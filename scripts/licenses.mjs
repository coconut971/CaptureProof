import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(root, 'docs', 'dependencies.md');
const frenchDestination = join(root, 'docs', 'fr', 'dependencies.md');
const nugetRoot = process.env.NUGET_PACKAGES ? resolve(process.env.NUGET_PACKAGES) : join(homedir(), '.nuget', 'packages');
const nugetProjects = [
  { path: 'src/CaptureProof.Api/packages.lock.json', scope: 'API' },
  { path: 'tests/CaptureProof.Api.Tests/packages.lock.json', scope: 'tests API' },
];

function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function lockHash(bytes) { return hash(Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'), 'utf8')); }
function compare(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function cell(value) { return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', ' ').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
function table(headers, rows) { return [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`)].join('\n'); }
function packageName(location) { return location.slice(location.lastIndexOf('node_modules/') + 'node_modules/'.length); }

async function input(path, label) {
  try { return await readFile(path); }
  catch { throw new Error(`${label} indisponible. Exécuter npm ci et dotnet restore --locked-mode avant cet inventaire.`); }
}

function decodeXml(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&#x([\da-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi, (_match, hex, decimal, named) => {
    if (hex || decimal) return String.fromCodePoint(Number.parseInt(hex ?? decimal, hex ? 16 : 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[named.toLowerCase()];
  }).trim();
}

function xmlElement(xml, name) {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`).exec(xml);
  return match ? decodeXml(match[1]) : undefined;
}

function publicUrl(value) {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) return undefined;
    return parsed.href;
  } catch { return undefined; }
}

function npmDirectUses(packages) {
  const uses = new Map();
  for (const [workspace, metadata] of Object.entries(packages)) {
    if (workspace.includes('node_modules/') || metadata.link) continue;
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const name of Object.keys(metadata[section] ?? {})) {
        let directory = workspace;
        while (true) {
          const candidate = `${directory ? `${directory}/` : ''}node_modules/${name}`;
          if (packages[candidate]) {
            if (!packages[candidate].link) {
              const values = uses.get(candidate) ?? [];
              values.push(`${metadata.name ?? 'workspace'} (${section === 'devDependencies' ? 'outillage' : 'exécution'})`);
              uses.set(candidate, values);
            }
            break;
          }
          if (!directory) throw new Error(`Dépendance directe npm non résolue : ${name}`);
          directory = directory.includes('/') ? directory.slice(0, directory.lastIndexOf('/')) : '';
        }
      }
    }
  }
  return uses;
}

async function npmInventory() {
  const bytes = await input(join(root, 'package-lock.json'), 'Verrou npm');
  const lock = JSON.parse(bytes.toString('utf8'));
  if (lock.lockfileVersion !== 3 || !lock.packages) throw new Error('Format de verrou npm non pris en charge.');
  const directUses = npmDirectUses(lock.packages);
  const rows = [];
  for (const [location, metadata] of Object.entries(lock.packages)) {
    if (!location.includes('node_modules/') || metadata.link) continue;
    const name = packageName(location);
    if (typeof metadata.version !== 'string' || typeof metadata.license !== 'string' || !metadata.license) {
      throw new Error(`Licence ou version npm non déclarée : ${name}`);
    }
    rows.push({ name, version: metadata.version, license: metadata.license, location, scope: metadata.dev ? 'outillage/tests' : 'exécution', optional: Boolean(metadata.optional), direct: directUses.get(location) ?? [] });
  }
  rows.sort((a, b) => compare(a.name, b.name) || compare(a.version, b.version) || compare(a.location, b.location));
  return { rows, checksum: lockHash(bytes) };
}

