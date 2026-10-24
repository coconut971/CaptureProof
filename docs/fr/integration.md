# Intégrer CaptureProof à votre application

[English](../integration.md)

CaptureProof propose trois points d'intégration indépendants. Utilisez les éléments dont votre application a besoin.

| Élément | Responsabilité | Dépendances facultatives |
| --- | --- | --- |
| `@captureproof/capture-web/headless` | Capture caméra mobile et machine d'état, avec votre interface | Ni React ni Web Component requis |
| `@captureproof/capture-web` | Même contrôleur et Web Component mince | DOM navigateur requis lors de l'import |
| `@captureproof/receipt-verifier` | Vérification locale du reçu et de ses fichiers exacts | Ni interface de capture, ni API .NET, ni réseau requis |

L'application React est une intégration de référence. L'API ASP.NET Core est une implémentation de référence du contrat backend compatible. Aucune des deux n'est requise par le package de capture. Le mode capture seule fonctionne sans backend ; le mode reçu serveur exige un backend compatible, que vous pouvez développer avec votre propre stack.

## Obtenir les packages localement

Ces workspaces sont privés et ne sont pas publiés sur le registre npm. Dans ce dépôt, `npm ci` relie les workspaces et `npm run build` produit leur JavaScript et leurs déclarations TypeScript :

```sh
npm ci
npm run build
node scripts/package-npm.mjs
```

Le script crée `artifacts/`, exécute de vraies commandes `npm pack` pour les deux workspaces et inspecte les fichiers des archives. Par exemple, sa commande pour la capture est :

```sh
npm pack --workspace packages/capture-web --pack-destination artifacts
```

Dans une application intégratrice séparée, installez l'une des archives locales ou les deux :

```sh
npm install /chemin/absolu/vers/CaptureProof/artifacts/captureproof-capture-web-0.1.0.tgz
npm install /chemin/absolu/vers/CaptureProof/artifacts/captureproof-receipt-verifier-0.1.0.tgz
```

Utilisez un bundler navigateur pour les intégrations d'interface. L'entrée `/headless` peut également être importée par Node ou un rendu côté serveur sans évaluer `HTMLElement`. Cela ne crée pas une caméra côté serveur : la prise de vue exige toujours un navigateur mobile, un HTTPS de confiance, une vidéo et une action explicite de l'utilisateur.

## Conserver votre interface

Cet exemple relie un contrôleur avec reçu serveur à vos références d'éléments existantes. Votre application doit d'abord obtenir une session autorisée et implémenter un transport compatible. La politique fournie par le serveur est utilisée sans modification.

```ts
import {
  CaptureController,
  type CaptureSession, type CaptureSnapshot, type CaptureTransport,
} from '@captureproof/capture-web/headless';

type View = {
  video: HTMLVideoElement;
  start: HTMLButtonElement;
  shutter: HTMLButtonElement;
  finish: HTMLButtonElement;
  render: (snapshot: CaptureSnapshot) => void;
  completed: (originalJws: string) => void;
};

export function mountCapture(view: View, session: CaptureSession, transport: CaptureTransport) {
  const controller = new CaptureController({
    mode: 'server-receipt', policy: session.policy, session, transport,
  });
  const render = () => {
    const state = controller.snapshot;
    view.start.disabled = state.camera === 'starting' || state.camera === 'ready'
      || state.sessionState !== 'Capturing';
    view.shutter.disabled = !state.canCapture;
    view.finish.disabled = !state.canFinalize;
    view.render(state);
  };
  const start = () => { void controller.startCamera(view.video); };
  const capture = () => { void controller.capture(); };
  const finish = () => { void controller.finalize(); };
  const completed = (event: Event) => {
    const detail = (event as CustomEvent<{ mode: 'server-receipt'; jws: string }>).detail;
    view.completed(detail.jws);
  };
  controller.addEventListener('change', render);
  controller.addEventListener('complete', completed);
  view.start.addEventListener('click', start);
  view.shutter.addEventListener('click', capture);
  view.finish.addEventListener('click', finish);
  render();
  return {
    sync: (next: CaptureSession) => controller.sync(next),
    refresh: () => controller.refresh(),
    retry: (id: string) => controller.retry(id),
    remove: (id: string) => controller.remove(id),
    unmount: () => {
      view.start.removeEventListener('click', start);
      view.shutter.removeEventListener('click', capture);
      view.finish.removeEventListener('click', finish);
      controller.removeEventListener('change', render);
      controller.removeEventListener('complete', completed);
      controller.dispose();
    },
  };
}
```

Affichez les prises depuis `snapshot.photos`, notamment `previewUrl`, `status`, la progression et les erreurs. Reliez chaque bouton de reprise ou suppression à l'identifiant existant de sa photo. Utilisez `snapshot.canCapture` et `snapshot.canFinalize` pour la disponibilité des actions. L'objectif de photos du Web Component facultatif reste une préférence locale ; il ne change pas la politique serveur.

Transmettez les nouvelles sessions autoritaires à `sync(next)`, ou appelez `refresh()`. SignalR est facultatif : votre polling ou transport d'événements peut fournir ces mises à jour. Dans le callback de fin, arrêtez vos propres abonnements ou polling, puis présentez le reçu ou naviguez selon votre application. Appelez `unmount()` lorsque l'intégration est définitivement retirée, pas simplement parce que le téléphone est temporairement verrouillé.

