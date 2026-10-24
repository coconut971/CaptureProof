**English** | [Français](fr/testing.md)

# Testing, execution evidence and remaining checks

Results recorded on 24 October 2026, on Windows with Node 24.18.1, .NET SDK 10.0.402, runtime 10.0.13, Vitest 4.1.12 and Playwright 1.64.1. This version is not declared stable. Focused reviews performed during development are internal; no external audit is claimed.

| Command executed | Result |
| --- | --- |
| `npm ci` | Installed from the lockfile; npm audit reported 0 known vulnerabilities at the time of the check |
| `npm run typecheck` | Strict TypeScript passed for both packages and the demo |
| `npm run lint` | Passed with no warnings |
| `npm run build` | Both packages and the Vite frontend built successfully |
| `dotnet restore CaptureProof.slnx --locked-mode` | Passed with the required local SDK |
| `dotnet test CaptureProof.slnx --no-restore` | 56 tests passed, none skipped |
| `npm test`, with both xUnit-generated interoperability directories | 105 tests passed, none skipped |
| `npm run test:e2e` | 25 Chromium tests passed, none skipped |
| `dotnet list CaptureProof.slnx package --vulnerable --include-transitive` | No known vulnerable package reported by the queried sources |
| `docker build -t captureproof:local .` | Linux image built successfully |
| Authorized test client against that Linux image | Actual JPEG decoding, unchanged originals, stable receipt and successful TypeScript verification |
| `node scripts/audit-docker-context.mjs` | 45 actual exported source files allowed; context checked without private files, databases, keys or photos |
| `node scripts/package-npm.mjs` | Two npm archives created and reread: 22 and 16 files, including both documentation languages |
| `npm run audit:docs` | 35 Markdown files and 196 relative links checked |
| Local `--backup`, then `--restore` commands | Passed on synthetic e2e data; existing destination refused; exact restored receipt and three originals independently verified |
| Same maintenance inside the Linux image, user `app`, network disabled | Passed; identical data, with directory/file permissions of `0700`/`0600` |

The README provides Windows and Linux commands. `scripts/interop.ps1` reproduces .NET fixture generation and TypeScript verification. File-based tests use `CAPTUREPROOF_INTEROP_DIR` and `CAPTUREPROOF_RESTORE_INTEROP_DIR`; without the corresponding variable, a case is reported as skipped and must not be described as executed. The e2e interoperability case also obtains a real receipt from the API.

## Coverage

The headless entry point is imported by a separate Node process without `HTMLElement` or `document`; the default browser entry still mounts the optional Web Component. The packaged archives have also been installed in a separate consuming project: the headless engine and independent verifier import without React or a DOM. A public-source copy without local working material passes the publication and documentation audits.

The xUnit tests use WebApplicationFactory, real isolated SQLite files and constraints, and a controlled TimeProvider for expiry. They cover min/max policies, server-owned category despite client fields, concurrent invitations, single consumption, expiry, rejection, regeneration, cancellation, wrong owners, unauthorized photo and receipt access, forbidden SignalR subscriptions, CSRF and origin checks.

Store tests cover concurrent competition for the final slot, reservations and expiry, renewal after response loss, a concurrent global budget, per-owner and global session limits, identical and concurrent retry without duplicates, rejection of different bytes, an authorization reused for another session or identifier, deletion before finalization, exactly-three policies, final immutability, persistent keys and a stable receipt after restart. The decoder rejects disguised formats, truncated JPEGs and prohibited sizes or dimensions. A conforming synthetic JPEG is deliberately accepted from an authorized client: this documents the limit of camera-origin claims.

TypeScript tests cover policies and the controller's simulated camera: permissions, track release, backgrounding, late permission grants, finalization and recovery. They also cover altered signatures, payloads and files; unknown, ambiguous or private keys; `alg=none`; unexpected algorithms and headers; critical extensions; schema and version checks; ambiguous JSON; resource limits; the exact file set; and the expected context. The interoperability case checks exact bytes and ES256 format from a receipt signed by .NET jose-jwt using TypeScript `jose`.

