[English](../dependencies.md) · Français

# Dépendances et preuves de licence

Ce document est généré par `node scripts/licenses.mjs`. Il recense les métadonnées des versions réellement verrouillées : 259 emplacements npm résolus et 64 couples paquet/version NuGet. Les dépendances transitives, les outils de test et les variantes npm optionnelles sont inclus. Les liens internes de workspaces ne sont pas des paquets tiers supplémentaires.

Il s'agit d'un inventaire automatisé de déclarations et de fichiers fournis par les éditeurs, pas d'un audit juridique complet ni d'une conclusion générale de compatibilité. Les dépendances conservent leurs propres licences. La licence Apache-2.0 du code CaptureProof ne remplace pas ces licences. Sa clause de brevet est limitée aux contributions et revendications visées par son article 3 ; elle ne garantit ni l'absence de brevets tiers ni une liberté générale d'exploitation. Voir le [texte Apache-2.0 officiel](https://www.apache.org/licenses/LICENSE-2.0).

## Reproduire l'inventaire

Après `npm ci` et `dotnet restore --locked-mode`, exécuter :

```sh
node scripts/licenses.mjs
node scripts/licenses.mjs --check
```

Le premier appel régénère les deux versions linguistiques ; le second les compare sans écrire et échoue si l'une diffère. Le script fonctionne avec Node.js sous Windows et Linux. Il utilise `NUGET_PACKAGES` si défini, sinon le cache NuGet standard du répertoire utilisateur. Aucun chemin privé ni nom d'utilisateur n'est écrit dans l'inventaire. Le script ne contacte aucun service et échoue si une licence npm ou une métadonnée NuGet nécessaire manque. Les paquets doivent avoir été restaurés localement.

Sources : champ `license` de chaque entrée tierce de `package-lock.json` ; versions et relations directes/transitives des deux `packages.lock.json` ; champs `license` et `licenseUrl` des fichiers `.nuspec` réellement installés. Les expressions sont reproduites telles que déclarées. Une URL seule reste identifiée comme telle, sans déduire une expression. La [documentation NuGet](https://learn.microsoft.com/en-us/nuget/reference/nuspec#license) distingue expression SPDX, fichier et ancienne URL de licence.

Les empreintes des verrous ci-dessous utilisent des fins de ligne LF afin de rester comparables entre Windows et Linux. Les empreintes des fichiers nuspec, licences et notices portent sur leurs octets originaux.

| Source verrouillée | SHA-256 après normalisation LF |
| --- | --- |
| package-lock.json | c95442699746a4136f3c8c3070de54d22290b9f2aa6bb5fedb01762c64523890 |
| src/CaptureProof.Api/packages.lock.json | 48e36455e18159e8aaf5dd4c9ded69f773097aed93099fba6bc1bfdd22114134 |
| tests/CaptureProof.Api.Tests/packages.lock.json | 47b02320a6646c218cddb41184dfdb0e15238da0da90cd6f069ec9de209968df |

## npm : inventaire complet

Licences déclarées distinctes : `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `BlueOak-1.0.0`, `ISC`, `MIT`, `MIT-0`, `MPL-2.0`, `Unlicense`. Une ligne correspond à un emplacement verrouillé ; un même paquet peut donc apparaître plusieurs fois si la résolution le place à plusieurs endroits. « Exécution » signifie que le verrou ne le marque pas exclusivement comme dépendance de développement ; cela ne prouve pas son inclusion dans un bundle précis. Les variantes optionnelles peuvent ne pas être installées sur le système courant. `MPL-2.0` et les autres conditions doivent être examinées selon les fichiers effectivement redistribués et les modifications éventuelles.

| Paquet et version | Licence déclarée | Portée | Optionnel | Relation directe ou emplacement |
| --- | --- | --- | --- | --- |
| [@asamuzakjp/css-color@3.2.0](https://www.npmjs.com/package/%40asamuzakjp%2Fcss-color/v/3.2.0) | MIT | outillage/tests | non | node_modules/@asamuzakjp/css-color |
| [@cacheable/memory@2.2.0](https://www.npmjs.com/package/%40cacheable%2Fmemory/v/2.2.0) | MIT | outillage/tests | non | node_modules/@cacheable/memory |
| [@cacheable/utils@2.5.0](https://www.npmjs.com/package/%40cacheable%2Futils/v/2.5.0) | MIT | outillage/tests | non | node_modules/@cacheable/utils |
| [@csstools/color-helpers@5.1.0](https://www.npmjs.com/package/%40csstools%2Fcolor-helpers/v/5.1.0) | MIT-0 | outillage/tests | non | node_modules/@csstools/color-helpers |
| [@csstools/css-calc@2.1.4](https://www.npmjs.com/package/%40csstools%2Fcss-calc/v/2.1.4) | MIT | outillage/tests | non | node_modules/@csstools/css-calc |
| [@csstools/css-color-parser@3.1.0](https://www.npmjs.com/package/%40csstools%2Fcss-color-parser/v/3.1.0) | MIT | outillage/tests | non | node_modules/@csstools/css-color-parser |
| [@csstools/css-parser-algorithms@3.0.5](https://www.npmjs.com/package/%40csstools%2Fcss-parser-algorithms/v/3.0.5) | MIT | outillage/tests | non | node_modules/@csstools/css-parser-algorithms |
| [@csstools/css-tokenizer@3.0.4](https://www.npmjs.com/package/%40csstools%2Fcss-tokenizer/v/3.0.4) | MIT | outillage/tests | non | node_modules/@csstools/css-tokenizer |
| [@eslint-community/eslint-utils@4.10.1](https://www.npmjs.com/package/%40eslint-community%2Feslint-utils/v/4.10.1) | MIT | outillage/tests | non | node_modules/@eslint-community/eslint-utils |
| [@eslint-community/regexpp@4.12.2](https://www.npmjs.com/package/%40eslint-community%2Fregexpp/v/4.12.2) | MIT | outillage/tests | non | node_modules/@eslint-community/regexpp |
| [@eslint/config-array@0.23.5](https://www.npmjs.com/package/%40eslint%2Fconfig-array/v/0.23.5) | Apache-2.0 | outillage/tests | non | node_modules/@eslint/config-array |
| [@eslint/config-helpers@0.7.0](https://www.npmjs.com/package/%40eslint%2Fconfig-helpers/v/0.7.0) | Apache-2.0 | outillage/tests | non | node_modules/@eslint/config-helpers |
| [@eslint/core@1.2.1](https://www.npmjs.com/package/%40eslint%2Fcore/v/1.2.1) | Apache-2.0 | outillage/tests | non | node_modules/@eslint/core |
| [@eslint/object-schema@3.0.5](https://www.npmjs.com/package/%40eslint%2Fobject-schema/v/3.0.5) | Apache-2.0 | outillage/tests | non | node_modules/@eslint/object-schema |
| [@eslint/plugin-kit@0.7.3](https://www.npmjs.com/package/%40eslint%2Fplugin-kit/v/0.7.3) | Apache-2.0 | outillage/tests | non | node_modules/@eslint/plugin-kit |
| [@humanfs/core@0.19.2](https://www.npmjs.com/package/%40humanfs%2Fcore/v/0.19.2) | Apache-2.0 | outillage/tests | non | node_modules/@humanfs/core |
| [@humanfs/node@0.16.8](https://www.npmjs.com/package/%40humanfs%2Fnode/v/0.16.8) | Apache-2.0 | outillage/tests | non | node_modules/@humanfs/node |
| [@humanfs/types@0.15.0](https://www.npmjs.com/package/%40humanfs%2Ftypes/v/0.15.0) | Apache-2.0 | outillage/tests | non | node_modules/@humanfs/types |
| [@humanwhocodes/module-importer@1.0.1](https://www.npmjs.com/package/%40humanwhocodes%2Fmodule-importer/v/1.0.1) | Apache-2.0 | outillage/tests | non | node_modules/@humanwhocodes/module-importer |
| [@humanwhocodes/retry@0.4.3](https://www.npmjs.com/package/%40humanwhocodes%2Fretry/v/0.4.3) | Apache-2.0 | outillage/tests | non | node_modules/@humanwhocodes/retry |
| [@jridgewell/sourcemap-codec@1.6.0](https://www.npmjs.com/package/%40jridgewell%2Fsourcemap-codec/v/1.6.0) | MIT | outillage/tests | non | node_modules/@jridgewell/sourcemap-codec |
| [@keyv/bigmap@1.3.1](https://www.npmjs.com/package/%40keyv%2Fbigmap/v/1.3.1) | MIT | outillage/tests | non | node_modules/@keyv/bigmap |
| [@keyv/serialize@1.1.1](https://www.npmjs.com/package/%40keyv%2Fserialize/v/1.1.1) | MIT | outillage/tests | non | node_modules/@keyv/serialize |
| [@microsoft/signalr@10.0.11](https://www.npmjs.com/package/%40microsoft%2Fsignalr/v/10.0.11) | MIT | exécution | non | @captureproof/demo-web (exécution) |
| [@oxc-project/types@0.155.0](https://www.npmjs.com/package/%40oxc-project%2Ftypes/v/0.155.0) | MIT | outillage/tests | non | node_modules/@oxc-project/types |
| [@playwright/test@1.64.1](https://www.npmjs.com/package/%40playwright%2Ftest/v/1.64.1) | Apache-2.0 | outillage/tests | non | captureproof-workspace (outillage) |
| [@rolldown/binding-android-arm-eabi@1.2.15](https://www.npmjs.com/package/%40rolldown%2Fbinding-android-arm-eabi/v/1.2.15) | MIT | outillage/tests | oui | node_modules/@rolldown/binding-android-arm-eabi |
| [@rolldown/binding-android-arm64@1.2.15](https://www.npmjs.com/package/%40rolldown%2Fbinding-android-arm64/v/1.2.15) | MIT | outillage/tests | oui | node_modules/@rolldown/binding-android-arm64 |
| [@rolldown/binding-darwin-arm64@1.2.15](https://www.npmjs.com/package/%40rolldown%2Fbinding-darwin-arm64/v/1.2.15) | MIT | outillage/tests | oui | node_modules/@rolldown/binding-darwin-arm64 |
| [@rolldown/binding-darwin-x64@1.2.15](https://www.npmjs.com/package/%40rolldown%2Fbinding-darwin-x64/v/1.2.15) | MIT | outillage/tests | oui | node_modules/@rolldown/binding-darwin-x64 |
| [@rolldown/binding-freebsd-x64@1.2.15](https://www.npmjs.com/package/%40rolldown%2Fbinding-freebsd-x64/v/1.2.15) | MIT | outillage/tests | oui | node_modules/@rolldown/binding-freebsd-x64 |
| [@rolldown/binding-linux-arm-gnueabihf@1.2.15](https://www.npmjs.com/package/%40rolldown%2Fbinding-linux-arm-gnueabihf/v/1.2.15) | MIT | outillage/tests | oui | node_modules/@rolldown/binding-linux-arm-gnueabihf |
| [@rolldown/binding-linux-arm64-gnu@1.2.15](https://www.npmjs.com/package/%40rolldown%2Fbinding-linux-arm64-gnu/v/1.2.15) | MIT | outillage/tests | oui | node_modules/@rolldown/binding-linux-arm64-gnu |
| [@rolldown/binding-linux-arm64-musl@1.2.15](https://www.npmjs.com/package/%40rolldown%2Fbinding-linux-arm64-musl/v/1.2.15) | MIT | outillage/tests | oui | node_modules/@rolldown/binding-linux-arm64-musl |
| [@rolldown/binding-linux-ppc64-gnu@1.2.15](https://www.npmjs.com/package/%40rolldown%2Fbinding-linux-ppc64-gnu/v/1.2.15) | MIT | outillage/tests | oui | node_modules/@rolldown/binding-linux-ppc64-gnu |
| [@rolldown/binding-linux-s390x-gnu@1.2.15](https://www.npmjs.com/package/%40rolldown%2Fbinding-linux-s390x-gnu/v/1.2.15) | MIT | outillage/tests | oui | node_modules/@rolldown/binding-linux-s390x-gnu |
| [@rolldown/binding-linux-x64-gnu@1.2.15](https://www.npmjs.com/package/%40rolldown%2Fbinding-linux-x64-gnu/v/1.2.15) | MIT | outillage/tests | oui | node_modules/@rolldown/binding-linux-x64-gnu |
| [@rolldown/binding-linux-x64-musl@1.2.15](https://www.npmjs.com/package/%40rolldown%2Fbinding-linux-x64-musl/v/1.2.15) | MIT | outillage/tests | oui | node_modules/@rolldown/binding-linux-x64-musl |
| [@rolldown/binding-openharmony-arm64@1.2.15](https://www.npmjs.com/package/%40rolldown%2Fbinding-openharmony-arm64/v/1.2.15) | MIT | outillage/tests | oui | node_modules/@rolldown/binding-openharmony-arm64 |
| [@rolldown/binding-win32-arm64-msvc@1.2.15](https://www.npmjs.com/package/%40rolldown%2Fbinding-win32-arm64-msvc/v/1.2.15) | MIT | outillage/tests | oui | node_modules/@rolldown/binding-win32-arm64-msvc |
| [@rolldown/binding-win32-x64-msvc@1.2.15](https://www.npmjs.com/package/%40rolldown%2Fbinding-win32-x64-msvc/v/1.2.15) | MIT | outillage/tests | oui | node_modules/@rolldown/binding-win32-x64-msvc |
| [@rolldown/pluginutils@1.0.0-rc.7](https://www.npmjs.com/package/%40rolldown%2Fpluginutils/v/1.0.0-rc.7) | MIT | outillage/tests | non | node_modules/@rolldown/pluginutils |
| [@rolldown/pluginutils@1.0.1](https://www.npmjs.com/package/%40rolldown%2Fpluginutils/v/1.0.1) | MIT | outillage/tests | non | node_modules/rolldown/node_modules/@rolldown/pluginutils |
| [@standard-schema/spec@1.1.0](https://www.npmjs.com/package/%40standard-schema%2Fspec/v/1.1.0) | MIT | outillage/tests | non | node_modules/@standard-schema/spec |
| [@types/chai@5.2.3](https://www.npmjs.com/package/%40types%2Fchai/v/5.2.3) | MIT | outillage/tests | non | node_modules/@types/chai |
| [@types/deep-eql@4.0.2](https://www.npmjs.com/package/%40types%2Fdeep-eql/v/4.0.2) | MIT | outillage/tests | non | node_modules/@types/deep-eql |
| [@types/esrecurse@4.3.1](https://www.npmjs.com/package/%40types%2Fesrecurse/v/4.3.1) | MIT | outillage/tests | non | node_modules/@types/esrecurse |
| [@types/estree@1.0.9](https://www.npmjs.com/package/%40types%2Festree/v/1.0.9) | MIT | outillage/tests | non | node_modules/@types/estree |
| [@types/json-schema@7.0.15](https://www.npmjs.com/package/%40types%2Fjson-schema/v/7.0.15) | MIT | outillage/tests | non | node_modules/@types/json-schema |
| [@types/node@24.10.0](https://www.npmjs.com/package/%40types%2Fnode/v/24.10.0) | MIT | outillage/tests | non | captureproof-workspace (outillage) |
| [@types/qrcode@1.5.6](https://www.npmjs.com/package/%40types%2Fqrcode/v/1.5.6) | MIT | outillage/tests | non | @captureproof/demo-web (outillage) |
| [@types/react@19.2.2](https://www.npmjs.com/package/%40types%2Freact/v/19.2.2) | MIT | outillage/tests | non | @captureproof/demo-web (outillage) |
| [@types/react-dom@19.2.2](https://www.npmjs.com/package/%40types%2Freact-dom/v/19.2.2) | MIT | outillage/tests | non | @captureproof/demo-web (outillage) |
| [@typescript-eslint/eslint-plugin@8.72.0](https://www.npmjs.com/package/%40typescript-eslint%2Feslint-plugin/v/8.72.0) | MIT | outillage/tests | non | node_modules/@typescript-eslint/eslint-plugin |
| [@typescript-eslint/parser@8.72.0](https://www.npmjs.com/package/%40typescript-eslint%2Fparser/v/8.72.0) | MIT | outillage/tests | non | node_modules/@typescript-eslint/parser |
| [@typescript-eslint/project-service@8.72.0](https://www.npmjs.com/package/%40typescript-eslint%2Fproject-service/v/8.72.0) | MIT | outillage/tests | non | node_modules/@typescript-eslint/project-service |
| [@typescript-eslint/scope-manager@8.72.0](https://www.npmjs.com/package/%40typescript-eslint%2Fscope-manager/v/8.72.0) | MIT | outillage/tests | non | node_modules/@typescript-eslint/scope-manager |
| [@typescript-eslint/tsconfig-utils@8.72.0](https://www.npmjs.com/package/%40typescript-eslint%2Ftsconfig-utils/v/8.72.0) | MIT | outillage/tests | non | node_modules/@typescript-eslint/tsconfig-utils |
| [@typescript-eslint/type-utils@8.72.0](https://www.npmjs.com/package/%40typescript-eslint%2Ftype-utils/v/8.72.0) | MIT | outillage/tests | non | node_modules/@typescript-eslint/type-utils |
| [@typescript-eslint/types@8.72.0](https://www.npmjs.com/package/%40typescript-eslint%2Ftypes/v/8.72.0) | MIT | outillage/tests | non | node_modules/@typescript-eslint/types |
| [@typescript-eslint/typescript-estree@8.72.0](https://www.npmjs.com/package/%40typescript-eslint%2Ftypescript-estree/v/8.72.0) | MIT | outillage/tests | non | node_modules/@typescript-eslint/typescript-estree |
| [@typescript-eslint/utils@8.72.0](https://www.npmjs.com/package/%40typescript-eslint%2Futils/v/8.72.0) | MIT | outillage/tests | non | node_modules/@typescript-eslint/utils |
| [@typescript-eslint/visitor-keys@8.72.0](https://www.npmjs.com/package/%40typescript-eslint%2Fvisitor-keys/v/8.72.0) | MIT | outillage/tests | non | node_modules/@typescript-eslint/visitor-keys |
| [@vitejs/plugin-react@6.0.1](https://www.npmjs.com/package/%40vitejs%2Fplugin-react/v/6.0.1) | MIT | outillage/tests | non | @captureproof/demo-web (outillage) |
| [@vitest/expect@4.1.12](https://www.npmjs.com/package/%40vitest%2Fexpect/v/4.1.12) | MIT | outillage/tests | non | node_modules/@vitest/expect |
| [@vitest/mocker@4.1.12](https://www.npmjs.com/package/%40vitest%2Fmocker/v/4.1.12) | MIT | outillage/tests | non | node_modules/@vitest/mocker |
| [@vitest/pretty-format@4.1.12](https://www.npmjs.com/package/%40vitest%2Fpretty-format/v/4.1.12) | MIT | outillage/tests | non | node_modules/@vitest/pretty-format |
| [@vitest/runner@4.1.12](https://www.npmjs.com/package/%40vitest%2Frunner/v/4.1.12) | MIT | outillage/tests | non | node_modules/@vitest/runner |
| [@vitest/snapshot@4.1.12](https://www.npmjs.com/package/%40vitest%2Fsnapshot/v/4.1.12) | MIT | outillage/tests | non | node_modules/@vitest/snapshot |
| [@vitest/spy@4.1.12](https://www.npmjs.com/package/%40vitest%2Fspy/v/4.1.12) | MIT | outillage/tests | non | node_modules/@vitest/spy |
| [@vitest/utils@4.1.12](https://www.npmjs.com/package/%40vitest%2Futils/v/4.1.12) | MIT | outillage/tests | non | node_modules/@vitest/utils |
| [abort-controller@3.0.0](https://www.npmjs.com/package/abort-controller/v/3.0.0) | MIT | exécution | non | node_modules/abort-controller |
| [acorn@8.19.0](https://www.npmjs.com/package/acorn/v/8.19.0) | MIT | outillage/tests | non | node_modules/acorn |
| [acorn-jsx@5.3.2](https://www.npmjs.com/package/acorn-jsx/v/5.3.2) | MIT | outillage/tests | non | node_modules/acorn-jsx |
| [agent-base@7.1.4](https://www.npmjs.com/package/agent-base/v/7.1.4) | MIT | outillage/tests | non | node_modules/agent-base |
| [ajv@6.15.0](https://www.npmjs.com/package/ajv/v/6.15.0) | MIT | outillage/tests | non | node_modules/ajv |
| [ansi-regex@5.0.1](https://www.npmjs.com/package/ansi-regex/v/5.0.1) | MIT | exécution | non | node_modules/ansi-regex |
| [ansi-styles@4.3.0](https://www.npmjs.com/package/ansi-styles/v/4.3.0) | MIT | exécution | non | node_modules/ansi-styles |
| [assertion-error@2.0.1](https://www.npmjs.com/package/assertion-error/v/2.0.1) | MIT | outillage/tests | non | node_modules/assertion-error |
| [balanced-match@4.0.4](https://www.npmjs.com/package/balanced-match/v/4.0.4) | MIT | outillage/tests | non | node_modules/balanced-match |
| [brace-expansion@5.0.12](https://www.npmjs.com/package/brace-expansion/v/5.0.12) | MIT | outillage/tests | non | node_modules/brace-expansion |
| [cacheable@2.5.0](https://www.npmjs.com/package/cacheable/v/2.5.0) | MIT | outillage/tests | non | node_modules/cacheable |
| [camelcase@5.3.1](https://www.npmjs.com/package/camelcase/v/5.3.1) | MIT | exécution | non | node_modules/camelcase |
| [chai@6.3.0](https://www.npmjs.com/package/chai/v/6.3.0) | MIT | outillage/tests | non | node_modules/chai |
| [cliui@6.0.0](https://www.npmjs.com/package/cliui/v/6.0.0) | ISC | exécution | non | node_modules/cliui |
| [color-convert@2.0.1](https://www.npmjs.com/package/color-convert/v/2.0.1) | MIT | exécution | non | node_modules/color-convert |
| [color-name@1.1.4](https://www.npmjs.com/package/color-name/v/1.1.4) | MIT | exécution | non | node_modules/color-name |
| [convert-source-map@2.0.0](https://www.npmjs.com/package/convert-source-map/v/2.0.0) | MIT | outillage/tests | non | node_modules/convert-source-map |
| [cross-spawn@7.0.6](https://www.npmjs.com/package/cross-spawn/v/7.0.6) | MIT | outillage/tests | non | node_modules/cross-spawn |
| [cssstyle@4.6.0](https://www.npmjs.com/package/cssstyle/v/4.6.0) | MIT | outillage/tests | non | node_modules/cssstyle |
| [csstype@3.2.3](https://www.npmjs.com/package/csstype/v/3.2.3) | MIT | outillage/tests | non | node_modules/csstype |
| [data-urls@5.0.0](https://www.npmjs.com/package/data-urls/v/5.0.0) | MIT | outillage/tests | non | node_modules/data-urls |
| [debug@4.4.3](https://www.npmjs.com/package/debug/v/4.4.3) | MIT | outillage/tests | non | node_modules/debug |
| [decamelize@1.2.0](https://www.npmjs.com/package/decamelize/v/1.2.0) | MIT | exécution | non | node_modules/decamelize |
| [decimal.js@10.6.0](https://www.npmjs.com/package/decimal.js/v/10.6.0) | MIT | outillage/tests | non | node_modules/decimal.js |
| [deep-is@0.1.4](https://www.npmjs.com/package/deep-is/v/0.1.4) | MIT | outillage/tests | non | node_modules/deep-is |
| [detect-libc@2.1.2](https://www.npmjs.com/package/detect-libc/v/2.1.2) | Apache-2.0 | outillage/tests | non | node_modules/detect-libc |
| [dijkstrajs@1.0.3](https://www.npmjs.com/package/dijkstrajs/v/1.0.3) | MIT | exécution | non | node_modules/dijkstrajs |
| [emoji-regex@8.0.0](https://www.npmjs.com/package/emoji-regex/v/8.0.0) | MIT | exécution | non | node_modules/emoji-regex |
| [entities@6.0.1](https://www.npmjs.com/package/entities/v/6.0.1) | BSD-2-Clause | outillage/tests | non | node_modules/entities |
| [es-module-lexer@2.3.2](https://www.npmjs.com/package/es-module-lexer/v/2.3.2) | MIT | outillage/tests | non | node_modules/es-module-lexer |
| [escape-string-regexp@4.0.0](https://www.npmjs.com/package/escape-string-regexp/v/4.0.0) | MIT | outillage/tests | non | node_modules/escape-string-regexp |
| [eslint@10.13.0](https://www.npmjs.com/package/eslint/v/10.13.0) | MIT | outillage/tests | non | captureproof-workspace (outillage) |
| [eslint-scope@9.1.2](https://www.npmjs.com/package/eslint-scope/v/9.1.2) | BSD-2-Clause | outillage/tests | non | node_modules/eslint-scope |
| [eslint-visitor-keys@3.4.3](https://www.npmjs.com/package/eslint-visitor-keys/v/3.4.3) | Apache-2.0 | outillage/tests | non | node_modules/@eslint-community/eslint-utils/node_modules/eslint-visitor-keys |
| [eslint-visitor-keys@5.0.1](https://www.npmjs.com/package/eslint-visitor-keys/v/5.0.1) | Apache-2.0 | outillage/tests | non | node_modules/eslint-visitor-keys |
| [espree@11.2.0](https://www.npmjs.com/package/espree/v/11.2.0) | BSD-2-Clause | outillage/tests | non | node_modules/espree |
| [esquery@1.7.0](https://www.npmjs.com/package/esquery/v/1.7.0) | BSD-3-Clause | outillage/tests | non | node_modules/esquery |
| [esrecurse@4.3.0](https://www.npmjs.com/package/esrecurse/v/4.3.0) | BSD-2-Clause | outillage/tests | non | node_modules/esrecurse |
| [estraverse@5.3.0](https://www.npmjs.com/package/estraverse/v/5.3.0) | BSD-2-Clause | outillage/tests | non | node_modules/estraverse |
| [estree-walker@3.0.3](https://www.npmjs.com/package/estree-walker/v/3.0.3) | MIT | outillage/tests | non | node_modules/estree-walker |
| [esutils@2.0.3](https://www.npmjs.com/package/esutils/v/2.0.3) | BSD-2-Clause | outillage/tests | non | node_modules/esutils |
| [event-target-shim@5.0.1](https://www.npmjs.com/package/event-target-shim/v/5.0.1) | MIT | exécution | non | node_modules/event-target-shim |
| [eventsource@2.0.2](https://www.npmjs.com/package/eventsource/v/2.0.2) | MIT | exécution | non | node_modules/eventsource |
| [expect-type@1.4.0](https://www.npmjs.com/package/expect-type/v/1.4.0) | Apache-2.0 | outillage/tests | non | node_modules/expect-type |
| [fast-deep-equal@3.1.3](https://www.npmjs.com/package/fast-deep-equal/v/3.1.3) | MIT | outillage/tests | non | node_modules/fast-deep-equal |
| [fast-json-stable-stringify@2.1.0](https://www.npmjs.com/package/fast-json-stable-stringify/v/2.1.0) | MIT | outillage/tests | non | node_modules/fast-json-stable-stringify |
| [fast-levenshtein@2.0.6](https://www.npmjs.com/package/fast-levenshtein/v/2.0.6) | MIT | outillage/tests | non | node_modules/fast-levenshtein |
| [fdir@6.5.0](https://www.npmjs.com/package/fdir/v/6.5.0) | MIT | outillage/tests | non | node_modules/fdir |
| [fetch-cookie@2.2.0](https://www.npmjs.com/package/fetch-cookie/v/2.2.0) | Unlicense | exécution | non | node_modules/fetch-cookie |
| [file-entry-cache@11.1.5](https://www.npmjs.com/package/file-entry-cache/v/11.1.5) | MIT | outillage/tests | non | node_modules/file-entry-cache |
| [find-up@4.1.0](https://www.npmjs.com/package/find-up/v/4.1.0) | MIT | exécution | non | node_modules/yargs/node_modules/find-up |
| [find-up@5.0.0](https://www.npmjs.com/package/find-up/v/5.0.0) | MIT | outillage/tests | non | node_modules/find-up |
| [flat-cache@6.1.23](https://www.npmjs.com/package/flat-cache/v/6.1.23) | MIT | outillage/tests | non | node_modules/flat-cache |
| [flatted@3.4.4](https://www.npmjs.com/package/flatted/v/3.4.4) | ISC | outillage/tests | non | node_modules/flatted |
| [fsevents@2.3.3](https://www.npmjs.com/package/fsevents/v/2.3.3) | MIT | outillage/tests | oui | node_modules/fsevents |
| [get-caller-file@2.0.5](https://www.npmjs.com/package/get-caller-file/v/2.0.5) | ISC | exécution | non | node_modules/get-caller-file |
| [glob-parent@6.0.2](https://www.npmjs.com/package/glob-parent/v/6.0.2) | ISC | outillage/tests | non | node_modules/glob-parent |
| [hashery@1.5.1](https://www.npmjs.com/package/hashery/v/1.5.1) | MIT | outillage/tests | non | node_modules/hashery |
| [hookified@1.15.1](https://www.npmjs.com/package/hookified/v/1.15.1) | MIT | outillage/tests | non | node_modules/hookified |
| [hookified@2.2.0](https://www.npmjs.com/package/hookified/v/2.2.0) | MIT | outillage/tests | non | node_modules/qified/node_modules/hookified |
| [html-encoding-sniffer@4.0.0](https://www.npmjs.com/package/html-encoding-sniffer/v/4.0.0) | MIT | outillage/tests | non | node_modules/html-encoding-sniffer |
| [http-proxy-agent@7.0.2](https://www.npmjs.com/package/http-proxy-agent/v/7.0.2) | MIT | outillage/tests | non | node_modules/http-proxy-agent |
| [https-proxy-agent@7.0.6](https://www.npmjs.com/package/https-proxy-agent/v/7.0.6) | MIT | outillage/tests | non | node_modules/https-proxy-agent |
| [iconv-lite@0.6.3](https://www.npmjs.com/package/iconv-lite/v/0.6.3) | MIT | outillage/tests | non | node_modules/iconv-lite |
| [ignore@5.3.2](https://www.npmjs.com/package/ignore/v/5.3.2) | MIT | outillage/tests | non | node_modules/ignore |
| [ignore@7.0.13](https://www.npmjs.com/package/ignore/v/7.0.13) | MIT | outillage/tests | non | node_modules/@typescript-eslint/eslint-plugin/node_modules/ignore |
| [imurmurhash@0.1.4](https://www.npmjs.com/package/imurmurhash/v/0.1.4) | MIT | outillage/tests | non | node_modules/imurmurhash |
| [is-extglob@2.1.1](https://www.npmjs.com/package/is-extglob/v/2.1.1) | MIT | outillage/tests | non | node_modules/is-extglob |
| [is-fullwidth-code-point@3.0.0](https://www.npmjs.com/package/is-fullwidth-code-point/v/3.0.0) | MIT | exécution | non | node_modules/is-fullwidth-code-point |
| [is-glob@4.0.3](https://www.npmjs.com/package/is-glob/v/4.0.3) | MIT | outillage/tests | non | node_modules/is-glob |
| [is-potential-custom-element-name@1.0.1](https://www.npmjs.com/package/is-potential-custom-element-name/v/1.0.1) | MIT | outillage/tests | non | node_modules/is-potential-custom-element-name |
| [isexe@2.0.0](https://www.npmjs.com/package/isexe/v/2.0.0) | ISC | outillage/tests | non | node_modules/isexe |
| [jose@6.2.13](https://www.npmjs.com/package/jose/v/6.2.13) | MIT | exécution | non | @captureproof/receipt-verifier (exécution) |
| [jsdom@26.1.0](https://www.npmjs.com/package/jsdom/v/26.1.0) | MIT | outillage/tests | non | @captureproof/capture-web (outillage) |
| [json-schema-traverse@0.4.1](https://www.npmjs.com/package/json-schema-traverse/v/0.4.1) | MIT | outillage/tests | non | node_modules/json-schema-traverse |
| [json-stable-stringify-without-jsonify@1.0.1](https://www.npmjs.com/package/json-stable-stringify-without-jsonify/v/1.0.1) | MIT | outillage/tests | non | node_modules/json-stable-stringify-without-jsonify |
| [keyv@5.6.0](https://www.npmjs.com/package/keyv/v/5.6.0) | MIT | outillage/tests | non | node_modules/keyv |
| [levn@0.4.1](https://www.npmjs.com/package/levn/v/0.4.1) | MIT | outillage/tests | non | node_modules/levn |
| [lightningcss@1.33.0](https://www.npmjs.com/package/lightningcss/v/1.33.0) | MPL-2.0 | outillage/tests | non | node_modules/lightningcss |
| [lightningcss-android-arm64@1.33.0](https://www.npmjs.com/package/lightningcss-android-arm64/v/1.33.0) | MPL-2.0 | outillage/tests | oui | node_modules/lightningcss-android-arm64 |
| [lightningcss-darwin-arm64@1.33.0](https://www.npmjs.com/package/lightningcss-darwin-arm64/v/1.33.0) | MPL-2.0 | outillage/tests | oui | node_modules/lightningcss-darwin-arm64 |
| [lightningcss-darwin-x64@1.33.0](https://www.npmjs.com/package/lightningcss-darwin-x64/v/1.33.0) | MPL-2.0 | outillage/tests | oui | node_modules/lightningcss-darwin-x64 |
| [lightningcss-freebsd-x64@1.33.0](https://www.npmjs.com/package/lightningcss-freebsd-x64/v/1.33.0) | MPL-2.0 | outillage/tests | oui | node_modules/lightningcss-freebsd-x64 |
| [lightningcss-linux-arm-gnueabihf@1.33.0](https://www.npmjs.com/package/lightningcss-linux-arm-gnueabihf/v/1.33.0) | MPL-2.0 | outillage/tests | oui | node_modules/lightningcss-linux-arm-gnueabihf |
| [lightningcss-linux-arm64-gnu@1.33.0](https://www.npmjs.com/package/lightningcss-linux-arm64-gnu/v/1.33.0) | MPL-2.0 | outillage/tests | oui | node_modules/lightningcss-linux-arm64-gnu |
| [lightningcss-linux-arm64-musl@1.33.0](https://www.npmjs.com/package/lightningcss-linux-arm64-musl/v/1.33.0) | MPL-2.0 | outillage/tests | oui | node_modules/lightningcss-linux-arm64-musl |
| [lightningcss-linux-x64-gnu@1.33.0](https://www.npmjs.com/package/lightningcss-linux-x64-gnu/v/1.33.0) | MPL-2.0 | outillage/tests | oui | node_modules/lightningcss-linux-x64-gnu |
| [lightningcss-linux-x64-musl@1.33.0](https://www.npmjs.com/package/lightningcss-linux-x64-musl/v/1.33.0) | MPL-2.0 | outillage/tests | oui | node_modules/lightningcss-linux-x64-musl |
| [lightningcss-win32-arm64-msvc@1.33.0](https://www.npmjs.com/package/lightningcss-win32-arm64-msvc/v/1.33.0) | MPL-2.0 | outillage/tests | oui | node_modules/lightningcss-win32-arm64-msvc |
| [lightningcss-win32-x64-msvc@1.33.0](https://www.npmjs.com/package/lightningcss-win32-x64-msvc/v/1.33.0) | MPL-2.0 | outillage/tests | oui | node_modules/lightningcss-win32-x64-msvc |
| [locate-path@5.0.0](https://www.npmjs.com/package/locate-path/v/5.0.0) | MIT | exécution | non | node_modules/yargs/node_modules/locate-path |
| [locate-path@6.0.0](https://www.npmjs.com/package/locate-path/v/6.0.0) | MIT | outillage/tests | non | node_modules/locate-path |
| [lru-cache@10.4.3](https://www.npmjs.com/package/lru-cache/v/10.4.3) | ISC | outillage/tests | non | node_modules/lru-cache |
| [magic-string@0.30.21](https://www.npmjs.com/package/magic-string/v/0.30.21) | MIT | outillage/tests | non | node_modules/magic-string |
| [minimatch@10.2.6](https://www.npmjs.com/package/minimatch/v/10.2.6) | BlueOak-1.0.0 | outillage/tests | non | node_modules/minimatch |
| [ms@2.1.3](https://www.npmjs.com/package/ms/v/2.1.3) | MIT | outillage/tests | non | node_modules/ms |
| [nanoid@3.3.20](https://www.npmjs.com/package/nanoid/v/3.3.20) | MIT | outillage/tests | non | node_modules/nanoid |
| [natural-compare@1.4.0](https://www.npmjs.com/package/natural-compare/v/1.4.0) | MIT | outillage/tests | non | node_modules/natural-compare |
| [node-fetch@2.7.0](https://www.npmjs.com/package/node-fetch/v/2.7.0) | MIT | exécution | non | node_modules/node-fetch |
| [nwsapi@2.2.28](https://www.npmjs.com/package/nwsapi/v/2.2.28) | MIT | outillage/tests | non | node_modules/nwsapi |
| [obug@2.2.1](https://www.npmjs.com/package/obug/v/2.2.1) | MIT | outillage/tests | non | node_modules/obug |
| [optionator@0.9.4](https://www.npmjs.com/package/optionator/v/0.9.4) | MIT | outillage/tests | non | node_modules/optionator |
| [p-limit@2.3.0](https://www.npmjs.com/package/p-limit/v/2.3.0) | MIT | exécution | non | node_modules/yargs/node_modules/p-limit |
| [p-limit@3.1.0](https://www.npmjs.com/package/p-limit/v/3.1.0) | MIT | outillage/tests | non | node_modules/p-limit |
| [p-locate@4.1.0](https://www.npmjs.com/package/p-locate/v/4.1.0) | MIT | exécution | non | node_modules/yargs/node_modules/p-locate |
| [p-locate@5.0.0](https://www.npmjs.com/package/p-locate/v/5.0.0) | MIT | outillage/tests | non | node_modules/p-locate |
| [p-try@2.2.0](https://www.npmjs.com/package/p-try/v/2.2.0) | MIT | exécution | non | node_modules/p-try |
| [parse5@7.3.0](https://www.npmjs.com/package/parse5/v/7.3.0) | MIT | outillage/tests | non | node_modules/parse5 |
| [path-exists@4.0.0](https://www.npmjs.com/package/path-exists/v/4.0.0) | MIT | exécution | non | node_modules/path-exists |
| [path-key@3.1.1](https://www.npmjs.com/package/path-key/v/3.1.1) | MIT | outillage/tests | non | node_modules/path-key |
| [pathe@2.0.3](https://www.npmjs.com/package/pathe/v/2.0.3) | MIT | outillage/tests | non | node_modules/pathe |
| [picocolors@1.1.1](https://www.npmjs.com/package/picocolors/v/1.1.1) | ISC | outillage/tests | non | node_modules/picocolors |
| [picomatch@4.0.7](https://www.npmjs.com/package/picomatch/v/4.0.7) | MIT | outillage/tests | non | node_modules/picomatch |
| [playwright@1.64.1](https://www.npmjs.com/package/playwright/v/1.64.1) | Apache-2.0 | outillage/tests | non | node_modules/playwright |
| [playwright-core@1.64.1](https://www.npmjs.com/package/playwright-core/v/1.64.1) | Apache-2.0 | outillage/tests | non | node_modules/playwright-core |
| [pngjs@5.0.0](https://www.npmjs.com/package/pngjs/v/5.0.0) | MIT | exécution | non | node_modules/pngjs |
| [postcss@8.5.31](https://www.npmjs.com/package/postcss/v/8.5.31) | MIT | outillage/tests | non | node_modules/postcss |
| [prelude-ls@1.2.1](https://www.npmjs.com/package/prelude-ls/v/1.2.1) | MIT | outillage/tests | non | node_modules/prelude-ls |
| [psl@1.15.0](https://www.npmjs.com/package/psl/v/1.15.0) | MIT | exécution | non | node_modules/psl |
| [punycode@2.3.1](https://www.npmjs.com/package/punycode/v/2.3.1) | MIT | exécution | non | node_modules/punycode |
| [qified@0.10.1](https://www.npmjs.com/package/qified/v/0.10.1) | MIT | outillage/tests | non | node_modules/qified |
| [qrcode@1.5.4](https://www.npmjs.com/package/qrcode/v/1.5.4) | MIT | exécution | non | @captureproof/demo-web (exécution) |
| [querystringify@2.2.0](https://www.npmjs.com/package/querystringify/v/2.2.0) | MIT | exécution | non | node_modules/querystringify |
| [react@19.3.1](https://www.npmjs.com/package/react/v/19.3.1) | MIT | exécution | non | @captureproof/demo-web (exécution) |
| [react-dom@19.3.1](https://www.npmjs.com/package/react-dom/v/19.3.1) | MIT | exécution | non | @captureproof/demo-web (exécution) |
| [require-directory@2.1.1](https://www.npmjs.com/package/require-directory/v/2.1.1) | MIT | exécution | non | node_modules/require-directory |
| [require-main-filename@2.0.0](https://www.npmjs.com/package/require-main-filename/v/2.0.0) | ISC | exécution | non | node_modules/require-main-filename |
| [requires-port@1.0.0](https://www.npmjs.com/package/requires-port/v/1.0.0) | MIT | exécution | non | node_modules/requires-port |
| [rolldown@1.2.15](https://www.npmjs.com/package/rolldown/v/1.2.15) | MIT | outillage/tests | non | node_modules/rolldown |
| [rrweb-cssom@0.8.0](https://www.npmjs.com/package/rrweb-cssom/v/0.8.0) | MIT | outillage/tests | non | node_modules/rrweb-cssom |
| [safer-buffer@2.1.2](https://www.npmjs.com/package/safer-buffer/v/2.1.2) | MIT | outillage/tests | non | node_modules/safer-buffer |
| [saxes@6.0.0](https://www.npmjs.com/package/saxes/v/6.0.0) | ISC | outillage/tests | non | node_modules/saxes |
| [scheduler@0.28.0](https://www.npmjs.com/package/scheduler/v/0.28.0) | MIT | exécution | non | node_modules/scheduler |
| [semver@7.8.5](https://www.npmjs.com/package/semver/v/7.8.5) | ISC | outillage/tests | non | node_modules/semver |
| [set-blocking@2.0.0](https://www.npmjs.com/package/set-blocking/v/2.0.0) | ISC | exécution | non | node_modules/set-blocking |
| [set-cookie-parser@2.7.3](https://www.npmjs.com/package/set-cookie-parser/v/2.7.3) | MIT | exécution | non | node_modules/set-cookie-parser |
| [shebang-command@2.0.0](https://www.npmjs.com/package/shebang-command/v/2.0.0) | MIT | outillage/tests | non | node_modules/shebang-command |
| [shebang-regex@3.0.0](https://www.npmjs.com/package/shebang-regex/v/3.0.0) | MIT | outillage/tests | non | node_modules/shebang-regex |
| [siginfo@2.0.0](https://www.npmjs.com/package/siginfo/v/2.0.0) | ISC | outillage/tests | non | node_modules/siginfo |
| [source-map-js@1.2.2](https://www.npmjs.com/package/source-map-js/v/1.2.2) | BSD-3-Clause | outillage/tests | non | node_modules/source-map-js |
| [stackback@0.0.2](https://www.npmjs.com/package/stackback/v/0.0.2) | MIT | outillage/tests | non | node_modules/stackback |
| [std-env@4.3.0](https://www.npmjs.com/package/std-env/v/4.3.0) | MIT | outillage/tests | non | node_modules/std-env |
| [string-width@4.2.3](https://www.npmjs.com/package/string-width/v/4.2.3) | MIT | exécution | non | node_modules/string-width |
| [strip-ansi@6.0.1](https://www.npmjs.com/package/strip-ansi/v/6.0.1) | MIT | exécution | non | node_modules/strip-ansi |
| [symbol-tree@3.2.4](https://www.npmjs.com/package/symbol-tree/v/3.2.4) | MIT | outillage/tests | non | node_modules/symbol-tree |
| [tinybench@2.9.0](https://www.npmjs.com/package/tinybench/v/2.9.0) | MIT | outillage/tests | non | node_modules/tinybench |
| [tinyexec@1.3.1](https://www.npmjs.com/package/tinyexec/v/1.3.1) | MIT | outillage/tests | non | node_modules/tinyexec |
| [tinyglobby@0.2.17](https://www.npmjs.com/package/tinyglobby/v/0.2.17) | MIT | outillage/tests | non | node_modules/tinyglobby |
| [tinyrainbow@3.2.0](https://www.npmjs.com/package/tinyrainbow/v/3.2.0) | MIT | outillage/tests | non | node_modules/tinyrainbow |
| [tldts@6.1.86](https://www.npmjs.com/package/tldts/v/6.1.86) | MIT | outillage/tests | non | node_modules/tldts |
| [tldts-core@6.1.86](https://www.npmjs.com/package/tldts-core/v/6.1.86) | MIT | outillage/tests | non | node_modules/tldts-core |
| [tough-cookie@4.1.4](https://www.npmjs.com/package/tough-cookie/v/4.1.4) | BSD-3-Clause | exécution | non | node_modules/tough-cookie |
| [tough-cookie@5.1.2](https://www.npmjs.com/package/tough-cookie/v/5.1.2) | BSD-3-Clause | outillage/tests | non | node_modules/jsdom/node_modules/tough-cookie |
| [tr46@0.0.3](https://www.npmjs.com/package/tr46/v/0.0.3) | MIT | exécution | non | node_modules/tr46 |
| [tr46@5.1.1](https://www.npmjs.com/package/tr46/v/5.1.1) | MIT | outillage/tests | non | node_modules/data-urls/node_modules/tr46 |
| [tr46@5.1.1](https://www.npmjs.com/package/tr46/v/5.1.1) | MIT | outillage/tests | non | node_modules/jsdom/node_modules/tr46 |
| [ts-api-utils@2.5.0](https://www.npmjs.com/package/ts-api-utils/v/2.5.0) | MIT | outillage/tests | non | node_modules/ts-api-utils |
| [type-check@0.4.0](https://www.npmjs.com/package/type-check/v/0.4.0) | MIT | outillage/tests | non | node_modules/type-check |
| [typescript@6.0.2](https://www.npmjs.com/package/typescript/v/6.0.2) | Apache-2.0 | outillage/tests | non | captureproof-workspace (outillage) |
| [typescript-eslint@8.72.0](https://www.npmjs.com/package/typescript-eslint/v/8.72.0) | MIT | outillage/tests | non | captureproof-workspace (outillage) |
| [undici-types@7.16.0](https://www.npmjs.com/package/undici-types/v/7.16.0) | MIT | outillage/tests | non | node_modules/undici-types |
| [universalify@0.2.0](https://www.npmjs.com/package/universalify/v/0.2.0) | MIT | exécution | non | node_modules/universalify |
| [uri-js@4.4.1](https://www.npmjs.com/package/uri-js/v/4.4.1) | BSD-2-Clause | outillage/tests | non | node_modules/uri-js |
| [url-parse@1.5.10](https://www.npmjs.com/package/url-parse/v/1.5.10) | MIT | exécution | non | node_modules/url-parse |
| [vite@8.3.5](https://www.npmjs.com/package/vite/v/8.3.5) | MIT | outillage/tests | non | @captureproof/demo-web (outillage) |
| [vitest@4.1.12](https://www.npmjs.com/package/vitest/v/4.1.12) | MIT | outillage/tests | non | captureproof-workspace (outillage) |
| [w3c-xmlserializer@5.0.0](https://www.npmjs.com/package/w3c-xmlserializer/v/5.0.0) | MIT | outillage/tests | non | node_modules/w3c-xmlserializer |
| [webidl-conversions@3.0.1](https://www.npmjs.com/package/webidl-conversions/v/3.0.1) | BSD-2-Clause | exécution | non | node_modules/webidl-conversions |
| [webidl-conversions@7.0.0](https://www.npmjs.com/package/webidl-conversions/v/7.0.0) | BSD-2-Clause | outillage/tests | non | node_modules/data-urls/node_modules/webidl-conversions |
| [webidl-conversions@7.0.0](https://www.npmjs.com/package/webidl-conversions/v/7.0.0) | BSD-2-Clause | outillage/tests | non | node_modules/jsdom/node_modules/webidl-conversions |
| [whatwg-encoding@3.1.1](https://www.npmjs.com/package/whatwg-encoding/v/3.1.1) | MIT | outillage/tests | non | node_modules/whatwg-encoding |
| [whatwg-mimetype@4.0.0](https://www.npmjs.com/package/whatwg-mimetype/v/4.0.0) | MIT | outillage/tests | non | node_modules/whatwg-mimetype |
| [whatwg-url@14.2.0](https://www.npmjs.com/package/whatwg-url/v/14.2.0) | MIT | outillage/tests | non | node_modules/data-urls/node_modules/whatwg-url |
| [whatwg-url@14.2.0](https://www.npmjs.com/package/whatwg-url/v/14.2.0) | MIT | outillage/tests | non | node_modules/jsdom/node_modules/whatwg-url |
| [whatwg-url@5.0.0](https://www.npmjs.com/package/whatwg-url/v/5.0.0) | MIT | exécution | non | node_modules/whatwg-url |
| [which@2.0.2](https://www.npmjs.com/package/which/v/2.0.2) | ISC | outillage/tests | non | node_modules/which |
| [which-module@2.0.1](https://www.npmjs.com/package/which-module/v/2.0.1) | ISC | exécution | non | node_modules/which-module |
| [why-is-node-running@2.3.0](https://www.npmjs.com/package/why-is-node-running/v/2.3.0) | MIT | outillage/tests | non | node_modules/why-is-node-running |
| [word-wrap@1.2.5](https://www.npmjs.com/package/word-wrap/v/1.2.5) | MIT | outillage/tests | non | node_modules/word-wrap |
| [wrap-ansi@6.2.0](https://www.npmjs.com/package/wrap-ansi/v/6.2.0) | MIT | exécution | non | node_modules/wrap-ansi |
| [ws@7.5.13](https://www.npmjs.com/package/ws/v/7.5.13) | MIT | exécution | non | node_modules/ws |
| [ws@8.22.0](https://www.npmjs.com/package/ws/v/8.22.0) | MIT | outillage/tests | non | node_modules/jsdom/node_modules/ws |
| [xml-name-validator@5.0.0](https://www.npmjs.com/package/xml-name-validator/v/5.0.0) | Apache-2.0 | outillage/tests | non | node_modules/xml-name-validator |
| [xmlchars@2.2.0](https://www.npmjs.com/package/xmlchars/v/2.2.0) | MIT | outillage/tests | non | node_modules/xmlchars |
| [y18n@4.0.3](https://www.npmjs.com/package/y18n/v/4.0.3) | ISC | exécution | non | node_modules/y18n |
| [yargs@15.4.1](https://www.npmjs.com/package/yargs/v/15.4.1) | MIT | exécution | non | node_modules/yargs |
| [yargs-parser@18.1.3](https://www.npmjs.com/package/yargs-parser/v/18.1.3) | ISC | exécution | non | node_modules/yargs-parser |
| [yocto-queue@0.1.0](https://www.npmjs.com/package/yocto-queue/v/0.1.0) | MIT | outillage/tests | non | node_modules/yocto-queue |

## NuGet : dépendances directes et transitives

Les colonnes « déclaration » et « URL » viennent des manifests `.nuspec` du cache restauré, sans classement juridique ajouté. L'empreinte du manifeste permet de vérifier la source locale de chaque ligne. Les références aux frameworks partagés .NET et au SDK ne sont pas des paquets applicatifs de ces verrous ; leurs notices accompagnent leurs distributions officielles.

| Paquet et version | Relation | Type et déclaration | URL déclarée | SHA-256 du nuspec |
| --- | --- | --- | --- | --- |
| [jose-jwt@5.3.0](https://www.nuget.org/packages/jose-jwt/5.3.0) | API directe; tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 0f626a236771f5a390843d1954e0eed45e4a7057135a9a0e23eb1f815ed1f2de |
| [Microsoft.AspNetCore.Connections.Abstractions@10.0.13](https://www.nuget.org/packages/Microsoft.AspNetCore.Connections.Abstractions/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 252ad3ff8205a8df30e874ff0a5ea12a06f3c47072a9af1a3fd1b2b46c76debf |
| [Microsoft.AspNetCore.Http.Connections.Client@10.0.13](https://www.nuget.org/packages/Microsoft.AspNetCore.Http.Connections.Client/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | cfd8ab3cee834d5eba9f66f40abc10d2989efa2d37a3f6e09f984ca6f268300a |
| [Microsoft.AspNetCore.Http.Connections.Common@10.0.13](https://www.nuget.org/packages/Microsoft.AspNetCore.Http.Connections.Common/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 1094cbfd67e98bedde594e962dcc6a0621cfb19b5a36ddad1021d260ff8f3b33 |
| [Microsoft.AspNetCore.Mvc.Testing@10.0.13](https://www.nuget.org/packages/Microsoft.AspNetCore.Mvc.Testing/10.0.13) | tests API directe | expression : MIT | [licence](https://licenses.nuget.org/MIT) | f2d0ce1c45716dc32fadf0aa048f8c7482ed561d53ca82f7862600a9c7cdcd79 |
| [Microsoft.AspNetCore.OpenApi@10.0.13](https://www.nuget.org/packages/Microsoft.AspNetCore.OpenApi/10.0.13) | API directe; tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | ca2ed8c028bc1a2b0aa358e0734ad2352903770680b1dcad4cc4f374c300848d |
| [Microsoft.AspNetCore.SignalR.Client@10.0.13](https://www.nuget.org/packages/Microsoft.AspNetCore.SignalR.Client/10.0.13) | tests API directe | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 1b641f3edbe5c020111c8a3dcad7ecbc65c0774548f5fba446517385427b3166 |
| [Microsoft.AspNetCore.SignalR.Client.Core@10.0.13](https://www.nuget.org/packages/Microsoft.AspNetCore.SignalR.Client.Core/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 39b0e0f885404be2b3eae3828ed0e7c634fbed159d4015a7d455e5d71db8a72f |
| [Microsoft.AspNetCore.SignalR.Common@10.0.13](https://www.nuget.org/packages/Microsoft.AspNetCore.SignalR.Common/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 2f8575a2ec439e421ceaa501ca3d1c093586f318fcfc991ebce06bbbc0474a52 |
| [Microsoft.AspNetCore.SignalR.Protocols.Json@10.0.13](https://www.nuget.org/packages/Microsoft.AspNetCore.SignalR.Protocols.Json/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 63c774eb00168066fb821786aa44345b4126bc125f1636b8880e1849fa4951ae |
| [Microsoft.AspNetCore.TestHost@10.0.13](https://www.nuget.org/packages/Microsoft.AspNetCore.TestHost/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 3af08a2ee6c6cbd6bfcc4a6d875eec8ed6b1369d5960dd4589cd49879f7f7c51 |
| [Microsoft.CodeCoverage@18.11.0](https://www.nuget.org/packages/Microsoft.CodeCoverage/18.11.0) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 2d043c98fae44e965c87a13d75b0d20d72a5a2bc08ec3f7fc48413d1cfb690b3 |
| [Microsoft.Data.Sqlite@10.0.13](https://www.nuget.org/packages/Microsoft.Data.Sqlite/10.0.13) | API directe; tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 14548e9e520e10f9dc16261c64a59606731d962ffe8a90043fcf96dc33ffac40 |
| [Microsoft.Data.Sqlite.Core@10.0.13](https://www.nuget.org/packages/Microsoft.Data.Sqlite.Core/10.0.13) | API transitive; tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | cae22388d3e0d116841a8285d4a6b922156c4bdb30b890687d40813f290767a6 |
| [Microsoft.Extensions.Configuration@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Configuration/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | e4967350b756395033fe08ab827cdac2cb2144a0cd1bf77a44731884f6984f0c |
| [Microsoft.Extensions.Configuration.Abstractions@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.Abstractions/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 314facae64103f772925be66661866440ebdc87818d14150522460a4ebdb06c6 |
| [Microsoft.Extensions.Configuration.Binder@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.Binder/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | acb9686218062f4b17e3020004c27caf54f86c115c5d620cd7d124667a41ffff |
| [Microsoft.Extensions.Configuration.CommandLine@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.CommandLine/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 1ab79d801c0f11504776f5518e78bf988d89ab4d68894347f57227b92dc88417 |
| [Microsoft.Extensions.Configuration.EnvironmentVariables@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.EnvironmentVariables/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | feea0b599cd84cf5a2477e5fc3c02c2eff5dbc8ab6db92ece1079d0e5183693e |
| [Microsoft.Extensions.Configuration.FileExtensions@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.FileExtensions/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | beb8e368577d981b995f47bc3695ace828664b0727d599879c0efbd497e68d9a |
| [Microsoft.Extensions.Configuration.Json@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.Json/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 8f857d2a11483a46d2aa38b1c87b9a09cf248560d383399bb416dc5eda803ded |
| [Microsoft.Extensions.Configuration.UserSecrets@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Configuration.UserSecrets/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | bcabf0dcfcbb3802273857980d52ee03891edc062b7126e2d88e388d419654c9 |
| [Microsoft.Extensions.DependencyInjection@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.DependencyInjection/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 39f0d9c0d603553c7d8045e6b8efb370ad21dafd12b98c18bd6964a9d9a09534 |
| [Microsoft.Extensions.DependencyInjection.Abstractions@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.DependencyInjection.Abstractions/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | ec1c51eb90a4226aa13870d456ccd34b6e80658ec314547ceb79e47ad3249069 |
| [Microsoft.Extensions.DependencyModel@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.DependencyModel/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 2e969b1ec3c23b9fb72ec9bcc7425e1840a4c1a00d1db82571002fe711a732ff |
| [Microsoft.Extensions.Diagnostics@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Diagnostics/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 3da8bf7799ef96be1f61d28e6e24341ff44a118e6fc07bb36eaa11b567273927 |
| [Microsoft.Extensions.Diagnostics.Abstractions@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Diagnostics.Abstractions/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | b95e6ea1107ce70ad3a9edbdc9acbf25375da04f3b5419c91a779bf1238da64b |
| [Microsoft.Extensions.Features@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Features/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 8c221c484f319623d77922912625378685ad3437c63a8e24ad88239d53093dfd |
| [Microsoft.Extensions.FileProviders.Abstractions@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.FileProviders.Abstractions/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | aba3fca0a4996799cd1d7fee727d1cb4b414ba9b317b6f6c62bd5816f40d2978 |
| [Microsoft.Extensions.FileProviders.Physical@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.FileProviders.Physical/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 8a18baf7e216b651db571ca7d38f844f9f50666f79505f909dc29a10b8821385 |
| [Microsoft.Extensions.FileSystemGlobbing@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.FileSystemGlobbing/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 9a20fe5aad794d92abaf55d33ff71dfbb58a07c8fe5a0d5b8fc1ab278d348005 |
| [Microsoft.Extensions.Hosting@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Hosting/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 7b245a966ea4b474e4942e8478b2d4df59973c28187d8b305e01c19df8938d10 |
| [Microsoft.Extensions.Hosting.Abstractions@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Hosting.Abstractions/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 7e4e00cf603d2466dd86c0fe93f8a077d4e6a129b6948f7aff3dd9ab3ecbd446 |
| [Microsoft.Extensions.Logging@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Logging/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 9c2c22321a3fb1b48a754c40d9af7cb3a443bf2cf13550c550aca5a527ff37db |
| [Microsoft.Extensions.Logging.Abstractions@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Logging.Abstractions/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 5cf07bdbf6c071a75f07908369d7d078a04ca012af8df71728ff748a1fd818e9 |
| [Microsoft.Extensions.Logging.Configuration@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Logging.Configuration/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | c337f20c454506a22f927c43ead55396f5d8cff376e66b3c83315227dd0d731a |
| [Microsoft.Extensions.Logging.Console@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Logging.Console/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 7f3dc7ced3ed20a842c7cb66d8a8584c893883042a54806af3a47c69ce5529a6 |
| [Microsoft.Extensions.Logging.Debug@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Logging.Debug/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 734c05aa4c9d0f6e491810408d559e85f5138e665268c5b780947cb402262a58 |
| [Microsoft.Extensions.Logging.EventLog@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Logging.EventLog/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 176f85e8c0f9507509fd104bda4c044986fedae6da5213a0b15f4542488b0b3e |
| [Microsoft.Extensions.Logging.EventSource@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Logging.EventSource/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 9874f2418f14bb4744cd722b48612d12361f22b9eddf6e4e60526eede2a572ae |
| [Microsoft.Extensions.Options@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Options/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | a41380a2ce7eebbc668ef6635b0a452a3c72ef618892996422545df4345bc46b |
| [Microsoft.Extensions.Options.ConfigurationExtensions@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Options.ConfigurationExtensions/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 1dde1090a100c2a30a370645516612804963998ec0bc19eeb4f3b5b50ffb58a2 |
| [Microsoft.Extensions.Primitives@10.0.13](https://www.nuget.org/packages/Microsoft.Extensions.Primitives/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | e82aab032c88deebaeb36aaf0f98504500b199b445b08158850a9fcc4bfccda0 |
| [Microsoft.NET.Test.Sdk@18.11.0](https://www.nuget.org/packages/Microsoft.NET.Test.Sdk/18.11.0) | tests API directe | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 84d55da3bba186da041a678d9abdc60d77d484e6dc074ce4329ce898d9723377 |
| [Microsoft.OpenApi@2.12.2](https://www.nuget.org/packages/Microsoft.OpenApi/2.12.2) | API transitive; tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 51780bbfff64a8638ae398d4aec5c4035a33496bac7f115ccbd04f6d8e2807f3 |
| [Microsoft.TestPlatform.ObjectModel@18.11.0](https://www.nuget.org/packages/Microsoft.TestPlatform.ObjectModel/18.11.0) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 0cf2373d0bc81ee42d51679fef567cbacff7b3be05e685ec802a6b05164d85a7 |
| [Microsoft.TestPlatform.TestHost@18.11.0](https://www.nuget.org/packages/Microsoft.TestPlatform.TestHost/18.11.0) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 5ffc102eb28b66f9d30a2f366e147fc385030435fa92ff2f0cdfe27903ca7034 |
| [SkiaSharp@4.153.1](https://www.nuget.org/packages/SkiaSharp/4.153.1) | API directe; tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 7c04ead5281ebf05c676af46a0ac7e674ade0f54c994336e842f3157a89feabe |
| [SkiaSharp.NativeAssets.Linux.NoDependencies@4.153.1](https://www.nuget.org/packages/SkiaSharp.NativeAssets.Linux.NoDependencies/4.153.1) | API directe; tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 577014811a90cfc3f846fcdfaad8a3d40ebb643cfb9c2b5eb233e0c4e939ef8a |
| [SkiaSharp.NativeAssets.macOS@4.153.1](https://www.nuget.org/packages/SkiaSharp.NativeAssets.macOS/4.153.1) | API transitive; tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | e5b94ed7aa7339637b89450d18de1c1b3179032ea59e64e108336839f2a25462 |
| [SkiaSharp.NativeAssets.Win32@4.153.1](https://www.nuget.org/packages/SkiaSharp.NativeAssets.Win32/4.153.1) | API transitive; tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 7ca8008c6c410b8b4d5cb2063e64b10da97c529ab70668c2b80776a34e7734d5 |
| [SQLitePCLRaw.bundle_e_sqlite3@2.1.13](https://www.nuget.org/packages/SQLitePCLRaw.bundle_e_sqlite3/2.1.13) | API transitive; tests API transitive | expression : Apache-2.0 | [licence](https://licenses.nuget.org/Apache-2.0) | f04f469c99056d21b928d6677ae2cd6db582fa0228ce934741ecefa2fae3c09d |
| [SQLitePCLRaw.core@2.1.13](https://www.nuget.org/packages/SQLitePCLRaw.core/2.1.13) | API transitive; tests API transitive | expression : Apache-2.0 | [licence](https://licenses.nuget.org/Apache-2.0) | 8e410ff52c26114c7c3124cf3e77d663abbd9ec49801324ed1bc1aa7ea1c91ae |
| [SQLitePCLRaw.lib.e_sqlite3@2.1.13](https://www.nuget.org/packages/SQLitePCLRaw.lib.e_sqlite3/2.1.13) | API transitive; tests API transitive | expression : Apache-2.0 | [licence](https://licenses.nuget.org/Apache-2.0) | 5e0800665aeb09107c3b45e1162109efb9b83dbaad987a4eca5d686d34769e86 |
| [SQLitePCLRaw.provider.e_sqlite3@2.1.13](https://www.nuget.org/packages/SQLitePCLRaw.provider.e_sqlite3/2.1.13) | API transitive; tests API transitive | expression : Apache-2.0 | [licence](https://licenses.nuget.org/Apache-2.0) | d31fbb24bed1097f15170bc81b1de4832213f9d50deab423ec8c7aa16995b1c7 |
| [System.Diagnostics.EventLog@10.0.13](https://www.nuget.org/packages/System.Diagnostics.EventLog/10.0.13) | tests API transitive | expression : MIT | [licence](https://licenses.nuget.org/MIT) | 143e1d07bab6d1b246ffe50eed5bb43e5e5d9c0b90f94ad1ac55f06e615398bf |
| [xunit@2.9.3](https://www.nuget.org/packages/xunit/2.9.3) | tests API directe | expression : Apache-2.0 | [licence](https://licenses.nuget.org/Apache-2.0) | 8f3373c5260b2acec2874a280640e0fbb9ac538d754880d7abaa4473c3497d25 |
| [xunit.abstractions@2.0.3](https://www.nuget.org/packages/xunit.abstractions/2.0.3) | tests API transitive | URL seule : non déclarée | [licence](https://raw.githubusercontent.com/xunit/xunit/master/license.txt) | e59191df9e3047dd953b695c886597786ac2771f66897baa40877f643da9f7b1 |
| [xunit.analyzers@1.18.0](https://www.nuget.org/packages/xunit.analyzers/1.18.0) | tests API transitive | expression : Apache-2.0 | [licence](https://licenses.nuget.org/Apache-2.0) | 270ffb0dce41126154f16bad2ee025da605185fb5308247877745e5eef97689e |
| [xunit.assert@2.9.3](https://www.nuget.org/packages/xunit.assert/2.9.3) | tests API transitive | expression : Apache-2.0 | [licence](https://licenses.nuget.org/Apache-2.0) | e3f99045088c262b14a62dd93cf025912e9e653f5ce1d77e7f858238e0bcb508 |
| [xunit.core@2.9.3](https://www.nuget.org/packages/xunit.core/2.9.3) | tests API transitive | expression : Apache-2.0 | [licence](https://licenses.nuget.org/Apache-2.0) | 08c844d40924a386d7600e2523c57f1a2a1d6a77c03b8c0001501831944a0691 |
| [xunit.extensibility.core@2.9.3](https://www.nuget.org/packages/xunit.extensibility.core/2.9.3) | tests API transitive | expression : Apache-2.0 | [licence](https://licenses.nuget.org/Apache-2.0) | 0c5886e9320c6dd828e50048c27cf355314fe20e2d8d4026b4a3a9fe42d4a359 |
| [xunit.extensibility.execution@2.9.3](https://www.nuget.org/packages/xunit.extensibility.execution/2.9.3) | tests API transitive | expression : Apache-2.0 | [licence](https://licenses.nuget.org/Apache-2.0) | 9c5498549b5200b65ba0c7e0d4597c269c6bbb2e374ea8f1c28d76dc3f3a0bdd |
| [xunit.runner.visualstudio@4.0.1](https://www.nuget.org/packages/xunit.runner.visualstudio/4.0.1) | tests API directe | expression : Apache-2.0 | [licence](https://licenses.nuget.org/Apache-2.0) | b304952a072d1e6280180b2c2077ce138e499cd341a3af67c5ace65df27b9975 |

## Notices fournies et composants natifs

Les notices originales trouvées à la racine des paquets NuGet résolus sont recensées ci-dessous avec leur taille et l'empreinte des octets originaux. Un éventuel fichier de licence désigné explicitement par le manifeste est également inclus. Leur présence n'est pas déduite d'un nom de bibliothèque. Ces empreintes ne remplacent pas les textes à conserver lors d'une redistribution.

| Paquet | Fichier fourni | Octets | SHA-256 |
| --- | --- | --- | --- |
| jose-jwt@5.3.0 | LICENSE | 1104 | 8b8d71198e5b98e2e54282781c53e19842d53d4f26fcfa4f85cb71c0ece7b4c1 |
| Microsoft.AspNetCore.Connections.Abstractions@10.0.13 | THIRD-PARTY-NOTICES.TXT | 56748 | 307d014f65d8482314f1400ddeae7a0cbabb96c2207bcc77f6233cc10588e5d9 |
| Microsoft.AspNetCore.Http.Connections.Client@10.0.13 | THIRD-PARTY-NOTICES.TXT | 56748 | 307d014f65d8482314f1400ddeae7a0cbabb96c2207bcc77f6233cc10588e5d9 |
| Microsoft.AspNetCore.Http.Connections.Common@10.0.13 | THIRD-PARTY-NOTICES.TXT | 56748 | 307d014f65d8482314f1400ddeae7a0cbabb96c2207bcc77f6233cc10588e5d9 |
| Microsoft.AspNetCore.Mvc.Testing@10.0.13 | THIRD-PARTY-NOTICES.TXT | 56748 | 307d014f65d8482314f1400ddeae7a0cbabb96c2207bcc77f6233cc10588e5d9 |
| Microsoft.AspNetCore.OpenApi@10.0.13 | THIRD-PARTY-NOTICES.TXT | 56748 | 307d014f65d8482314f1400ddeae7a0cbabb96c2207bcc77f6233cc10588e5d9 |
| Microsoft.AspNetCore.SignalR.Client.Core@10.0.13 | THIRD-PARTY-NOTICES.TXT | 56748 | 307d014f65d8482314f1400ddeae7a0cbabb96c2207bcc77f6233cc10588e5d9 |
| Microsoft.AspNetCore.SignalR.Client@10.0.13 | THIRD-PARTY-NOTICES.TXT | 56748 | 307d014f65d8482314f1400ddeae7a0cbabb96c2207bcc77f6233cc10588e5d9 |
| Microsoft.AspNetCore.SignalR.Common@10.0.13 | THIRD-PARTY-NOTICES.TXT | 56748 | 307d014f65d8482314f1400ddeae7a0cbabb96c2207bcc77f6233cc10588e5d9 |
| Microsoft.AspNetCore.SignalR.Protocols.Json@10.0.13 | THIRD-PARTY-NOTICES.TXT | 56748 | 307d014f65d8482314f1400ddeae7a0cbabb96c2207bcc77f6233cc10588e5d9 |
| Microsoft.AspNetCore.TestHost@10.0.13 | THIRD-PARTY-NOTICES.TXT | 56748 | 307d014f65d8482314f1400ddeae7a0cbabb96c2207bcc77f6233cc10588e5d9 |
| Microsoft.CodeCoverage@18.11.0 | ThirdPartyNotices.txt | 1813 | 4fc4244935bbe3516164402c573f053a5d246571ed4d357e6cccd8ebec296bbc |
| Microsoft.Extensions.Configuration.Abstractions@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Configuration.Binder@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Configuration.CommandLine@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Configuration.EnvironmentVariables@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Configuration.FileExtensions@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Configuration.Json@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Configuration.UserSecrets@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Configuration@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.DependencyInjection.Abstractions@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.DependencyInjection@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.DependencyModel@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Diagnostics.Abstractions@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Diagnostics@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Features@10.0.13 | THIRD-PARTY-NOTICES.TXT | 56748 | 307d014f65d8482314f1400ddeae7a0cbabb96c2207bcc77f6233cc10588e5d9 |
| Microsoft.Extensions.FileProviders.Abstractions@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.FileProviders.Physical@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.FileSystemGlobbing@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Hosting.Abstractions@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Hosting@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Logging.Abstractions@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Logging.Configuration@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Logging.Console@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Logging.Debug@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Logging.EventLog@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Logging.EventSource@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Logging@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Options.ConfigurationExtensions@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Options@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.Extensions.Primitives@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |
| Microsoft.TestPlatform.TestHost@18.11.0 | ThirdPartyNotices.txt | 4054 | e2ce7628e0f67d0d724eea9d9286a6938bf1eedd253fc84b23d72ae54778a5f7 |
| SkiaSharp.NativeAssets.Linux.NoDependencies@4.153.1 | LICENSE.txt | 1129 | 89101e35a8c66fd4d6dffc1763259161d35cb564c169714ec227a768c89f2938 |
| SkiaSharp.NativeAssets.Linux.NoDependencies@4.153.1 | THIRD-PARTY-NOTICES.txt | 139775 | 21504c46c4c58aa64c1055bd2dcbc5f9a136b4b8c412ed3cc6740e22c5b127f5 |
| SkiaSharp.NativeAssets.macOS@4.153.1 | LICENSE.txt | 1129 | 89101e35a8c66fd4d6dffc1763259161d35cb564c169714ec227a768c89f2938 |
| SkiaSharp.NativeAssets.macOS@4.153.1 | THIRD-PARTY-NOTICES.txt | 139775 | 21504c46c4c58aa64c1055bd2dcbc5f9a136b4b8c412ed3cc6740e22c5b127f5 |
| SkiaSharp.NativeAssets.Win32@4.153.1 | LICENSE.txt | 1129 | 89101e35a8c66fd4d6dffc1763259161d35cb564c169714ec227a768c89f2938 |
| SkiaSharp.NativeAssets.Win32@4.153.1 | THIRD-PARTY-NOTICES.txt | 139775 | 21504c46c4c58aa64c1055bd2dcbc5f9a136b4b8c412ed3cc6740e22c5b127f5 |
| SkiaSharp@4.153.1 | LICENSE.txt | 1129 | 89101e35a8c66fd4d6dffc1763259161d35cb564c169714ec227a768c89f2938 |
| System.Diagnostics.EventLog@10.0.13 | THIRD-PARTY-NOTICES.TXT | 78041 | 6d15e10a101c6bfff2ab4429ed061bf76c456fc4b23ad6b03e0d0f8377148a21 |

Les manifests SkiaSharp et NativeAssets déclarent MIT. Les paquets natifs fournissent aussi `THIRD-PARTY-NOTICES.txt` : leur contenu est plus large que cette déclaration du paquet. Les notices natives actuellement relevées citent : `ANGLE`, `DNG SDK`, `HarfBuzz`, `ICU`, `SPIR-V Headers`, `SPIR-V Tools`, `etc1`, `expat`, `freetype`, `gif`, `imgui`, `jsoncpp`, `libjpeg-turbo`, `libmicrohttpd`, `libpng`, `libwebp`, `piex`, `sdl`, `sfntly`, `skia`, `zlib`.

Le texte fourni contient notamment des sections BSD (ANGLE, Skia), les conditions IJG/BSD/zlib de libjpeg-turbo, des alternatives FTL/GPL pour FreeType, des textes MPL/GPL/LGPL, LGPL/eCos pour libmicrohttpd et les conditions du DNG SDK. Ce constat porte sur les notices de distribution, pas sur une analyse des symboles ni sur la preuve que chaque composant est lié dans chaque binaire. Ne pas réduire cet ensemble à « MIT uniquement » ou « toutes dépendances sous Apache-2.0 ».

Avant de redistribuer un exécutable, une image ou un bundle, conserver les licences et attributions originales des composants effectivement embarqués et examiner leurs conditions applicables. Les textes natifs ne doivent pas être traduits ou réécrits. La publication .NET de référence doit inclure `LICENSE.txt` de SkiaSharp et le `THIRD-PARTY-NOTICES.txt` natif original avec les binaires ; vérifier ces fichiers dans le résultat publié et l'image finale. La présence des notices n'est pas une preuve suffisante de conformité complète. Aucun titulaire, transfert de droits, exception ni autorisation de brevet supplémentaire n'est inventé ici.
