import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { base64url, exportJWK, generateKeyPair } from 'jose';
import { verifyReceipt, VERIFICATION_LIMITS, type ReceiptManifest, type ReceiptFile, type TrustedPublicJwk } from '../src/index.js';

const bytes = new Uint8Array([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9]);
const files: ReceiptFile[] = [{ name: 'photo-1.jpg', bytes }];
const context = { integrationSpace: 'demo', businessReference: 'DEMO-001' };
let privateKey: CryptoKey;
let trustedKeys: TrustedPublicJwk[];
let manifest: ReceiptManifest;
let receipt: string;
const header = { alg: 'ES256', typ: 'captureproof-receipt+jws', kid: 'key-1' };

async function signRaw(payload: string | Uint8Array, protectedHeader = JSON.stringify(header)): Promise<string> {
  const input = `${base64url.encode(protectedHeader)}.${base64url.encode(payload)}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new TextEncoder().encode(input));
  return `${input}.${base64url.encode(new Uint8Array(signature))}`;
}

async function signed(change: (copy: ReceiptManifest) => void): Promise<string> {
  const copy = structuredClone(manifest);
  change(copy);
  return signRaw(JSON.stringify(copy));
}

beforeAll(async () => {
  const pair = await generateKeyPair('ES256', { extractable: true });
  privateKey = pair.privateKey;
  trustedKeys = [{ ...await exportJWK(pair.publicKey), kid: 'key-1', alg: 'ES256', use: 'sig' }];
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  manifest = {
    schemaVersion: 1, issuer: 'CaptureProof demo', receiptId: 'receipt-1', sessionId: 'session-1', context,
    finalizedAt: '2026-10-24T10:01:00.1234567+00:00',
    policy: { minPhotos: 1, maxPhotos: 6, maxBytesPerPhoto: 8 * 1024 * 1024, sessionTtlSeconds: 900 },
    photoCount: 1,
    files: [{ id: 'photo-1', sha256: Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join(''), size: bytes.length, contentType: 'image/jpeg', receivedAt: '2026-10-24T10:00:59Z' }],
    guarantees: { integrity: true, hardwareCameraAttested: false, aiOriginAssessed: false },
  };
  receipt = await signRaw(JSON.stringify(manifest));
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('independent receipt verification', () => {
  it('verifies original bytes, explicit public key and business context', async () => {
    const result = await verifyReceipt(receipt, files, trustedKeys, context);
    expect(result.valid).toBe(true);
    expect(result.signature.status).toBe('valid');
    expect(result.key.status).toBe('trusted');
    expect(result.schema.status).toBe('valid');
    expect(result.files.status).toBe('valid');
    expect(result.context.status).toBe('valid');
    expect(result.manifest).toEqual(manifest);
  });

  it('accepts signed whitespace without reserializing before signature verification', async () => {
    expect((await verifyReceipt(await signRaw(JSON.stringify(manifest, null, 2)), files, trustedKeys, context)).valid).toBe(true);
  });

  it('rejects altered original payload even if JSON meaning is unchanged', async () => {
    const segments = receipt.split('.');
    segments[1] = base64url.encode(JSON.stringify(manifest, null, 2));
    const result = await verifyReceipt(segments.join('.'), files, trustedKeys, context);
    expect(result.signature.code).toBe('signature-invalid');
    expect(result.manifest).toBeUndefined();
    expect(result.files.status).toBe('not-checked');
  });

  it('rejects altered signature and withholds the unverified manifest', async () => {
    const segments = receipt.split('.');
    const signature = base64url.decode(segments[2] ?? '');
    signature[0] = (signature[0] ?? 0) ^ 1;
    segments[2] = base64url.encode(signature);
    const result = await verifyReceipt(segments.join('.'), files, trustedKeys);
    expect(result.valid).toBe(false);
    expect(result.signature.code).toBe('signature-invalid');
    expect(result.manifest).toBeUndefined();
  });

  it('distinguishes an unknown key from an invalid signature', async () => {
    const result = await verifyReceipt(receipt, files, []);
    expect(result.key.code).toBe('unknown-key');
    expect(result.signature.status).toBe('not-checked');
    expect(result.valid).toBe(false);
  });

  it('rejects ambiguous trusted key IDs', async () => {
    const result = await verifyReceipt(receipt, files, [...trustedKeys, ...trustedKeys]);
    expect(result.key.code).toBe('ambiguous-key');
  });

  it('rejects a public point that cannot be imported', async () => {
    const result = await verifyReceipt(receipt, files, [{ ...trustedKeys[0], x: 'A'.repeat(43), y: 'A'.repeat(43) }]);
    expect(result.key.code).toBe('invalid-public-key');
  });

  it('treats a different public key under the same kid as a signature failure', async () => {
    const pair = await generateKeyPair('ES256');
    const result = await verifyReceipt(receipt, files, [{ ...await exportJWK(pair.publicKey), kid: 'key-1' }]);
    expect(result.key.status).toBe('trusted');
    expect(result.signature.code).toBe('signature-invalid');
  });

  it.each(['none', 'HS256', 'ES384', 'RS256'])('rejects unsupported algorithm %s', async (alg) => {
    const result = await verifyReceipt(await signRaw(JSON.stringify(manifest), JSON.stringify({ ...header, alg })), files, trustedKeys);
    expect(result.signature.code).toBe('unsupported-algorithm');
  });

  it.each([
    { jku: 'https://attacker.invalid/keys' },
    { x5u: 'https://attacker.invalid/certificate' },
    { jwk: { kty: 'EC', crv: 'P-256' } },
    { x5c: ['attacker-certificate'] },
    { crit: ['future'], future: true },
    { crit: [] },
    { b64: false, crit: ['b64'] },
    { typ: 'JWT' },
  ])('rejects unrecognized protected headers and never fetches trust: %j', async (extra) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const result = await verifyReceipt(await signRaw(JSON.stringify(manifest), JSON.stringify({ ...header, ...extra })), files, trustedKeys);
    expect(result.signature.code).toBe('unsupported-protected-header');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects duplicate protected fields before JSON ambiguity can matter', async () => {
    const result = await verifyReceipt(await signRaw(JSON.stringify(manifest), '{"alg":"HS256","alg":"ES256","typ":"captureproof-receipt+jws","kid":"key-1"}'), files, trustedKeys);
    expect(result.signature.code).toBe('malformed-jws');
  });

  it.each([
    { kty: 'oct', k: 'attacker-key' }, { crv: 'P-384' }, { alg: 'HS256' }, { use: 'enc' },
    { key_ops: ['sign'] }, { d: 'private-key' }, { x5u: 'https://attacker.invalid' }, { jku: 'https://attacker.invalid' },
  ])('rejects unsupported or private trusted JWK material: %j', async (extra) => {
    const result = await verifyReceipt(receipt, files, [{ ...trustedKeys[0], ...extra }]);
    expect(result.key.status).toBe('invalid');
    expect(result.signature.status).toBe('not-checked');
  });

  it.each(['', 'a.b', 'a.b.c.d', ' e30.e30.AA', 'e30.e30.AA=', 'e30..AA'])('rejects malformed compact input %s', async (jws) => {
    expect((await verifyReceipt(jws, files, trustedKeys)).signature.status).toBe('invalid');
  });

  it('bounds compact input before processing', async () => {
    expect((await verifyReceipt('a'.repeat(VERIFICATION_LIMITS.jwsCharacters + 1), files, trustedKeys)).signature.code).toBe('jws-resource-limit');
  });

  it('bounds trusted key and file counts', async () => {
    expect((await verifyReceipt(receipt, files, Array.from({ length: 65 }, () => trustedKeys[0]!))).key.code).toBe('invalid-trust-store');
    expect((await verifyReceipt(receipt, Array.from({ length: 33 }, () => files[0]!), trustedKeys)).files.code).toBe('file-resource-limit');
  });

  it.each([
    (copy: ReceiptManifest) => { copy.schemaVersion = 2 as 1; },
    (copy: ReceiptManifest) => { copy.photoCount = 2; },
    (copy: ReceiptManifest) => { copy.policy.minPhotos = 0; },
    (copy: ReceiptManifest) => { copy.policy.maxPhotos = 33; },
    (copy: ReceiptManifest) => { copy.policy.maxBytesPerPhoto = 1; },
    (copy: ReceiptManifest) => { copy.files.push({ ...copy.files[0] } as ReceiptManifest['files'][number]); copy.photoCount = 2; },
    (copy: ReceiptManifest) => { copy.files[0]!.id = '../photo-1'; },
    (copy: ReceiptManifest) => { copy.files[0]!.sha256 = 'A'.repeat(64); },
    (copy: ReceiptManifest) => { copy.files[0]!.size = 1.1; },
    (copy: ReceiptManifest) => { copy.files[0]!.receivedAt = '2026-02-30T10:00:00Z'; },
    (copy: ReceiptManifest) => { copy.files[0]!.receivedAt = '2026-10-24T10:02:00Z'; },
    (copy: ReceiptManifest) => { copy.finalizedAt = 'not-a-time'; },
    (copy: ReceiptManifest) => { copy.guarantees.hardwareCameraAttested = true as false; },
    (copy: ReceiptManifest) => { Object.assign(copy, { cameraOrigin: true }); },
    (copy: ReceiptManifest) => { Object.assign(copy.files[0]!, { filename: 'other.jpg' }); },
  ])('rejects invalid signed manifests after confirming their signature', async (change) => {
    const result = await verifyReceipt(await signed(change), files, trustedKeys);
    expect(result.signature.status).toBe('valid');
    expect(result.schema.code).toBe('unsupported-manifest');
    expect(result.valid).toBe(false);
    expect(result.manifest).toBeUndefined();
  });

  it('rejects duplicate manifest members, invalid UTF-8 and excessive nesting', async () => {
    const duplicate = JSON.stringify(manifest).replace('"schemaVersion":1', '"schemaVersion":9,"schemaVersion":1');
    expect((await verifyReceipt(await signRaw(duplicate), files, trustedKeys)).schema.code).toBe('malformed-manifest');
    const deep = `${'['.repeat(20)}0${']'.repeat(20)}`;
    expect((await verifyReceipt(await signRaw(deep), files, trustedKeys)).schema.code).toBe('malformed-manifest');
    expect((await verifyReceipt(await signRaw(new Uint8Array([0xff])), files, trustedKeys)).schema.code).toBe('malformed-manifest');
  });

  it('reports altered file bytes separately from the valid signature', async () => {
    const altered = new Uint8Array(bytes);
    altered[2] = 0;
    const result = await verifyReceipt(receipt, [{ name: 'photo-1.jpg', bytes: altered }], trustedKeys, context);
    expect(result.signature.status).toBe('valid');
    expect(result.files.issues).toContainEqual({ name: 'photo-1.jpg', code: 'digest-mismatch' });
    expect(result.valid).toBe(false);
  });

  it('requires exact file names, sizes and membership', async () => {
    expect((await verifyReceipt(receipt, [], trustedKeys)).files.issues).toContainEqual({ name: 'photo-1.jpg', code: 'missing-file' });
    expect((await verifyReceipt(receipt, [...files, { name: 'extra.jpg', bytes }], trustedKeys)).files.issues).toContainEqual({ name: 'extra.jpg', code: 'extra-file' });
    expect((await verifyReceipt(receipt, [...files, ...files], trustedKeys)).files.issues).toContainEqual({ name: 'photo-1.jpg', code: 'duplicate-file' });
    expect((await verifyReceipt(receipt, [{ name: 'photo-1.jpg', bytes: bytes.slice(1) }], trustedKeys)).files.issues).toContainEqual({ name: 'photo-1.jpg', code: 'size-mismatch' });
    expect((await verifyReceipt(receipt, [{ name: 'photo-1.JPG', bytes }], trustedKeys)).files.issues).toContainEqual({ name: 'photo-1.JPG', code: 'invalid-file' });
  });

  it('compares context exactly and distinguishes omitted context', async () => {
    const mismatch = await verifyReceipt(receipt, files, trustedKeys, { ...context, businessReference: 'demo-001' });
    expect(mismatch.context.code).toBe('context-mismatch');
    expect(mismatch.signature.status).toBe('valid');
    expect(mismatch.files.status).toBe('valid');
    expect(mismatch.valid).toBe(false);
    const omitted = await verifyReceipt(receipt, files, trustedKeys);
    expect(omitted.context.code).toBe('expected-context-not-provided');
    expect(omitted.valid).toBe(true);
    expect((await verifyReceipt(receipt, files, trustedKeys, { ...context, businessReference: '' })).context.code).toBe('invalid-expected-context');
  });
});