async function nugetInventory() {
  const dependencies = new Map();
  const inputs = [];
  for (const project of nugetProjects) {
    const bytes = await input(join(root, project.path), 'Verrou NuGet');
    const lock = JSON.parse(bytes.toString('utf8'));
    if (lock.version !== 1 || !lock.dependencies) throw new Error('Format de verrou NuGet non pris en charge.');
    inputs.push({ name: project.path, checksum: lockHash(bytes) });
    for (const framework of Object.values(lock.dependencies)) {
      for (const [name, metadata] of Object.entries(framework)) {
        if (metadata.type === 'Project') continue;
        if (!['Direct', 'Transitive', 'CentralTransitive'].includes(metadata.type) || typeof metadata.resolved !== 'string') throw new Error(`Dépendance NuGet non résolue : ${name}`);
        const id = `${name.toLowerCase()}/${metadata.resolved.toLowerCase()}`;
        const entry = dependencies.get(id) ?? { name, version: metadata.resolved, scopes: new Set(), directory: join(nugetRoot, name.toLowerCase(), metadata.resolved.toLowerCase()) };
        entry.scopes.add(`${project.scope} ${metadata.type === 'Direct' ? 'directe' : 'transitive'}`);
        dependencies.set(id, entry);
      }
    }
  }
  const rows = [];
  const notices = [];
  for (const dependency of dependencies.values()) {
    const packageId = `${dependency.name}@${dependency.version}`;
    let filenames;
    try { filenames = await readdir(dependency.directory); } catch { throw new Error(`Paquet NuGet absent du cache : ${packageId}. Exécuter dotnet restore --locked-mode.`); }
    const nuspecName = filenames.find((name) => name.toLowerCase() === `${dependency.name.toLowerCase()}.nuspec`);
    if (!nuspecName) throw new Error(`Manifeste NuGet absent : ${packageId}`);
    const nuspec = await input(join(dependency.directory, nuspecName), `Manifeste ${packageId}`);
    const xml = nuspec.toString('utf8');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error(`Manifeste XML externe refusé : ${packageId}`);
    const metadata = /<metadata(?:\s[^>]*)?>([\s\S]*?)<\/metadata>/.exec(xml)?.[1];
    if (!metadata || xmlElement(metadata, 'id')?.toLowerCase() !== dependency.name.toLowerCase() || xmlElement(metadata, 'version')?.toLowerCase() !== dependency.version.toLowerCase()) {
      throw new Error(`Identité du manifeste incohérente : ${packageId}`);
    }
    const licenseMatch = /<license\s[^>]*type=["'](expression|file)["'][^>]*>([\s\S]*?)<\/license>/.exec(metadata);
    const licenseType = licenseMatch?.[1];
    const license = licenseMatch ? decodeXml(licenseMatch[2]) : undefined;
    const originalUrl = xmlElement(metadata, 'licenseUrl');
    const licenseUrl = publicUrl(originalUrl);
    if (originalUrl && !licenseUrl) throw new Error(`URL de licence non publique ou complexe refusée : ${packageId}`);
    if (!license && !licenseUrl) throw new Error(`Aucune licence déclarée dans le manifeste : ${packageId}`);
    if (licenseType === 'file') {
      const path = resolve(dependency.directory, license);
      const within = relative(dependency.directory, path);
      if (isAbsolute(within) || within === '..' || within.startsWith(`..${sep}`)) throw new Error(`Chemin de licence externe refusé : ${packageId}`);
      const content = await input(path, `Licence ${packageId}`);
      notices.push({ package: packageId, file: license, bytes: content.length, checksum: hash(content), components: [] });
    }
    for (const filename of filenames.filter((name) => /^(?:LICENSE|NOTICE|THIRD[-_]?PARTY[-_]?NOTICES)(?:\.[A-Za-z]+)?$/i.test(name))) {
      if (licenseType === 'file' && filename === license) continue;
      const content = await input(join(dependency.directory, filename), `Notice ${packageId}`);
      const components = [...content.toString('utf8').matchAll(/^# ([^#\r\n]+)$/gm)].map((match) => match[1].trim()).filter((name) => !name.startsWith('END:') && !name.startsWith('http'));
      notices.push({ package: packageId, file: filename, bytes: content.length, checksum: hash(content), components });
    }
    rows.push({ name: dependency.name, version: dependency.version, scopes: [...dependency.scopes].sort(compare), license: license ?? 'non déclarée', licenseType: licenseType ?? 'URL seule', licenseUrl, nuspecChecksum: hash(nuspec) });
  }
  rows.sort((a, b) => compare(a.name.toLowerCase(), b.name.toLowerCase()) || compare(a.version, b.version));
  notices.sort((a, b) => compare(a.package.toLowerCase(), b.package.toLowerCase()) || compare(a.file, b.file));
  return { rows, notices, inputs };
}

function buildFrenchDocument(npm, nuget) {
  const npmLicenses = [...new Set(npm.rows.map((row) => row.license))].sort(compare);
  const nativeNotices = nuget.notices.filter((row) => row.package.toLowerCase().startsWith('skiasharp.nativeassets') && row.file === 'THIRD-PARTY-NOTICES.txt');
  const nativeComponents = [...new Set(nativeNotices.flatMap((row) => row.components))].sort(compare);
  return `# Dépendances et preuves de licence

Ce document est généré par \`node scripts/licenses.mjs\`. Il recense les métadonnées des versions réellement verrouillées : ${npm.rows.length} emplacements npm résolus et ${nuget.rows.length} couples paquet/version NuGet. Les dépendances transitives, les outils de test et les variantes npm optionnelles sont inclus. Les liens internes de workspaces ne sont pas des paquets tiers supplémentaires.

Il s'agit d'un inventaire automatisé de déclarations et de fichiers fournis par les éditeurs, pas d'un audit juridique complet ni d'une conclusion générale de compatibilité. Les dépendances conservent leurs propres licences. La licence Apache-2.0 du code CaptureProof ne remplace pas ces licences. Sa clause de brevet est limitée aux contributions et revendications visées par son article 3 ; elle ne garantit ni l'absence de brevets tiers ni une liberté générale d'exploitation. Voir le [texte Apache-2.0 officiel](https://www.apache.org/licenses/LICENSE-2.0).

## Reproduire l'inventaire

Après \`npm ci\` et \`dotnet restore --locked-mode\`, exécuter :

\`\`\`sh
node scripts/licenses.mjs
node scripts/licenses.mjs --check
\`\`\`

Le premier appel régénère les deux versions linguistiques ; le second les compare sans écrire et échoue si l'une diffère. Le script fonctionne avec Node.js sous Windows et Linux. Il utilise \`NUGET_PACKAGES\` si défini, sinon le cache NuGet standard du répertoire utilisateur. Aucun chemin privé ni nom d'utilisateur n'est écrit dans l'inventaire. Le script ne contacte aucun service et échoue si une licence npm ou une métadonnée NuGet nécessaire manque. Les paquets doivent avoir été restaurés localement.

Sources : champ \`license\` de chaque entrée tierce de \`package-lock.json\` ; versions et relations directes/transitives des deux \`packages.lock.json\` ; champs \`license\` et \`licenseUrl\` des fichiers \`.nuspec\` réellement installés. Les expressions sont reproduites telles que déclarées. Une URL seule reste identifiée comme telle, sans déduire une expression. La [documentation NuGet](https://learn.microsoft.com/en-us/nuget/reference/nuspec#license) distingue expression SPDX, fichier et ancienne URL de licence.

Les empreintes des verrous ci-dessous utilisent des fins de ligne LF afin de rester comparables entre Windows et Linux. Les empreintes des fichiers nuspec, licences et notices portent sur leurs octets originaux.

${table(['Source verrouillée', 'SHA-256 après normalisation LF'], [ ['package-lock.json', npm.checksum], ...nuget.inputs.map((entry) => [entry.name, entry.checksum]) ])}

## npm : inventaire complet

Licences déclarées distinctes : ${npmLicenses.map((value) => String.fromCharCode(96) + value + String.fromCharCode(96)).join(', ')}. Une ligne correspond à un emplacement verrouillé ; un même paquet peut donc apparaître plusieurs fois si la résolution le place à plusieurs endroits. « Exécution » signifie que le verrou ne le marque pas exclusivement comme dépendance de développement ; cela ne prouve pas son inclusion dans un bundle précis. Les variantes optionnelles peuvent ne pas être installées sur le système courant. \`MPL-2.0\` et les autres conditions doivent être examinées selon les fichiers effectivement redistribués et les modifications éventuelles.

${table(['Paquet et version', 'Licence déclarée', 'Portée', 'Optionnel', 'Relation directe ou emplacement'], npm.rows.map((row) => [
    `[${row.name}@${row.version}](https://www.npmjs.com/package/${encodeURIComponent(row.name)}/v/${encodeURIComponent(row.version)})`, row.license, row.scope, row.optional ? 'oui' : 'non', row.direct.length ? row.direct.join('; ') : row.location,
  ]))}

## NuGet : dépendances directes et transitives

Les colonnes « déclaration » et « URL » viennent des manifests \`.nuspec\` du cache restauré, sans classement juridique ajouté. L'empreinte du manifeste permet de vérifier la source locale de chaque ligne. Les références aux frameworks partagés .NET et au SDK ne sont pas des paquets applicatifs de ces verrous ; leurs notices accompagnent leurs distributions officielles.

${table(['Paquet et version', 'Relation', 'Type et déclaration', 'URL déclarée', 'SHA-256 du nuspec'], nuget.rows.map((row) => [
    `[${row.name}@${row.version}](https://www.nuget.org/packages/${encodeURIComponent(row.name)}/${encodeURIComponent(row.version)})`, row.scopes.join('; '), `${row.licenseType} : ${row.license}`, row.licenseUrl ? `[licence](${row.licenseUrl})` : 'absente', row.nuspecChecksum,
  ]))}

