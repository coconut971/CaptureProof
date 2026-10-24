export interface CapturePolicy {
  minPhotos: number;
  maxPhotos: number;
  maxBytesPerPhoto: number;
  sessionTtlSeconds: number;
}

export type SessionState = 'AwaitingPairing' | 'PendingConfirmation' | 'Capturing' | 'Finalized' | 'Cancelled' | 'Expired';
export interface AcceptedPhoto {
  id: string;
  uploadId?: string;
  sha256: string;
  size: number;
  contentType: string;
  receivedAt: string;
  url: string;
}
export interface CaptureSession {
  id: string;
  state: SessionState;
  policy: CapturePolicy;
  context: { integrationSpace: string; businessReference: string };
  expiresAt: string;
  confirmationCode?: string;
  paired: boolean;
  photos: AcceptedPhoto[];
  receiptAvailable: boolean;
}
export interface UploadAuthorization { uploadId: string; authorization: string; expiresAt: string }
export interface CaptureTransport {
  load(): Promise<CaptureSession>;
  reserve(uploadId: string): Promise<UploadAuthorization>;
  upload(reservation: UploadAuthorization, blob: Blob, onProgress: (fraction: number) => void): Promise<AcceptedPhoto>;
  remove(photoId: string): Promise<void>;
  finalize(): Promise<{ jws: string }>;
}
export type PhotoStatus = 'reserving' | 'uploading' | 'failed' | 'confirmed' | 'deleting';
export interface CapturePhoto {
  id: string;
  previewUrl: string;
  status: PhotoStatus;
  progress: number;
  error?: string;
  accepted?: AcceptedPhoto;
}
export interface CaptureSnapshot {
  mode: 'server-receipt' | 'capture-only';
  camera: 'off' | 'starting' | 'ready' | 'paused' | 'error';
  photos: readonly CapturePhoto[];
  policy: CapturePolicy;
  sessionState: SessionState;
  busy: boolean;
  canCapture: boolean;
  canFinalize: boolean;
  error?: string;
  receipt?: string;
}
export interface CaptureOptions {
  mode: 'server-receipt' | 'capture-only';
  policy: CapturePolicy;
  transport?: CaptureTransport;
  session?: CaptureSession;
}

export function validatePolicy(policy: CapturePolicy): void {
  if (!Number.isInteger(policy.minPhotos) || !Number.isInteger(policy.maxPhotos)
    || policy.minPhotos < 1 || policy.maxPhotos < policy.minPhotos || policy.maxPhotos > 50
    || !Number.isSafeInteger(policy.maxBytesPerPhoto) || policy.maxBytesPerPhoto < 1
    || !Number.isSafeInteger(policy.sessionTtlSeconds) || policy.sessionTtlSeconds < 1) {
    throw new Error('Politique de capture invalide.');
  }
}

/** Routing aid only. This is neither device attestation nor server authorization. */
export function isMobileBrowser(navigatorInfo: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> = navigator): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigatorInfo.userAgent)
    || (/Macintosh/i.test(navigatorInfo.userAgent) && navigatorInfo.maxTouchPoints > 1);
}
