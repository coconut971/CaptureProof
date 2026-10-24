using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;

namespace CaptureProof.Api;

public sealed record CapturePolicy(int MinPhotos = 1, int MaxPhotos = 3, long MaxBytesPerPhoto = 5 * 1024 * 1024, int SessionTtlSeconds = 600)
{
    public void Validate()
    {
        if (MinPhotos < 1 || MaxPhotos < MinPhotos || MaxPhotos > 32 || MaxBytesPerPhoto is < 1024 or > 25 * 1024 * 1024 || MaxBytesPerPhoto * MaxPhotos > 128 * 1024 * 1024 || SessionTtlSeconds is < 1 or > 86400)
            throw new InvalidOperationException("Politique de capture invalide.");
    }
}
public sealed class CaptureOptions
{
    public string PublicOrigin { get; set; } = "https://localhost:7443";
    public string DevelopmentOrigin { get; set; } = "http://localhost:5080";
    public string ViteDevelopmentOrigin { get; set; } = "http://localhost:5173";
    public string DataDirectory { get; set; } = ".data/captureproof";
    public int RetentionHours { get; set; } = 24;
    public int MaxSessionsPerOwner { get; set; } = 10;
    public int MaxSessions { get; set; } = 1000;
    public int MaxRequestsPerMinute { get; set; } = 150;
    public long MaxStoredBytes { get; set; } = 512 * 1024 * 1024;
    public Dictionary<string, CapturePolicy> Policies { get; set; } = new() { ["vinyl"] = new() };
    public void Validate()
    {
        var origin = new Uri(PublicOrigin, UriKind.Absolute);
        if (origin.Scheme != "https" || origin.AbsolutePath != "/" || origin.Query.Length != 0 || origin.Fragment.Length != 0 || origin.UserInfo.Length != 0)
            throw new InvalidOperationException("PublicOrigin doit être une origine HTTPS sans chemin.");
        if (RetentionHours is < 1 or > 720 || MaxSessions is < 1 or > 100000 || MaxSessionsPerOwner is < 1 or > 100 || MaxStoredBytes < 1024
            || MaxRequestsPerMinute is < 10 or > 10000)
            throw new InvalidOperationException("Limites de ressources invalides.");
        foreach (var policy in Policies.Values) policy.Validate();
        if (Policies.Count == 0 || Policies.Values.Any(p => p.SessionTtlSeconds > RetentionHours * 3600))
            throw new InvalidOperationException("La conservation doit couvrir toute la durée de session.");
    }
}
public sealed record BusinessContext(string IntegrationSpace, string BusinessReference);
public sealed record CreateSessionRequest(string Category, string BusinessReference, bool Direct);
public sealed record PairRequest(string SessionId, string Secret);
public sealed record ConfirmRequest(bool Accept);
public sealed record UploadRequest(string UploadId);
public sealed record PhoneGrant(string SessionId, string Version, long ExpiresAt);
public sealed record Actor(string? OwnerId, PhoneGrant? Phone);
public sealed record PhotoView(string Id, string Sha256, long Size, string ContentType, DateTimeOffset ReceivedAt, string Url, string UploadId);
public sealed record SessionView(string Id, string State, CapturePolicy Policy, BusinessContext Context, DateTimeOffset ExpiresAt, string? ConfirmationCode, bool Paired, PhotoView[] Photos, bool ReceiptAvailable);
public sealed record ReservationView(string UploadId, string Authorization, DateTimeOffset ExpiresAt);
public sealed class ApiFault(int status, string code, string message) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
}
public static class Protocol
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static string Token() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
    public static string Hash(string value) => Hash(Encoding.UTF8.GetBytes(value));
    public static string Hash(byte[] bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));
    public static string Id() => Guid.NewGuid().ToString();
    public static void Require(bool condition, int status, string code, string message)
    {
        if (!condition) throw new ApiFault(status, code, message);
    }
    public static bool EqualHash(string? expected, string token)
    {
        if (expected is null || token.Length > 256) return false;
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(Hash(token)));
    }
}
