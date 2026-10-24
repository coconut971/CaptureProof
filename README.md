<p align="center">
  <img src="docs/assets/captureproof-overview.svg" alt="CaptureProof mobile photo capture and signed receipt verification" width="1280" />
</p>

<p align="center">
  <strong>English</strong> · <a href="README.fr.md">Français</a> · <a href="docs/README.md">Documentation</a> · <a href="docs/integration.md">Integration guide</a>
</p>

<p align="center">
  <a href="https://github.com/coconut971/CaptureProof/actions/workflows/ci.yml"><img src="https://github.com/coconut971/CaptureProof/actions/workflows/ci.yml/badge.svg" alt="Build and test workflow" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-195b47" alt="Apache-2.0 license" /></a>
  <img src="https://img.shields.io/badge/core-TypeScript-3178c6" alt="TypeScript core" />
  <img src="https://img.shields.io/badge/UI-headless%20or%20Web%20Component-195b47" alt="Choose a headless integration or the optional Web Component" />
  <img src="https://img.shields.io/badge/receipts-ES256%20%2F%20JWS-a66b22" alt="ES256 JWS receipts" />
</p>

<h1 align="center">CaptureProof</h1>

<p align="center">Mobile photo capture and signed receipt verification</p>

Use the headless TypeScript engine with your own interface and workflow. Add the supplied Web Component, the ASP.NET Core reference API or the React demo as needed. The receipt verifier works on its own, without calling a server.

CaptureProof is a working reference implementation. It binds **exact accepted file bytes and declared business context**. It does not attest physical camera origin, object authenticity, absence of AI or independently trusted time.

## Choose what you need

| Your goal | Start here | What you can replace |
| --- | --- | --- |
| Build your own capture screen | [`@captureproof/capture-web/headless`](packages/capture-web/README.md) | Interface, steps, navigation and transport |
| Embed a ready-made capture control | [`<capture-proof>`](examples/vanilla/README.md) | Surrounding application and transport |
| Capture locally, without signed receipts | [`capture-only`](docs/integration.md) | Your interface and handling of the resulting JPEGs |
| Issue signed receipts in your workflow | [`CaptureTransport` + compatible backend](docs/protocol.md) | Backend implementation and business authorization |
| Verify an existing receipt and files | [`@captureproof/receipt-verifier`](packages/receipt-verifier/README.md) | Your application and trusted public key source |
| Explore the complete QR journey | [React demo + reference .NET API](docs/architecture.md) | Demo screens, identity integration and business rules |

The engine has no React dependency. The headless entry point does not load the supplied UI. Your backend can use another language if it implements the transport and receipt contracts; the server remains responsible for authorization, quotas and accepted bytes.

## Custom interface example

```ts
import { CaptureController } from '@captureproof/capture-web/headless';

const capture = new CaptureController({
  mode: 'capture-only',
  policy: {
    minPhotos: 1,
    maxPhotos: 3,
    maxBytesPerPhoto: 5 * 1024 * 1024,
    sessionTtlSeconds: 600,
  },
});

capture.addEventListener('change', () => renderYourScreen(capture.snapshot));
startButton.onclick = () => void capture.startCamera(videoElement);
shutterButton.onclick = () => void capture.capture();
finishButton.onclick = () => void capture.finalize();
// On leaving your capture screen: capture.dispose();
```

`renderYourScreen`, the buttons and the video element belong to your application. Capture runs in a supported mobile browser over trusted HTTPS and starts after an explicit user action. The [integration guide](docs/integration.md) covers completion events, custom transports, retries, lifecycle cleanup and signed receipts.

## Run the reference demo

Prerequisites: **Node.js 24**, **.NET SDK 10.0.402** and the **ASP.NET Core 10.0.13 runtime**. Exact dependency versions are locked.

```sh
npm ci
npm run build
```

On Windows:

```powershell
pwsh -File scripts/install-dotnet.ps1  # optional local SDK installation
pwsh -File scripts/start-demo.ps1
```

On Linux:

```sh
ASPNETCORE_ENVIRONMENT=Development \
ASPNETCORE_URLS=http://localhost:5080 \
CaptureProof__DataDirectory="$PWD/.data/demo" \
dotnet run --no-launch-profile --project src/CaptureProof.Api
```

Open [the local demo](http://localhost:5080). This loopback HTTP address is for desktop development. A real phone needs a shared, trusted **HTTPS** origin: follow the [mobile HTTPS guide](docs/https.md). The default QR origin, `https://localhost:7443`, cannot reach your computer from another device.

For frontend development, keep the API running and use `npm run dev` in a second terminal. The React demo uses port 5173 and proxies the API on port 5080.

## Use the packages in another project

The packages are **not published to the npm registry**. Build and create local archives:

```sh
npm ci
npm run build
node scripts/package-npm.mjs
```

Then, in your own project, install the archive you need:

```sh
npm install /path/to/CaptureProof/artifacts/captureproof-capture-web-0.1.0.tgz
# Or install captureproof-receipt-verifier-0.1.0.tgz independently.
```

See the [capture package](packages/capture-web/README.md), [verifier package](packages/receipt-verifier/README.md) and [integration guide](docs/integration.md) for complete contracts and examples.

## Documentation

- **Build your integration:** [integration](docs/integration.md), [architecture](docs/architecture.md), [HTTP protocol](docs/protocol.md), [receipt format](docs/receipt.md).
- **Operate the reference API:** [HTTPS](docs/https.md), [configuration and Docker](docs/operations.md), [backup and restore](docs/backup-restore.md).
- **Assess the guarantees:** [threat model](docs/threat-model.md), [validation record](docs/testing.md), [security reporting](SECURITY.md), [dependencies](docs/dependencies.md).
- **Contribute or adapt:** [contribution guide](CONTRIBUTING.md), [Apache-2.0 license](LICENSE), [French documentation](docs/fr/README.md).

## Validation

The [validation record](docs/testing.md) distinguishes automated checks, observed device tests and remaining gaps. Real user journeys have been exercised on iPhone/Safari and Xiaomi/Mi Browser, including Wi-Fi recovery and a short screen lock with a pending photo on the Xiaomi. Exact device and browser versions were not recorded; Chrome Android has not been tested on a physical device.

```sh
npm run typecheck
npm run lint
npm run build
dotnet restore CaptureProof.slnx --locked-mode
dotnet test CaptureProof.slnx --no-restore
npm test
npx playwright install chromium
npm run test:e2e
npm run audit:public
```

For the two .NET-to-TypeScript fixture checks, follow the environment setup in the [testing guide](docs/testing.md), or run `pwsh -File scripts/interop.ps1`. A skipped fixture test is not a passed interoperability check.

## License and scope

[Apache-2.0](LICENSE). You can adapt the modules, build your own interface and integrate them into your products under that license. Keep the applicable license and dependency notices.

The reference demo uses anonymous, browser-scoped identities and temporary storage with a default retention of 24 hours. Production integration requires your own identity and business authorization. Pending JPEGs stay in page memory and can be lost when the page is closed, reloaded or evicted. See [security and operational limits](SECURITY.md) before exposing the reference API publicly.
