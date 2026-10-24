import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { verifyReceipt } from '../src/index.js';

// The reference API produces this private fixture. Never bundle its photos or keys.
const fixtures = [
  { directory: process.env.CAPTUREPROOF_INTEROP_DIR, title: 'verifies an actual .NET jose-jwt ES256 receipt independently', restored: false },
  { directory: process.env.CAPTUREPROOF_RESTORE_INTEROP_DIR, title: 'verifies three originals and the unchanged receipt after offline .NET backup and restoration', restored: true },
];
for (const fixture of fixtures) it.skipIf(!fixture.directory)(fixture.title, async () => {
  const fixtureDirectory = fixture.directory;
  if (!fixtureDirectory) return;
  const jws = (await readFile(join(fixtureDirectory, 'receipt.jws'), 'utf8')).trim();
  const keyset = JSON.parse(await readFile(join(fixtureDirectory, 'trusted-public.jwks.json'), 'utf8')) as { keys: JsonWebKey[] };
  const authenticated = await verifyReceipt(jws, [], keyset.keys);
  expect(authenticated.signature.status).toBe('valid');
  expect(authenticated.schema.status).toBe('valid');
  expect(authenticated.manifest).toBeDefined();
  const photos = await Promise.all(authenticated.manifest!.files.map(async (file) => {
    const name = `${file.id}.jpg`;
    return { name, bytes: new Uint8Array(await readFile(join(fixtureDirectory, name))) };
  }));
  const result = await verifyReceipt(jws, photos, keyset.keys);
  expect(result.valid, JSON.stringify(result)).toBe(true);
  expect(result.signature.status).toBe('valid');
  const manifest = result.manifest;
  expect(manifest).toBeDefined();
  if (fixture.restored) expect(manifest!.photoCount).toBe(3);
  expect((await verifyReceipt(jws, photos, keyset.keys, manifest!.context)).context.status).toBe('valid');
  const altered = photos.map((file) => ({ ...file, bytes: new Uint8Array(file.bytes) }));
  if (altered[0]?.bytes[0] !== undefined) altered[0].bytes[0] ^= 1;
  expect((await verifyReceipt(jws, altered, keyset.keys)).files.status).toBe('invalid');
});
