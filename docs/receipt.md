English · [Français](fr/receipt.md)

# Portable receipts, trust and keys

The receipt is a compact JWS with a protected header of exactly this form:

```json
{ "alg": "ES256", "typ": "captureproof-receipt+jws", "kid": "key-identifier" }
```

ES256 means ECDSA P-256 with SHA-256. jose-jwt produces the signature; `jose` verifies the original compact segments. The real interoperability test also checks the 64-byte JWS ES256 signature representation rather than DER. The payload is UTF-8 JSON serialized once and persisted as text with the JWS in SQLite. Repeated finalization or a restart returns the same receipt.

## Version 1 manifest

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Integer 1; other versions are rejected |
| `issuer` | Declared issuer, currently `CaptureProof demo` |
| `receiptId`, `sessionId` | Technical receipt and session identifiers |
| `context` | Expected integration-side `{integrationSpace,businessReference}` |
| `finalizedAt` | Server-declared time without an independent time authority |
| `policy` | Copy of `minPhotos`, `maxPhotos`, `maxBytesPerPhoto`, `sessionTtlSeconds` |
| `photoCount` | Number of finalized files |
| `files` | List ordered by receipt time, then identifier |
| `files[].id` | Exported original filename: `<id>.jpg` |
| `files[].sha256` | Hexadecimal SHA-256 calculated by the server over the exact bytes |
| `files[].size` | Exact size in bytes |
| `files[].contentType` | `image/jpeg`, fully decoded before acceptance |
| `files[].receivedAt` | Server-declared receipt time |
| `guarantees` | `integrity:true`, `hardwareCameraAttested:false`, `aiOriginAssessed:false` |

The manifest contains no cookie, invitation secret, upload authorization, GPS data or hardware fingerprint. The original JPEG is never silently changed; a resized or reencoded version is a different file. Metadata present in a received original remains part of its reference bytes and is not interpreted as an attested fact.

## Independent verification

The verifier makes no network request. Supply the JWS, the exact file set with original names and an explicitly trusted public-key set. `kid` searches only that set. A key embedded in a receipt, `jku`, `jwk`, a URL or an unknown critical extension cannot establish trust. The verifier also rejects `alg=none`, other algorithms, private or ambiguous keys and unexpected fields.

Results separately expose signature, key trust, schema, files and context. Without an expected context, that check reports `not-checked`; valid integrity then does not mean the receipt belongs to the business record intended by the caller. Supply both expected fields to detect substitution of a business reference.

Package limits are: 256 KiB of ASCII JWS characters, a 4 KiB header, a 128 KiB manifest, 32 photos, 25 MiB per photo, 128 MiB total and 64 keys. The small verification interface applies additional on-screen limits: at most 50 selected files, 12 MiB each, 40 MiB total and 20 keys. The package still enforces its exact maximum of 32 photos. Server policy rejects a theoretical maximum above 128 MiB per session.

CLI example after `npm run build`:

```sh
node packages/receipt-verifier/dist/cli.js --receipt dossier/receipt.jws --keys trusted-public.jwks.json --space demo --reference DEMO-001 dossier/photo-identifier.jpg
```

See the [package README](../packages/receipt-verifier/README.md) for help and exact syntax. Download receipts, originals and keys separately. No archive import is needed, so the project exposes no ZIP extractor or untrusted archive paths.

## Generation and rotation

On first startup, the server creates a P-256 key at `<DataDirectory>/signing/active-private.pem`. The `kid` is derived from the public key. Files named `public-<kid>.json` are retained. The private key is not compiled into the application, sent to the frontend or included in the Docker image. Protect it through operating-system permissions and persist it with the data.

To rotate the key, first stop the server, keep a protected backup and run with the **same DataDirectory**:

```powershell
$env:CaptureProof__DataDirectory = Join-Path (Get-Location) '.data/demo'
.\.tools\dotnet\dotnet run --no-launch-profile --project src/CaptureProof.Api -- --rotate-key
```

On Linux, use `dotnet` with the same option. The command retains old public keys, replaces the active private key and exits. Restart the server and distribute the new public key through a trusted channel. Do not run two processes simultaneously. Retained public keys support historical receipt verification; they do not implement revocation or trusted post-compromise timestamps. A compromised key requires operator response and an external trust policy.

References: [JWS RFC 7515](https://www.rfc-editor.org/rfc/rfc7515.html), [ES256 RFC 7518](https://www.rfc-editor.org/rfc/rfc7518.html), [best practices RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html).