Le contrôleur arrête la caméra quand la page devient cachée, lors de `pagehide`, de l'interruption d'une piste et de sa destruction. Il ne redémarre pas automatiquement la caméra après déverrouillage. Gardez la même page ouverte pendant un envoi en attente : ces JPEG vivent en mémoire, pas dans un stockage hors ligne durable. Un rechargement, une fermeture ou une éviction de la page par le système peut les perdre.

Pour une vue prête à l'emploi, importez `registerCaptureElement` depuis l'entrée navigateur par défaut, créez `<capture-proof>`, affectez son `controller` avant insertion et écoutez `capturecomplete`. La vue fournie utilise actuellement des libellés français. L'[exemple vanilla](../../examples/vanilla/README.fr.md) montre le mode capture seule, sans React ni .NET.

## Implémenter l'adaptateur backend typé

`CaptureTransport` est une frontière d'adaptation, pas un simple raccourci d'envoi de fichier. Votre client HTTP ou SDK doit exposer des règles backend équivalentes. Ce squelette montre la correspondance sans imposer routes HTTP, gestion des cookies ou framework applicatif :

```ts
import type {
  AcceptedPhoto, CaptureSession, CaptureTransport, UploadAuthorization,
} from '@captureproof/capture-web/headless';

interface Backend {
  loadSession(sessionId: string): Promise<CaptureSession>;
  reserveUpload(sessionId: string, uploadId: string): Promise<UploadAuthorization>;
  uploadJpeg(sessionId: string, reservation: UploadAuthorization, bytes: Blob,
    onProgress: (fraction: number) => void): Promise<AcceptedPhoto>;
  removePhoto(sessionId: string, photoId: string): Promise<void>;
  finalizeSession(sessionId: string): Promise<{ jws: string }>;
}

export function createCaptureTransport(sessionId: string, backend: Backend): CaptureTransport {
  return {
    load: () => backend.loadSession(sessionId),
    reserve: uploadId => backend.reserveUpload(sessionId, uploadId),
    upload: (reservation, bytes, progress) => backend.uploadJpeg(sessionId, reservation, bytes, progress),
    remove: photoId => backend.removePhoto(sessionId, photoId),
    finalize: () => backend.finalizeSession(sessionId),
  };
}
```

Le backend doit :

- Autoriser l'appelant, la session et la référence métier à partir du contexte de confiance de votre application. Le user-agent mobile n'est pas une autorisation.
- Choisir et figer la politique côté serveur, imposer quotas et expiration, puis décoder les JPEG acceptés. Une préférence client ne change jamais la politique stockée.
- Conserver l'identifiant d'envoi pendant les reprises. Réaccepter le même identifiant autorisé avec les mêmes octets doit retrouver la même photo acceptée, sans nouveau fichier. Des octets ou un périmètre incompatibles doivent être refusés.
- Retourner les métadonnées acceptées avec l'`uploadId` d'origine, l'identifiant stable de photo, la taille exacte et le SHA-256. La reprise a besoin de cet identifiant d'envoi pour rapprocher une réponse perdue de l'entrée locale en attente.
- Stocker et signer les octets exacts acceptés. Après finalisation, conserver l'ensemble des photos et le reçu signé original immuables. Une finalisation dont l'issue est incertaine doit pouvoir être reprise sans créer silencieusement un nouveau dossier.

L'adaptateur de référence de même origine gère cookies, CSRF, délais bornés et progression JPEG dans [apps/web/src/api.ts](../../apps/web/src/api.ts). Une autre stack doit fournir sa propre gestion équivalente des autorisations et du transport. Lisez le [protocole](../protocol.md) et le [format du reçu](../receipt.md) avant de remplacer le backend. Pour rester compatible avec le vérificateur indépendant, produisez l'en-tête JWS compact ES256, le schéma du manifeste, les noms et empreintes de fichiers spécifiés.

## Capturer sans backend

Créez un contrôleur avec `{ mode: 'capture-only', policy }` et sans transport. Les mêmes API caméra et snapshot s'appliquent. Son événement `complete` porte `{ mode: 'capture-only', photos: [{ id, blob }] }`. Conservez ou téléchargez ces Blobs avant de détruire le contrôleur ou de quitter la page. Aucun reçu serveur ni garantie d'intégrité signée portable n'est produit.

## Vérifier indépendamment

Installez seulement `@captureproof/receipt-verifier` pour contrôler un reçu et des originaux existants. Fournissez le JWS compact original, tous les `<id>.jpg`, des clés publiques explicitement reconnues, puis l'espace d'intégration et la référence métier exacts attendus. Le vérificateur n'émet aucune requête réseau et ne télécharge pas de clés désignées par le reçu. Voir son [README](../../packages/receipt-verifier/README.fr.md).

Un reçu valide lie les octets exacts acceptés au contexte déclaré par l'émetteur. Il n'atteste ni l'origine physique de la caméra, ni l'authenticité de l'objet, ni l'absence d'IA, ni une heure de confiance. La confiance dans une clé de signature doit être établie explicitement par votre application, via un canal choisi.
