#!/usr/bin/env node
import { open } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { verifyReceipt, VERIFICATION_LIMITS, type ReceiptContext, type ReceiptFile } from './index.js';
import { parseStrictJson } from './json.js';
import { exactKeys, record } from './schema.js';

const usage = 'Usage : captureproof-verify --receipt receipt.jws --keys trusted-public.jwks.json [--space demo --reference DEMO-001] photo-id.jpg [...]';

async function boundedRead(path: string, maximum: number): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > maximum) throw new Error(`Fichier absent, non régulier ou trop volumineux : ${path}`);
    const chunks: Buffer[] = [];
    let length = 0;
    while (true) {
      const chunk = Buffer.alloc(Math.min(65_536, maximum - length + 1));
      const { bytesRead } = await handle.read(chunk);
      if (bytesRead === 0) return Buffer.concat(chunks, length);
      length += bytesRead;
      if (length > maximum) throw new Error(`Fichier trop volumineux : ${path}`);
      chunks.push(chunk.subarray(0, bytesRead));
    }
  } finally { await handle.close(); }
}

export async function runCli(args: readonly string[]): Promise<number> {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) { process.stdout.write(`${usage}\n`); return 0; }
  let receiptPath: string | undefined;
  let keysPath: string | undefined;
  let space: string | undefined;
  let reference: string | undefined;
  const paths: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (!argument) throw new Error(usage);
    if (argument.startsWith('--')) {
      const next = args[++index];
      if (!next || next.startsWith('--')) throw new Error(usage);
      if (argument === '--receipt' && receiptPath === undefined) receiptPath = next;
      else if (argument === '--keys' && keysPath === undefined) keysPath = next;
      else if (argument === '--space' && space === undefined) space = next;
      else if (argument === '--reference' && reference === undefined) reference = next;
      else throw new Error(usage);
    } else paths.push(argument);
  }
  if (!receiptPath || !keysPath || (space === undefined) !== (reference === undefined) || paths.length > VERIFICATION_LIMITS.photos) throw new Error(usage);
  const jws = (await boundedRead(receiptPath, VERIFICATION_LIMITS.jwsCharacters)).toString('utf8').trim();
  const keyset: unknown = parseStrictJson((await boundedRead(keysPath, 64 * 1024)).toString('utf8'));
  if (!record(keyset) || !exactKeys(keyset, ['keys']) || !Array.isArray(keyset.keys) || keyset.keys.length > VERIFICATION_LIMITS.trustedKeys || !keyset.keys.every(record)) {
    throw new Error('Le fichier de confiance doit contenir un objet JWKS public {"keys":[...]}.');
  }
  let total = 0;
  const files: ReceiptFile[] = [];
  for (const path of paths) {
    const bytes = await boundedRead(path, Math.min(VERIFICATION_LIMITS.photoBytes, VERIFICATION_LIMITS.totalPhotoBytes - total));
    total += bytes.byteLength;
    if (total > VERIFICATION_LIMITS.totalPhotoBytes) throw new Error('Limite cumulée des photos dépassée.');
    files.push({ name: basename(path), bytes });
  }
  const context: ReceiptContext | undefined = space === undefined || reference === undefined ? undefined : { integrationSpace: space, businessReference: reference };
  const result = await verifyReceipt(jws, files, keyset.keys as JsonWebKey[], context);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.valid ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Échec de la vérification.'}\n`);
    process.exitCode = 2;
  });
}
