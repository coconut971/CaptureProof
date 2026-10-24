import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { publicFiles } from './public-files.mjs';

const files = await publicFiles();
const destination = path.resolve('artifacts/source');
await mkdir(destination, { recursive: true });
// Fresh allowlisted staging directory, outside Git publication; never archive the workspace wholesale.
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const stage = path.join(destination, stamp);
await mkdir(stage);
for (const file of files) {
  const output = path.join(stage, file);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, await readFile(file));
}
const archive = path.resolve('artifacts', `captureproof-source-${stamp}.tar.gz`);
execFileSync('tar', ['-czf', archive, '-C', stage, '.']);
const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(p => !p.endsWith('/')).map(p => p.replace(/^\.\//, '')).sort();
if (JSON.stringify(entries) !== JSON.stringify(files)) throw new Error('Contenu archive différent de la liste explicite.');
console.log(`Archive vérifiée : ${archive} (${entries.length} fichiers)`);
