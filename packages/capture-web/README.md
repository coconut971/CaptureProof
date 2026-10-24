# @captureproof/capture-web

[Français](README.fr.md)

A reusable TypeScript controller for mobile browser photo capture, with an optional Web Component. React and the ASP.NET Core reference API are separate examples, not dependencies of this package.

## Choose an entry point

| Import | Intended use |
| --- | --- |
| `@captureproof/capture-web/headless` | Your own UI, with the controller and TypeScript contracts. Importing it does not evaluate `HTMLElement` or register a component. |
| `@captureproof/capture-web` | Browser entry with the same controller, types, `CaptureProofElement` and `registerCaptureElement`. Requires a DOM when imported. |

The headless entry can be imported by a server-side build or plain Node process. Capturing still requires a supported mobile browser, a secure HTTPS context, a video element and user camera permission. It is not a server-side camera API.

## Use the optional Web Component

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
  // Store or offer the original receipt according to your application's workflow.
  console.info('Receipt available', typeof jws === 'string');
});
document.querySelector('#capture')!.append(element);
// When your integration is permanently unmounted:
// element.remove();
// controller.dispose();
```

The bundled view currently uses French labels. Build your own view through `/headless` to control the layout, language and navigation. See the [custom UI and backend integration guide](../../docs/integration.md).

## Controller contract

`startCamera(video)` requests the rear camera where available, with audio disabled and `playsInline`. The only source of new JPEG bytes is the live video. There is no gallery, file, clipboard or drop import method. Mobile detection is a routing aid, not device attestation or a server authorization check.

Use `snapshot` to render camera state, photos, progress, errors and `canCapture`/`canFinalize`. Listen to `change`, call `capture()`, `retry(id)`, `remove(id)` and `finalize()` from your UI, and use `sync(session)` or `refresh()` for authoritative server updates. `photoaccepted` carries accepted metadata; `complete` carries the receipt or local photos. Call `dispose()` when the integration is permanently destroyed.

Going into the background, `pagehide`, a track interruption, or component disconnection stops the camera. Resuming the camera requires an explicit action. Photo orientation and camera behavior still depend on the browser and device.

## Two explicit modes

- `capture-only`: no transport or backend is required. JPEGs stay in page memory. `complete` carries `{ mode: 'capture-only', photos: [{ id, blob }] }`. Download or otherwise handle them before disposing the controller or leaving the page. There is no signed receipt.
- `server-receipt`: provide an already authorized `CaptureSession` and a compatible typed `CaptureTransport`. The server owns the policy, authorization, quotas, accepted bytes and finalization. `complete` carries `{ mode: 'server-receipt', jws }` only after server confirmation.

`CaptureTransport` implements `load`, `reserve`, `upload`, `remove` and `finalize`. Recovery reuses the original upload identifier and JPEG bytes. Failed uploads block finalization. A retry first reloads server state to reconcile an accepted upload whose response was lost. The adapter and backend must implement those semantics, including returning the original `uploadId` in accepted metadata. The reference implementation is [apps/web/src/api.ts](../../apps/web/src/api.ts).

Pending photos remain in memory in the same page. This is not durable offline storage: reloading, closing, or the operating system discarding the page can lose unconfirmed photos. The built-in view displays this limitation during pending uploads. After confirmed server finalization, the controller stops camera tracks, releases local previews and photo/authorization references, and keeps the receipt in the completion event. A failed finalization preserves the capture for an explicit retry.

The Web Component's optional photo target is only a UI preference within the server policy. It does not change `minPhotos`, `maxPhotos`, or server finalization rules.

## Local installation

The workspace is private and has not been published to the npm registry. From the repository root:

```sh
npm ci
npm run build
node scripts/package-npm.mjs
```

The packaging script runs actual `npm pack` commands and inspects both archives. Its individual capture command is `npm pack --workspace packages/capture-web --pack-destination artifacts`. In a consuming project, install the generated local archive:

```sh
npm install /absolute/path/to/CaptureProof/artifacts/captureproof-capture-web-0.1.0.tgz
```

The ESM package contains built JavaScript and declarations. No React or .NET installation is required to use it. The [vanilla example](../../examples/vanilla/README.md) runs without React.

A server receipt binds the exact accepted bytes and declared business context. It does not attest physical camera origin, object authenticity, absence of AI, or trusted time.
