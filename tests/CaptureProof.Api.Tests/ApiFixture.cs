using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Hosting;
using SkiaSharp;
using Xunit;

namespace CaptureProof.Api.Tests;

internal sealed class TestClock : TimeProvider
{
    private DateTimeOffset now = DateTimeOffset.UtcNow;
    public override DateTimeOffset GetUtcNow() => now;
    public void Advance(TimeSpan duration) => now += duration;
}

internal sealed class ApiFactory : WebApplicationFactory<Program>
{
    public const string Origin = "https://localhost:7443";
    private readonly string dataDirectory;
    private readonly IReadOnlyDictionary<string, string?> overrides;
    public TestClock Clock { get; }

    public ApiFactory(string dataDirectory, TestClock? clock = null,
        IReadOnlyDictionary<string, string?>? overrides = null)
    {
        this.dataDirectory = dataDirectory;
        this.overrides = overrides ?? new Dictionary<string, string?>();
        Clock = clock ?? new TestClock();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(Settings()));
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
        });
        builder.ConfigureLogging(logging => logging.ClearProviders());
    }

    // Minimal hosting reads the data directory before Build; seed host configuration early.
    protected override IHost CreateHost(IHostBuilder builder)
    {
        builder.ConfigureHostConfiguration(configuration => configuration.AddInMemoryCollection(Settings()));
        return base.CreateHost(builder);
    }

    private Dictionary<string, string?> Settings()
    {
        var settings = new Dictionary<string, string?>
            {
                ["CaptureProof:DataDirectory"] = dataDirectory,
                ["CaptureProof:PublicOrigin"] = Origin,
                ["CaptureProof:Policies:vinyl:MinPhotos"] = "1",
                ["CaptureProof:Policies:vinyl:MaxPhotos"] = "3",
                ["CaptureProof:Policies:vinyl:MaxBytesPerPhoto"] = "5242880",
                ["CaptureProof:Policies:vinyl:SessionTtlSeconds"] = "600",
        };
        foreach (var entry in overrides) settings[entry.Key] = entry.Value;
        return settings;
    }

    public async Task<ApiClient> NewClient(CookieContainer? cookies = null)
    {
        var client = new ApiClient(this, cookies ?? new CookieContainer());
        await client.Bootstrap();
        return client;
    }
}

internal sealed class CookieHandler(CookieContainer cookies) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var uri = request.RequestUri!;
        var cookie = cookies.GetCookieHeader(uri);
        if (cookie.Length > 0) request.Headers.TryAddWithoutValidation("Cookie", cookie);
        var response = await base.SendAsync(request, cancellationToken);
        if (response.Headers.TryGetValues("Set-Cookie", out var values))
            foreach (var value in values) cookies.SetCookies(uri, value);
        return response;
    }
}

internal sealed class ApiClient : IDisposable
{
    public HttpClient Http { get; }
    public CookieContainer Cookies { get; }
    public string CsrfToken { get; private set; } = "";

    public ApiClient(ApiFactory factory, CookieContainer cookies)
    {
        Cookies = cookies;
        Http = new HttpClient(new CookieHandler(cookies) { InnerHandler = factory.Server.CreateHandler() })
        {
            BaseAddress = new Uri(ApiFactory.Origin)
        };
    }

    public async Task Bootstrap()
    {
        using var response = await Http.GetAsync("/api/bootstrap");
        var json = await ReadSuccess(response);
        CsrfToken = json["csrfToken"]!.GetValue<string>();
    }

    public Task<HttpResponseMessage> Mutate(string method, string path, object? payload = null,
        byte[]? bytes = null, string? authorization = null, string contentType = "image/jpeg")
    {
        var request = new HttpRequestMessage(new HttpMethod(method), path);
        request.Headers.Add("Origin", ApiFactory.Origin);
        request.Headers.Add("X-CSRF-TOKEN", CsrfToken);
        if (authorization is not null) request.Headers.Add("X-Upload-Authorization", authorization);
        request.Content = bytes is null ? JsonContent.Create(payload ?? new { }) : new ByteArrayContent(bytes);
        if (bytes is not null) request.Content.Headers.ContentType = new(contentType);
        return Http.SendAsync(request);
    }

    public async Task<JsonObject> Create(bool direct = true, string reference = "TEST-001")
    {
        using var response = await Mutate("POST", "/api/sessions", new
        {
            category = "vinyl", businessReference = reference, direct
        });
        return await ReadSuccess(response);
    }

    public async Task<JsonObject> Reserve(string sessionId, string? uploadId = null)
    {
        using var response = await Mutate("POST", $"/api/sessions/{sessionId}/uploads",
            new { uploadId = uploadId ?? Guid.NewGuid().ToString() });
        return await ReadSuccess(response);
    }

    public async Task<JsonObject> Upload(string sessionId, byte[]? bytes = null)
    {
        var authorization = await Reserve(sessionId);
        using var response = await Put(sessionId, authorization, bytes ?? SyntheticJpeg());
        return await ReadSuccess(response);
    }

    public Task<HttpResponseMessage> Put(string sessionId, JsonObject reservation, byte[] bytes) =>
        Mutate("PUT", $"/api/sessions/{sessionId}/uploads/{reservation["uploadId"]!.GetValue<string>()}",
            bytes: bytes, authorization: reservation["authorization"]!.GetValue<string>());

    public async Task<JsonObject> State(string sessionId)
    {
        using var response = await Http.GetAsync($"/api/sessions/{sessionId}");
        return await ReadSuccess(response);
    }

    public static async Task<JsonObject> ReadSuccess(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"HTTP {(int)response.StatusCode}: {body}");
        return JsonNode.Parse(body)!.AsObject();
    }

    // This deliberately computer-generated JPEG documents the protocol's trust boundary.
    public static byte[] SyntheticJpeg(byte value = 82, int width = 16, int height = 16)
    {
        using var bitmap = new SKBitmap(width, height);
        using var canvas = new SKCanvas(bitmap);
        canvas.Clear(new SKColor(value, 128, 190));
        using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(SKEncodedImageFormat.Jpeg, 85);
        return encoded.ToArray();
    }

    public void Dispose() => Http.Dispose();
}

public abstract class IsolatedApiTest : IAsyncLifetime
{
    protected string DataDirectory { get; } = Path.Combine(Path.GetTempPath(), "CaptureProof-tests", Guid.NewGuid().ToString("N"));
    internal ApiFactory Factory { get; private set; } = null!;
    protected virtual IReadOnlyDictionary<string, string?> Configuration => new Dictionary<string, string?>();

    public Task InitializeAsync()
    {
        Factory = new ApiFactory(DataDirectory, overrides: Configuration);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        await Factory.DisposeAsync();
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if (Directory.Exists(DataDirectory)) Directory.Delete(DataDirectory, true);
    }
}
