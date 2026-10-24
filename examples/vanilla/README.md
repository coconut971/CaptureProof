# Vanilla browser example

[Français](README.fr.md)

This example uses `@captureproof/capture-web` directly, with its optional Web Component and no React. It runs in `capture-only` mode: no API, .NET runtime, server upload or signed receipt is involved. JPEGs remain in page memory and can be downloaded after completion.

From the repository root:

```sh
npm ci
npm run build --workspace @captureproof/capture-web
npx vite examples/vanilla --host 0.0.0.0 --port 5174
```

This command starts an HTTP development server. Use a trusted HTTPS reverse proxy or HTTPS development configuration for a real phone camera test. A plain HTTP LAN address is not a secure camera context. The [HTTPS guide](../../docs/https.md) explains the local certificate and phone trust requirements.

`main.ts` registers the element, creates a capture-only controller, handles `capturecomplete`, offers original JPEG downloads and releases local URLs when leaving. The mobile check only chooses the UI; it is not a proof of camera origin or a backend security boundary.

Pending and local photos are not durably stored. Download them before closing or reloading the page. The example does not import files from the gallery or filesystem.

To keep your own UI, use `@captureproof/capture-web/headless` and bind the controller to your own video and buttons. To obtain server receipts, supply a previously authorized session and a compatible `CaptureTransport`; the backend must enforce policy, authorization, idempotent upload and finalization. React and the .NET implementation remain optional. See the [integration guide](../../docs/integration.md).

The packages are private workspaces, not published npm registry packages. For use outside this repository, build and pack them with `node scripts/package-npm.mjs`, then install the generated local `.tgz` archives. See the [capture package README](../../packages/capture-web/README.md).

Capture-only mode provides no signed receipt. A server receipt binds accepted bytes and declared context; it does not attest physical camera origin, object authenticity, absence of AI or trusted time.
