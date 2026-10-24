export const VERIFICATION_LIMITS = Object.freeze({
  jwsCharacters: 262_144,
  headerBytes: 4096,
  manifestBytes: 131_072,
  photos: 32,
  photoBytes: 25 * 1024 * 1024,
  totalPhotoBytes: 128 * 1024 * 1024,
  trustedKeys: 64,
});

export interface ReceiptContext { integrationSpace: string; businessReference: string }
export interface ReceiptPolicy { minPhotos: number; maxPhotos: number; maxBytesPerPhoto: number; sessionTtlSeconds: number }
export interface ReceiptPhoto { id: string; sha256: string; size: number; contentType: 'image/jpeg'; receivedAt: string }
export interface ReceiptManifest {
  schemaVersion: 1;
  issuer: string;
  receiptId: string;
  sessionId: string;
  context: ReceiptContext;
  finalizedAt: string;
  policy: ReceiptPolicy;
  photoCount: number;
  files: ReceiptPhoto[];
  guarantees: { integrity: true; hardwareCameraAttested: false; aiOriginAssessed: false };
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function exactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
}

function text(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value);
}

function id(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value); }
function integer(value: unknown, min: number, max: number): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max; }

function date(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 40) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,7})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
    && Number(match[4]) <= 23 && Number(match[5]) <= 59 && Number(match[6]) <= 59;
}

export function validContext(value: unknown): value is ReceiptContext {
  return record(value) && exactKeys(value, ['integrationSpace', 'businessReference']) && text(value.integrationSpace, 200) && text(value.businessReference, 500);
}

export function validateManifest(value: unknown): value is ReceiptManifest {
  if (!record(value) || !exactKeys(value, ['schemaVersion', 'issuer', 'receiptId', 'sessionId', 'context', 'finalizedAt', 'policy', 'photoCount', 'files', 'guarantees'])) return false;
  if (value.schemaVersion !== 1 || !text(value.issuer, 200) || !id(value.receiptId) || !id(value.sessionId) || !validContext(value.context) || !date(value.finalizedAt)) return false;
  const policy = value.policy;
  if (!record(policy) || !exactKeys(policy, ['minPhotos', 'maxPhotos', 'maxBytesPerPhoto', 'sessionTtlSeconds'])
    || !integer(policy.minPhotos, 1, VERIFICATION_LIMITS.photos) || !integer(policy.maxPhotos, policy.minPhotos, VERIFICATION_LIMITS.photos)
    || !integer(policy.maxBytesPerPhoto, 1, VERIFICATION_LIMITS.photoBytes) || !integer(policy.sessionTtlSeconds, 1, 86_400)) return false;
  if (!integer(value.photoCount, policy.minPhotos, policy.maxPhotos) || !Array.isArray(value.files) || value.files.length !== value.photoCount) return false;
  const identifiers = new Set<string>();
  let total = 0;
  for (const file of value.files) {
    if (!record(file) || !exactKeys(file, ['id', 'sha256', 'size', 'contentType', 'receivedAt']) || !id(file.id)
      || identifiers.has(file.id) || typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)
      || !integer(file.size, 1, policy.maxBytesPerPhoto) || file.contentType !== 'image/jpeg' || !date(file.receivedAt)
      || Date.parse(file.receivedAt) > Date.parse(value.finalizedAt)) return false;
    identifiers.add(file.id);
    total += file.size;
    if (total > VERIFICATION_LIMITS.totalPhotoBytes) return false;
  }
  const guarantees = value.guarantees;
  return record(guarantees) && exactKeys(guarantees, ['integrity', 'hardwareCameraAttested', 'aiOriginAssessed'])
    && guarantees.integrity === true && guarantees.hardwareCameraAttested === false && guarantees.aiOriginAssessed === false;
}
