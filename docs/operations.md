**English** | [Français](fr/operations.md)

# Operations, data and deliverables

## Retention and storage

`CaptureProof:DataDirectory` is a private directory outside the webroot. It contains `captureproof.db`, `photos/`, `signing/` and `cookie-keys/`. The database and its WAL files, originals, active private signing key and Data Protection keys are local data excluded from sources and the container image. Signing and cookie-protection keys survive restarts when this directory persists. Restrict inherited Windows ACLs to the operator and service; private PEM files receive restricted user permissions on Linux.

By default, sessions are retained for 24 hours after creation, including finalized dossiers. Cleanup runs at startup and once per minute. It expires open sessions, removes rows older than the retention period, then removes their orphan files. Historical public keys stay in `signing/` for receipts already exported. Physically deleting files does not guarantee removal from backups or disk blocks.

To clear demo dossiers, stop the server and explicitly remove `captureproof.db`, any `-wal`/`-shm` files and the `photos` subdirectory from the **verified DataDirectory**. Keep `signing` if historical keys must remain available. Removing `cookie-keys` also revokes demo cookies. Removing the entire DataDirectory resets everything and requires separately preserving the public keys needed for historical receipts. The project does not automatically run a deletion script for you.

Default limits are: 10 retained sessions per owner, 1,000 sessions globally, a 512 MiB global upload budget, 512 upload identifiers per session, 150 requests per IP per minute, four upload bodies processed concurrently, and 20 seconds per endpoint. Mutation JSON bodies are limited to 16 KiB before deserialization; headers and HTTP reading are also subject to Kestrel limits. JPEG limits are 8,192 pixels per axis, 12 million pixels, and 5 MiB per file under the demo policy. Retention must cover the maximum configured session TTL. Server configuration also bounds a policy to 32 photos, 25 MiB each and 128 MiB theoretical total per session. Reservations last at most 120 seconds and stop occupying quota after expiry.

Unconfirmed photo uploads remain in the phone page's memory. Closing the page can lose them. Recovery is possible while the page, its bytes and its session remain available. An orphan reservation can block finalization until it expires. An already-started request can still finish after the component is closed; authoritative REST state can recover accepted photos. This version does not provide a durable offline upload queue.

After confirmed finalization, the demo immediately stops the phone's camera and synchronization, releases local previews, then replaces the document with `capture-complete.html`, a script-free confirmation page. Server-side originals and the receipt follow normal retention. Safari controls whether its tab can be closed; the demo does not bypass that restriction. An unconfirmed finalization attempt keeps the recovery interface available.

The per-IP request limit is configurable with `CaptureProof:MaxRequestsPerMinute`, from 10 to 10,000, with a default of 150. It remains active on the isolated test server, where the browser suite uses 1,000 for its rapid sequence of page loads. This test setting does not change the LAN demo's limit.

## Backup and restore

The [offline procedure](backup-restore.md) provides local `--backup` and `--restore` commands. It preserves the database, photos and keys together, validates the inventory, and refuses an existing destination. Server and maintenance commands share a directory lock. Backups contain secrets and must remain private; their manifest provides neither encryption nor external authentication.

## HTTPS and logs

In `Production`, cookies are Secure, HttpOnly and SameSite Strict, and API/hub access requires HTTPS. Development has an HTTP exception for explicitly configured loopback origins; it is not a mobile-device testing method. Set `AllowedHosts` and `PublicOrigin` to the actual origin. CSP, Referrer-Policy, Permissions-Policy and nosniff headers are present; HTTPS responses include HSTS.

Application logs contain error types and technical identifiers, without bodies, cookies, secrets or keys. Detailed SignalR errors are disabled and the client uses SignalR logging level None. No analytics or third-party resources are used. Operators must control proxy logging: do not log request bodies, cookies, upload authorizations or full client URLs, and do not capture invitation fragments through a script. Personal browser traces must not become public artifacts.

## Optional Docker deployment

The Dockerfile builds the frontend and API with explicit versions, then copies only the published result into an ASP.NET Core image. Its context is an allowlist in `.dockerignore`, and its COPY instructions are explicit. The runtime user is `app`, data persists in `/data`, and certificates are mounted separately. Never bake keys into the image.

Build:

```sh
docker build -t captureproof:local .
```

Example HTTPS startup, using certificate paths prepared through the [HTTPS guide](https.md) and readable by user `app`:

```sh
docker run --rm --name captureproof -p 7443:7443 \
  -v captureproof-data:/data \
  -v /absolute/path/tls:/tls:ro \
  -e AllowedHosts=192.168.1.20 \
  -e CaptureProof__PublicOrigin=https://192.168.1.20:7443 \
  -e Kestrel__Endpoints__Https__Url=https://0.0.0.0:7443 \
  -e Kestrel__Endpoints__Https__Certificate__Path=/tls/cert.pem \
  -e Kestrel__Endpoints__Https__Certificate__KeyPath=/tls/key.pem \
  captureproof:local
```

Backslashes are Linux shell line continuations; PowerShell can use one line instead. The named volume retains data and keys between containers. Back them up together. Do not run a second instance against the same database or put SQLite on a network share. Native SkiaSharp license files and notices accompany the published output in `third-party/`.

## Distribution checks

`scripts/public-files.mjs` defines the explicit allowlist of distributable source files and directories, excluding outputs, data and local material. `npm run audit:public` checks candidate sources, the Git index and local exclusions; this local audit requires the workspace's private exclusions. `node scripts/audit-deliverables.mjs` checks the allowlists and the actual content calculated by `npm pack --dry-run` for both packages without relying on private clone files.

`npm run package:source` builds a staging directory from this allowlist only, creates a `.tar.gz` archive, then rereads its entries and compares them exactly. Archives go into the Git-ignored `artifacts/` directory. Never archive or publish the entire working directory. Both packages remain marked `private:true` to prevent accidental npm publication. These packaging commands do not commit, push or publish anything.

The Apache-2.0 license is supplied for review before publication. The [dependency inventory](dependencies.md) preserves available license expressions and notices; it does not replace a legal review of the chosen distribution. Regenerate it after dependency changes with `node scripts/licenses.mjs`, then `node scripts/licenses.mjs --check`.

`node scripts/package-npm.mjs` creates both npm archives in `artifacts/` and rereads their entries. `node scripts/audit-docker-context.mjs` builds a temporary image containing the actual transmitted context, exports its content and compares every file against the source allowlist, then removes its own temporary resources. Inspect the runtime image separately before startup with `docker run --rm --entrypoint sh captureproof:local -c 'find /app /data -type f'`: no key, database or photo should be embedded. After startup, generated data belongs to the `/data` volume.
