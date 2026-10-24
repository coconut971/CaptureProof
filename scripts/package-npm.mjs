import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { assertPublic } from './public-files.mjs';

await mkdir('artifacts', { recursive: true });
for (const workspace of ['packages/capture-web', 'packages/receipt-verifier']) {
  const args = ['pack', '--json', '--pack-destination', 'artifacts', '--workspace', workspace];
  const output = process.platform === 'win32'
    ? execFileSync('cmd.exe', ['/d', '/c', 'npm.cmd', ...args], { encoding: 'utf8' })
    : execFileSync('npm', args, { encoding: 'utf8' });
  const packed = JSON.parse(output)[0];
  const entries = execFileSync('tar', ['-tzf', `artifacts/${packed.filename}`], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(path => !path.endsWith('/')).map(path => path.replace(/^package\//, '')).sort();
  for (const entry of entries) assertPublic(entry);
  const expected = packed.files.map(file => file.path).sort();
  if (JSON.stringify(entries) !== JSON.stringify(expected)) throw new Error(`Contenu npm inattendu : ${workspace}`);
  console.log(`Package créé et relu : artifacts/${packed.filename}, ${entries.length} fichiers, sha512 ${packed.integrity}`);
}
