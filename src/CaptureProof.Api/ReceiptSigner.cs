using System.Security.Cryptography;
using System.Text.Json;
using Jose;
using Microsoft.AspNetCore.WebUtilities;

namespace CaptureProof.Api;

public sealed class ReceiptSigner : IDisposable
{
    private readonly ECDsa key;
    public string Kid { get; }
    public string KeyDirectory { get; }
    public ReceiptSigner(CaptureOptions options)
    {
        KeyDirectory = Path.Combine(options.DataDirectory, "signing");
        Directory.CreateDirectory(KeyDirectory);
        var privatePath = Path.Combine(KeyDirectory, "active-private.pem");
        if (!File.Exists(privatePath)) Generate(KeyDirectory);
        key = ECDsa.Create();
        key.ImportFromPem(File.ReadAllText(privatePath));
        Kid = PublicKey(key).Kid;
        WritePublic(KeyDirectory, key);
    }
    public string Sign(string exactPayload)
    {
        lock (key)
            return JWT.Encode(exactPayload, key, JwsAlgorithm.ES256, new Dictionary<string, object> { ["typ"] = "captureproof-receipt+jws", ["kid"] = Kid });
    }
    public object Keys() => new { keys = Directory.GetFiles(KeyDirectory, "public-*.json").Order().Select(path => JsonSerializer.Deserialize<JsonElement>(File.ReadAllText(path))).ToArray() };
    private sealed record PublicJwk(string Kty, string Crv, string X, string Y, string Kid, string Alg, string Use);
    private static PublicJwk PublicKey(ECDsa signingKey)
    {
        var p = signingKey.ExportParameters(false);
        var x = WebEncoders.Base64UrlEncode(p.Q.X!);
        var y = WebEncoders.Base64UrlEncode(p.Q.Y!);
        var kid = Protocol.Hash(signingKey.ExportSubjectPublicKeyInfo())[..24];
        return new("EC", "P-256", x, y, kid, "ES256", "sig");
    }
    private static void WritePublic(string directory, ECDsa signingKey)
    {
        var jwk = PublicKey(signingKey);
        File.WriteAllText(Path.Combine(directory, $"public-{jwk.Kid}.json"), JsonSerializer.Serialize(jwk, Protocol.Json));
    }
    public static void Generate(string directory)
    {
        Directory.CreateDirectory(directory);
        using var signingKey = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        // Operator performs rotation only while the service is stopped.
        WritePublic(directory, signingKey);
        var path = Path.Combine(directory, "active-private.pem");
        File.WriteAllText(path + ".new", signingKey.ExportPkcs8PrivateKeyPem());
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(path + ".new", UnixFileMode.UserRead | UnixFileMode.UserWrite);
        File.Move(path + ".new", path, true);
    }
    public void Dispose() => key.Dispose();
}
