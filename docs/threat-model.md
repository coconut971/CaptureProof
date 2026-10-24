English · [Français](fr/threat-model.md)

# Threat model and limits

The server and its configuration are assumed to be administered by the integrator. The browser, client metadata and every uploaded file are untrusted. Mobile detection is not a security boundary. Public keys become trusted only through an explicit decision by the verifier or integrator.

| Threat | Implemented protection | Limit |
| --- | --- | --- |
| Cross-session access | Server-created owner, protected cookie, phone permission bound to session/version, checked routes and Subscribe | Replace anonymous demonstration identity in a production integration |
| Unauthorized pairing | Hashed 256-bit secret, URL fragment, atomic single-use POST, compared code and owner confirmation | A stolen secret or careless human comparison can pair the wrong phone |
| Replay | Single-use invitation, expiring/revocable grants, upload bound to session/identifier, unique finalization | A compromised cookie or device retains access until revocation or expiry |
| Concurrent quota use | Immediate SQLite transactions, counted reservations, global budget and bounds | Does not replace public denial-of-service infrastructure |
| Modified file or receipt | Server digest of exact bytes, ES256 signature, strict schema and exact file set | Server, storage or signing-key compromise lies outside the guarantee |
| Context substitution | Signed context and comparison against expected fields | Omitting this optional check is reported as not provided |
| Exposed secret | No secret in server URLs, application logs or third-party calls; no localStorage token | Operators must keep proxy logs, backups and other logs free of bodies, cookies and fragments |
| Upload abuse | Full JPEG decoding, byte/dimension/pixel limits, four concurrent processing slots, timeout, rate, session and storage bounds | Native decoder and dependencies need updates; demonstration identity does not prevent all abusive session creation |

The controlled `SyntheticJpegIsAcceptedByAuthorizedClientAndOriginalBytesArePreserved` test sends a software-created JPEG through an authorized client. The server accepts it, calculates its digest and signs the dossier. This exposes the trust boundary: removing an import button cannot make a modified request impossible.

This version does not solve modified JavaScript, virtual cameras, substitution of a conforming file into a valid request, photographing a screen, compromised devices, object authenticity, AI origin, server or key compromise, or independent clock trust. It contains no vision model, AI detector, “real” score, face recognition or biometric processing.

Notifications sent to an already subscribed connection may disclose session activity timing after revocation without permitting REST reads. Short retention reduces exposure of dossiers but does not provide cryptographic erasure of disk contents or backups.

HTTPS encrypts transport. Disk permissions protect local access according to the operating system. Reference files and the PEM key are not claimed to be encrypted at rest. The signature supports integrity and issuer verification according to the chosen trusted keys; it encrypts no content.

References: [OWASP file uploads](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [OWASP sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
