import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn<typeof fetch>();
let client: typeof import('../src/api');
let requests: StubXMLHttpRequest[];
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const bootstrapResponse = (): Response => json({ csrfToken: 'csrf-test-only' });
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

class StubXMLHttpRequest {
  withCredentials = false;
  timeout = 0;
  status = 200;
  responseText = '';
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  upload: { onprogress?: (event: ProgressEvent) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  constructor() { requests.push(this); }
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  fetchMock.mockReset();
  requests = [];
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('XMLHttpRequest', StubXMLHttpRequest);
  client = await import('../src/api');
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('bounded API requests', () => {
  it('shares bootstrap while pending and after success', async () => {
    const response = deferred<Response>();
    fetchMock.mockReturnValueOnce(response.promise);
    const first = client.bootstrap();
    const second = client.bootstrap();
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    response.resolve(bootstrapResponse());
    await Promise.all([first, second]);
    expect(client.bootstrap()).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('translates a bootstrap network failure and permits a fresh explicit attempt', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(bootstrapResponse());
    await expect(client.bootstrap()).rejects.toThrow('Connexion au serveur interrompue. Vérifiez votre connexion, puis réessayez.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await client.bootstrap();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts a pending bootstrap at 20 seconds and clears its shared failure before retry', async () => {
    const pendingResponse = deferred<Response>();
    fetchMock.mockReturnValueOnce(pendingResponse.promise).mockResolvedValueOnce(bootstrapResponse());
    const bootstrap = client.bootstrap();
    const rejected = expect(bootstrap).rejects.toThrow('Le serveur tarde à répondre. Vérifiez votre connexion, puis réessayez.');
    await vi.advanceTimersByTimeAsync(19_999);
    const signal = fetchMock.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await client.bootstrap();
    // An obsolete response cannot overwrite the successful replacement bootstrap.
    pendingResponse.resolve(json({ csrfToken: 'obsolete-csrf' }));
    fetchMock.mockResolvedValueOnce(json({ ok: true }));
    await client.api('/api/test-mutation', {});
    expect(fetchMock.mock.calls[2][1]?.headers).toEqual({ 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'csrf-test-only' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects a malformed bootstrap token and permits a replacement', async () => {
    fetchMock.mockResolvedValueOnce(json({ csrfToken: null })).mockResolvedValueOnce(bootstrapResponse());
    await expect(client.bootstrap()).rejects.toThrow('Réponse serveur illisible. Réessayez.');
    await client.bootstrap();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bounds a pending API mutation without retrying it or promising photo retention', async () => {
    fetchMock.mockResolvedValueOnce(bootstrapResponse()).mockReturnValueOnce(new Promise<Response>(() => {}));
    const operation = client.api('/api/sessions/test/finalize', {});
    const rejected = expect(operation).rejects.toThrow('Le serveur tarde à répondre. Vérifiez votre connexion, puis réessayez.');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const signal = fetchMock.mock.calls[1][1]?.signal;
    await vi.advanceTimersByTimeAsync(20_000);
    await rejected;
    expect(signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('also times out when headers arrive but the response body never completes', async () => {
    const body = deferred<unknown>();
    fetchMock.mockResolvedValueOnce(bootstrapResponse()).mockResolvedValueOnce({ ok: true, status: 200, json: () => body.promise } as Response);
    const operation = client.api('/api/sessions');
    const rejected = expect(operation).rejects.toThrow('Le serveur tarde à répondre.');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(20_000);
    await rejected;
    expect(fetchMock.mock.calls[1][1]?.signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('replaces a raw fetch network error for reads without a photo-specific promise', async () => {
    fetchMock.mockResolvedValueOnce(bootstrapResponse()).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(client.api('/api/sessions')).rejects.toThrow('Connexion au serveur interrompue. Vérifiez votre connexion, puis réessayez.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    { status: 403, body: { detail: 'Autorisation de capture expirée.', message: 'Autre message' }, message: 'Autorisation de capture expirée.' },
    { status: 409, body: { message: 'Le dossier est déjà finalisé.' }, message: 'Le dossier est déjà finalisé.' },
    { status: 429, body: { title: 'Limite de sessions atteinte.' }, message: 'Limite de sessions atteinte.' },
    { status: 503, body: null, message: 'Requête refusée (503).' },
  ])('preserves HTTP $status and its business message', async ({ status, body, message }) => {
    fetchMock.mockResolvedValueOnce(bootstrapResponse()).mockResolvedValueOnce(json(body, status));
    const error = await client.api('/api/sessions/test/finalize', {}).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(client.ApiError);
    expect(error).toMatchObject({ status, message });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retains a bootstrap HTTP refusal and permits an explicit new bootstrap', async () => {
    fetchMock.mockResolvedValueOnce(json({ detail: 'Accès temporairement refusé.' }, 503)).mockResolvedValueOnce(bootstrapResponse());
    await expect(client.bootstrap()).rejects.toMatchObject({ status: 503, message: 'Accès temporairement refusé.' });
    await client.bootstrap();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns no content without parsing a body and sends the existing cookie/CSRF protections', async () => {
    fetchMock.mockResolvedValueOnce(bootstrapResponse()).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(client.api('/api/sessions/test/photos/photo', undefined, 'DELETE')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[1]).toEqual(['/api/sessions/test/photos/photo', expect.objectContaining({
      method: 'DELETE', credentials: 'same-origin', cache: 'no-store', headers: { 'X-CSRF-TOKEN': 'csrf-test-only' }, signal: expect.any(AbortSignal),
    })]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('photo transport recovery', () => {
  const reservation = { uploadId: 'upload-same', authorization: 'authorization-test-only', expiresAt: '2030-01-01T00:00:00Z' };

  it('describes a pending photo after a failed reservation and keeps the upload id for an explicit retry', async () => {
    fetchMock.mockResolvedValueOnce(bootstrapResponse()).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(json(reservation));
    const transport = client.createTransport('session-test');
    await expect(transport.reserve(reservation.uploadId)).rejects.toThrow('La photo reste en mémoire sur cette page.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(transport.reserve(reservation.uploadId)).resolves.toEqual(reservation);
    for (const call of fetchMock.mock.calls.slice(1)) {
      expect(call[0]).toBe('/api/sessions/session-test/uploads');
      expect(call[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ uploadId: 'upload-same' }) });
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps business refusals intact when reserving a photo', async () => {
    fetchMock.mockResolvedValueOnce(bootstrapResponse()).mockResolvedValueOnce(json({ detail: 'Nombre maximal de photos atteint.' }, 409));
    await expect(client.createTransport('session-test').reserve('upload-same')).rejects.toMatchObject({ status: 409, message: 'Nombre maximal de photos atteint.' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bounds a stalled reservation and explains how to retry the retained photo', async () => {
    fetchMock.mockResolvedValueOnce(bootstrapResponse()).mockReturnValueOnce(new Promise<Response>(() => {}));
    const operation = client.createTransport('session-test').reserve('upload-same');
    const rejected = expect(operation).rejects.toThrow('Le serveur tarde à répondre. La photo reste en mémoire sur cette page. Ne la rechargez pas ; vérifiez votre connexion, puis choisissez « Réessayer l’envoi ».');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(20_000);
    await rejected;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.signal?.aborted).toBe(true);
  });

  it.each(['network', 'timeout'] as const)('keeps the same JPEG, upload id and 90-second PUT limit after %s failure', async failure => {
    fetchMock.mockResolvedValueOnce(bootstrapResponse());
    const transport = client.createTransport('session-test');
    const photo = new Blob(['unchanged-jpeg-test'], { type: 'image/jpeg' });
    const progress = vi.fn();
    const first = transport.upload(reservation, photo, progress);
    const rejected = expect(first).rejects.toThrow('La photo reste en mémoire sur cette page.');
    await vi.advanceTimersByTimeAsync(0);
    const request = requests[0];
    expect(request.timeout).toBe(90_000);
    expect(request.withCredentials).toBe(true);
    expect(request.open).toHaveBeenCalledWith('PUT', '/api/sessions/session-test/uploads/upload-same');
    expect(request.setRequestHeader.mock.calls).toEqual([
      ['Content-Type', 'image/jpeg'], ['X-CSRF-TOKEN', 'csrf-test-only'], ['X-Upload-Authorization', 'authorization-test-only'],
    ]);
    request.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 } as ProgressEvent);
    expect(progress).toHaveBeenCalledWith(0.5);
    if (failure === 'network') request.onerror?.(); else request.ontimeout?.();
    await rejected;
    expect(requests).toHaveLength(1);
    const retried = transport.upload(reservation, photo, progress);
    await vi.advanceTimersByTimeAsync(0);
    expect(requests).toHaveLength(2);
    expect(requests[1].open.mock.calls).toEqual(request.open.mock.calls);
    expect(request.send.mock.calls[0][0]).toBe(photo);
    expect(requests[1].send.mock.calls[0][0]).toBe(photo);
    requests[1].responseText = JSON.stringify({ id: 'accepted-photo', uploadId: reservation.uploadId });
    requests[1].onload?.();
    await expect(retried).resolves.toEqual({ id: 'accepted-photo', uploadId: reservation.uploadId });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves HTTP status and the business rejection from a PUT', async () => {
    fetchMock.mockResolvedValueOnce(bootstrapResponse());
    const operation = client.createTransport('session-test').upload(reservation, new Blob(['jpeg']), vi.fn());
    const rejected = expect(operation).rejects.toMatchObject({ status: 403, message: 'Autorisation de dépôt expirée ou invalide.' });
    await vi.advanceTimersByTimeAsync(0);
    requests[0].status = 403;
    requests[0].responseText = JSON.stringify({ detail: 'Autorisation de dépôt expirée ou invalide.' });
    requests[0].onload?.();
    await rejected;
    expect(requests).toHaveLength(1);
  });
});
