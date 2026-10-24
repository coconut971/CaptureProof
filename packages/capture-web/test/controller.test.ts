// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CaptureController } from '../src/controller';
import { isMobileBrowser, validatePolicy, type AcceptedPhoto, type CaptureSession, type CaptureTransport } from '../src/types';

const policy = { minPhotos: 1, maxPhotos: 3, maxBytesPerPhoto: 1024 * 1024, sessionTtlSeconds: 1800 };
const baseSession = (): CaptureSession => ({ id: 'session-test', state: 'Capturing', policy: { ...policy }, context: { integrationSpace: 'demo', businessReference: 'TEST-001' }, expiresAt: new Date(Date.now() + 60_000).toISOString(), paired: true, photos: [], receiptAvailable: false });
let stop: ReturnType<typeof vi.fn>;
let getUserMedia: ReturnType<typeof vi.fn>;
let controllers: CaptureController[];
let previewCount = 0;
function makeController(transport?: CaptureTransport): CaptureController {
  const controller = new CaptureController(transport ? { mode: 'server-receipt', policy, session: baseSession(), transport } : { mode: 'capture-only', policy });
  controllers.push(controller); return controller;
}
function video(): HTMLVideoElement {
  const element = document.createElement('video');
  Object.defineProperty(element, 'videoWidth', { configurable: true, value: 1024 });
  Object.defineProperty(element, 'videoHeight', { configurable: true, value: 768 });
  element.play = vi.fn().mockResolvedValue(undefined);
  return element;
}
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: Error) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function makeTransport(): CaptureTransport {
  return {
    load: vi.fn().mockResolvedValue(baseSession()),
    reserve: vi.fn().mockImplementation(async (uploadId: string) => ({ uploadId, authorization: 'unit-test-only', expiresAt: new Date(Date.now() + 60_000).toISOString() })),
    upload: vi.fn().mockImplementation(async reservation => ({ id: 'photo-1', uploadId: reservation.uploadId, sha256: '00'.repeat(32), size: 3, contentType: 'image/jpeg', receivedAt: new Date().toISOString(), url: '/api/test-photo' })),
    remove: vi.fn().mockResolvedValue(undefined), finalize: vi.fn().mockResolvedValue({ jws: 'receipt-test' }),
  };
}

