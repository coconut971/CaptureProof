# @captureproof/receipt-verifier

[English](README.md)

Vérificateur TypeScript ESM indépendant pour les reçus CaptureProof et leurs originaux. Il utilise Web Crypto et `jose.compactVerify` sur le JWS compact ES256 original. Il ne dépend ni du contrôleur de capture, ni de React, ni de l'API .NET de référence, ni d'un stockage central. La vérification n'émet aucune requête réseau.

```ts
import { verifyReceipt } from '@captureproof/receipt-verifier';

const result = await verifyReceipt(
  originalJws,
  [{ name: 'identifiant-photo.jpg', bytes: originalBytes }],
  explicitlyTrustedPublicJwks.keys,
  { integrationSpace: 'votre-espace', businessReference: 'DOSSIER-001' },
);
console.log(result.valid, result.signature, result.key, result.files, result.context);
```

Fournissez tous les originaux sous les noms exacts `<id>.jpg` du manifeste. Un fichier manquant, supplémentaire, en double, renommé ou modifié invalide la vérification. Le contexte attendu est comparé exactement. Fournissez-le pour contrôler un dossier métier précis. Son omission donne `context.status: 'not-checked'` : un résultat valide ne confirme alors pas votre référence métier attendue.

## Établir explicitement la confiance

`trustedKeys` est une liste explicitement acceptée de JWK publics EC P-256 avec `kid`. Choisissez un canal de confiance pour distribuer ces clés. Télécharger `/api/keys` depuis le serveur qui fournit le reçu ne crée pas une confiance indépendante. Aucune URL du reçu n'est consultée. Les clés privées et les extensions d'en-tête non prises en charge, notamment `jku`, `x5u`, `jwk`, `x5c` et `crit`, sont refusées.

Le résultat distingue `signature`, `key`, `schema`, `files` et `context`. Le manifeste n'est exposé qu'après validation de la signature et du schéma. `valid` exige une clé explicitement reconnue, une signature et un schéma valides, l'ensemble exact des fichiers et aucun échec de contexte.

Le reçu lie les octets exacts acceptés au contexte métier déclaré par l'émetteur. Il n'atteste ni l'origine physique de la caméra, ni l'authenticité de l'objet, ni l'absence d'IA, ni une heure de confiance. Les dates sont des déclarations signées, pas une certification d'horodatage indépendante.

## Installation locale et CLI

Ce workspace est privé et n'est pas publié sur le registre npm. Depuis la racine du dépôt :

```sh
npm ci
npm run build
node scripts/package-npm.mjs
```

Le script exécute de vraies commandes `npm pack` et inspecte les archives produites. Sa commande individuelle de vérification est `npm pack --workspace packages/receipt-verifier --pack-destination artifacts`. Dans un projet intégrateur :

```sh
npm install /chemin/absolu/vers/CaptureProof/artifacts/captureproof-receipt-verifier-0.1.0.tgz
```

Après construction du dépôt, lancez le CLI indépendamment :

```sh
node packages/receipt-verifier/dist/cli.js --receipt receipt.jws --keys trusted-public.jwks.json --space votre-espace --reference DOSSIER-001 identifiant-photo.jpg
```

Le fichier de confiance doit être un objet JWKS public `{"keys":[...]}`. Codes de sortie : `0` valide, `1` vérification refusée, `2` arguments ou fichiers d'entrée illisibles/invalides. Les originaux restent inchangés. L'archive locale installe également le binaire `captureproof-verify` dans le répertoire des commandes de dépendances du projet intégrateur.

Node.js 24 ou supérieur, ou un navigateur disposant de Web Crypto, est requis. `VERIFICATION_LIMITS` exporte des bornes explicites : JWS de 256 Ki caractères, manifeste de 128 Kio, 32 photos, 25 Mio par photo, 128 Mio cumulés et 64 clés de confiance. La politique signée peut imposer des bornes inférieures.

Les tests d'interopérabilité .NET emploient des répertoires de fixtures privés contrôlés par `CAPTUREPROOF_INTEROP_DIR` et `CAPTUREPROOF_RESTORE_INTEROP_DIR`. Ces reçus, images et clés générés ne font pas partie du package. Voir le [guide d'intégration](../../docs/fr/integration.md) pour les responsabilités de la capture et du backend.