## Notices fournies et composants natifs

Les notices originales trouvées à la racine des paquets NuGet résolus sont recensées ci-dessous avec leur taille et l'empreinte des octets originaux. Un éventuel fichier de licence désigné explicitement par le manifeste est également inclus. Leur présence n'est pas déduite d'un nom de bibliothèque. Ces empreintes ne remplacent pas les textes à conserver lors d'une redistribution.

${table(['Paquet', 'Fichier fourni', 'Octets', 'SHA-256'], nuget.notices.map((row) => [row.package, row.file, row.bytes, row.checksum]))}

Les manifests SkiaSharp et NativeAssets déclarent MIT. Les paquets natifs fournissent aussi \`THIRD-PARTY-NOTICES.txt\` : leur contenu est plus large que cette déclaration du paquet. Les notices natives actuellement relevées citent : ${nativeComponents.map((value) => String.fromCharCode(96) + value + String.fromCharCode(96)).join(', ')}.

Le texte fourni contient notamment des sections BSD (ANGLE, Skia), les conditions IJG/BSD/zlib de libjpeg-turbo, des alternatives FTL/GPL pour FreeType, des textes MPL/GPL/LGPL, LGPL/eCos pour libmicrohttpd et les conditions du DNG SDK. Ce constat porte sur les notices de distribution, pas sur une analyse des symboles ni sur la preuve que chaque composant est lié dans chaque binaire. Ne pas réduire cet ensemble à « MIT uniquement » ou « toutes dépendances sous Apache-2.0 ».

Avant de redistribuer un exécutable, une image ou un bundle, conserver les licences et attributions originales des composants effectivement embarqués et examiner leurs conditions applicables. Les textes natifs ne doivent pas être traduits ou réécrits. La publication .NET de référence doit inclure \`LICENSE.txt\` de SkiaSharp et le \`THIRD-PARTY-NOTICES.txt\` natif original avec les binaires ; vérifier ces fichiers dans le résultat publié et l'image finale. La présence des notices n'est pas une preuve suffisante de conformité complète. Aucun titulaire, transfert de droits, exception ni autorisation de brevet supplémentaire n'est inventé ici.
`;
}

