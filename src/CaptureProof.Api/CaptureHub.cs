using Microsoft.AspNetCore.SignalR;

namespace CaptureProof.Api;

public sealed class CaptureHub(DemoIdentity identity, CaptureStore store) : Hub
{
    public static string Group(string id) => "session:" + id;
    public override Task OnConnectedAsync()
    {
        var actor = identity.Read(Context.GetHttpContext()!);
        if (actor.OwnerId is null && actor.Phone is null) { Context.Abort(); throw new HubException("Identité de démonstration requise."); }
        return base.OnConnectedAsync();
    }
    public async Task Subscribe(string sessionId)
    {
        try { _ = store.Read(sessionId, identity.Read(Context.GetHttpContext()!)); }
        catch (ApiFault) { throw new HubException("Abonnement non autorisé."); }
        await Groups.AddToGroupAsync(Context.ConnectionId, Group(sessionId));
    }
}
public sealed class StorageJanitor(CaptureStore store, ILogger<StorageJanitor> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            try { store.Cleanup(); }
            catch (Exception error) when (error is not OperationCanceledException) { logger.LogError("Nettoyage incomplet {ExceptionType}", error.GetType().Name); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
