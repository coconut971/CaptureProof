// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchSession } from '../src/live';

const fake = vi.hoisted(() => ({
  start: vi.fn(), invoke: vi.fn(), stop: vi.fn(),
  changed: undefined as ((event: { sessionId: string }) => void) | undefined,
  reconnecting: undefined as (() => void) | undefined,
  reconnected: undefined as (() => void) | undefined,
  closed: undefined as (() => void) | undefined,
}));
vi.mock('@microsoft/signalr', () => ({
  LogLevel: { None: 0 },
  HubConnectionBuilder: class {
    withUrl(): this { return this; }
    configureLogging(): this { return this; }
    withAutomaticReconnect(): this { return this; }
    build(): object {
      return {
        start: fake.start, invoke: fake.invoke, stop: fake.stop,
        on: (_name: string, callback: (event: { sessionId: string }) => void) => { fake.changed = callback; },
        onreconnecting: (callback: () => void) => { fake.reconnecting = callback; },
        onreconnected: (callback: () => void) => { fake.reconnected = callback; },
        onclose: (callback: () => void) => { fake.closed = callback; },
      };
    }
  },
}));

let cleanups: (() => void)[];
function observe(reload: () => Promise<void>, onStatus = vi.fn()): () => void {
  const cleanup = watchSession('session-a', reload, onStatus);
  cleanups.push(cleanup);
  return cleanup;
}
function deferred(): { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void } {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
  cleanups = [];
  fake.start.mockReset().mockResolvedValue(undefined);
  fake.invoke.mockReset().mockResolvedValue(undefined);
  fake.stop.mockReset().mockResolvedValue(undefined);
  fake.changed = undefined; fake.reconnecting = undefined; fake.reconnected = undefined; fake.closed = undefined;
});
afterEach(() => { cleanups.forEach(cleanup => cleanup()); vi.useRealTimers(); });

describe('authorized session monitoring', () => {
  it('restores the live status after a temporary REST failure', async () => {
    const reload = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const status = vi.fn(); observe(reload, status);
    await vi.advanceTimersByTimeAsync(0);
    expect(status).toHaveBeenLastCalledWith('Reprise de la connexion…');
    await vi.advanceTimersByTimeAsync(8_000);
    expect(reload).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenLastCalledWith('Synchronisation en direct');
    await vi.advanceTimersByTimeAsync(8_000);
    expect(status).toHaveBeenCalledTimes(3);
  });

  it('restores the polling status after a temporary REST failure without a hub connection', async () => {
    fake.start.mockRejectedValue(new Error('hub unavailable'));
    const reload = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const status = vi.fn(); observe(reload, status);
    await vi.advanceTimersByTimeAsync(0);
    expect(status).toHaveBeenLastCalledWith('Actualisation périodique active');
    await vi.advanceTimersByTimeAsync(8_000);
    expect(status).toHaveBeenLastCalledWith('Reprise de la connexion…');
    await vi.advanceTimersByTimeAsync(8_000);
    expect(status).toHaveBeenLastCalledWith('Actualisation périodique active');
    expect(fake.invoke).not.toHaveBeenCalled();
  });

  it('coalesces notifications while a read is pending and ignores other sessions', async () => {
    const pending = deferred();
    const reload = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
    observe(reload);
    await vi.advanceTimersByTimeAsync(0);
    fake.changed?.({ sessionId: 'other-session' });
    fake.changed?.({ sessionId: 'session-a' });
    fake.changed?.({ sessionId: 'session-a' });
    await vi.advanceTimersByTimeAsync(8_000);
    expect(reload).toHaveBeenCalledTimes(1);
    pending.resolve(); await vi.advanceTimersByTimeAsync(0);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('ignores late failures and reconnect callbacks after disposal', async () => {
    const pending = deferred();
    const reload = vi.fn().mockReturnValue(pending.promise);
    const status = vi.fn(); const cleanup = observe(reload, status);
    await vi.advanceTimersByTimeAsync(0);
    cleanup(); cleanup();
    const reported = status.mock.calls.length;
    fake.reconnecting?.(); fake.reconnected?.(); fake.closed?.();
    fake.changed?.({ sessionId: 'session-a' });
    pending.reject(new Error('late failure'));
    await vi.advanceTimersByTimeAsync(16_000);
    expect(status).toHaveBeenCalledTimes(reported);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(fake.invoke).toHaveBeenCalledTimes(1);
    expect(fake.stop).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe if negotiation finishes after disposal', async () => {
    const pending = deferred(); fake.start.mockReturnValue(pending.promise);
    const reload = vi.fn().mockResolvedValue(undefined);
    const status = vi.fn(); const cleanup = observe(reload, status);
    cleanup(); pending.resolve(); await vi.advanceTimersByTimeAsync(16_000);
    expect(fake.invoke).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it('reports polling when resubscription fails and live sync only after a successful rejoin', async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const status = vi.fn(); observe(reload, status);
    await vi.advanceTimersByTimeAsync(0);
    fake.invoke.mockRejectedValueOnce(new Error('subscription refused'));
    fake.reconnecting?.(); fake.reconnected?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(status).toHaveBeenLastCalledWith('Actualisation périodique active');
    await vi.advanceTimersByTimeAsync(8_000);
    expect(status).toHaveBeenLastCalledWith('Actualisation périodique active');
    fake.reconnected?.(); await vi.advanceTimersByTimeAsync(0);
    expect(fake.invoke).toHaveBeenCalledTimes(3);
    expect(status).toHaveBeenLastCalledWith('Synchronisation en direct');
    expect(reload).toHaveBeenCalledTimes(3);
  });
});
