import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { assertPublic, publicFiles } from './public-files.mjs';

const files = await publicFiles();
for (const file of files) {
  const body = await readFile(file, 'utf8');
  if (/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/.test(body)) throw new Error(`Clé privée dans ${file}`);
}
// Run npm's real pack algorithm for each reusable package and inspect every included path.
for (const workspace of ['packages/capture-web', 'packages/receipt-verifier']) {
  const npmArguments = ['pack', '--dry-run', '--json', '--workspace', workspace];
  const output = process.platform === 'win32'
    ? execFileSync('cmd.exe', ['/d', '/c', 'npm.cmd', ...npmArguments], { encoding: 'utf8' })
    : execFileSync('npm', npmArguments, { encoding: 'utf8' });
  const packed = JSON.parse(output)[0];
  for (const item of packed.files) {
    assertPublic(item.path);
    if (!['package.json', 'README.md', 'README.fr.md', 'LICENSE'].includes(item.path) && !/^dist\/[A-Za-z0-9._/-]+\.(js|d\.ts|map)$/.test(item.path)) throw new Error(`Inclusion npm inattendue : ${item.path}`);
    if (/\btest\b/i.test(item.path)) throw new Error(`Test dans package : ${item.path}`);
  }
  console.log(`${packed.name}: ${packed.files.length} fichiers npm contrôlés (${packed.unpackedSize} octets).`);
}
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
for (const file of tracked) { assertPublic(file); if (!files.includes(file)) throw new Error(`Fichier suivi non publiable : ${file}`); }
console.log(`Listes source et packages vérifiées, ${tracked.length} fichiers Git suivis.`);
