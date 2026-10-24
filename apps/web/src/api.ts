import type { AcceptedPhoto, CaptureSession, CaptureTransport, UploadAuthorization } from '@captureproof/capture-web';

let csrfToken: string | undefined;
let bootstrapPromise: Promise<void> | undefined;
const requestTimeoutMs = 20_000;
type RequestFailure = 'network' | 'timeout' | 'invalid-response';
const requestMessages: Record<RequestFailure, string> = {
  network: 'Connexion au serveur interrompue. Vérifiez votre connexion, puis réessayez.',
  timeout: 'Le serveur tarde à répondre. Vérifiez votre connexion, puis réessayez.',
  'invalid-response': 'Réponse serveur illisible. Réessayez.',
};
class RequestError extends Error {
  constructor(readonly failure: RequestFailure) { super(requestMessages[failure]); }
}
export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Bound the whole response, including a body that stops arriving after its headers. */
async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new RequestError('timeout'));
    }, requestTimeoutMs);
  });
  const responseBody = async (): Promise<T> => {
    const response = await fetch(path, { ...init, signal: controller.signal });
    if (!response.ok) {
      const problem = await response.json().catch(() => ({})) as { detail?: string; title?: string; message?: string } | null;
      throw new ApiError(problem?.detail ?? problem?.message ?? problem?.title ?? `Requête refusée (${response.status}).`, response.status);
    }
    return response.status === 204 ? undefined as T : await response.json() as T;
  };
  try { return await Promise.race([responseBody(), timeout]); }
  catch (error) {
    if (timedOut) throw new RequestError('timeout');
    if (error instanceof ApiError) throw error;
    if (error instanceof SyntaxError) throw new RequestError('invalid-response');
    if (error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError')) throw new RequestError('network');
    throw error;
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

function pendingPhotoError(error: unknown): unknown {
  if (error instanceof RequestError) {
    const reason = error.failure === 'network' ? 'Connexion au serveur interrompue.'
      : error.failure === 'timeout' ? 'Le serveur tarde à répondre.' : 'Réponse serveur illisible.';
    return new Error(`${reason} La photo reste en mémoire sur cette page. Ne la rechargez pas ; vérifiez votre connexion, puis choisissez « Réessayer l’envoi ».`);
  }
  return error;
}

export function bootstrap(): Promise<void> {
  bootstrapPromise ??= requestJson<{ csrfToken: string }>('/api/bootstrap', { credentials: 'same-origin', cache: 'no-store' }).then(data => {
    if (!data || typeof data.csrfToken !== 'string' || !data.csrfToken) throw new RequestError('invalid-response');
    csrfToken = data.csrfToken;
  }).catch(error => { bootstrapPromise = undefined; throw error; });
  return bootstrapPromise;
}

export async function api<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  await bootstrap();
  return requestJson<T>(path, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(method === 'GET' ? {} : { 'X-CSRF-TOKEN': csrfToken! }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function createTransport(sessionId: string): CaptureTransport {
  const base = `/api/sessions/${encodeURIComponent(sessionId)}`;
  return {
    load: () => api<CaptureSession>(base),
    reserve: async uploadId => {
      try { return await api<UploadAuthorization>(`${base}/uploads`, { uploadId }); }
      catch (error) { throw pendingPhotoError(error); }
    },
    upload: async (reservation, blob, onProgress) => {
      try { await bootstrap(); } catch (error) { throw pendingPhotoError(error); }
      return new Promise<AcceptedPhoto>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('PUT', `${base}/uploads/${encodeURIComponent(reservation.uploadId)}`);
        request.withCredentials = true;
        request.timeout = 90_000;
        request.setRequestHeader('Content-Type', 'image/jpeg');
        request.setRequestHeader('X-CSRF-TOKEN', csrfToken!);
        request.setRequestHeader('X-Upload-Authorization', reservation.authorization);
        request.upload.onprogress = event => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
        request.onload = () => {
          if (request.status >= 200 && request.status < 300) {
            try { resolve(JSON.parse(request.responseText) as AcceptedPhoto); } catch { reject(new Error('Réponse serveur illisible. Réessayez le même envoi.')); }
          } else {
            let error = `Envoi refusé (${request.status}). Réessayez le même envoi.`;
            try { const body = JSON.parse(request.responseText) as { detail?: string; message?: string }; error = body.detail ?? body.message ?? error; } catch { /* Keep the bounded generic error. */ }
            reject(new ApiError(error, request.status));
          }
        };
        request.onerror = () => reject(pendingPhotoError(new RequestError('network')));
        request.ontimeout = () => reject(pendingPhotoError(new RequestError('timeout')));
        request.send(blob);
      });
    },
    remove: photoId => api<void>(`${base}/photos/${encodeURIComponent(photoId)}`, undefined, 'DELETE'),
    finalize: () => api<{ jws: string }>(`${base}/finalize`, {}),
  };
}

export function download(name: string, bytes: BlobPart, type = 'application/octet-stream'): void {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
