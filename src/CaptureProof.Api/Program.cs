using System.Threading.RateLimiting;
using CaptureProof.Api;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection.Extensions;

if (args.Any(argument => argument is "--backup" or "--restore"))
{
    Environment.ExitCode = DataMaintenanceCommand.Run(args);
    return;
}

var staticRoot = Path.Combine(AppContext.BaseDirectory, "wwwroot");
Directory.CreateDirectory(staticRoot);
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, WebRootPath = staticRoot });
var options = builder.Configuration.GetSection("CaptureProof").Get<CaptureOptions>() ?? new();
options.Validate();
options.DataDirectory = Path.GetFullPath(options.DataDirectory);
using var dataDirectoryLock = DataDirectoryLock.Acquire(options.DataDirectory);
if (args.Contains("--rotate-key", StringComparer.Ordinal))
{
    ReceiptSigner.Generate(Path.Combine(options.DataDirectory, "signing"));
    Console.WriteLine("Nouvelle clé active créée. Anciennes clés publiques conservées. Redémarrez le serveur.");
    return;
}
Directory.CreateDirectory(options.DataDirectory);
builder.WebHost.ConfigureKestrel(k => { k.Limits.MaxRequestBodySize = 25 * 1024 * 1024; k.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(15); k.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(30); });
builder.Services.AddSingleton(options);
builder.Services.TryAddSingleton(TimeProvider.System);
builder.Services.AddDataProtection().SetApplicationName("CaptureProof.demo.v1").PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(options.DataDirectory, "cookie-keys")));
builder.Services.AddSingleton<DemoIdentity>();
builder.Services.AddSingleton<IBusinessAuthorizer, DemoBusinessAuthorizer>();
builder.Services.AddSingleton<ReceiptSigner>();
builder.Services.AddSingleton<CaptureStore>();
builder.Services.AddSingleton(new SemaphoreSlim(4, 4));
builder.Services.AddAntiforgery(o =>
{
    o.HeaderName = "X-CSRF-TOKEN"; o.Cookie.Name = "cp-csrf"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
});
builder.Services.AddSignalR(o => { o.MaximumReceiveMessageSize = 2048; o.EnableDetailedErrors = false; o.ClientTimeoutInterval = TimeSpan.FromSeconds(30); });
builder.Services.AddOpenApi();
builder.Services.AddRequestTimeouts(o => o.DefaultPolicy = new RequestTimeoutPolicy { Timeout = TimeSpan.FromSeconds(20) });
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = options.MaxRequestsPerMinute, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddHostedService<StorageJanitor>();
var app = builder.Build();
app.Lifetime.ApplicationStopped.Register(dataDirectoryLock.Dispose);
_ = app.Services.GetRequiredService<CaptureStore>();
app.Use(async (context, next) =>
{
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()";
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    if (context.Request.IsHttps) context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000";
    if (context.Request.Path.StartsWithSegments("/api") || context.Request.Path.StartsWithSegments("/hubs")) context.Response.Headers.CacheControl = "no-store";
    var originalBody = context.Request.Body;
    await using var jsonBody = new MemoryStream();
    try
    {
        var origin = context.Request.Headers.Origin.ToString();
        var isApi = context.Request.Path.StartsWithSegments("/api");
        var isHub = context.Request.Path.StartsWithSegments("/hubs");
        var mutation = !HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method);
        if (isApi && mutation && !HttpMethods.IsPut(context.Request.Method))
        {
            Protocol.Require(context.Request.ContentLength is null || context.Request.ContentLength <= 16384, 413, "request_too_large", "Requête JSON trop volumineuse.");
            var bodyLimit = context.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
            if (bodyLimit is { IsReadOnly: false }) bodyLimit.MaxRequestBodySize = 16384;
            var jsonBuffer = new byte[8192];
            int read;
            while ((read = await originalBody.ReadAsync(jsonBuffer, context.RequestAborted)) > 0)
            {
                Protocol.Require(jsonBody.Length + read <= 16384, 413, "request_too_large", "Requête JSON trop volumineuse.");
                await jsonBody.WriteAsync(jsonBuffer.AsMemory(0, read), context.RequestAborted);
            }
            jsonBody.Position = 0;
            context.Request.Body = jsonBody;
        }
        var originAllowed = origin == options.PublicOrigin.TrimEnd('/') || (app.Environment.IsDevelopment() && (origin == options.DevelopmentOrigin.TrimEnd('/') || origin == options.ViteDevelopmentOrigin.TrimEnd('/')));
        if ((isApi && mutation) || (isHub && origin.Length > 0)) Protocol.Require(originAllowed, 403, "origin_rejected", "Origine non autorisée.");
        if (isHub) Protocol.Require(context.Request.Headers["Sec-Fetch-Site"] != "cross-site", 403, "origin_rejected", "Origine non autorisée.");
        if ((isApi || isHub) && !app.Environment.IsDevelopment()) Protocol.Require(context.Request.IsHttps, 400, "https_required", "HTTPS est requis.");
        if (isApi && mutation) await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context);
        await next();
    }
    catch (ApiFault fault) when (!context.Response.HasStarted) { context.Response.StatusCode = fault.Status; await context.Response.WriteAsJsonAsync(new { code = fault.Code, message = fault.Message }); }
    catch (AntiforgeryValidationException) when (!context.Response.HasStarted) { context.Response.StatusCode = 403; await context.Response.WriteAsJsonAsync(new { code = "csrf_invalid", message = "Protection CSRF invalide. Rechargez la page." }); }
    catch (BadHttpRequestException error) when (!context.Response.HasStarted) { context.Response.StatusCode = error.StatusCode; await context.Response.WriteAsJsonAsync(new { code = "invalid_request", message = "Requête invalide ou trop volumineuse." }); }
    catch (Exception error) when (error is not OperationCanceledException && !context.Response.HasStarted)
    {
        // Never serialize exception messages, URLs, bodies or headers into application logs.
        app.Logger.LogError("Échec interne {ExceptionType}, identifiant {TraceId}", error.GetType().Name, context.TraceIdentifier);
        context.Response.StatusCode = 500; await context.Response.WriteAsJsonAsync(new { code = "internal_error", message = "Le serveur ne peut pas traiter la demande." });
    }
    finally { context.Request.Body = originalBody; }
});
app.UseRateLimiter();
app.UseRequestTimeouts();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", demo = true }));
app.MapGet("/api/bootstrap", (HttpContext c, DemoIdentity identity, IAntiforgery anti) =>
{
    identity.EnsureOwner(c);
    return Results.Ok(new { csrfToken = anti.GetAndStoreTokens(c).RequestToken, demo = true });
});
app.MapGet("/api/sessions", (HttpContext c, DemoIdentity identity, CaptureStore store) => store.List(identity.Read(c)));
app.MapPost("/api/sessions", (CreateSessionRequest request, HttpContext c, DemoIdentity identity, CaptureStore store) =>
{
    var result = store.Create(request, identity.Read(c));
    if (result.Grant is not null) identity.IssuePhone(c, result.Grant);
    return Results.Created($"/api/sessions/{result.View.Id}", result.View);
});
app.MapGet("/api/sessions/{id}", (string id, HttpContext c, DemoIdentity identity, CaptureStore store) => store.Read(id, identity.Read(c)));
app.MapPost("/api/sessions/{id}/invitation", async (string id, HttpContext c, DemoIdentity identity, CaptureStore store, IHubContext<CaptureHub> hub) =>
{
    var result = store.Invite(id, identity.Read(c)); await Changed(hub, id); return Results.Ok(result);
});
app.MapPost("/api/pair", async (PairRequest request, HttpContext c, DemoIdentity identity, CaptureStore store, IHubContext<CaptureHub> hub) =>
{
    var result = store.Pair(request); identity.IssuePhone(c, result.Grant); await Changed(hub, result.View.Id); return Results.Ok(result.View);
});
app.MapPost("/api/sessions/{id}/confirm", async (string id, ConfirmRequest request, HttpContext c, DemoIdentity identity, CaptureStore store, IHubContext<CaptureHub> hub) =>
{
    var result = store.Confirm(id, request.Accept, identity.Read(c)); await Changed(hub, id); return Results.Ok(result);
});
app.MapPost("/api/sessions/{id}/cancel", async (string id, HttpContext c, DemoIdentity identity, CaptureStore store, IHubContext<CaptureHub> hub) =>
{
    var result = store.Cancel(id, identity.Read(c)); await Changed(hub, id); return Results.Ok(result);
});
app.MapPost("/api/sessions/{id}/uploads", (string id, UploadRequest request, HttpContext c, DemoIdentity identity, CaptureStore store) => store.Reserve(id, request.UploadId, identity.Read(c)));
app.MapPut("/api/sessions/{id}/uploads/{uploadId}", async (string id, string uploadId, HttpContext c, DemoIdentity identity, CaptureStore store, IHubContext<CaptureHub> hub, SemaphoreSlim uploadGate) =>
{
    var actor = identity.Read(c); var policy = store.AuthorizeUpload(id, actor);
    Protocol.Require(c.Request.ContentType?.Split(';')[0] == "image/jpeg", 415, "jpeg_required", "Le type image/jpeg est requis.");
    Protocol.Require(c.Request.ContentLength is null || c.Request.ContentLength <= policy.MaxBytesPerPhoto, 413, "photo_too_large", "Photo trop volumineuse.");
    Protocol.Require(await uploadGate.WaitAsync(0, c.RequestAborted), 429, "upload_busy", "Serveur occupé. Réessayez cet envoi.");
    try
    {
        using var memory = new MemoryStream(); var buffer = new byte[65536]; int count;
        while ((count = await c.Request.Body.ReadAsync(buffer, c.RequestAborted)) > 0)
        {
            Protocol.Require(memory.Length + count <= policy.MaxBytesPerPhoto, 413, "photo_too_large", "Photo trop volumineuse.");
            await memory.WriteAsync(buffer.AsMemory(0, count), c.RequestAborted);
        }
        var photo = store.Upload(id, uploadId, c.Request.Headers["X-Upload-Authorization"].ToString(), memory.ToArray(), actor);
        await Changed(hub, id); return Results.Ok(photo);
    }
    finally { uploadGate.Release(); }
});
app.MapDelete("/api/sessions/{id}/photos/{photoId}", async (string id, string photoId, HttpContext c, DemoIdentity identity, CaptureStore store, IHubContext<CaptureHub> hub) =>
{
    store.DeletePhoto(id, photoId, identity.Read(c)); await Changed(hub, id); return Results.NoContent();
});
app.MapPost("/api/sessions/{id}/finalize", async (string id, HttpContext c, DemoIdentity identity, CaptureStore store, IHubContext<CaptureHub> hub) =>
{
    var jws = store.FinalizeSession(id, identity.Read(c)); await Changed(hub, id); return Results.Ok(new { jws });
});
app.MapGet("/api/sessions/{id}/receipt", (string id, HttpContext c, DemoIdentity identity, CaptureStore store) => Results.Ok(new { jws = store.Receipt(id, identity.Read(c)) }));
app.MapGet("/api/sessions/{id}/photos/{photoId}", (string id, string photoId, HttpContext c, DemoIdentity identity, CaptureStore store) => Results.File(store.PhotoPath(id, photoId, identity.Read(c)), "image/jpeg", photoId + ".jpg"));
app.MapGet("/api/keys", (ReceiptSigner signer) => Results.Ok(signer.Keys()));
app.MapHub<CaptureHub>("/hubs/capture", o => o.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.WebSockets | Microsoft.AspNetCore.Http.Connections.HttpTransportType.LongPolling);
app.MapOpenApi();
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapFallback(async c =>
{
    if (c.Request.Path.StartsWithSegments("/api") || c.Request.Path.StartsWithSegments("/hubs") || !HttpMethods.IsGet(c.Request.Method)) { c.Response.StatusCode = 404; return; }
    var file = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "index.html");
    if (File.Exists(file)) { c.Response.ContentType = "text/html; charset=utf-8"; await c.Response.SendFileAsync(file); }
    else { c.Response.StatusCode = 503; await c.Response.WriteAsync("Construisez la démonstration : npm ci puis npm run build."); }
});
app.Run();

static Task Changed(IHubContext<CaptureHub> hub, string id) => hub.Clients.Group(CaptureHub.Group(id)).SendAsync("SessionChanged", new { sessionId = id });
public partial class Program { }