Demo transport tests cover a shared bootstrap, explicit recovery after failure, rejection of an unreadable token and obsolete responses. Each `fetch` is bounded to twenty seconds, including body reading; a required bootstrap has its own deadline, separate from the following request. Network and timeout errors are explained in French, HTTP statuses and business messages are retained, and cookies and CSRF headers remain required. JPEG PUT retains its ninety-second timeout. No mutation is automatically repeated; recovery tests check reuse of the same upload identifier and JPEG after an explicit retry action.

Monitoring tests check notification coalescing during a read, restoration of an accurate status after REST recovery, polling fallback and SignalR resubscription. Cleanup stops the timer and connection; late completions no longer publish statuses or trigger new loads. An already-started request remains subject to its bounded timeout.

Playwright flows use two separate contexts, one emulating a mobile device. The fake camera is injected exclusively by `tests/e2e/camera-fixture.ts`, never by the product. Tests check that desktop never requests a camera, capture interfaces contain no file input, the invitation fragment is removed before POST, codes are compared and confirmed, photos are captured, SignalR updates arrive, finalization works, camera denial supports recovery, and controlled PUT response loss can be retried with identical bytes. iPhone emulation in Chromium does not test Safari or a physical smartphone.

The lost-PUT-response case also checks the notice shown while a photo is unconfirmed: pending JPEGs remain in page memory and the page must stay open without reloading. The notice disappears after confirmed receipt. It does not promise durable local storage or preservation after a page closes or is evicted.

The verifier suite uses the actual `/verify` file inputs, an API-issued receipt and three synthetic JPEGs generated in memory. It covers a valid dossier, same-size byte alteration, changed size, an altered receipt, wrong context, missing, extra, duplicate and renamed files, and wrong keys with or without a matching identifier. It checks clearing a stale result and delayed asynchronous reads. Every `/api` or `/hubs` call from the verifier page is blocked and fails the test: selected files remain local.

Three history scenarios check a cancelled dossier's state on return to the list, finalization received before an older confirmation response, and a dossier selection superseded by another. Responses are deliberately held and released; a terminal state must not reopen, and an old selection must not replace the new one.

The fifteen verifier tests, seven capture/interoperability flows and three history scenarios use an isolated server and data directory, with separate build outputs. The per-IP limit remains enabled at 1,000 for this automatic burst; the normal application default remains 150. A server test explicitly checks HTTP 429 after a configured budget of 10, and out-of-range configuration values are rejected. This test setting fixed an initial complete run in which `/verify` navigation hit the normal request limit.

[Backup and restore](backup-restore.md) tests create a synthetic signed dossier, stop its server, copy and restore the data into a new directory, then restart the copy. They check originals, the exact receipt, the signature and continuity of still-valid cookies. Concurrency, overwrite, corruption, incomplete inventory and forbidden-path scenarios use private temporary directories only. Optional `CAPTUREPROOF_RESTORE_INTEROP_DIR` output enables a second check with the independent TypeScript package.

Tests do not claim to cover every disk failure, a forced stop at every instruction or denial-of-service attack. Protocol assumptions and limits still need review before a public service deployment.

The Docker exercise used Development loopback HTTP to check Linux and the native decoder. LAN HTTPS was then configured with mkcert and checked without disabling TLS in Windows and Chromium. This record describes local executions and does not present a remote CI result. Local distribution checks do not constitute publication.

Mobile completion is tested with the confirmation navigation deliberately delayed: all tracks are stopped and no monitoring GET is emitted while waiting. The static final page contains no script, camera, thumbnail, navigation or import. A network failure before server confirmation preserves capture and supports another completion attempt. Capture-only mode continues to offer local JPEG downloads. Unit tests also cover late responses after disposal and a stale Capturing state arriving after finalization.

## Choosing validations

Consolidation starts with the automatic commands above. Focused tests check the modified behavior; the full set of checks validates a delivery slice. Completed device flows provide a baseline for selecting additional checks.

A physical-device test should address a specific risk that automated checks cannot resolve: camera lifecycle or permission behavior, a mobile browser, or device-specific interruption and recovery. A wording, documentation or history-list change does not justify repeating captures. Group necessary actions into one short flow and record the outcome, including failures or checks not performed.

## Physical-device checklist

