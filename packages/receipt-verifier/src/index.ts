import { base64url, compactVerify, importJWK, type JWK } from 'jose';
import { parseStrictJson } from './json.js';
import { exactKeys, record, validateManifest, validContext, VERIFICATION_LIMITS, type ReceiptContext, type ReceiptManifest } from './schema.js';

export { VERIFICATION_LIMITS } from './schema.js';
export type { ReceiptContext, ReceiptManifest, ReceiptPhoto, ReceiptPolicy } from './schema.js';

export interface ReceiptFile { name: string; bytes: Uint8Array }
/** JOSE metadata extends Web Crypto's JsonWebKey dictionary; validation requires kid. */
export interface TrustedPublicJwk extends JsonWebKey { kid?: string; use?: string }
export interface VerificationCheck { status: 'valid' | 'invalid' | 'not-checked'; code: string }
export interface KeyCheck { status: 'trusted' | 'untrusted' | 'invalid' | 'not-checked'; code: string; kid?: string }
export interface FileIssue { name: string; code: 'missing-file' | 'extra-file' | 'duplicate-file' | 'size-mismatch' | 'digest-mismatch' | 'invalid-file' }
export interface VerificationResult {
  valid: boolean;
  signature: VerificationCheck;
  key: KeyCheck;
  schema: VerificationCheck;
  files: VerificationCheck & { issues: FileIssue[] };
  context: VerificationCheck;
  /** Present only after verifying the original compact JWS and validating its schema. */
  manifest?: ReceiptManifest;
}

const notChecked = (): VerificationCheck => ({ status: 'not-checked', code: 'not-checked' });
const decoder = new TextDecoder('utf-8', { fatal: true });

function initialResult(): VerificationResult {
  return { valid: false, signature: notChecked(), key: { status: 'not-checked', code: 'not-checked' }, schema: notChecked(), files: { ...notChecked(), issues: [] }, context: notChecked() };
}

function canonicalSegment(segment: string, maximumBytes: number): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(segment) || segment.length > Math.ceil(maximumBytes * 4 / 3)) throw new Error('Invalid compact segment');
  const bytes = base64url.decode(segment);
  if (bytes.byteLength > maximumBytes || base64url.encode(bytes) !== segment) throw new Error('Non-canonical compact segment');
  return bytes;
}

function validPublicKey(key: Record<string, unknown>): boolean {
  return exactKeys(key, ['kty', 'crv', 'x', 'y', 'kid'], ['alg', 'use', 'key_ops', 'ext'])
    && key.kty === 'EC' && key.crv === 'P-256' && typeof key.kid === 'string' && key.kid.length > 0 && key.kid.length <= 128
    && typeof key.x === 'string' && typeof key.y === 'string' && /^[A-Za-z0-9_-]{43}$/.test(key.x) && /^[A-Za-z0-9_-]{43}$/.test(key.y)
    && (key.alg === undefined || key.alg === 'ES256') && (key.use === undefined || key.use === 'sig')
    && (key.key_ops === undefined || (Array.isArray(key.key_ops) && key.key_ops.length === 1 && key.key_ops[0] === 'verify'))
    && (key.ext === undefined || typeof key.ext === 'boolean');
}

/**
 * Verify the exact original JWS and supplied file bytes against an explicitly trusted public key set.
 * No network request or trust discovery occurs. Context is compared exactly, with no normalization.
 */
