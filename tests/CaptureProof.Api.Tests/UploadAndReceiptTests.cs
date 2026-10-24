using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Xunit;

namespace CaptureProof.Api.Tests;

public sealed class UploadAndReceiptTests : IsolatedApiTest
{
    [Fact]
    public async Task ConcurrentReservationsNeverExceedMaximumAndFinalizeWaitsForUploads()
    {
        using var phone = await Factory.NewClient();
        var id = (await phone.Create())["id"]!.GetValue<string>();
        await phone.Upload(id);
        await phone.Upload(id);
        var attempts = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ =>
            phone.Mutate("POST", $"/api/sessions/{id}/uploads", new { uploadId = Guid.NewGuid() })));
        var accepted = Assert.Single(attempts, response => response.IsSuccessStatusCode);
        var reservation = await ApiClient.ReadSuccess(accepted);
        Assert.Equal(7, attempts.Count(response => !response.IsSuccessStatusCode));
        using var prematureFinalization = await phone.Mutate("POST", $"/api/sessions/{id}/finalize");
        Assert.False(prematureFinalization.IsSuccessStatusCode);
        using var upload = await phone.Put(id, reservation, ApiClient.SyntheticJpeg());
        Assert.True(upload.IsSuccessStatusCode);
        var state = await phone.State(id);
        Assert.Equal(3, state["photos"]!.AsArray().Count);
        using var extra = await phone.Mutate("POST", $"/api/sessions/{id}/uploads", new { uploadId = Guid.NewGuid() });
        Assert.False(extra.IsSuccessStatusCode);
        using var finalize = await phone.Mutate("POST", $"/api/sessions/{id}/finalize");
        Assert.True(finalize.IsSuccessStatusCode);
        foreach (var response in attempts) response.Dispose();
    }

    [Fact]
    public async Task SameUploadIdAndBytesAreIdempotentButDifferentBytesAreRejected()
    {
        using var phone = await Factory.NewClient();
        var id = (await phone.Create())["id"]!.GetValue<string>();
        var authorization = await phone.Reserve(id);
        var bytes = ApiClient.SyntheticJpeg();
        using var first = await phone.Put(id, authorization, bytes);
        var result = await ApiClient.ReadSuccess(first);
        using var retry = await phone.Put(id, authorization, bytes);
        var repeated = await ApiClient.ReadSuccess(retry);
        Assert.Equal(result["id"]!.GetValue<string>(), repeated["id"]!.GetValue<string>());
        using var changed = await phone.Put(id, authorization, ApiClient.SyntheticJpeg(150));
        Assert.Equal(HttpStatusCode.Conflict, changed.StatusCode);
        Assert.Single((await phone.State(id))["photos"]!.AsArray());
        Assert.Equal(Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(), result["sha256"]!.GetValue<string>());
    }

    [Fact]
    public async Task ConcurrentRetriesOfSameUploadDoNotDuplicatePhoto()
    {
        using var phone = await Factory.NewClient();
        var id = (await phone.Create())["id"]!.GetValue<string>();
        var authorization = await phone.Reserve(id);
        var bytes = ApiClient.SyntheticJpeg();
        var uploads = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => phone.Put(id, authorization, bytes)));
        var results = await Task.WhenAll(uploads.Select(ApiClient.ReadSuccess));
        Assert.Single(results.Select(photo => photo["id"]!.GetValue<string>()).Distinct());
        Assert.Single((await phone.State(id))["photos"]!.AsArray());
        foreach (var response in uploads) response.Dispose();
    }

    [Fact]
    public async Task ExpiredUploadReservationIsReleasedAndCannotBeReused()
    {
        using var phone = await Factory.NewClient();
        var id = (await phone.Create())["id"]!.GetValue<string>();
        var reservations = new[] { await phone.Reserve(id), await phone.Reserve(id), await phone.Reserve(id) };
        Factory.Clock.Advance(TimeSpan.FromMinutes(3));
        using var expired = await phone.Put(id, reservations[0], ApiClient.SyntheticJpeg());
        Assert.False(expired.IsSuccessStatusCode);
        await phone.Upload(id);
        Assert.Single((await phone.State(id))["photos"]!.AsArray());
    }

    [Fact]
    public async Task LostReservationResponseCanBeReissuedWithoutOccupyingAnotherQuotaSlot()
    {
        using var phone = await Factory.NewClient();
        var id = (await phone.Create())["id"]!.GetValue<string>();
        var uploadId = Guid.NewGuid().ToString();
        var lostResponse = await phone.Reserve(id, uploadId);
        var recovered = await phone.Reserve(id, uploadId);
        Assert.NotEqual(lostResponse["authorization"]!.GetValue<string>(), recovered["authorization"]!.GetValue<string>());
        using var stale = await phone.Put(id, lostResponse, ApiClient.SyntheticJpeg());
        Assert.Equal(HttpStatusCode.Forbidden, stale.StatusCode);
        using var accepted = await phone.Put(id, recovered, ApiClient.SyntheticJpeg());
        Assert.True(accepted.IsSuccessStatusCode);
        await phone.Upload(id);
        await phone.Upload(id);
        Assert.Equal(3, (await phone.State(id))["photos"]!.AsArray().Count);
        using var extra = await phone.Mutate("POST", $"/api/sessions/{id}/uploads", new { uploadId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.Conflict, extra.StatusCode);
    }

    [Fact]
    public async Task ExpiredReservationCanBeRenewedWithSameUploadIdAndOnlyNewTokenWorks()
    {
        using var phone = await Factory.NewClient();
        var id = (await phone.Create())["id"]!.GetValue<string>();
        var uploadId = Guid.NewGuid().ToString();
        var expired = await phone.Reserve(id, uploadId);
        Factory.Clock.Advance(TimeSpan.FromMinutes(3));
        var renewed = await phone.Reserve(id, uploadId);
        Assert.Equal(uploadId, renewed["uploadId"]!.GetValue<string>());
        Assert.True(renewed["expiresAt"]!.GetValue<DateTimeOffset>() > expired["expiresAt"]!.GetValue<DateTimeOffset>());
        using var stale = await phone.Put(id, expired, ApiClient.SyntheticJpeg());
        Assert.Equal(HttpStatusCode.Forbidden, stale.StatusCode);
        using var first = await phone.Put(id, renewed, ApiClient.SyntheticJpeg());
        var accepted = await ApiClient.ReadSuccess(first);
        using var retry = await phone.Put(id, renewed, ApiClient.SyntheticJpeg());
        Assert.Equal(accepted["id"]!.GetValue<string>(), (await ApiClient.ReadSuccess(retry))["id"]!.GetValue<string>());
        Assert.Single((await phone.State(id))["photos"]!.AsArray());
    }

    [Fact]
    public async Task ConsumedUploadCannotBeReservedAgainAfterAuthorizationExpires()
    {
        using var phone = await Factory.NewClient();
        var id = (await phone.Create())["id"]!.GetValue<string>();
        var reservation = await phone.Reserve(id);
        using var put = await phone.Put(id, reservation, ApiClient.SyntheticJpeg());
        Assert.True(put.IsSuccessStatusCode);
        Factory.Clock.Advance(TimeSpan.FromMinutes(3));
        using var reserve = await phone.Mutate("POST", $"/api/sessions/{id}/uploads", new { uploadId = reservation["uploadId"]!.GetValue<string>() });
        Assert.Equal(HttpStatusCode.Conflict, reserve.StatusCode);
        using var expiredPut = await phone.Put(id, reservation, ApiClient.SyntheticJpeg());
        Assert.Equal(HttpStatusCode.Forbidden, expiredPut.StatusCode);
        Assert.Single((await phone.State(id))["photos"]!.AsArray());
        using var finalize = await phone.Mutate("POST", $"/api/sessions/{id}/finalize");
        Assert.True(finalize.IsSuccessStatusCode);
    }

    [Fact]
    public async Task CancelledDirectSessionRefusesAllPhotoMutations()
    {
        using var phone = await Factory.NewClient();
        var id = (await phone.Create())["id"]!.GetValue<string>();
        var photo = await phone.Upload(id);
        using var cancel = await phone.Mutate("POST", $"/api/sessions/{id}/cancel");
        Assert.True(cancel.IsSuccessStatusCode);
        using var reserve = await phone.Mutate("POST", $"/api/sessions/{id}/uploads", new { uploadId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.Conflict, reserve.StatusCode);
        using var delete = await phone.Mutate("DELETE", $"/api/sessions/{id}/photos/{photo["id"]!.GetValue<string>()}");
        Assert.Equal(HttpStatusCode.Conflict, delete.StatusCode);
        using var finalize = await phone.Mutate("POST", $"/api/sessions/{id}/finalize");
        Assert.Equal(HttpStatusCode.Conflict, finalize.StatusCode);
        Assert.Equal("Cancelled", (await phone.State(id))["state"]!.GetValue<string>());
    }

    [Fact]
    public async Task SyntheticJpegIsAcceptedByAuthorizedClientAndOriginalBytesArePreserved()
    {
        using var phone = await Factory.NewClient();
        var id = (await phone.Create())["id"]!.GetValue<string>();
        var syntheticJpeg = ApiClient.SyntheticJpeg();
        var photo = await phone.Upload(id, syntheticJpeg);
        var photoId = photo["id"]!.GetValue<string>();
        using var download = await phone.Http.GetAsync($"/api/sessions/{id}/photos/{photoId}");
        Assert.True(download.IsSuccessStatusCode);
        Assert.Equal(syntheticJpeg, await download.Content.ReadAsByteArrayAsync());
        using var finalize = await phone.Mutate("POST", $"/api/sessions/{id}/finalize");
        var receipt = await ApiClient.ReadSuccess(finalize);
        var payload = DecodePayload(receipt["jws"]!.GetValue<string>());
        Assert.False(payload["guarantees"]!["hardwareCameraAttested"]!.GetValue<bool>());
        Assert.False(payload["guarantees"]!["aiOriginAssessed"]!.GetValue<bool>());
        Assert.True(payload["guarantees"]!["integrity"]!.GetValue<bool>());
        var interopDirectory = Environment.GetEnvironmentVariable("CAPTUREPROOF_INTEROP_DIR");
        if (!string.IsNullOrWhiteSpace(interopDirectory))
        {
            Directory.CreateDirectory(interopDirectory);
            await File.WriteAllTextAsync(Path.Combine(interopDirectory, "receipt.jws"), receipt["jws"]!.GetValue<string>());
            await File.WriteAllTextAsync(Path.Combine(interopDirectory, "trusted-public.jwks.json"), await phone.Http.GetStringAsync("/api/keys"));
            await File.WriteAllBytesAsync(Path.Combine(interopDirectory, photoId + ".jpg"), syntheticJpeg);
        }
    }

    [Fact]
    public async Task FormatSpoofingTruncatedJpegAndOversizedBodiesAreRejected()
    {
        using var phone = await Factory.NewClient();
        var id = (await phone.Create())["id"]!.GetValue<string>();
        var authorization = await phone.Reserve(id);
        foreach (var bytes in new[] { Encoding.UTF8.GetBytes("<svg xmlns='http://www.w3.org/2000/svg'/>"), new byte[] { 255, 216, 255, 217 } })
        {
            using var invalid = await phone.Put(id, authorization, bytes);
            Assert.False(invalid.IsSuccessStatusCode);
        }
        using var wrongContentType = await phone.Mutate("PUT", $"/api/sessions/{id}/uploads/{authorization["uploadId"]!.GetValue<string>()}",
            bytes: ApiClient.SyntheticJpeg(), authorization: authorization["authorization"]!.GetValue<string>(), contentType: "image/svg+xml");
        Assert.False(wrongContentType.IsSuccessStatusCode);
        using var excessive = await phone.Put(id, authorization, new byte[5 * 1024 * 1024 + 1]);
        Assert.False(excessive.IsSuccessStatusCode);
        using var dimensions = await phone.Put(id, authorization, ApiClient.SyntheticJpeg(width: 9000, height: 1));
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, dimensions.StatusCode);
        Assert.Empty((await phone.State(id))["photos"]!.AsArray());
    }

    [Fact]
    public async Task UploadAuthorizationCannotBeReusedForAnotherSessionOrUploadId()
    {
        using var first = await Factory.NewClient();
        using var second = await Factory.NewClient();
        var firstId = (await first.Create())["id"]!.GetValue<string>();
        var secondId = (await second.Create())["id"]!.GetValue<string>();
        var firstReservation = await first.Reserve(firstId);
        var secondReservation = await second.Reserve(secondId);
        using var wrongSession = await second.Mutate("PUT", $"/api/sessions/{secondId}/uploads/{secondReservation["uploadId"]!.GetValue<string>()}",
            bytes: ApiClient.SyntheticJpeg(), authorization: firstReservation["authorization"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.Forbidden, wrongSession.StatusCode);
        using var wrongUploadId = await first.Mutate("PUT", $"/api/sessions/{firstId}/uploads/{Guid.NewGuid()}",
            bytes: ApiClient.SyntheticJpeg(), authorization: firstReservation["authorization"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.Forbidden, wrongUploadId.StatusCode);
        Assert.Empty((await first.State(firstId))["photos"]!.AsArray());
        Assert.Empty((await second.State(secondId))["photos"]!.AsArray());
    }

    [Fact]
    public async Task DeleteBeforeFinalizationReleasesQuotaAndFinalizedSessionIsImmutable()
    {
        using var phone = await Factory.NewClient();
        var id = (await phone.Create())["id"]!.GetValue<string>();
        var original = await phone.Upload(id);
        var originalId = original["id"]!.GetValue<string>();
        using var deletion = await phone.Mutate("DELETE", $"/api/sessions/{id}/photos/{originalId}");
        Assert.True(deletion.IsSuccessStatusCode);
        Assert.Empty((await phone.State(id))["photos"]!.AsArray());
        using var min = await phone.Mutate("POST", $"/api/sessions/{id}/finalize");
        Assert.False(min.IsSuccessStatusCode);
        var photoId = (await phone.Upload(id))["id"]!.GetValue<string>();
        using var first = await phone.Mutate("POST", $"/api/sessions/{id}/finalize");
        var receipt = await ApiClient.ReadSuccess(first);
        using var retry = await phone.Mutate("POST", $"/api/sessions/{id}/finalize");
        Assert.Equal(receipt["jws"]!.GetValue<string>(), (await ApiClient.ReadSuccess(retry))["jws"]!.GetValue<string>());
        foreach (var action in new[] { "uploads", "invitation", "cancel" })
        {
            using var response = await phone.Mutate("POST", $"/api/sessions/{id}/{action}", new { uploadId = Guid.NewGuid() });
            Assert.False(response.IsSuccessStatusCode);
        }
        using var after = await phone.Mutate("DELETE", $"/api/sessions/{id}/photos/{photoId}");
        Assert.False(after.IsSuccessStatusCode);
    }

    [Fact]
    public async Task ReceiptAndSigningKeySurviveApplicationRestart()
    {
        var clock = new TestClock();
        var firstFactory = new ApiFactory(DataDirectory, clock);
        var cookies = new CookieContainer();
        string jws;
        string keys;
        string id;
        using (var phone = await firstFactory.NewClient(cookies))
        {
            id = (await phone.Create())["id"]!.GetValue<string>();
            await phone.Upload(id);
            using var finalize = await phone.Mutate("POST", $"/api/sessions/{id}/finalize");
            jws = (await ApiClient.ReadSuccess(finalize))["jws"]!.GetValue<string>();
            keys = await phone.Http.GetStringAsync("/api/keys");
        }
        await firstFactory.DisposeAsync();
        await using var restartedFactory = new ApiFactory(DataDirectory, clock);
        using var recovered = await restartedFactory.NewClient(cookies);
        using var repeated = await recovered.Mutate("POST", $"/api/sessions/{id}/finalize");
        Assert.Equal(jws, (await ApiClient.ReadSuccess(repeated))["jws"]!.GetValue<string>());
        Assert.Equal(keys, await recovered.Http.GetStringAsync("/api/keys"));
        var manifest = DecodePayload(jws);
        Assert.Equal(id, manifest["sessionId"]!.GetValue<string>());
        Assert.Equal("TEST-001", manifest["context"]!["businessReference"]!.GetValue<string>());
        Assert.Equal(1, manifest["photoCount"]!.GetValue<int>());
        Assert.Equal("ES256", DecodeSegment(jws.Split('.')[0])["alg"]!.GetValue<string>());
    }

    private static JsonObject DecodePayload(string jws) => DecodeSegment(jws.Split('.')[1]);

    private static JsonObject DecodeSegment(string segment)
    {
        var text = segment.Replace('-', '+').Replace('_', '/');
        text = text.PadRight((text.Length + 3) / 4 * 4, '=');
        return JsonNode.Parse(Convert.FromBase64String(text))!.AsObject();
    }
}

public sealed class ExactPhotoPolicyTests : IsolatedApiTest
{
    protected override IReadOnlyDictionary<string, string?> Configuration => new Dictionary<string, string?>
    {
        ["CaptureProof:Policies:vinyl:MinPhotos"] = "3",
        ["CaptureProof:Policies:vinyl:MaxPhotos"] = "3",
    };

    [Fact]
    public async Task TrustedServerPolicyRequiresExactlyThreePhotosDespiteClientOverrides()
    {
        using var phone = await Factory.NewClient();
        using var creation = await phone.Mutate("POST", "/api/sessions", new
        {
            category = "vinyl", businessReference = "EXACT-3", direct = true,
            minPhotos = 0, maxPhotos = 99, policy = new { minPhotos = 0, maxPhotos = 99 }
        });
        var session = await ApiClient.ReadSuccess(creation);
        Assert.Equal(3, session["policy"]!["minPhotos"]!.GetValue<int>());
        Assert.Equal(3, session["policy"]!["maxPhotos"]!.GetValue<int>());
        var id = session["id"]!.GetValue<string>();
        await phone.Upload(id);
        await phone.Upload(id);
        using var premature = await phone.Mutate("POST", $"/api/sessions/{id}/finalize");
        Assert.False(premature.IsSuccessStatusCode);
        var thirdPhoto = await phone.Upload(id);
        using var extra = await phone.Mutate("POST", $"/api/sessions/{id}/uploads", new { uploadId = Guid.NewGuid() });
        Assert.False(extra.IsSuccessStatusCode);
        using var deletion = await phone.Mutate("DELETE", $"/api/sessions/{id}/photos/{thirdPhoto["id"]!.GetValue<string>()}");
        Assert.True(deletion.IsSuccessStatusCode);
        using var afterDelete = await phone.Mutate("POST", $"/api/sessions/{id}/finalize");
        Assert.False(afterDelete.IsSuccessStatusCode);
        await phone.Upload(id);
        Assert.Equal(3, (await phone.State(id))["photos"]!.AsArray().Count);
        using var finalize = await phone.Mutate("POST", $"/api/sessions/{id}/finalize");
        Assert.True(finalize.IsSuccessStatusCode);
    }
}
