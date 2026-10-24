using System.Net;
using Xunit;

namespace CaptureProof.Api.Tests;

public sealed class ResourceQuotaTests : IsolatedApiTest
{
    protected override IReadOnlyDictionary<string, string?> Configuration => new Dictionary<string, string?>
    {
        ["CaptureProof:MaxSessionsPerOwner"] = "1",
        ["CaptureProof:MaxSessions"] = "2",
        ["CaptureProof:MaxStoredBytes"] = "2048",
        ["CaptureProof:Policies:vinyl:MaxBytesPerPhoto"] = "1024",
    };

    [Fact]
    public async Task PerOwnerAndGlobalSessionLimitsAreEnforced()
    {
        using var firstOwner = await Factory.NewClient();
        using var secondOwner = await Factory.NewClient();
        using var thirdOwner = await Factory.NewClient();
        await firstOwner.Create();
        using var ownerQuota = await firstOwner.Mutate("POST", "/api/sessions", new { category = "vinyl", businessReference = "EXTRA", direct = true });
        Assert.Equal(HttpStatusCode.TooManyRequests, ownerQuota.StatusCode);
        await secondOwner.Create();
        using var globalQuota = await thirdOwner.Mutate("POST", "/api/sessions", new { category = "vinyl", businessReference = "EXTRA", direct = true });
        Assert.Equal(HttpStatusCode.TooManyRequests, globalQuota.StatusCode);
    }

    [Fact]
    public async Task GlobalByteBudgetSerializesConcurrentReservationsAcrossSessions()
    {
        using var first = await Factory.NewClient();
        using var second = await Factory.NewClient();
        var firstId = (await first.Create())["id"]!.GetValue<string>();
        var secondId = (await second.Create())["id"]!.GetValue<string>();
        await first.Reserve(firstId);
        var results = await Task.WhenAll(
            first.Mutate("POST", $"/api/sessions/{firstId}/uploads", new { uploadId = Guid.NewGuid() }),
            second.Mutate("POST", $"/api/sessions/{secondId}/uploads", new { uploadId = Guid.NewGuid() }));
        Assert.Single(results, response => response.IsSuccessStatusCode);
        Assert.Single(results, response => response.StatusCode == HttpStatusCode.InsufficientStorage);
        foreach (var result in results) result.Dispose();
    }
}
