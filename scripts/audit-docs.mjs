import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { publicFiles } from './public-files.mjs';

const root = process.cwd();
const files = (await publicFiles()).filter(file => file.endsWith('.md'));
let checked = 0;
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const prose = source.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
  if ((source.match(/^```/gm)?.length ?? 0) % 2 !== 0) throw new Error(`Unclosed code block: ${file}`);
  const targets = [
    ...[...prose.matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)].map(match => match[1]),
    ...[...prose.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1]),
  ];
  for (const target of targets) {
    if (/^(?:[a-z]+:|#)/i.test(target)) continue;
    const relative = decodeURIComponent(target.split('#')[0]);
    const resolved = path.resolve(path.dirname(file), relative);
    if (!resolved.startsWith(root + path.sep)) throw new Error(`Link outside the repository: ${file} -> ${target}`);
    try { await stat(resolved); } catch { throw new Error(`Missing documentation target: ${file} -> ${target}`); }
    checked++;
  }
  if (file.startsWith('docs/') && !file.startsWith('docs/fr/')) {
    try { await stat(file.replace('docs/', 'docs/fr/')); } catch { throw new Error(`Missing French counterpart: ${file}`); }
  }
}
console.log(`${files.length} Markdown files and ${checked} relative links checked; English/French guides present.`);
