**English** | [Français](SECURITY.fr.md)

# Security

This first version is a reference prototype that needs review before a public deployment. Automated tests and focused internal reviews are not an external security audit. User-reported flows have been validated on iPhone Safari and Xiaomi with Mi Browser, including the completion screen and camera shutdown. On the Xiaomi, a Wi-Fi interruption and a short screen lock with a pending photo were also followed by successful recovery in the same page. Exact device models and versions were not recorded. Other real-device conditions, including Chrome Android, are documented in the [physical-device checklist](docs/testing.md).

To report a vulnerability, contact the maintainer or integrator privately through their established channel. This repository does not invent a named contact. If a private reporting channel is enabled on the repository platform, use it. Never attach a private key, cookie, active invitation or personal photo to a public report. Include the version, a minimal reproduction and the observed consequences using synthetic data.

The [threat model](docs/threat-model.md) describes the assumptions and limits. Replace the demo identity boundary and authorize business references on the server before integrating the reference implementation into a marketplace.

Operators must apply .NET, npm, NuGet and native decoder updates, restrict permissions on keys and the data directory, and configure HTTPS, retention, backups and proxy logs. A compromised signing key requires rotation and a trust decision for older receipts. Signing an image does not encrypt it.

[Offline maintenance](docs/backup-restore.md) also preserves private signing keys and cookie keys, so backup copies must remain protected. Their hash inventory detects corruption but does not authenticate a hostile backup. The shared directory lock protects cooperating processes in this version; it does not replace stopping the service or applying operating-system permissions.