export async function verifyReceipt(
  jws: string,
  files: readonly ReceiptFile[],
  trustedKeys: readonly TrustedPublicJwk[],
  expectedContext?: ReceiptContext,
): Promise<VerificationResult> {
  const result = initialResult();
  if (typeof jws !== 'string' || jws.length > VERIFICATION_LIMITS.jwsCharacters) {
    result.signature = { status: 'invalid', code: 'jws-resource-limit' };
    return result;
  }
  const segments = jws.split('.');
  let header: Record<string, unknown>;
  try {
    if (segments.length !== 3) throw new Error('Expected compact JWS');
    const protectedSegment = segments[0];
    const payloadSegment = segments[1];
    const signatureSegment = segments[2];
    if (!protectedSegment || !payloadSegment || !signatureSegment) throw new Error('Empty segment');
    const parsed: unknown = parseStrictJson(decoder.decode(canonicalSegment(protectedSegment, VERIFICATION_LIMITS.headerBytes)));
    canonicalSegment(payloadSegment, VERIFICATION_LIMITS.manifestBytes);
    if (canonicalSegment(signatureSegment, 64).byteLength !== 64) throw new Error('Invalid ES256 signature length');
    if (!record(parsed)) throw new Error('Invalid header');
    header = parsed;
  } catch {
    result.signature = { status: 'invalid', code: 'malformed-jws' };
    return result;
  }
  if (header.alg !== 'ES256') {
    result.signature = { status: 'invalid', code: 'unsupported-algorithm' };
    return result;
  }
  if (!exactKeys(header, ['alg', 'typ', 'kid']) || header.typ !== 'captureproof-receipt+jws'
    || typeof header.kid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(header.kid)) {
    result.signature = { status: 'invalid', code: 'unsupported-protected-header' };
    return result;
  }
  result.key.kid = header.kid;
  if (!Array.isArray(trustedKeys) || trustedKeys.length > VERIFICATION_LIMITS.trustedKeys) {
    result.key = { status: 'invalid', code: 'invalid-trust-store', kid: header.kid };
    return result;
  }
  const matchingKeys = trustedKeys.filter((key: unknown) => record(key) && key.kid === header.kid);
  if (matchingKeys.length === 0) {
    result.key = { status: 'untrusted', code: 'unknown-key', kid: header.kid };
    return result;
  }
  if (matchingKeys.length !== 1) {
    result.key = { status: 'invalid', code: 'ambiguous-key', kid: header.kid };
    return result;
  }
  const selected: unknown = matchingKeys[0];
  if (!record(selected) || !validPublicKey(selected)) {
    result.key = { status: 'invalid', code: 'unsupported-public-key', kid: header.kid };
    return result;
  }
  let key: Awaited<ReturnType<typeof importJWK>>;
  try {
    canonicalSegment(selected.x as string, 32);
    canonicalSegment(selected.y as string, 32);
    key = await importJWK(selected as JWK, 'ES256');
    result.key = { status: 'trusted', code: 'explicitly-trusted-key', kid: header.kid };
  } catch {
    result.key = { status: 'invalid', code: 'invalid-public-key', kid: header.kid };
    return result;
  }
  let payload: Uint8Array;
  try {
    // compactVerify receives the original segments. Never rebuild or reserialize a JWS.
    payload = (await compactVerify(jws, key, { algorithms: ['ES256'] })).payload;
    result.signature = { status: 'valid', code: 'signature-valid' };
  } catch {
    result.signature = { status: 'invalid', code: 'signature-invalid' };
    return result;
  }
  let manifest: unknown;
  try { manifest = parseStrictJson(decoder.decode(payload)); } catch {
    result.schema = { status: 'invalid', code: 'malformed-manifest' };
    return result;
  }
  if (!validateManifest(manifest)) {
    result.schema = { status: 'invalid', code: 'unsupported-manifest' };
    return result;
  }
  result.schema = { status: 'valid', code: 'schema-valid' };
  result.manifest = manifest;
  if (expectedContext === undefined) result.context = { status: 'not-checked', code: 'expected-context-not-provided' };
  else if (!validContext(expectedContext)) result.context = { status: 'invalid', code: 'invalid-expected-context' };
  else if (expectedContext.integrationSpace !== manifest.context.integrationSpace || expectedContext.businessReference !== manifest.context.businessReference) {
    result.context = { status: 'invalid', code: 'context-mismatch' };
  } else result.context = { status: 'valid', code: 'context-matches' };

  if (!Array.isArray(files) || files.length > VERIFICATION_LIMITS.photos) {
    result.files = { status: 'invalid', code: 'file-resource-limit', issues: [] };
    return result;
  }
  let totalBytes = 0;
  const provided = new Map<string, Uint8Array>();
  const issues: FileIssue[] = [];
  for (const file of files) {
    if (!record(file) || typeof file.name !== 'string' || !/^[A-Za-z0-9_-]{1,128}\.jpg$/.test(file.name) || !(file.bytes instanceof Uint8Array)) {
      issues.push({ name: record(file) && typeof file.name === 'string' ? file.name.slice(0, 256) : '', code: 'invalid-file' });
      continue;
    }
    totalBytes += file.bytes.byteLength;
    if (file.bytes.byteLength > VERIFICATION_LIMITS.photoBytes || totalBytes > VERIFICATION_LIMITS.totalPhotoBytes) {
      result.files = { status: 'invalid', code: 'file-resource-limit', issues: [] };
      return result;
    }
    if (provided.has(file.name)) issues.push({ name: file.name, code: 'duplicate-file' });
    // Copy once so callers cannot change the bytes during the asynchronous digest.
    else provided.set(file.name, new Uint8Array(file.bytes));
  }
  const expectedNames = new Set(manifest.files.map((file) => `${file.id}.jpg`));
  for (const name of provided.keys()) if (!expectedNames.has(name)) issues.push({ name, code: 'extra-file' });
  for (const file of manifest.files) {
    const name = `${file.id}.jpg`;
    const bytes = provided.get(name);
    if (!bytes) { issues.push({ name, code: 'missing-file' }); continue; }
    if (bytes.byteLength !== file.size) { issues.push({ name, code: 'size-mismatch' }); continue; }
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)));
    const actualHash = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (actualHash !== file.sha256) issues.push({ name, code: 'digest-mismatch' });
  }
  result.files = { status: issues.length === 0 ? 'valid' : 'invalid', code: issues.length === 0 ? 'files-match' : 'files-mismatch', issues };
  result.valid = result.signature.status === 'valid' && result.key.status === 'trusted' && result.schema.status === 'valid'
    && result.files.status === 'valid' && result.context.status !== 'invalid';
  return result;
}
