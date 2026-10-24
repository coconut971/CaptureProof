using System.Net;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Xunit;

namespace CaptureProof.Api.Tests;

public sealed class PairingAndAuthorizationTests : IsolatedApiTest
{
    [Fact]
    public async Task PairingIsOneUseAndRequiresExplicitOwnerConfirmation()
    {
        using var owner = await Factory.NewClient();
        using var phone = await Factory.NewClient();
        using var otherPhone = await Factory.NewClient();
        var session = await owner.Create(direct: false);
        var id = session["id"]!.GetValue<string>();
        var invitation = await Invitation(owner, id);
        Assert.StartsWith(ApiFactory.Origin + "/capture/", invitation["url"]!.GetValue<string>());
        var secret = Secret(invitation);

        using var first = await phone.Mutate("POST", "/api/pair", new { sessionId = id, secret });
        var pending = await ApiClient.ReadSuccess(first);
        Assert.Equal("PendingConfirmation", pending["state"]!.GetValue<string>());
        var ownerPending = await owner.State(id);
        Assert.False(string.IsNullOrWhiteSpace(pending["confirmationCode"]!.GetValue<string>()));
        Assert.Equal(ownerPending["confirmationCode"]!.GetValue<string>(), pending["confirmationCode"]!.GetValue<string>());
        using var repeated = await otherPhone.Mutate("POST", "/api/pair", new { sessionId = id, secret });
        Assert.False(repeated.IsSuccessStatusCode);
        using var premature = await phone.Mutate("POST", $"/api/sessions/{id}/uploads", new { uploadId = Guid.NewGuid() });
        Assert.False(premature.IsSuccessStatusCode);
        using var unauthorizedConfirm = await phone.Mutate("POST", $"/api/sessions/{id}/confirm", new { accept = true });
        AssertAccessDenied(unauthorizedConfirm);
        using var confirm = await owner.Mutate("POST", $"/api/sessions/{id}/confirm", new { accept = true });
        Assert.True(confirm.IsSuccessStatusCode);
        Assert.Equal("Capturing", (await phone.State(id))["state"]!.GetValue<string>());
        using var ownerUpload = await owner.Mutate("POST", $"/api/sessions/{id}/uploads", new { uploadId = Guid.NewGuid() });
        AssertAccessDenied(ownerUpload);
        await phone.Upload(id);
    }

    [Fact]
    public async Task TwoPhonesCannotConsumeTheSameInvitationConcurrently()
    {
        using var owner = await Factory.NewClient();
        using var phone1 = await Factory.NewClient();
        using var phone2 = await Factory.NewClient();
        var id = (await owner.Create(direct: false))["id"]!.GetValue<string>();
        var secret = Secret(await Invitation(owner, id));
        var results = await Task.WhenAll(phone1.Mutate("POST", "/api/pair", new { sessionId = id, secret }),
            phone2.Mutate("POST", "/api/pair", new { sessionId = id, secret }));
        Assert.Single(results, response => response.IsSuccessStatusCode);
        Assert.Single(results, response => !response.IsSuccessStatusCode);
        foreach (var response in results) response.Dispose();
    }

    [Fact]
    public async Task ExpiredInvitationAndSessionCannotBeUsed()
    {
        using var owner = await Factory.NewClient();
        using var phone = await Factory.NewClient();
        var id = (await owner.Create(direct: false))["id"]!.GetValue<string>();
        var secret = Secret(await Invitation(owner, id));
        Factory.Clock.Advance(TimeSpan.FromMinutes(11));
        using var expired = await phone.Mutate("POST", "/api/pair", new { sessionId = id, secret });
        Assert.False(expired.IsSuccessStatusCode);
        using var reservation = await owner.Mutate("POST", $"/api/sessions/{id}/uploads", new { uploadId = Guid.NewGuid() });
        Assert.False(reservation.IsSuccessStatusCode);
        var state = await owner.State(id);
        Assert.Equal("Expired", state["state"]!.GetValue<string>());
    }

    [Fact]
    public async Task RegeneratingInvitationRevokesPreviousPhoneRights()
    {
        using var owner = await Factory.NewClient();
        using var phone = await Factory.NewClient();
        using var nextPhone = await Factory.NewClient();
        var id = (await owner.Create(direct: false))["id"]!.GetValue<string>();
        var oldSecret = Secret(await Invitation(owner, id));
        using var pair = await phone.Mutate("POST", "/api/pair", new { sessionId = id, secret = oldSecret });
        Assert.True(pair.IsSuccessStatusCode);
        using var confirmation = await owner.Mutate("POST", $"/api/sessions/{id}/confirm", new { accept = true });
        Assert.True(confirmation.IsSuccessStatusCode);
        var newSecret = Secret(await Invitation(owner, id));
        Assert.NotEqual(oldSecret, newSecret);
        using var oldState = await phone.Http.GetAsync($"/api/sessions/{id}");
        AssertAccessDenied(oldState);
        using var replay = await nextPhone.Mutate("POST", "/api/pair", new { sessionId = id, secret = oldSecret });
        Assert.False(replay.IsSuccessStatusCode);
        using var next = await nextPhone.Mutate("POST", "/api/pair", new { sessionId = id, secret = newSecret });
        Assert.True(next.IsSuccessStatusCode);
    }

