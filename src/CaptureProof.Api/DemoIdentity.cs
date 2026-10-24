using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;

namespace CaptureProof.Api;

// Demonstration seam: replace this identity AND authorize business references server-side.
public interface IBusinessAuthorizer
{
    BusinessContext Authorize(string ownerId, string businessReference);
}
public sealed class DemoBusinessAuthorizer : IBusinessAuthorizer
{
    public BusinessContext Authorize(string ownerId, string businessReference)
    {
        Protocol.Require(!string.IsNullOrWhiteSpace(ownerId) && !string.IsNullOrWhiteSpace(businessReference) && businessReference.Length <= 100
            && businessReference.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_' or '.'), 400, "invalid_reference", "Référence de démonstration invalide.");
        return new("demo", businessReference);
    }
}
public sealed class DemoIdentity(IDataProtectionProvider provider, TimeProvider clock, IWebHostEnvironment environment)
{
    private readonly IDataProtector ownerProtector = provider.CreateProtector("CaptureProof.demo-owner.v1");
    private readonly IDataProtector phoneProtector = provider.CreateProtector("CaptureProof.phone.v1");
    private CookieOptions Cookie(HttpContext context) => new()
    {
        HttpOnly = true, Secure = !environment.IsDevelopment() || context.Request.IsHttps,
        SameSite = SameSiteMode.Strict, Path = "/", IsEssential = true
    };
    public Actor Read(HttpContext context)
    {
        string? owner = null;
        PhoneGrant? phone = null;
        try
        {
            if (context.Request.Cookies.TryGetValue("cp-owner", out var value))
            {
                var fields = ownerProtector.Unprotect(value).Split('|');
                if (fields.Length == 2 && Guid.TryParse(fields[0], out _) && long.TryParse(fields[1], out var expiry) && expiry > clock.GetUtcNow().ToUnixTimeSeconds()) owner = fields[0];
            }
        }
        catch (System.Security.Cryptography.CryptographicException) { }
        try
        {
            if (context.Request.Cookies.TryGetValue("cp-phone", out var value))
            {
                phone = JsonSerializer.Deserialize<PhoneGrant>(phoneProtector.Unprotect(value), Protocol.Json);
                if (phone?.ExpiresAt <= clock.GetUtcNow().ToUnixTimeSeconds()) phone = null;
            }
        }
        catch (Exception exception) when (exception is System.Security.Cryptography.CryptographicException or JsonException) { }
        return new(owner, phone);
    }
    public string EnsureOwner(HttpContext context)
    {
        var owner = Read(context).OwnerId;
        if (owner is not null) return owner;
        owner = Protocol.Id();
        context.Response.Cookies.Append("cp-owner", ownerProtector.Protect($"{owner}|{clock.GetUtcNow().AddHours(24).ToUnixTimeSeconds()}"), Cookie(context));
        return owner;
    }
    public void IssuePhone(HttpContext context, PhoneGrant grant) => context.Response.Cookies.Append("cp-phone", phoneProtector.Protect(JsonSerializer.Serialize(grant, Protocol.Json)), Cookie(context));
}
