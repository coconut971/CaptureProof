import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { CompactSign, exportJWK, generateKeyPair } from 'jose';
import { runCli } from '../src/cli.js';

let directory: string;
let args: string[];
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'captureproof-verifier-'));
  const pair = await generateKeyPair('ES256', { extractable: true });
  const bytes = new Uint8Array([255, 216, 255, 217]);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const manifest = {
    schemaVersion: 1, issuer: 'CaptureProof demo', receiptId: 'receipt-1', sessionId: 'session-1',
    context: { integrationSpace: 'demo', businessReference: 'CLI-001' }, finalizedAt: '2026-10-24T10:00:00Z',
    policy: { minPhotos: 1, maxPhotos: 1, maxBytesPerPhoto: 1024, sessionTtlSeconds: 600 }, photoCount: 1,
    files: [{ id: 'photo-1', size: bytes.length, sha256: hash, contentType: 'image/jpeg', receivedAt: '2026-10-24T10:00:00Z' }],
    guarantees: { integrity: true, hardwareCameraAttested: false, aiOriginAssessed: false },
  };
  const receipt = await new CompactSign(new TextEncoder().encode(JSON.stringify(manifest)))
    .setProtectedHeader({ alg: 'ES256', typ: 'captureproof-receipt+jws', kid: 'cli-key' }).sign(pair.privateKey);
  await writeFile(join(directory, 'receipt.jws'), receipt);
  await writeFile(join(directory, 'trusted-public.jwks.json'), JSON.stringify({ keys: [{ ...await exportJWK(pair.publicKey), kid: 'cli-key' }] }));
  await writeFile(join(directory, 'photo-1.jpg'), bytes);
  args = ['--receipt', join(directory, 'receipt.jws'), '--keys', join(directory, 'trusted-public.jwks.json'), '--space', 'demo', '--reference', 'CLI-001', join(directory, 'photo-1.jpg')];
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

it('verifies local originals with explicit key file, prints distinct checks and does not fetch', async () => {
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const before = await readFile(join(directory, 'photo-1.jpg'));
  expect(await runCli(args)).toBe(0);
  const output = JSON.parse(String(stdout.mock.calls[0]?.[0])) as { valid: boolean; key: { status: string }; files: { status: string } };
  expect(output.valid).toBe(true);
  expect(output.key.status).toBe('trusted');
  expect(output.files.status).toBe('valid');
  expect(fetch).not.toHaveBeenCalled();
  expect(await readFile(join(directory, 'photo-1.jpg'))).toEqual(before);
});

it('returns failure for mismatched expected business reference', async () => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const changed = args.map((value) => value === 'CLI-001' ? 'OTHER-001' : value);
  expect(await runCli(changed)).toBe(1);
});

it('requires an explicit trust file and a complete expected context', async () => {
  await expect(runCli(['--receipt', join(directory, 'receipt.jws')])).rejects.toThrow('Usage');
  await expect(runCli(['--receipt', join(directory, 'receipt.jws'), '--keys', join(directory, 'trusted-public.jwks.json'), '--space', 'demo'])).rejects.toThrow('Usage');
});