beforeEach(() => {
  controllers = [];
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone) AppleWebKit Safari' });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  stop = vi.fn();
  const track = Object.assign(new EventTarget(), { stop });
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [track], getVideoTracks: () => [track] });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['jpg'], { type: 'image/jpeg' })));
  URL.createObjectURL = vi.fn(() => `blob:preview-${++previewCount}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { controllers.forEach(controller => controller.dispose()); vi.restoreAllMocks(); });

describe('capture policy and mobile routing', () => {
  it('validates min/max and bounded policy values', () => {
    expect(() => validatePolicy(policy)).not.toThrow();
    expect(() => validatePolicy({ ...policy, minPhotos: 4 })).toThrow();
    expect(() => validatePolicy({ ...policy, maxPhotos: 0 })).toThrow();
    expect(() => validatePolicy({ ...policy, sessionTtlSeconds: 0 })).toThrow();
  });
  it('routes iPad desktop user agents with touch and never calls a desktop camera', async () => {
    expect(isMobileBrowser({ userAgent: 'Macintosh', maxTouchPoints: 5 })).toBe(true);
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Desktop Chrome Windows' });
    const controller = makeController(); await controller.startCamera(video());
    expect(getUserMedia).not.toHaveBeenCalled(); expect(controller.snapshot.error).toContain('mobile');
  });
});

describe('camera lifecycle and standalone capture', () => {
  it('requests the rear camera without audio and stops tracks on background', async () => {
    const controller = makeController(); await controller.startCamera(video());
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: { ideal: 'environment' } }) }));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(stop).toHaveBeenCalled(); expect(controller.snapshot.camera).toBe('paused');
  });
  it('reports camera refusal with retry guidance and no upload', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    const controller = makeController(); await controller.startCamera(video());
    expect(controller.snapshot.camera).toBe('error'); expect(controller.snapshot.error).toContain('refusé');
    expect(controller.snapshot.canFinalize).toBe(false);
  });
  it('stops a late permission grant after dispose', async () => {
    const grant = deferred<MediaStream>(); getUserMedia.mockReturnValue(grant.promise);
    const controller = makeController(); const starting = controller.startCamera(video()); controller.dispose();
    grant.resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream); await starting;
    expect(stop).toHaveBeenCalled(); expect(controller.snapshot.camera).toBe('off');
  });
  it('keeps standalone mode explicit and finalizes local blobs only', async () => {
    const controller = makeController(); const complete = vi.fn(); controller.addEventListener('complete', complete);
    await controller.startCamera(video()); await controller.capture();
    expect(controller.snapshot.mode).toBe('capture-only'); expect(controller.snapshot.canFinalize).toBe(true);
    await controller.finalize(); expect(complete).toHaveBeenCalledOnce();
    const event = complete.mock.calls[0][0] as CustomEvent;
    expect(event.detail.mode).toBe('capture-only'); expect(event.detail.photos[0].blob).toBeInstanceOf(Blob);
    expect(controller.snapshot.receipt).toBeUndefined(); expect(controller.snapshot.sessionState).toBe('Finalized');
  });
});

describe('server confirmation and retries', () => {
  it('renews an expired reservation using the same upload id and original bytes', async () => {
    const transport = makeTransport();
    vi.mocked(transport.reserve).mockImplementationOnce(async uploadId => ({ uploadId, authorization: 'expired-test-only', expiresAt: new Date(Date.now() - 1000).toISOString() }));
    vi.mocked(transport.upload).mockRejectedValueOnce(new Error('Autorisation expirée'));
    const controller = makeController(transport); await controller.startCamera(video()); await controller.capture();
    await vi.waitFor(() => expect(controller.snapshot.photos[0].status).toBe('failed'));
    await controller.retry(controller.snapshot.photos[0].id);
    expect(transport.load).toHaveBeenCalledOnce(); expect(transport.reserve).toHaveBeenCalledTimes(2);
    expect(vi.mocked(transport.reserve).mock.calls[0][0]).toBe(vi.mocked(transport.reserve).mock.calls[1][0]);
    expect(vi.mocked(transport.upload).mock.calls[0][1]).toBe(vi.mocked(transport.upload).mock.calls[1][1]);
    expect(controller.snapshot.canFinalize).toBe(true);
  });
  it('recovers a lost response from authoritative state without retransmitting the photo', async () => {
    const transport = makeTransport(); vi.mocked(transport.upload).mockRejectedValueOnce(new Error('Réponse perdue'));
    const controller = makeController(transport); await controller.startCamera(video()); await controller.capture();
    await vi.waitFor(() => expect(controller.snapshot.photos[0].status).toBe('failed'));
    const id = controller.snapshot.photos[0].id;
    vi.mocked(transport.load).mockResolvedValue({ ...baseSession(), photos: [{ id: 'recovered-photo', uploadId: id, sha256: '00'.repeat(32), size: 3, contentType: 'image/jpeg', receivedAt: new Date().toISOString(), url: '/api/photo' }] });
    await controller.retry(id);
    expect(transport.upload).toHaveBeenCalledOnce(); expect(controller.snapshot.canFinalize).toBe(true);
    expect(controller.snapshot.photos).toHaveLength(1);
  });
  it('reflects deletion reported by authoritative state after uploads have settled', async () => {
    const transport = makeTransport(); const controller = makeController(transport); await controller.startCamera(video()); await controller.capture();
    await vi.waitFor(() => expect(controller.snapshot.canFinalize).toBe(true));
    controller.sync(baseSession());
    expect(controller.snapshot.photos).toHaveLength(0); expect(controller.snapshot.canFinalize).toBe(false);
  });
  it('retains the same upload id, bytes and authorization after network failure', async () => {
    const transport = makeTransport();
    const upload = vi.mocked(transport.upload); upload.mockRejectedValueOnce(new Error('Réseau coupé'));
    const controller = makeController(transport); await controller.startCamera(video()); await controller.capture();
    await vi.waitFor(() => expect(controller.snapshot.photos[0].status).toBe('failed'));
    const id = controller.snapshot.photos[0].id;
    expect(controller.snapshot.canFinalize).toBe(false); await controller.remove(id);
    expect(controller.snapshot.photos).toHaveLength(1);
    await controller.retry(id);
    expect(transport.reserve).toHaveBeenCalledOnce(); expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[0][0]).toBe(upload.mock.calls[1][0]); expect(upload.mock.calls[0][1]).toBe(upload.mock.calls[1][1]);
    expect(controller.snapshot.canFinalize).toBe(true);
    await controller.finalize(); expect(transport.finalize).toHaveBeenCalledOnce();
    await controller.remove(id); expect(controller.snapshot.photos).toHaveLength(0);
  });
  it('reconciles live state by uploadId without duplicate and still awaits the upload response', async () => {
    const transport = makeTransport(); const response = deferred<AcceptedPhoto>(); vi.mocked(transport.upload).mockReturnValue(response.promise);
    const controller = makeController(transport); await controller.startCamera(video()); await controller.capture();
    await vi.waitFor(() => expect(transport.upload).toHaveBeenCalledOnce());
    const photo: AcceptedPhoto = { id: 'accepted-different-id', uploadId: controller.snapshot.photos[0].id, sha256: '00'.repeat(32), size: 3, contentType: 'image/jpeg', receivedAt: new Date().toISOString(), url: '/api/photo' };
    controller.sync({ ...baseSession(), photos: [photo] });
    expect(controller.snapshot.photos).toHaveLength(1); expect(controller.snapshot.canFinalize).toBe(false);
    response.resolve(photo); await vi.waitFor(() => expect(controller.snapshot.canFinalize).toBe(true));
    expect(controller.snapshot.photos).toHaveLength(1);
  });
  it('never displays server success before finalize resolves', async () => {
    const transport = makeTransport(); const finalized = deferred<{ jws: string }>(); vi.mocked(transport.finalize).mockReturnValue(finalized.promise);
    const controller = makeController(transport); await controller.startCamera(video()); await controller.capture();
    await vi.waitFor(() => expect(controller.snapshot.canFinalize).toBe(true));
    const previewUrl = controller.snapshot.photos[0].previewUrl;
    const element = video();
    await controller.startCamera(element);
    const complete = vi.fn(); controller.addEventListener('complete', complete);
    const finishing = controller.finalize(); expect(controller.snapshot.sessionState).toBe('Capturing');
    expect(controller.snapshot.photos).toHaveLength(1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(previewUrl);
    finalized.resolve({ jws: 'exact.receipt.bytes' }); await finishing;
    expect(controller.snapshot.receipt).toBe('exact.receipt.bytes'); expect(controller.snapshot.sessionState).toBe('Finalized');
    expect(controller.snapshot.photos).toHaveLength(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(previewUrl);
    expect(element.srcObject).toBeNull();
    expect(stop).toHaveBeenCalled();
    expect((complete.mock.calls[0][0] as CustomEvent).detail.jws).toBe('exact.receipt.bytes');
  });

  it('ignores a stale refresh that arrives after confirmed finalization', async () => {
    const transport = makeTransport(); const refresh = deferred<CaptureSession>();
    vi.mocked(transport.load).mockReturnValue(refresh.promise);
    const controller = makeController(transport); await controller.startCamera(video()); await controller.capture();
    await vi.waitFor(() => expect(controller.snapshot.canFinalize).toBe(true));
    const accepted = controller.snapshot.photos[0].accepted!;
    const loading = controller.refresh();
    await controller.finalize();
    refresh.resolve({ ...baseSession(), photos: [accepted] }); await loading;
    expect(controller.snapshot.sessionState).toBe('Finalized');
    expect(controller.snapshot.photos).toHaveLength(0);
    expect(controller.snapshot.canCapture).toBe(false);
    expect(controller.snapshot.canFinalize).toBe(false);
  });

  it('preserves photos and camera when finalization fails and allows retry', async () => {
    const transport = makeTransport(); vi.mocked(transport.finalize).mockRejectedValueOnce(new Error('Réseau interrompu'));
    const controller = makeController(transport); await controller.startCamera(video()); await controller.capture();
    await vi.waitFor(() => expect(controller.snapshot.canFinalize).toBe(true));
    const previewUrl = controller.snapshot.photos[0].previewUrl;
    await controller.finalize();
    expect(controller.snapshot.sessionState).toBe('Capturing');
    expect(controller.snapshot.camera).toBe('ready');
    expect(controller.snapshot.photos).toHaveLength(1);
    expect(controller.snapshot.error).toBe('Réseau interrompu');
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(previewUrl);
    expect(controller.snapshot.canFinalize).toBe(true);
    await controller.finalize();
    expect(controller.snapshot.sessionState).toBe('Finalized');
    expect(controller.snapshot.photos).toHaveLength(0);
  });

  it('releases local resources on authoritative final state before the POST response', async () => {
    const transport = makeTransport(); const finalization = deferred<{ jws: string }>();
    vi.mocked(transport.finalize).mockReturnValue(finalization.promise);
    const controller = makeController(transport); await controller.startCamera(video()); await controller.capture();
    await vi.waitFor(() => expect(controller.snapshot.canFinalize).toBe(true));
    const photo = controller.snapshot.photos[0].accepted!;
    const finishing = controller.finalize();
    controller.sync({ ...baseSession(), state: 'Finalized', receiptAvailable: true, photos: [photo] });
    expect(controller.snapshot.photos).toHaveLength(0);
    expect(controller.snapshot.camera).toBe('off');
    controller.sync({ ...baseSession(), photos: [photo] });
    expect(controller.snapshot.sessionState).toBe('Finalized');
    finalization.resolve({ jws: 'confirmed.receipt.bytes' }); await finishing;
    expect(controller.snapshot.receipt).toBe('confirmed.receipt.bytes');
    expect(controller.snapshot.photos).toHaveLength(0);
  });

  it('does not start an upload when its reservation arrives after disposal', async () => {
    const transport = makeTransport();
    const reservation = deferred<Awaited<ReturnType<CaptureTransport['reserve']>>>();
    vi.mocked(transport.reserve).mockReturnValue(reservation.promise);
    const controller = makeController(transport); await controller.startCamera(video()); await controller.capture();
    await vi.waitFor(() => expect(transport.reserve).toHaveBeenCalledOnce());
    const uploadId = controller.snapshot.photos[0].id;
    controller.dispose();
    reservation.resolve({ uploadId, authorization: 'test-only', expiresAt: new Date(Date.now() + 60000).toISOString() });
    await vi.waitFor(() => expect(controller.snapshot.busy).toBe(false));
    expect(transport.upload).not.toHaveBeenCalled();
    expect(controller.snapshot.photos).toHaveLength(0);
  });

  it('does not publish an upload response that arrives after disposal', async () => {
    const transport = makeTransport(); const response = deferred<AcceptedPhoto>();
    vi.mocked(transport.upload).mockReturnValue(response.promise);
    const controller = makeController(transport); const accepted = vi.fn(); controller.addEventListener('photoaccepted', accepted);
    await controller.startCamera(video()); await controller.capture();
    await vi.waitFor(() => expect(transport.upload).toHaveBeenCalledOnce());
    const uploadId = controller.snapshot.photos[0].id;
    controller.dispose();
    response.resolve({ id: 'photo-late', uploadId, sha256: '00'.repeat(32), size: 3, contentType: 'image/jpeg', receivedAt: new Date().toISOString(), url: '/api/photo-late' });
    await vi.waitFor(() => expect(controller.snapshot.busy).toBe(false));
    expect(accepted).not.toHaveBeenCalled();
    expect(controller.snapshot.photos).toHaveLength(0);
  });
});
