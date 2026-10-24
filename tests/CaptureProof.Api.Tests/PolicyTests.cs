using Xunit;

namespace CaptureProof.Api.Tests;

public sealed class PolicyTests
{
    [Theory]
    [InlineData(0, 3, 1024, 60)]
    [InlineData(3, 2, 1024, 60)]
    [InlineData(1, 33, 1024, 60)]
    [InlineData(1, 3, 1023, 60)]
    [InlineData(1, 3, 26214401, 60)]
    [InlineData(1, 3, 1024, 0)]
    [InlineData(1, 3, 1024, 86401)]
    public void InvalidPoliciesAreRejectedAtStartup(int minimum, int maximum, long bytes, int ttl) =>
        Assert.Throws<InvalidOperationException>(() => new CapturePolicy(minimum, maximum, bytes, ttl).Validate());

    [Theory]
    [InlineData(1, 3)]
    [InlineData(3, 3)]
    public void PolicySupportsRangeAndExactPhotoCount(int minimum, int maximum) =>
        new CapturePolicy(minimum, maximum).Validate();

    [Fact]
    public void RetentionMustCoverEverySessionLifetime()
    {
        var options = new CaptureOptions { RetentionHours = 1, Policies = new() { ["long"] = new(SessionTtlSeconds: 3601) } };
        Assert.Throws<InvalidOperationException>(options.Validate);
    }
}