function buildEnglishDocument(npm, nuget) {
  const npmLicenses = [...new Set(npm.rows.map((row) => row.license))].sort(compare);
  const nativeNotices = nuget.notices.filter((row) => row.package.toLowerCase().startsWith('skiasharp.nativeassets') && row.file === 'THIRD-PARTY-NOTICES.txt');
  const nativeComponents = [...new Set(nativeNotices.flatMap((row) => row.components))].sort(compare);
  const codeList = (values) => values.map((value) => String.fromCharCode(96) + value + String.fromCharCode(96)).join(', ');
  return `# Dependencies and license evidence

This document is generated by \`node scripts/licenses.mjs\`. It inventories metadata for the versions actually locked: ${npm.rows.length} resolved npm locations and ${nuget.rows.length} NuGet package/version pairs. Transitive dependencies, test tools and optional npm variants are included. Internal workspace links are not additional third-party packages.

This is an automated inventory of publisher declarations and supplied files, not a complete legal audit or a general compatibility conclusion. Dependencies retain their own licenses. The Apache-2.0 license for CaptureProof code does not replace them. Its patent clause is limited to the contributions and claims covered by section 3; it does not guarantee freedom from third-party patents or a general freedom to operate. See the [official Apache-2.0 text](https://www.apache.org/licenses/LICENSE-2.0).

## Reproduce the inventory

After \`npm ci\` and \`dotnet restore --locked-mode\`, run:

\`\`\`sh
node scripts/licenses.mjs
node scripts/licenses.mjs --check
\`\`\`

The first command regenerates both language versions; the second compares both without writing and fails if either differs. The script runs with Node.js on Windows and Linux. It uses \`NUGET_PACKAGES\` when set, otherwise the standard NuGet cache in the user directory. No private path or username is written to the inventory. It contacts no service and fails if a required npm license or NuGet metadata is missing. Restore packages locally first.

Sources: the \`license\` field of each third-party entry in \`package-lock.json\`; versions and direct/transitive relationships in both \`packages.lock.json\` files; and the \`license\` and \`licenseUrl\` fields of installed \`.nuspec\` files. Expressions are reproduced as declared. A URL-only declaration remains identified as such rather than being inferred as an expression. The [NuGet documentation](https://learn.microsoft.com/en-us/nuget/reference/nuspec#license) distinguishes SPDX expressions, files and legacy license URLs.

The lockfile digests below use LF line endings so that Windows and Linux remain comparable. Digests for nuspec, license and notice files cover their original bytes.

${table(['Locked source', 'SHA-256 after LF normalization'], [['package-lock.json', npm.checksum], ...nuget.inputs.map((entry) => [entry.name, entry.checksum])])}

## npm: complete inventory

Distinct declared licenses: ${codeList(npmLicenses)}. Each row represents a locked location; the same package can therefore appear multiple times when resolution places it in several locations. “Runtime” means the lockfile does not mark it exclusively as a development dependency; it does not prove inclusion in a particular bundle. Optional variants may not be installed on the current system. Examine \`MPL-2.0\` and other terms according to the files actually redistributed and any modifications.

${table(['Package and version', 'Declared license', 'Scope', 'Optional', 'Direct relationship or location'], npm.rows.map((row) => [
    `[${row.name}@${row.version}](https://www.npmjs.com/package/${encodeURIComponent(row.name)}/v/${encodeURIComponent(row.version)})`, row.license, row.scope === 'outillage/tests' ? 'tooling/tests' : 'runtime', row.optional ? 'yes' : 'no', row.direct.length ? row.direct.map((value) => value.replaceAll('(outillage)', '(tooling)').replaceAll('(exécution)', '(runtime)')).join('; ') : row.location,
  ]))}

