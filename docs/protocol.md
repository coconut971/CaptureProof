English · [Français](fr/protocol.md)

# HTTP protocol and states

The OpenAPI contract is available at `/openapi/v1.json`. JSON responses use camelCase. Application errors contain `code` and `message` without secrets. HTTP limits can also produce 400, 413, 429 or 503 before a route runs.

Call `GET /api/bootstrap` to obtain the demonstration owner cookie and `csrfToken`. Keep the token in memory and send it in `X-CSRF-TOKEN` on every mutation. Cookies use `credentials: same-origin`. The server also checks `Origin`. No durable token is placed in localStorage, and unrestricted CORS is not configured.

| Method and route | Permission | Purpose |
| --- | --- | --- |
| GET `/api/bootstrap` | Public | Demonstration identity and antiforgery |
| POST `/api/sessions` | Owner | `{category,businessReference,direct}`; server-selected policy |
| GET `/api/sessions` | Owner | The owner's own dossiers |
| GET `/api/sessions/{id}` | Owner or current phone | Authorized state and metadata |
| POST `/api/sessions/{id}/invitation` | Owner | New secret, revoking the old one; no active upload or received photo permitted |
| POST `/api/pair` | Invitation holder | `{sessionId,secret}`; atomic consumption and phone cookie |
| POST `/api/sessions/{id}/confirm` | Owner | `{accept}`; accept or reject the phone |
| POST `/api/sessions/{id}/cancel` | Owner | Cancel a session that is still open |
| POST `/api/sessions/{id}/uploads` | Confirmed phone | `{uploadId}`; reserve or renew an unconsumed reservation |
| PUT `/api/sessions/{id}/uploads/{uploadId}` | Confirmed phone | JPEG body and `X-Upload-Authorization` |
| DELETE `/api/sessions/{id}/photos/{photoId}` | Confirmed phone | Delete before finalization |
| POST `/api/sessions/{id}/finalize` | Confirmed phone | Stable file set and unique receipt `{jws}` |
| GET `/api/sessions/{id}/receipt` | Owner or current phone | The same persisted receipt `{jws}` |
| GET `/api/sessions/{id}/photos/{photoId}` | Owner or current phone | Original JPEG bytes, filename `<photoId>.jpg` |
| GET `/api/keys` | Public | Export public keys; does not establish trust automatically |
| SignalR `/hubs/capture`, `Subscribe(id)` | Owner or current phone | Read permission checked before joining the group |

Knowing a session or group identifier grants no access. Owner permission alone cannot upload: direct mode separately creates phone authorization for the current session. A phone cannot act on another session or confirm its own pairing.

## Invitation

The secret contains 32 cryptographically random bytes. Only its SHA-256 digest is stored. It is valid for at most 120 seconds, bounded by the session lifetime. The QR is generated locally from `PublicOrigin`, never from a request-supplied Host. Its URL contains `#invite=...`; the frontend reads and synchronously removes the fragment before its first network call. The exchange POST consumes the invitation; a GET never does. The six-digit comparison code supports human verification but replaces no secret.

Regenerating or rejecting an invitation revokes the previous phone-authorization version. After an upload or an active reservation, changing phones requires a new session. This avoids ambiguity about an already assembled dossier.

## State machine

| State | Allowed transitions |
| --- | --- |
| `AwaitingPairing` | Invitation or regeneration; valid exchange to `PendingConfirmation`; cancellation; expiry |
| `PendingConfirmation` | Acceptance to `Capturing`; rejection to `AwaitingPairing`; regeneration; cancellation; expiry |
| `Capturing` | Reservations, uploads and deletion; finalization to `Finalized`; cancellation; expiry; new invitation only without a photo or active reservation |
| `Finalized` | Reads and repeated finalization returning the same receipt; no mutation |
| `Cancelled`, `Expired` | No mutation; authorized state reads remain available until purge |

Direct mode creates a session in `Capturing`. Its lifetime is calculated by the server. Finalization cannot occur after expiry even if the interface still shows an open session. A finalized session stays finalized after its capture expiry and remains available to its owner until purge.

## Uploads and retries

An authorization is bound to `(sessionId,uploadId)`, lasts at most 120 seconds and is stored as a digest. Every PUT checks the current phone cookie, CSRF, origin, state, reserved quota and upload authorization. The same bytes with the same valid authorization return the same photo. Different bytes produce 409. A lost response does not create a second identifier.

Repeating POST for an unconsumed reservation issues a new secret and invalidates the previous one without occupying another slot. An earlier PUT can consequently fail and must use the latest secret. Before renewing, the client rereads state to recover an upload that may already have been accepted. After an accepted authorization expires, the photo is recovered from state rather than uploaded again.

Finalization rejects fewer than `minPhotos`, more than `maxPhotos` or any remaining active reservation. It copies the policy and metadata, signs once and persists both payload and JWS. Repeating finalization changes neither time nor signature. Expired reservations cease to be active. The component still blocks finalization while an upload response is pending, even when a notification has already shown its result.

REST checks revocation on every access. In this version, a SignalR connection already in a group may still receive invalidations containing only a previously known `sessionId` after revocation. It can no longer retrieve data, but activity timing may remain observable until disconnection.
