# @captureproof/capture-web

[English](README.md)

Un contrôleur TypeScript réutilisable de capture photo sur navigateur mobile, accompagné d'un Web Component facultatif. React et l'API ASP.NET Core de référence sont des exemples séparés, pas des dépendances de ce package.

## Choisir un point d'entrée

| Import | Utilisation |
| --- | --- |
| `@captureproof/capture-web/headless` | Votre propre interface, avec le contrôleur et ses contrats TypeScript. Cet import n'évalue pas `HTMLElement` et n'enregistre aucun composant. |
| `@captureproof/capture-web` | Entrée navigateur avec le même contrôleur, les types, `CaptureProofElement` et `registerCaptureElement`. Un DOM doit être disponible lors de l'import. |

L'entrée headless peut être importée par une construction côté serveur ou par Node sans DOM. La prise de vue nécessite toujours un navigateur mobile compatible, une origine HTTPS sûre, une vidéo et l'autorisation caméra. Ce n'est pas une API caméra côté serveur.

## Utiliser le Web Component facultatif

```ts
import {
  CaptureController, registerCaptureElement,
  type CaptureProofElement, type CaptureSession, type CaptureTransport,
} from '@captureproof/capture-web';

declare const authorizedSession: CaptureSession;
declare const transport: CaptureTransport;

registerCaptureElement();
const controller = new CaptureController({
  mode: 'server-receipt',
  policy: authorizedSession.policy,
  session: authorizedSession,
  transport,
});
const element = document.createElement('capture-proof') as CaptureProofElement;
element.controller = controller;
element.addEventListener('capturecomplete', event => {
  const { jws } = (event as CustomEvent<{ mode: 'server-receipt'; jws: string }>).detail;
  // Conserver ou proposer le reçu original selon le parcours de votre application.
  console.info('Reçu disponible', typeof jws === 'string');
});
document.querySelector('#capture')!.append(element);
// Lors de la destruction définitive de l'intégration :
// element.remove();
// controller.dispose();
```

Les libellés du composant fourni sont actuellement en français. Utilisez `/headless` pour maîtriser la présentation, la langue et la navigation. Voir le [guide d'intégration de votre interface et backend](../../docs/fr/integration.md).

## Contrat du contrôleur

`startCamera(video)` demande de préférence la caméra arrière, avec l'audio désactivé et `playsInline`. Les nouveaux octets JPEG proviennent exclusivement de la vidéo active. Il n'existe aucune méthode d'import depuis une galerie, un fichier, le presse-papiers ou un dépôt. La détection mobile oriente l'interface ; ce n'est ni une attestation d'appareil ni une autorisation serveur.

Utilisez `snapshot` pour afficher caméra, photos, progression, erreurs et capacités `canCapture`/`canFinalize`. Écoutez `change`, reliez votre interface à `capture()`, `retry(id)`, `remove(id)` et `finalize()`, puis utilisez `sync(session)` ou `refresh()` pour les mises à jour serveur. `photoaccepted` porte les métadonnées acceptées ; `complete` porte le reçu ou les photos locales. Appelez `dispose()` lors de la destruction définitive de l'intégration.

L'arrière-plan, `pagehide`, l'interruption d'une piste ou la déconnexion du composant arrêtent la caméra. Sa reprise demande une action explicite. L'orientation des photos et le comportement caméra dépendent encore de l'appareil et du navigateur.

## Deux modes explicites

- `capture-only` : aucun transport ni backend requis. Les JPEG restent en mémoire dans la page. `complete` porte `{ mode: 'capture-only', photos: [{ id, blob }] }`. Téléchargez-les ou traitez-les avant de détruire le contrôleur ou de quitter la page. Aucun reçu signé n'est produit.
- `server-receipt` : fournissez une `CaptureSession` déjà autorisée et un `CaptureTransport` typé compatible. Le serveur reste maître de la politique, des autorisations, quotas, octets acceptés et finalisation. `complete` porte `{ mode: 'server-receipt', jws }` seulement après confirmation serveur.

`CaptureTransport` implémente `load`, `reserve`, `upload`, `remove` et `finalize`. La reprise réutilise l'identifiant d'envoi et les octets JPEG d'origine. Un échec d'envoi bloque la finalisation. Le retry recharge d'abord l'état pour retrouver un dépôt accepté dont la réponse a été perdue. L'adaptateur et le backend doivent respecter ces règles, notamment en retournant l'`uploadId` d'origine dans les métadonnées acceptées. L'implémentation de référence est [apps/web/src/api.ts](../../apps/web/src/api.ts).

Les photos en attente restent en mémoire dans la même page. Ce n'est pas un stockage hors ligne durable : un rechargement, une fermeture ou une éviction de la page par le système peut perdre les prises non confirmées. La vue fournie affiche cette limite pendant les envois en attente. Après finalisation serveur confirmée, le contrôleur arrête les pistes, libère les aperçus locaux et ses références aux photos et autorisations, puis fournit le reçu dans l'événement de fin. Un échec de finalisation conserve la capture pour une nouvelle tentative explicite.

L'objectif personnel de photos proposé par le composant est une préférence d'interface dans les bornes serveur. Il ne change ni `minPhotos`, ni `maxPhotos`, ni les règles de finalisation.

## Installation locale

Ce workspace est privé et n'est pas publié sur le registre npm. Depuis la racine du dépôt :

```sh
npm ci
npm run build
node scripts/package-npm.mjs
```

Le script exécute de vraies commandes `npm pack` et inspecte les deux archives. Sa commande individuelle de capture est `npm pack --workspace packages/capture-web --pack-destination artifacts`. Dans le projet intégrateur, installez l'archive locale créée :

```sh
npm install /chemin/absolu/vers/CaptureProof/artifacts/captureproof-capture-web-0.1.0.tgz
```

Le package ESM contient le JavaScript construit et ses déclarations. Son utilisation ne nécessite ni React ni .NET. L'[exemple vanilla](../../examples/vanilla/README.fr.md) fonctionne sans React.

Un reçu serveur lie les octets exacts acceptés au contexte métier déclaré. Il n'atteste ni l'origine physique de la caméra, ni l'authenticité de l'objet, ni l'absence d'IA, ni une heure de confiance.