## NuGet: direct and transitive dependencies

The declaration and URL columns come from \`.nuspec\` manifests in the restored cache, without added legal classification. The manifest digest identifies the local source for each row. .NET shared framework and SDK references are not application packages in these lockfiles; their notices accompany their official distributions.

${table(['Package and version', 'Relationship', 'Type and declaration', 'Declared URL', 'nuspec SHA-256'], nuget.rows.map((row) => [
    `[${row.name}@${row.version}](https://www.nuget.org/packages/${encodeURIComponent(row.name)}/${encodeURIComponent(row.version)})`, row.scopes.map((scope) => scope.replaceAll('tests API', 'API tests').replaceAll('directe', 'direct')).join('; '), `${row.licenseType === 'URL seule' ? 'URL only' : row.licenseType}: ${row.license === 'non déclarée' ? 'not declared' : row.license}`, row.licenseUrl ? `[license](${row.licenseUrl})` : 'absent', row.nuspecChecksum,
  ]))}

## Supplied notices and native components

Original notices found at the root of resolved NuGet packages are listed below with their size and original-byte digest. A license file explicitly named by a manifest is also included. Presence is not inferred from a library name. These digests do not replace the texts that must be retained for redistribution.

${table(['Package', 'Supplied file', 'Bytes', 'SHA-256'], nuget.notices.map((row) => [row.package, row.file, row.bytes, row.checksum]))}