Two flows were performed by the user on an iPhone with Safari. The user confirmed three-photo capture, the new “Capture terminée” screen and camera shutdown. The desktop browser showed three originals and a finalized receipt. Actual downloads and local verification succeeded. Tests using altered photo copies, a modified receipt, wrong keys, wrong context, and missing, extra, duplicate and renamed files produced the expected rejection. Originals were checked unchanged. The iPhone model and iOS version were not recorded; this does not validate every Safari version or other conditions. No photos from these tests are included in public deliverables.

On 24 October 2026, three flows were also performed on a Xiaomi with Mi Browser. The first confirmed capture of three photos, finalization, “Capture terminée” and camera shutdown. The second included Wi-Fi loss: the pending photo's thumbnail remained visible, and the user chose “Réessayer l’envoi” after the connection returned. The third added a ten-second screen lock with Wi-Fi still disabled and a second photo pending. After unlocking, the user observed both thumbnails retained, “Caméra arrêtée” and the camera-interrupted message. The user then restored the network, retried the upload, explicitly restarted the camera and finalized three photos, confirming the completion screen and camera shutdown.

For each Xiaomi dossier, the desktop showed three accepted photos and a finalized receipt. Downloads were compared with server-stored files, then checked with the independent TypeScript package and in the browser: signature, trusted key, format, file set and context were valid. Neither interruption flow created duplicate uploads or left a pending reservation. The first photo received before each interruption retained its identifiers, size and hash. Preservation of the pending photo was observed in the interface and followed by successful receipt; its hash was not measured on the phone before upload.

The exact Xiaomi model, Android version and Mi Browser version were not recorded. Certificate installation and trust configuration on that phone were not documented. Chrome on Android has not been tested on a physical device. These results cover observed flows in the same open page. Unsent JPEGs remain in memory; closing, reloading or operating-system eviction can lose them. No durable offline storage is claimed.

This checklist describes known results and limits. For a necessary new device test, record date, model, iOS/Android version, browser, HTTPS origin, result and any error using non-personal data. User confirmations are distinguished from automated checks. UI labels currently remain French.

| Check | Safari on iPhone | Mi Browser on Xiaomi |
| --- | --- | --- |
| Trusted HTTPS, same application and valid QR | User flow completed; model and version not recorded | QR flow on an HTTPS origin completed; certificate installation/trust not recorded |
| Secret removed from URL; matching codes; confirm, reject or regenerate | Pairing completed; rejection and regeneration remain untested on device | Pairing completed; fragment removal, rejection and regeneration not recorded on device |
| Direct creation without QR; no gallery, file import, paste or drop | Untested on a physical device | Untested on a physical device |
| Allow or deny camera permission, recover; no audio | Authorized capture succeeded; denial/recovery and audio need explicit checks | Authorized capture succeeded; denial/recovery and audio need explicit checks |
| Rear camera, playsinline preview, portrait/landscape | Untested on a physical device | Untested on a physical device |
| Counter, thumbnails, deletion/retake and server min/max | Three photos received; deletion and limits untested on device | Three photos received, thumbnails retained and upload retried; deletion and limits untested on device |
| Backgrounding, screen lock, camera/call interruption and track release | Untested on a physical device | Ten-second lock: camera stopped, two thumbnails retained including a pending photo, explicit restart; calls and other interruptions untested |
| Network loss/recovery, response loss, expired reservation | Untested on a physical device | Wi-Fi loss/recovery, pending photo retained, manual retry without duplicates; response loss and expired reservation untested on device |
| Expiry, cancellation, immutable finalization and message after server confirmation | Finalization, completion screen and camera shutdown confirmed; expiry/cancellation untested on device | Finalization before deadline, completion screen and camera shutdown confirmed; expiry/cancellation untested on device |
| Desktop return, original/receipt export, local verification with correct/wrong context | Downloads and local checks completed successfully on desktop | Originals and receipts downloaded, bytes and correct context checked locally; wrong-context test not repeated on these dossiers |

On a real desktop, also check that the browser never requests a camera. Choose remaining device cases according to the change being validated, using the [HTTPS procedure](https.md). Xiaomi results do not validate Chrome Android, all device models or versions, or all suspension behavior.