    [Fact]
    public async Task OwnerRejectionAndCancellationBlockPhoneMutations()
    {
        using var owner = await Factory.NewClient();
        using var phone = await Factory.NewClient();
        var id = (await owner.Create(direct: false))["id"]!.GetValue<string>();
        var secret = Secret(await Invitation(owner, id));
        using var pair = await phone.Mutate("POST", "/api/pair", new { sessionId = id, secret });
        Assert.True(pair.IsSuccessStatusCode);
        using var reject = await owner.Mutate("POST", $"/api/sessions/{id}/confirm", new { accept = false });
        Assert.True(reject.IsSuccessStatusCode);
        using var reservation = await phone.Mutate("POST", $"/api/sessions/{id}/uploads", new { uploadId = Guid.NewGuid() });
        Assert.False(reservation.IsSuccessStatusCode);
        using var cancel = await owner.Mutate("POST", $"/api/sessions/{id}/cancel");
        Assert.True(cancel.IsSuccessStatusCode);
        Assert.Equal("Cancelled", (await owner.State(id))["state"]!.GetValue<string>());
        using var invitation = await owner.Mutate("POST", $"/api/sessions/{id}/invitation");
        Assert.False(invitation.IsSuccessStatusCode);
    }

    [Fact]
    public async Task OtherOwnerCannotReadMutateDownloadOrSubscribeToKnownSession()
    {
        using var owner = await Factory.NewClient();
        using var stranger = await Factory.NewClient();
        var id = (await owner.Create())["id"]!.GetValue<string>();
        var photoId = (await owner.Upload(id))["id"]!.GetValue<string>();
        foreach (var path in new[] { $"/api/sessions/{id}", $"/api/sessions/{id}/receipt", $"/api/sessions/{id}/photos/{photoId}" })
        {
            using var response = await stranger.Http.GetAsync(path);
            AssertAccessDenied(response);
        }
        foreach (var action in new[] { "invitation", "cancel", "finalize", "uploads" })
        {
            using var response = await stranger.Mutate("POST", $"/api/sessions/{id}/{action}", new { uploadId = Guid.NewGuid() });
            AssertAccessDenied(response);
        }
        using var delete = await stranger.Mutate("DELETE", $"/api/sessions/{id}/photos/{photoId}");
        AssertAccessDenied(delete);

        await using var hub = new HubConnectionBuilder().WithUrl(ApiFactory.Origin + "/hubs/capture", options =>
        {
            options.Transports = HttpTransportType.LongPolling;
            options.Cookies = stranger.Cookies;
            options.HttpMessageHandlerFactory = _ => new CookieHandler(stranger.Cookies) { InnerHandler = Factory.Server.CreateHandler() };
        }).Build();
        await hub.StartAsync();
        await Assert.ThrowsAsync<HubException>(() => hub.InvokeAsync("Subscribe", id));
    }

    [Fact]
    public async Task MissingCsrfAndForeignOriginAreRejected()
    {
        using var owner = await Factory.NewClient();
        using var withoutCsrf = new HttpRequestMessage(HttpMethod.Post, "/api/sessions")
        {
            Content = System.Net.Http.Json.JsonContent.Create(new { category = "vinyl", businessReference = "BAD", direct = true })
        };
        withoutCsrf.Headers.Add("Origin", ApiFactory.Origin);
        using var missingResponse = await owner.Http.SendAsync(withoutCsrf);
        AssertAccessDenied(missingResponse);
        using var foreign = new HttpRequestMessage(HttpMethod.Post, "/api/sessions")
        {
            Content = System.Net.Http.Json.JsonContent.Create(new { category = "vinyl", businessReference = "BAD", direct = true })
        };
        foreign.Headers.Add("Origin", "https://untrusted.invalid");
        foreign.Headers.Add("X-CSRF-TOKEN", owner.CsrfToken);
        using var foreignResponse = await owner.Http.SendAsync(foreign);
        AssertAccessDenied(foreignResponse);
    }

    [Fact]
    public async Task OversizedJsonIsRejectedBeforeSessionCreation()
    {
        using var owner = await Factory.NewClient();
        using var response = await owner.Mutate("POST", "/api/sessions", new
        {
            category = "vinyl", businessReference = "TEST", direct = true, padding = new string('x', 20000)
        });
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        using var sessions = await owner.Http.GetAsync("/api/sessions");
        Assert.Equal("[]", await sessions.Content.ReadAsStringAsync());
    }

    private static async Task<JsonObject> Invitation(ApiClient owner, string id)
    {
        using var response = await owner.Mutate("POST", $"/api/sessions/{id}/invitation");
        return await ApiClient.ReadSuccess(response);
    }

    private static string Secret(JsonObject invitation) =>
        Uri.UnescapeDataString(new Uri(invitation["url"]!.GetValue<string>()).Fragment["#invite=".Length..]);

    private static void AssertAccessDenied(HttpResponseMessage response) =>
        Assert.True(response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden or HttpStatusCode.NotFound,
            $"Expected access denied, got {(int)response.StatusCode}");
}
