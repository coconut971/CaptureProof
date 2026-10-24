**English** | [Français](fr/backup-restore.md)

# Offline backup and restore

These local commands copy the SQLite database, photos, signing keys and cookie-protection keys together. They do not start the server or generate a key. Restore creates a **new directory** and never replaces an existing installation.

## Back up

Stop the server using the source directory and wait for the process to exit. The server, key rotation and maintenance commands share a directory lock; a concurrent operation is refused. This is a cooperative lock: older versions and external tools do not acquire it. Explicitly stopping the service remains required.

Build first with `npm ci`, `npm run build`, then `dotnet build src/CaptureProof.Api`. On Windows with the local SDK, replace `dotnet` with `.\.tools\dotnet\dotnet.exe`. From the repository root:

```powershell
$sourceDirectory = Join-Path (Get-Location) '.data/stopped-installation'
$backupDirectory = Join-Path (Get-Location) '.data/backup-001'
.\.tools\dotnet\dotnet.exe src/CaptureProof.Api/bin/Debug/net10.0/CaptureProof.Api.dll --backup $sourceDirectory $backupDirectory
```

The destination's parent must already exist; the destination itself must not exist. Source and destination must be separate and must not contain each other. Symbolic links, reparse points and unexpected files are refused. On Windows, device paths and path components ending in a dot or space, or containing `~`, are refused to avoid ambiguous aliases. Do not delete an unexpected file without understanding its origin.

SQLite's backup API produces a self-contained copy, including committed WAL transactions. Accepted photos are checked against the sizes and hashes in the database. Active keys, historical public keys and cookie keys are validated. Intermediate `-wal`, `-shm` and coordination lock files are not restore data.

The copy is prepared in a private temporary directory, validated, then moved to the destination. SQLite operates on a temporary raw copy of the database and its WAL so that it creates no coordination files in the source. Allow space for this intermediate copy in addition to the final backup. On failure, only the temporary area created by the command is cleaned up. An existing destination is never overwritten.

## Restore

Keep the backup separate and choose a new destination:

```powershell
$restoredDirectory = Join-Path (Get-Location) '.data/restored-001'
.\.tools\dotnet\dotnet.exe src/CaptureProof.Api/bin/Debug/net10.0/CaptureProof.Api.dll --restore $backupDirectory $restoredDirectory
```

The inventory must be complete: names, sizes and SHA-256 values. A missing, extra or modified file, forbidden path or inconsistent key causes restore to fail. Data is made available to the server only after full validation.

Before replacing an installation, start the restored copy on a separate test origin and port, with its own `CaptureProof__DataDirectory`. Check dossiers, downloads, exact receipts and verification against previously trusted public keys. Preserved cookie keys maintain still-valid authorizations; they do not extend their expiry.

**Dossier creation dates remain unchanged.** Normal cleanup applies at the first startup, so a backup older than retention can be purged. Explicitly configure the verification server's retention before starting it, within the allowed bounds. Restore does not renew a dossier.

Exit codes are `0` for success, `1` for a refused operation and `2` for invalid syntax. On Linux or from a published build, use the same options with `dotnet CaptureProof.Api.dll --backup ...` or `--restore ...` and that installation's paths.

## Protect copies

A backup contains **private keys and photos**. It must not enter Git, a public source archive, a Docker image or a web directory. On Windows, the copy is restricted to the operator account and SYSTEM; on Linux, directories use `0700` and files use `0600`. Run under the service account or explicitly adjust its permissions before restarting.

The SHA-256 inventory detects accidental changes. It neither authenticates nor encrypts the backup: a party able to modify both data and inventory can replace both. Use trusted, protected storage and encryption appropriate to operational requirements. Cookie keys protected by the operating system can depend on the original account or machine.

Limits are 100,000 files, 128 GiB total, 16 GiB per file and a 32 MiB inventory. This first procedure remains offline on local storage. It does not add scheduling, a remote service or live backups.

## Reproducible exercise

`DataBackupTests` uses temporary directories and synthetic JPEGs. The test finalizes a real API dossier, stops its server, backs it up, restores it and starts the copy. It compares the receipt, photos, keys and cookies. It also exercises refusal of concurrent operations, overwrites, corruption and forbidden paths.

Setting `CAPTUREPROOF_RESTORE_INTEROP_DIR` to a private directory before running tests exports the restored receipt and its synthetic files for the independent TypeScript verifier. That directory stays outside the distribution. The [test guide](testing.md) records commands actually executed and their outcomes.
