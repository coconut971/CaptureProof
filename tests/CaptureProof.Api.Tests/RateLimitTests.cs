using System.Net;
using CaptureProof.Api;
using Xunit;

namespace CaptureProof.Api.Tests;

public sealed class RateLimitTests : IsolatedApiTest
{
    protected override IReadOnlyDictionary<string, string?> Configuration => new Dictionary<string, string?>
    {
        ["CaptureProof:MaxRequestsPerMinute"] = "10",
    };

    [Fact]
    public async Task ConfiguredRequestBudgetStillRejectsTrafficAfterItsLimit()
    {
        using var client = await Factory.NewClient(); // Bootstrap consumes one request.
        for (var count = 0; count < 9; count++)
        {
            using var allowed = await client.Http.GetAsync("/api/health");
            Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        }
        using var rejected = await client.Http.GetAsync("/api/health");
        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(9)]
    [InlineData(10001)]
    public void RequestBudgetCannotDisableProtectionOrGrowWithoutBound(int maximum)
    {
        var options = new CaptureOptions { MaxRequestsPerMinute = maximum };
        Assert.Throws<InvalidOperationException>(options.Validate);
        Assert.Equal(150, new CaptureOptions().MaxRequestsPerMinute);
    }
}
