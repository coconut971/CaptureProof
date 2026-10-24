import { isMobileBrowser, validatePolicy } from './types.js';
import type { AcceptedPhoto, CaptureOptions, CapturePhoto, CaptureSession, CaptureSnapshot, UploadAuthorization } from './types.js';

interface PendingPhoto extends CapturePhoto { blob?: Blob; reservation?: UploadAuthorization; ownedUrl?: boolean }
const pending = (photo: CapturePhoto): boolean => ['reserving', 'uploading', 'deleting'].includes(photo.status);
const message = (error: unknown): string => error instanceof Error ? error.message : 'Une erreur est survenue. Réessayez.';

/** Framework-free capture coordinator. The only source of new photo bytes is its live video. */
export class CaptureController extends EventTarget {
  private readonly options: CaptureOptions;
  private entries: PendingPhoto[] = [];
  private stream?: MediaStream;
  private video?: HTMLVideoElement;
  private camera: CaptureSnapshot['camera'] = 'off';
  private sessionState: CaptureSession['state'];
  private operation = false;
  private capturing = false;
  private uploadsInFlight = 0;
  private error?: string;
  private receipt?: string;
  private disposed = false;
  private cameraGeneration = 0;
  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.stopCamera('paused');
  };
  private readonly onPageHide = (): void => this.stopCamera('paused');

  constructor(options: CaptureOptions) {
    super();
    validatePolicy(options.policy);
    if (options.mode === 'server-receipt' && !options.transport) throw new Error('Un transport serveur est requis.');
    this.options = { ...options, policy: { ...options.policy } };
    this.sessionState = options.session?.state ?? 'Capturing';
    if (options.session) this.sync(options.session);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility);
      window.addEventListener('pagehide', this.onPageHide);
    }
  }

  get snapshot(): CaptureSnapshot {
    const active = !this.disposed && this.sessionState === 'Capturing';
    const inflight = this.entries.some(pending) || this.capturing || this.operation || this.uploadsInFlight > 0;
    return {
      mode: this.options.mode, camera: this.camera, photos: this.entries.map(photo => ({ id: photo.id, previewUrl: photo.previewUrl, status: photo.status, progress: photo.progress, ...(photo.error ? { error: photo.error } : {}), ...(photo.accepted ? { accepted: photo.accepted } : {}) })),
      policy: { ...this.options.policy }, sessionState: this.sessionState, busy: inflight,
      canCapture: active && this.camera === 'ready' && !this.capturing && !this.operation && this.entries.length < this.options.policy.maxPhotos,
      canFinalize: active && !inflight && this.entries.length >= this.options.policy.minPhotos && this.entries.every(photo => photo.status === 'confirmed'),
      ...(this.error ? { error: this.error } : {}), ...(this.receipt ? { receipt: this.receipt } : {}),
    };
  }

  private changed(): void { this.dispatchEvent(new Event('change')); }

  sync(session: CaptureSession): void {
    if (this.disposed || this.sessionState === 'Finalized') return;
    this.sessionState = session.state;
    this.options.policy = session.policy;
    if (session.state === 'Finalized' && this.options.mode === 'server-receipt') {
      this.releaseCaptureResources(); this.changed(); return;
    }
    const acceptedIds = new Set(session.photos.map(photo => photo.id));
    if (!this.uploadsInFlight) {
      this.entries = this.entries.filter(entry => {
        const absent = entry.accepted && !acceptedIds.has(entry.accepted.id) && !pending(entry);
        if (absent && entry.ownedUrl) URL.revokeObjectURL(entry.previewUrl);
        return !absent;
      });
    }
    for (const photo of session.photos) {
      const found = this.entries.find(entry => entry.accepted?.id === photo.id || entry.id === photo.uploadId || entry.id === photo.id);
      if (found) { found.accepted = photo; if (found.status !== 'deleting') found.status = 'confirmed'; found.progress = 1; }
      else this.entries.push({ id: photo.id, previewUrl: photo.url, status: 'confirmed', progress: 1, accepted: photo });
    }
    if (session.state !== 'Capturing') this.stopCamera();
    this.changed();
  }

  async refresh(): Promise<void> { if (!this.disposed && this.sessionState !== 'Finalized' && this.options.transport) this.sync(await this.options.transport.load()); }

  private releaseCaptureResources(): void {
    this.stopCamera();
    this.video = undefined;
    for (const entry of this.entries) {
      if (entry.ownedUrl) URL.revokeObjectURL(entry.previewUrl);
      entry.blob = undefined; entry.reservation = undefined;
    }
    this.entries = [];
    this.options.session = undefined;
    this.error = undefined;
  }

  async startCamera(video: HTMLVideoElement): Promise<void> {
    if (this.disposed) return;
    if (!isMobileBrowser()) { this.fail('La capture est réservée au navigateur mobile. Ouvrez la session sur votre téléphone.'); return; }
    if (this.sessionState !== 'Capturing') { this.fail('La session doit être autorisée avant de démarrer la caméra.'); return; }
    this.stopCamera();
    const generation = ++this.cameraGeneration;
    this.video = video;
    this.camera = 'starting'; this.error = undefined; this.changed();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('La caméra nécessite HTTPS et un navigateur compatible.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } } });
      if (generation !== this.cameraGeneration || this.disposed || document.visibilityState === 'hidden') {
        stream.getTracks().forEach(track => track.stop()); return;
      }
      this.stream = stream;
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
        if (this.stream === stream) { this.stopCamera('paused'); this.fail('La caméra a été interrompue. Vous pouvez la relancer.'); }
      }, { once: true }));
      video.autoplay = true; video.muted = true; video.playsInline = true; video.srcObject = stream;
      await video.play();
      if (generation !== this.cameraGeneration) return;
      this.camera = 'ready'; this.changed();
    } catch (error) {
      if (generation !== this.cameraGeneration) return;
      this.stopCamera('error');
      const name = error instanceof DOMException ? error.name : '';
      this.fail(name === 'NotAllowedError' ? 'Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur, puis réessayez.'
        : name === 'NotFoundError' ? 'Aucune caméra disponible sur cet appareil.' : message(error));
    }
  }

  stopCamera(state: CaptureSnapshot['camera'] = 'off'): void {
    this.cameraGeneration++;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = undefined;
    if (this.video) this.video.srcObject = null;
    this.camera = state; this.changed();
  }

  async capture(): Promise<void> {
    if (!this.snapshot.canCapture || !this.video) return;
    this.capturing = true; this.error = undefined; this.changed();
    try {
      const { videoWidth, videoHeight } = this.video;
      if (!videoWidth || !videoHeight) throw new Error('La caméra prépare encore la photo. Réessayez.');
      const scale = Math.min(1, 2048 / Math.max(videoWidth, videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(videoWidth * scale); canvas.height = Math.round(videoHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('La capture ne peut pas être préparée dans ce navigateur.');
      context.drawImage(this.video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('La photo ne peut pas être encodée.')), 'image/jpeg', 0.9));
      if (blob.type !== 'image/jpeg' || blob.size > this.options.policy.maxBytesPerPhoto) throw new Error('Cette photo dépasse la taille autorisée. Reprenez une photo.');
      if (this.disposed || this.sessionState !== 'Capturing') return;
      const entry: PendingPhoto = { id: crypto.randomUUID(), previewUrl: URL.createObjectURL(blob), blob, ownedUrl: true,
        status: this.options.mode === 'capture-only' ? 'confirmed' : 'reserving', progress: this.options.mode === 'capture-only' ? 1 : 0 };
      this.entries.push(entry); this.changed();
      if (this.options.transport) void this.send(entry);
    } catch (error) { this.fail(message(error)); }
    finally { this.capturing = false; this.changed(); }
  }

  private async send(entry: PendingPhoto): Promise<void> {
    const transport = this.options.transport;
    if (!transport || !entry.blob || this.disposed) return;
    this.uploadsInFlight++;
    entry.error = undefined;
    try {
      entry.status = entry.reservation ? 'uploading' : 'reserving'; this.changed();
      entry.reservation ??= await transport.reserve(entry.id);
      if (this.disposed || this.sessionState !== 'Capturing' || !entry.blob) return;
      entry.status = 'uploading'; this.changed();
      const accepted = await transport.upload(entry.reservation, entry.blob, fraction => {
        if (this.disposed || this.sessionState !== 'Capturing') return;
        entry.progress = fraction; this.changed();
      });
      if (this.disposed || this.sessionState !== 'Capturing') return;
      entry.accepted = accepted; entry.status = 'confirmed'; entry.progress = 1; entry.blob = undefined; this.changed();
      this.dispatchEvent(new CustomEvent<AcceptedPhoto>('photoaccepted', { detail: accepted }));
    } catch (error) {
      if (this.disposed || this.sessionState !== 'Capturing') return;
      // A concurrent authorized REST reload may already have confirmed this idempotent upload.
      if (entry.accepted) { entry.status = 'confirmed'; entry.blob = undefined; }
      else { entry.status = 'failed'; entry.error = message(error); }
      this.changed();
    } finally { this.uploadsInFlight--; this.changed(); }
  }

  async retry(id: string): Promise<void> {
    const entry = this.entries.find(photo => photo.id === id);
    if (entry?.status !== 'failed' || this.sessionState !== 'Capturing') return;
    // Recover a lost response before renewing a reservation. Never replace the upload id or photo bytes.
    try { await this.refresh(); } catch { /* A still-valid authorization can be retried while recovery reads are unavailable. */ }
    if (entry.accepted || this.sessionState !== 'Capturing') return;
    if (entry.reservation && Date.parse(entry.reservation.expiresAt) <= Date.now()) entry.reservation = undefined;
    await this.send(entry);
  }

  async remove(id: string): Promise<void> {
    if (this.sessionState !== 'Capturing' || this.operation) return;
    const entry = this.entries.find(photo => photo.id === id);
    if (!entry || pending(entry)) return;
    // A failed upload may already have reached the server. Preserve its reservation and bytes until its outcome is confirmed.
    if (entry.status === 'failed' && entry.reservation) { this.fail('Réessayez cet envoi pour confirmer sa réception avant de le supprimer.'); return; }
    const previous = entry.status;
    entry.status = 'deleting'; this.changed();
    try {
      if (entry.accepted && this.options.transport) await this.options.transport.remove(entry.accepted.id);
      if (entry.ownedUrl) URL.revokeObjectURL(entry.previewUrl);
      this.entries = this.entries.filter(photo => photo !== entry); this.changed();
    } catch (error) { entry.status = previous; this.fail(message(error)); }
  }

  async finalize(): Promise<void> {
    if (!this.snapshot.canFinalize) return;
    this.operation = true; this.error = undefined; this.changed();
    try {
      const result = await this.options.transport?.finalize();
      if (this.disposed) return;
      this.receipt = result?.jws;
      this.sessionState = 'Finalized';
      if (this.options.mode === 'server-receipt') this.releaseCaptureResources();
      else this.stopCamera();
      this.dispatchEvent(new CustomEvent('complete', { detail: this.options.mode === 'server-receipt'
        ? { mode: 'server-receipt', jws: this.receipt } : { mode: 'capture-only', photos: this.entries.map(photo => ({ id: photo.id, blob: photo.blob })) } }));
    } catch (error) { this.fail(message(error)); }
    finally { this.operation = false; this.changed(); }
  }

  private fail(error: string): void { this.error = error; this.changed(); }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.releaseCaptureResources();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
      window.removeEventListener('pagehide', this.onPageHide);
    }
  }
}
