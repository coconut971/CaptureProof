import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { assertPublic, publicFiles } from './public-files.mjs';

const id = randomUUID().slice(0, 8);
const image = `captureproof-context-audit:${id}`;
const container = `captureproof-context-audit-${id}`;
const archive = `artifacts/docker-context-${id}.tar`;
await mkdir('artifacts', { recursive: true });
const allowed = new Set(await publicFiles());
let created = false;
try {
  execFileSync('docker', ['build', '--target', 'context-audit', '-t', image, '.'], { stdio: 'inherit' });
  execFileSync('docker', ['create', '--name', container, image, '/noop']);
  created = true;
  execFileSync('docker', ['export', '-o', archive, container]);
  const entries = execFileSync('tar', ['-tf', archive], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(path => path.startsWith('context/') && !path.endsWith('/')).map(path => path.slice('context/'.length));
  for (const entry of entries) {
    assertPublic(entry);
    if (!allowed.has(entry)) throw new Error(`Contexte Docker hors liste : ${entry}`);
  }
  console.log(`Contexte Docker exporté et vérifié : ${entries.length} fichiers source autorisés.`);
} finally {
  if (created) execFileSync('docker', ['rm', container]);
  execFileSync('docker', ['image', 'rm', image]);
  await rm(archive, { force: true });
}
