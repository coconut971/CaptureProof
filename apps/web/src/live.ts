import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

/** Notifications are hints. Every notification and reconnect reloads authorized REST state. */
export function watchSession(id: string, reload: () => Promise<void>, onStatus: (status: string) => void): () => void {
  let closed = false;
  let refreshing = false;
  let refreshQueued = false;
  let subscribed = false;
  let lastStatus = '';
  const report = (status: string): void => {
    if (closed || status === lastStatus) return;
    lastStatus = status;
    onStatus(status);
  };
  const connection = new HubConnectionBuilder().withUrl('/hubs/capture', { withCredentials: true })
    .configureLogging(LogLevel.None).withAutomaticReconnect([0, 2000, 5000, 10_000]).build();
  const refresh = async (): Promise<void> => {
    if (closed) return;
    if (refreshing) { refreshQueued = true; return; }
    refreshing = true;
    try { await reload(); report(subscribed ? 'Synchronisation en direct' : 'Actualisation périodique active'); }
    catch { report('Reprise de la connexion…'); }
    finally { refreshing = false; if (refreshQueued && !closed) { refreshQueued = false; void refresh(); } }
  };
  const subscribe = async (): Promise<void> => {
    if (closed) return;
    await connection.invoke('Subscribe', id);
    if (!closed) { subscribed = true; report('Synchronisation en direct'); await refresh(); }
  };
  connection.on('SessionChanged', (event: { sessionId: string }) => { if (event.sessionId === id) void refresh(); });
  connection.onreconnecting(() => { subscribed = false; report('Reconnexion…'); });
  connection.onreconnected(() => { void subscribe().catch(() => { subscribed = false; report('Actualisation périodique active'); }); });
  connection.onclose(() => { subscribed = false; report('Actualisation périodique active'); });
  void connection.start().then(subscribe).catch(() => { subscribed = false; report('Actualisation périodique active'); });
  const timer = window.setInterval(refresh, 8000);
  return () => { if (closed) return; closed = true; window.clearInterval(timer); void connection.stop().catch(() => { /* Already closed during negotiation. */ }); };
}
