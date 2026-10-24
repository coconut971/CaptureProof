# Integrating CaptureProof into your application

[Français](fr/integration.md)

CaptureProof has three independent integration choices. Use only the pieces your application needs.

| Piece | Responsibility | Optional dependencies |
| --- | --- | --- |
| `@captureproof/capture-web/headless` | Mobile camera capture and state machine, with your UI | No React or Web Component required |
| `@captureproof/capture-web` | The same controller plus a thin Web Component | Browser DOM required when imported |
| `@captureproof/receipt-verifier` | Local verification of a receipt and its exact original files | No capture UI, .NET API or network required |

The React application is a reference integration. The ASP.NET Core API is a reference implementation of the compatible backend contract. Neither is required by the capture package. Capture-only mode needs no backend; server-receipt mode needs a compatible backend, which you can implement using your own stack.

## Obtain the packages locally

These are private workspaces, not published npm registry packages. In this repository, `npm ci` links the workspaces and `npm run build` creates their JavaScript and type declarations:

```sh
npm ci
npm run build
node scripts/package-npm.mjs
```

The packaging script creates `artifacts/`, runs actual `npm pack` for both workspaces and inspects the archive entries. For example, its capture command is:

```sh
npm pack --workspace packages/capture-web --pack-destination artifacts
```

In a separate consuming application, install either or both local archives:

```sh
npm install /absolute/path/to/CaptureProof/artifacts/captureproof-capture-web-0.1.0.tgz
npm install /absolute/path/to/CaptureProof/artifacts/captureproof-receipt-verifier-0.1.0.tgz
```

Use a browser bundler for the UI integrations. The `/headless` entry can also be imported by Node or a server-side renderer without evaluating `HTMLElement`. That import safety does not provide a server-side camera: actual capture still needs a mobile browser, trusted HTTPS, a video element and an explicit user camera action.

## Bring your own interface

This example mounts a server-receipt controller against your existing element references. Your application must first obtain an authorized session and implement a compatible transport. The server's session policy is used unchanged.

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

Render the photos from `snapshot.photos`, including `previewUrl`, `status`, progress and errors. Bind each retry or remove button to its existing photo identifier. Use `snapshot.canCapture` and `snapshot.canFinalize` for availability. The photo target in the optional Web Component is a local preference; it does not change server policy.

Forward authoritative session updates to `sync(next)`, or call `refresh()`. SignalR is optional: your application's polling or event transport can provide these updates. In the completion callback, stop your own subscriptions or polling and present the receipt or navigate as appropriate. Call `unmount()` when the integration is permanently removed, not merely because the phone is temporarily locked.

The controller stops the camera when the page becomes hidden, on `pagehide`, on track interruption and on disposal. It does not automatically restart the camera after unlocking. Keep the same page open while a photo is pending: pending JPEGs live in memory, not durable offline storage. A reload, closed tab or operating-system page eviction may lose them.

For a ready-made view, import `registerCaptureElement` from the default browser entry, create `<capture-proof>`, assign its `controller` before insertion and listen to `capturecomplete`. The supplied view currently has French labels. [The vanilla example](../examples/vanilla/README.md) demonstrates capture-only operation without React or .NET.

## Implement the typed backend adapter

`CaptureTransport` is an adapter boundary, not a generic file-upload shortcut. Your existing HTTP or SDK client must expose equivalent backend semantics. This skeleton shows the mapping without imposing HTTP routes, cookie handling or an application framework:

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

The backend must:

- Authorize the caller, session and business reference using your application's trusted context. Mobile user-agent detection is not authorization.
- Choose and freeze the policy server-side, enforce quotas and expiration, and decode accepted JPEGs. A client preference never changes the stored policy.
- Preserve the original upload identifier across retries. Accepting the same authorized identifier and exact bytes again must resolve to the same accepted photo, not another file. Conflicting bytes or scope must be rejected.
- Return accepted metadata with its original `uploadId`, stable photo identifier, exact size and SHA-256. Recovery needs that upload identifier to match a lost response to the local pending entry.
- Store and sign the exact accepted bytes. After finalization, keep the photo set and original signed receipt immutable. An uncertain finalization must be recoverable without silently creating a new dossier.

The reference same-origin adapter handles cookies, CSRF, bounded request waits and JPEG upload progress in [apps/web/src/api.ts](../apps/web/src/api.ts). Another stack must supply its own equivalent authentication and transport handling. Read the [protocol](protocol.md) and [receipt format](receipt.md) before replacing the backend. To remain compatible with the independent verifier, emit the specified ES256 compact JWS header and manifest schema, filenames and byte hashes.

## Capture without a backend

Create a controller with `{ mode: 'capture-only', policy }` and no transport. The same camera and snapshot APIs apply. Its `complete` event carries `{ mode: 'capture-only', photos: [{ id, blob }] }`. Save or download those blobs before disposing the controller or leaving the page. No server receipt or portable signed integrity guarantee is produced.

## Verify independently

Install only `@captureproof/receipt-verifier` if you just need to check an existing receipt and original files. Supply the original compact JWS, every original `<id>.jpg`, explicitly trusted public keys and the exact expected integration space and business reference. The verifier makes no network requests and does not fetch keys named by a receipt. See its [README](../packages/receipt-verifier/README.md).

A valid receipt binds the exact accepted bytes to the issuer's declared context. It does not attest physical camera origin, object authenticity, absence of AI or trusted time. Trust in a signing key must be established by your application through an explicit trusted channel.
