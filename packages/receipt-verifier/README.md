# @captureproof/receipt-verifier

[Français](README.fr.md)

An independent TypeScript ESM verifier for CaptureProof receipts and original files. It uses Web Crypto and `jose.compactVerify` on the original ES256 compact JWS. It does not depend on the capture controller, React, the reference .NET API, or a central storage service. Verification makes no network requests.

```ts
import { verifyReceipt } from '@captureproof/receipt-verifier';

const result = await verifyReceipt(
  originalJws,
  [{ name: 'photo-id.jpg', bytes: originalBytes }],
  explicitlyTrustedPublicJwks.keys,
  { integrationSpace: 'your-space', businessReference: 'CASE-001' },
);
console.log(result.valid, result.signature, result.key, result.files, result.context);
```

Supply every original file under its exact `<id>.jpg` manifest filename. Missing, extra, duplicate, renamed or modified files fail verification. Expected context is compared exactly. Always pass it when validating a particular business case. Omitting it gives `context.status: 'not-checked'`; a valid result then does not confirm your expected business reference.

## Establish trust explicitly

`trustedKeys` is an explicitly accepted list of public EC P-256 JWKs with `kid`. Choose a trusted distribution channel for these keys. Downloading `/api/keys` from the same server that supplied a receipt does not independently establish trust. No receipt URL is fetched. Private keys and unsupported header extensions, including `jku`, `x5u`, `jwk`, `x5c` and `crit`, are rejected.

The result distinguishes `signature`, `key`, `schema`, `files` and `context`. The manifest is exposed only after signature and schema validation. `valid` requires an explicitly trusted key, valid signature and schema, the exact file set, and no failed context comparison.

A receipt binds exact accepted bytes and the issuer's declared business context. It does not attest physical camera origin, object authenticity, absence of AI, or trusted time. Dates are signed statements, not independent timestamp certification.

## Local installation and CLI

This workspace is private and has not been published to the npm registry. From the repository root:

```sh
npm ci
npm run build
node scripts/package-npm.mjs
```

The packaging script runs actual `npm pack` commands and inspects the generated archives. Its individual verifier command is `npm pack --workspace packages/receipt-verifier --pack-destination artifacts`. In a consuming project:

```sh
npm install /absolute/path/to/CaptureProof/artifacts/captureproof-receipt-verifier-0.1.0.tgz
```

After building the repository, run the CLI independently:

```sh
node packages/receipt-verifier/dist/cli.js --receipt receipt.jws --keys trusted-public.jwks.json --space your-space --reference CASE-001 photo-id.jpg
```

The public trust file must be a JWKS object `{"keys":[...]}`. Exit codes: `0` valid, `1` verification failed, `2` invalid arguments or unreadable/invalid input files. Originals remain unchanged. The local tarball also installs the `captureproof-verify` binary in the consuming project's dependency bin directory.

Node.js 24 or later, or a browser with Web Crypto, is required. `VERIFICATION_LIMITS` exports explicit bounds: 256 Ki characters for a JWS, 128 KiB for a manifest, 32 photos, 25 MiB per photo, 128 MiB total, and 64 trusted keys. A signed policy can impose smaller limits.

The .NET interoperability tests use private fixture directories controlled through `CAPTUREPROOF_INTEROP_DIR` and `CAPTUREPROOF_RESTORE_INTEROP_DIR`. Those generated receipts, images and keys are not included in the package. See the [integration guide](../../docs/integration.md) for the capture and backend boundaries.