SkiaSharp and NativeAssets manifests declare MIT. Native packages also supply \`THIRD-PARTY-NOTICES.txt\`, whose contents are broader than the package declaration. The native notices currently inventoried mention: ${codeList(nativeComponents)}.

The supplied text includes BSD sections (ANGLE, Skia), libjpeg-turbo IJG/BSD/zlib terms, FreeType FTL/GPL alternatives, MPL/GPL/LGPL texts, libmicrohttpd LGPL/eCos terms and DNG SDK terms. This describes distribution notices, not symbol analysis or proof that every component is linked into every binary. Do not reduce this inventory to “MIT only” or “all dependencies under Apache-2.0”.

Before redistributing an executable, image or bundle, retain the original licenses and attributions of components actually included and examine their applicable terms. Do not translate or rewrite the native license texts. The reference .NET publish output must include SkiaSharp \`LICENSE.txt\` and the original native \`THIRD-PARTY-NOTICES.txt\` with the binaries; verify those files in the published output and final image. Presence of notices alone is not proof of complete compliance. No rightsholder, assignment, exception or additional patent permission is invented here.
`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error('Usage : node scripts/licenses.mjs [--check]');
  const [npm, nuget] = await Promise.all([npmInventory(), nugetInventory()]);
  const documents = [
    { path: destination, body: `English · [Français](fr/dependencies.md)\n\n${buildEnglishDocument(npm, nuget)}` },
    { path: frenchDestination, body: `[English](../dependencies.md) · Français\n\n${buildFrenchDocument(npm, nuget)}` },
  ];
  if (args[0] === '--check') {
    for (const document of documents) {
      const previous = (await input(document.path, 'Inventaire public')).toString('utf8').replaceAll('\r\n', '\n');
      if (previous !== document.body) throw new Error('Inventaire différent des dépendances restaurées. Relancer node scripts/licenses.mjs.');
    }
    process.stdout.write(`Inventaire cohérent : ${npm.rows.length} entrées npm, ${nuget.rows.length} paquets NuGet, ${nuget.notices.length} fichiers de licence ou notice.\n`);
  } else {
    await mkdir(dirname(frenchDestination), { recursive: true });
    for (const document of documents) await writeFile(document.path, document.body, 'utf8');
    process.stdout.write(`Inventaires anglais et français générés : ${npm.rows.length} entrées npm, ${nuget.rows.length} paquets NuGet, ${nuget.notices.length} fichiers de licence ou notice.\n`);
  }
}

main().catch((error) => {
  // Filesystem failures may contain local paths. Only controlled messages are exported.
  const controlled = error instanceof Error && !('code' in error) ? error.message : 'Échec de lecture ou écriture de l’inventaire ; vérifier les fichiers restaurés.';
  process.stderr.write(`${controlled}\n`);
  process.exitCode = 1;
});
