[English](../receipt.md) · Français

# Reçu portable, confiance et clés

Le reçu est un JWS compact, avec un en-tête protégé exactement de la forme :

```json
{ "alg": "ES256", "typ": "captureproof-receipt+jws", "kid": "identifiant-de-cle" }
```

ES256 désigne ECDSA P-256 avec SHA-256. jose-jwt produit la signature, `jose` vérifie les segments compacts d’origine. Le test d’interopérabilité réel vérifie aussi la signature ES256 de 64 octets au format JWS, et non une représentation DER. Le payload est un JSON UTF-8 sérialisé une fois puis conservé textuellement avec le JWS dans SQLite. Une répétition de finalisation ou un redémarrage retourne le même reçu.

## Manifeste version 1

| Champ | Sens |
| --- | --- |
| `schemaVersion` | Entier 1 ; autres versions refusées |
| `issuer` | Émetteur déclaré, actuellement `CaptureProof demo` |
| `receiptId`, `sessionId` | Identifiants techniques du reçu et de la session |
| `context` | `{integrationSpace,businessReference}` attendu côté intégration |
| `finalizedAt` | Date déclarée par le serveur, sans autorité de temps indépendante |
| `policy` | Copie de `minPhotos`, `maxPhotos`, `maxBytesPerPhoto`, `sessionTtlSeconds` |
| `photoCount` | Nombre de fichiers finalisés |
| `files` | Liste ordonnée par réception puis identifiant |
| `files[].id` | Nom de l’original exporté : `<id>.jpg` |
| `files[].sha256` | SHA-256 hexadécimal calculé côté serveur sur les octets exacts |
| `files[].size` | Taille exacte en octets |
| `files[].contentType` | `image/jpeg`, format entièrement décodé avant acceptation |
| `files[].receivedAt` | Heure de réception déclarée par le serveur |
| `guarantees` | `integrity:true`, `hardwareCameraAttested:false`, `aiOriginAssessed:false` |

Le manifeste ne contient ni cookie, secret d’invitation, autorisation de dépôt, GPS ou empreinte matérielle. Le JPEG original n’est jamais modifié silencieusement ; une version redimensionnée ou réencodée est un autre fichier. Les métadonnées éventuellement présentes dans un original reçu restent ses octets de référence et ne sont pas interprétées comme des faits attestés.

## Vérification indépendante

Le vérificateur n’effectue aucun appel réseau. Fournir le JWS, l’ensemble exact des fichiers avec leurs noms d’origine et un jeu de clés publiques explicitement reconnu. `kid` cherche uniquement dans ce jeu. Une clé incluse dans un reçu, un `jku`, un `jwk`, une URL ou une extension critique inconnue ne peut pas établir la confiance. Le vérificateur refuse aussi `alg=none`, les autres algorithmes, les clés privées ou ambiguës et les champs non prévus.

Les résultats exposent séparément signature, reconnaissance de clé, schéma, fichiers et contexte. Sans contexte attendu, ce contrôle indique `not-checked` ; une intégrité valide ne signifie alors pas que le reçu appartient à l’annonce visée. Fournir les deux champs attendus pour déceler une substitution d’annonce.

Les limites du package sont : JWS 256 Kio de caractères ASCII, en-tête 4 Kio, manifeste 128 Kio, 32 photos, 25 Mio par photo, 128 Mio cumulés et 64 clés. La petite interface impose des bornes supplémentaires documentées à l’écran : 50 fichiers sélectionnés au plus, 12 Mio chacun, 40 Mio cumulés et 20 clés. Le package continue d’imposer son nombre exact maximal de 32 photos. La politique serveur refuse un maximum théorique supérieur à 128 Mio par session.

Exemple CLI après `npm run build` :

```sh
node packages/receipt-verifier/dist/cli.js --receipt dossier/receipt.jws --keys trusted-public.jwks.json --space demo --reference DEMO-001 dossier/identifiant-photo.jpg
```

Voir l’aide et la syntaxe exacte dans [le README du package](../../packages/receipt-verifier/README.fr.md). Télécharger séparément reçu, originaux et clés. Aucune archive importée n’est nécessaire ; le projet n’expose donc pas d’extracteur ZIP ni de chemins d’archive non fiables.

## Génération et rotation

Au premier démarrage, le serveur crée une clé P-256 dans `<DataDirectory>/signing/active-private.pem`. Le `kid` est dérivé de la clé publique. Les fichiers `public-<kid>.json` sont conservés. La clé privée n’est ni compilée, ni envoyée au frontend, ni incluse dans l’image Docker. Elle doit être protégée par les permissions du système et persister avec les données.

Pour tourner la clé, arrêter d’abord le serveur, conserver une sauvegarde protégée et exécuter avec le **même DataDirectory** :

```powershell
$env:CaptureProof__DataDirectory = Join-Path (Get-Location) '.data/demo'
.\.tools\dotnet\dotnet run --no-launch-profile --project src/CaptureProof.Api -- --rotate-key
```

Sous Linux, utiliser `dotnet` avec la même option. La commande conserve les anciennes clés publiques et remplace la clé privée active, puis quitte. Redémarrer le serveur et distribuer la nouvelle clé publique par un canal de confiance. Ne pas faire tourner deux processus simultanément. La conservation des clés publiques permet de vérifier les reçus historiques ; elle n’implémente pas un système de révocation ou d’horodatage après compromission. Une clé compromise impose une réponse opérateur et une politique de confiance externe.

Références : [JWS RFC 7515](https://www.rfc-editor.org/rfc/rfc7515.html), [ES256 RFC 7518](https://www.rfc-editor.org/rfc/rfc7518.html), [bonnes pratiques RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html).
