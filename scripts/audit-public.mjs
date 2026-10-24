import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { approvedImageAssets, assertPublic, publicFiles } from './public-files.mjs';

const files = await publicFiles();
for (const file of files) {
  await stat(file);
  if (approvedImageAssets.has(file)) continue;
  const text = await readFile(file, 'utf8');
  if (/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{40,}/.test(text)) throw new Error(`Clé privée détectée : ${file}`);
  if (text.includes('\u2014')) throw new Error(`Tiret cadratin interdit : ${file}`);
}
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
for (const file of tracked) { assertPublic(file); if (!files.includes(file)) throw new Error(`Fichier suivi hors liste publique : ${file}`); }
// Fresh public clones do not contain local working material or a private Git exclude file.
for (const localPath of ['AGENTS.md', '.agent-local/']) {
  if (existsSync(localPath)) execFileSync('git', ['check-ignore', '-q', localPath]);
}
console.log(`${files.length} fichiers publiables contrôlés. ${tracked.length} fichiers suivis. Matériel local exclu.`);
