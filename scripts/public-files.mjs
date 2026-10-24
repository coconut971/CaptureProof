import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const rootFiles = [
  '.gitignore', '.gitattributes', '.dockerignore', 'Dockerfile', 'package.json', 'package-lock.json', 'tsconfig.base.json',
  'eslint.config.mjs', 'vitest.config.ts', 'playwright.config.ts', 'global.json', 'Directory.Build.props',
  'CaptureProof.slnx', 'README.md', 'README.fr.md', 'SECURITY.md', 'SECURITY.fr.md',
  'CONTRIBUTING.md', 'CONTRIBUTING.fr.md', '.github/PULL_REQUEST_TEMPLATE.md', 'LICENSE', 'NOTICE',
];
export const publicDirectories = ['apps/web', 'packages/capture-web', 'packages/receipt-verifier', 'src/CaptureProof.Api', 'tests/CaptureProof.Api.Tests', 'tests/e2e', 'examples/vanilla', 'docs', 'scripts', '.github/workflows', '.github/ISSUE_TEMPLATE'];
const ignoredDirectories = new Set(['node_modules', 'dist', 'bin', 'obj', '.data', 'TestResults', 'test-results', 'playwright-report']);
// Only this generated, reviewed artwork may pass the otherwise blanket photo exclusion.
export const approvedImageAssets = new Map([
  ['docs/assets/captureproof-social.png', '273d4027c80d4d5ce759017b772904ec4df6956f280e59120ad9ce78b085da93'],
]);
const denied = /(^|\/)((?:AGENTS?|GPT|CHATGPT|CLAUDE|CODEX|GEMINI|COPILOT)(?:[._-][^/]*)?\.(?:md|txt|json|ya?ml)|\.agent-local|\.agents|\.codex|\.claude|\.cursor|\.tools|\.env(?:\..*)?)($|\/)|\.(?:db(?:-shm|-wal)?|sqlite3?|pfx|p12|pem|key|cer|crt|jws|jpe?g|png|webp|tgz|zip)$/i;
export function assertPublic(file) {
  if (approvedImageAssets.has(file)) return;
  if (denied.test(file)) throw new Error(`Fichier interdit dans un livrable : ${file}`);
}
export async function publicFiles() {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.posix.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Lien symbolique refusé : ${file}`);
      if (entry.isDirectory()) { if (!ignoredDirectories.has(entry.name)) await walk(file); }
      else {
        assertPublic(file);
        if (approvedImageAssets.has(file) && createHash('sha256').update(await readFile(file)).digest('hex') !== approvedImageAssets.get(file)) {
          throw new Error(`Visuel public modifié : contrôler puis actualiser son empreinte autorisée : ${file}`);
        }
        files.push(file);
      }
    }
  }
  for (const directory of publicDirectories) await walk(directory);
  for (const file of rootFiles) { assertPublic(file); files.push(file); }
  return [...new Set(files)].sort();
}
