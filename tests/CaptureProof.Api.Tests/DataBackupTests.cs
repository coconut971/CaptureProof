using System.Net;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using CaptureProof.Api;
using Jose;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Data.Sqlite;
using Xunit;

namespace CaptureProof.Api.Tests;

public sealed class DataBackupTests : IAsyncLifetime
{
    private readonly string root = Path.Combine(Path.GetTempPath(), "CaptureProof-backup-tests", Guid.NewGuid().ToString("N"));
    private string Source => Path.Combine(root, "source");
    private string Snapshot => Path.Combine(root, "snapshot");
    private string Restored => Path.Combine(root, "restored");

    public Task InitializeAsync() { Directory.CreateDirectory(root); return Task.CompletedTask; }

    public Task DisposeAsync()
    {
        SqliteConnection.ClearAllPools();
        var expectedParent = Path.GetFullPath(Path.Combine(Path.GetTempPath(), "CaptureProof-backup-tests"));
        Assert.Equal(expectedParent, Path.GetDirectoryName(Path.GetFullPath(root)));
        Assert.Matches("^[a-f0-9]{32}$", Path.GetFileName(root));
        var link = Path.Combine(root, "linked-source");
        if (new DirectoryInfo(link).LinkTarget is not null)
        {
            Assert.Equal(Path.GetFullPath(root), Path.GetDirectoryName(Path.GetFullPath(link)));
            Directory.Delete(link); // Remove only the test link, never recurse through it.
        }
        if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
        return Task.CompletedTask;
    }

    [Fact]
    public async Task OfflineRoundTripPreservesThreeOriginalsReceiptSigningAndExistingCookies()
    {
        var original = await CreateClosedStore();
        var sourceBefore = Fingerprints(Source);
        DataBackup.Create(Source, Snapshot);
        Assert.Equal(sourceBefore, Fingerprints(Source));
        Assert.False(File.Exists(Path.Combine(Snapshot, "captureproof.db-wal")));
        Assert.False(File.Exists(Path.Combine(Snapshot, "captureproof.db-shm")));
        Assert.True(File.Exists(Path.Combine(Snapshot, DataBackup.ManifestFileName)));
        DataBackup.Restore(Snapshot, Restored);
        Assert.False(File.Exists(Path.Combine(Restored, DataBackup.ManifestFileName)));
        var expectedCookies = Directory.GetFiles(Path.Combine(Source, "cookie-keys")).Select(Path.GetFileName).Order().ToArray();
        Assert.NotEmpty(expectedCookies);
        foreach (var name in expectedCookies)
            Assert.Equal(File.ReadAllBytes(Path.Combine(Source, "cookie-keys", name!)), File.ReadAllBytes(Path.Combine(Restored, "cookie-keys", name!)));
        Assert.Equal(File.ReadAllBytes(Path.Combine(Source, "signing", "active-private.pem")), File.ReadAllBytes(Path.Combine(Restored, "signing", "active-private.pem")));
        await using var recoveredFactory = new ApiFactory(Restored, original.Clock);
        using var recovered = await recoveredFactory.NewClient(original.Cookies);
        var state = await recovered.State(original.Id);
        Assert.Equal("Finalized", state["state"]!.GetValue<string>());
        Assert.Equal(3, state["photos"]!.AsArray().Count);
        Assert.Equal(original.Keys, await recovered.Http.GetStringAsync("/api/keys"));
        using var receiptResponse = await recovered.Http.GetAsync($"/api/sessions/{original.Id}/receipt");
        Assert.Equal(original.Receipt, (await ApiClient.ReadSuccess(receiptResponse))["jws"]!.GetValue<string>());
        foreach (var photo in original.Photos)
        {
            using var response = await recovered.Http.GetAsync($"/api/sessions/{original.Id}/photos/{photo.Id}");
            Assert.True(response.IsSuccessStatusCode);
            Assert.Equal(photo.Bytes, await response.Content.ReadAsByteArrayAsync());
        }
        using var publicDocument = JsonDocument.Parse(original.Keys);
        var publicJwk = publicDocument.RootElement.GetProperty("keys")[0];
        using var publicKey = ECDsa.Create(new ECParameters
        {
            Curve = ECCurve.NamedCurves.nistP256,
            Q = new ECPoint
            {
                X = WebEncoders.Base64UrlDecode(publicJwk.GetProperty("x").GetString()!),
                Y = WebEncoders.Base64UrlDecode(publicJwk.GetProperty("y").GetString()!),
            },
        });
        var payload = JsonNode.Parse(JWT.Decode(original.Receipt, publicKey, JwsAlgorithm.ES256))!;
        Assert.Equal(original.Id, payload["sessionId"]!.GetValue<string>());
        Assert.Equal("BACKUP-ROUNDTRIP", payload["context"]!["businessReference"]!.GetValue<string>());
        Assert.Equal(3, payload["photoCount"]!.GetValue<int>());
        var interop = Environment.GetEnvironmentVariable("CAPTUREPROOF_RESTORE_INTEROP_DIR");
        if (!string.IsNullOrWhiteSpace(interop))
        {
            Directory.CreateDirectory(interop);
            await File.WriteAllTextAsync(Path.Combine(interop, "receipt.jws"), original.Receipt);
            await File.WriteAllTextAsync(Path.Combine(interop, "trusted-public.jwks.json"), original.Keys);
            foreach (var photo in original.Photos) await File.WriteAllBytesAsync(Path.Combine(interop, photo.Id + ".jpg"), photo.Bytes);
        }
        Assert.Empty(Directory.GetDirectories(root, ".captureproof-stage-*"));
    }

    [Fact]
    public async Task RunningServerAndConcurrentMaintenanceCannotShareTheSameDirectory()
    {
        await using (var factory = new ApiFactory(Source))
        {
            using var phone = await factory.NewClient();
            await phone.Create();
            Assert.Throws<InvalidOperationException>(() => DataBackup.Create(Source, Snapshot));
            Assert.Throws<InvalidOperationException>(() => DataDirectoryLock.Acquire(Source));
            Assert.False(Directory.Exists(Snapshot));
        }
        // Disposal must actually release the OS lock, not merely stop accepting requests.
        using var afterStop = DataDirectoryLock.Acquire(Source, createDirectory: false);
        Assert.Throws<InvalidOperationException>(() => DataBackup.Create(Source, Snapshot));
    }

    [Fact]
    public async Task ExistingOrOverlappingDestinationsAreNeverOverwritten()
    {
        await CreateClosedStore();
        var original = Fingerprints(Source);
        Directory.CreateDirectory(Snapshot);
        File.WriteAllText(Path.Combine(Snapshot, "sentinel.txt"), "keep");
        Assert.Throws<InvalidOperationException>(() => DataBackup.Create(Source, Snapshot));
        Assert.Equal("keep", File.ReadAllText(Path.Combine(Snapshot, "sentinel.txt")));
        Assert.Throws<InvalidOperationException>(() => DataBackup.Create(Source, Source));
        Assert.Throws<InvalidOperationException>(() => DataBackup.Create(Source, Path.Combine(Source, "child")));
        Assert.Throws<InvalidOperationException>(() => DataBackup.Create(Source, root));
        Assert.Throws<InvalidOperationException>(() => DataBackup.Create(Source, Path.GetPathRoot(root)!));
        Assert.Equal(original, Fingerprints(Source));
        Assert.False(Directory.Exists(Path.Combine(Source, "child")));
    }

    [Fact]
    public async Task WindowsAliasSpellingsCannotBypassDirectorySeparation()
    {
        await CreateClosedStore();
        if (!OperatingSystem.IsWindows())
        {
            // These spellings have different semantics on Unix; ordinary overlap is covered above.
            Assert.Throws<InvalidOperationException>(() => DataBackup.Create(Source, Path.Combine(Source, "child")));
            return;
        }
        var original = Fingerprints(Source);
        var rootName = Path.GetFileName(root);
        var shortSpelling = Path.Combine(Path.GetDirectoryName(root)!, rootName[..6] + "~1", "source");
        var aliases = new[]
        {
            Source + ".",
            Source + " ",
            shortSpelling,
            "\\\\?\\" + Source,
            "\\\\.\\" + Source,
            "//?/" + Source.Replace('\\', '/'),
        };
        foreach (var alias in aliases)
        {
            var expectedReason = alias.StartsWith("\\\\", StringComparison.Ordinal) || alias.StartsWith("//?", StringComparison.Ordinal) ? "périphérique" : "alias";
            var failure = Assert.Throws<InvalidOperationException>(() => DataDirectoryLock.Acquire(alias, createDirectory: false));
            Assert.Contains(expectedReason, failure.Message, StringComparison.OrdinalIgnoreCase);
            Assert.Throws<InvalidOperationException>(() => DataBackup.Create(alias, Snapshot));
            Assert.Throws<InvalidOperationException>(() => DataBackup.Create(Source, Path.Combine(alias, "snapshot")));
            Assert.False(Directory.Exists(Snapshot));
        }
        DataBackup.Create(Source, Snapshot);
        var backup = Fingerprints(Snapshot);
        foreach (var alias in aliases)
        {
            Assert.Throws<InvalidOperationException>(() => DataBackup.Restore(Snapshot, Path.Combine(alias, "restored")));
            Assert.Throws<InvalidOperationException>(() => DataBackup.Restore(alias, Restored));
        }
        Assert.Equal(backup, Fingerprints(Snapshot));
        Assert.Equal(original, Fingerprints(Source));
        Assert.False(Directory.Exists(Path.Combine(Source, "snapshot")));
        Assert.Empty(Directory.GetDirectories(root, ".captureproof-stage-*"));
    }

    [Fact]
    public async Task RestoreRequiresNewDestinationAndAnIdleBackup()
    {
        await CreateClosedStore();
        DataBackup.Create(Source, Snapshot);
        Directory.CreateDirectory(Restored);
        Assert.Throws<InvalidOperationException>(() => DataBackup.Restore(Snapshot, Restored));
        Assert.Throws<InvalidOperationException>(() => DataBackup.Restore(Snapshot, Snapshot));
        Assert.Throws<InvalidOperationException>(() => DataBackup.Restore(Snapshot, Path.Combine(Snapshot, "child")));
        using var busy = DataDirectoryLock.Acquire(Snapshot, createDirectory: false);
        Assert.Throws<InvalidOperationException>(() => DataBackup.Restore(Snapshot, Path.Combine(root, "another")));
        Assert.False(Directory.Exists(Path.Combine(root, "another")));
    }

    [Theory]
    [InlineData("changed")]
    [InlineData("missing")]
    [InlineData("extra")]
    [InlineData("traversal")]
    [InlineData("duplicate")]
    [InlineData("unsupported-version")]
    [InlineData("corrupt-database-with-updated-manifest")]
    [InlineData("missing-cookie-keys-with-updated-manifest")]
    [InlineData("missing-signing-key-with-updated-manifest")]
    public async Task CorruptionAndUnsafeInventoriesRefuseRestoreWithoutCreatingDestination(string mutation)
    {
        var original = await CreateClosedStore();
        DataBackup.Create(Source, Snapshot);
        var sourceBefore = Fingerprints(Source);
        var manifestPath = Path.Combine(Snapshot, DataBackup.ManifestFileName);
        var manifest = JsonNode.Parse(await File.ReadAllTextAsync(manifestPath))!.AsObject();
        var files = manifest["files"]!.AsArray();
        var photo = Path.Combine(Snapshot, "photos", original.Photos[0].Id + ".jpg");
        switch (mutation)
        {
            case "changed":
                var bytes = await File.ReadAllBytesAsync(photo); bytes[^1] ^= 1; await File.WriteAllBytesAsync(photo, bytes); break;
            case "missing": File.Delete(photo); break;
            case "extra": await File.WriteAllTextAsync(Path.Combine(Snapshot, "unexpected.txt"), "extra"); break;
            case "traversal": files[0]!["path"] = "../outside.txt"; break;
            case "duplicate": files.Add(files[0]!.DeepClone()); break;
            case "unsupported-version": manifest["formatVersion"] = 999; break;
            case "corrupt-database-with-updated-manifest":
                await File.WriteAllBytesAsync(Path.Combine(Snapshot, "captureproof.db"), [1, 2, 3, 4]);
                RefreshEntry(files, "captureproof.db"); break;
            case "missing-cookie-keys-with-updated-manifest":
                foreach (var file in Directory.GetFiles(Path.Combine(Snapshot, "cookie-keys"))) File.Delete(file);
                RemoveEntries(files, "cookie-keys/"); break;
            case "missing-signing-key-with-updated-manifest":
                File.Delete(Path.Combine(Snapshot, "signing", "active-private.pem"));
                RemoveEntries(files, "signing/active-private.pem"); break;
        }
        if (mutation is not ("changed" or "missing" or "extra")) await File.WriteAllTextAsync(manifestPath, manifest.ToJsonString());
        Assert.ThrowsAny<Exception>(() => DataBackup.Restore(Snapshot, Restored));
        Assert.False(Directory.Exists(Restored));
        Assert.Empty(Directory.GetDirectories(root, ".captureproof-stage-*"));
        Assert.Equal(sourceBefore, Fingerprints(Source));
    }

    [Fact]
    public async Task AcceptedPhotoCorruptionIsRejectedEvenWhenManifestHashIsUpdated()
    {
        var original = await CreateClosedStore();
        DataBackup.Create(Source, Snapshot);
        var file = Path.Combine(Snapshot, "photos", original.Photos[0].Id + ".jpg");
        var bytes = File.ReadAllBytes(file); bytes[bytes.Length / 2] ^= 1; File.WriteAllBytes(file, bytes);
        var manifestPath = Path.Combine(Snapshot, DataBackup.ManifestFileName);
        var manifest = JsonNode.Parse(File.ReadAllText(manifestPath))!;
        RefreshEntry(manifest["files"]!.AsArray(), "photos/" + original.Photos[0].Id + ".jpg");
        File.WriteAllText(manifestPath, manifest.ToJsonString());
        Assert.Throws<InvalidOperationException>(() => DataBackup.Restore(Snapshot, Restored));
        Assert.False(Directory.Exists(Restored));
    }

    [Fact]
    public async Task CommittedWalTransactionsAreIncludedWithoutChangingRawSourceFiles()
    {
        var original = await CreateClosedStore();
        long updatedExpiry;
        using (var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = Path.Combine(Source, "captureproof.db"), Pooling = false }.ToString()))
        {
            db.Open();
            Assert.Equal(SQLitePCL.raw.SQLITE_OK, SQLitePCL.raw.sqlite3_db_config(db.Handle, SQLitePCL.raw.SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE, 1, out var enabled));
            Assert.Equal(1, enabled);
            using var command = db.CreateCommand();
            command.CommandText = "PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;";
            command.ExecuteNonQuery();
            command.CommandText = "UPDATE Sessions SET ExpiresAt=ExpiresAt+12345 WHERE Id=$id RETURNING ExpiresAt;";
            command.Parameters.AddWithValue("$id", original.Id);
            updatedExpiry = Convert.ToInt64(command.ExecuteScalar());
        }
        Assert.True(new FileInfo(Path.Combine(Source, "captureproof.db-wal")).Length > 0);
        var rawBefore = Fingerprints(Source);
        DataBackup.Create(Source, Snapshot);
        Assert.Equal(rawBefore, Fingerprints(Source));
        DataBackup.Restore(Snapshot, Restored);
        using var restored = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = Path.Combine(Restored, "captureproof.db"), Mode = SqliteOpenMode.ReadOnly, Pooling = false }.ToString());
        restored.Open();
        using var query = restored.CreateCommand();
        query.CommandText = "SELECT ExpiresAt FROM Sessions WHERE Id=$id;";
        query.Parameters.AddWithValue("$id", original.Id);
        Assert.Equal(updatedExpiry, Convert.ToInt64(query.ExecuteScalar()));
        Assert.False(File.Exists(Path.Combine(Snapshot, "captureproof.db-wal")));
    }

    [Fact]
    public async Task UnknownSourceFilesAreRefusedWithoutCopyingOrDeletingThem()
    {
        await CreateClosedStore();
        var unexpected = Path.Combine(Source, "secrets-not-part-of-this-store.txt");
        File.WriteAllText(unexpected, "private sentinel");
        Assert.Throws<InvalidOperationException>(() => DataBackup.Create(Source, Snapshot));
        Assert.False(Directory.Exists(Snapshot));
        Assert.Equal("private sentinel", File.ReadAllText(unexpected));
    }

    [Fact]
    public async Task LinkedSourceOrDestinationAncestorsAreRefused()
    {
        await CreateClosedStore();
        var linked = Path.Combine(root, "linked-source");
        try { Directory.CreateSymbolicLink(linked, Source); }
        catch (UnauthorizedAccessException) when (OperatingSystem.IsWindows())
        {
            await CreateWindowsJunction(linked, Source);
        }
        catch (IOException error) when (OperatingSystem.IsWindows() && (error.HResult & 0xffff) == 1314)
        {
            await CreateWindowsJunction(linked, Source);
        }
        Assert.Throws<InvalidOperationException>(() => DataBackup.Create(linked, Snapshot));
        Assert.Throws<InvalidOperationException>(() => DataBackup.Create(Source, Path.Combine(linked, "snapshot")));
        Assert.False(Directory.Exists(Snapshot));
        Assert.False(Directory.Exists(Path.Combine(Source, "snapshot")));
    }

    private static async Task CreateWindowsJunction(string link, string target)
    {
        // Junctions exercise the same reparse guard without requiring symbolic-link privilege.
        // The command is fixed, and paths are passed as data through environment variables.
        var start = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe"))
        {
            UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardOutput = true, RedirectStandardError = true,
        };
        foreach (var argument in new[] { "-NoProfile", "-NonInteractive", "-Command", "New-Item -ItemType Junction -Path $env:CAPTUREPROOF_TEST_LINK_PATH -Target $env:CAPTUREPROOF_TEST_LINK_TARGET -ErrorAction Stop | Out-Null" }) start.ArgumentList.Add(argument);
        start.Environment["CAPTUREPROOF_TEST_LINK_PATH"] = link;
        start.Environment["CAPTUREPROOF_TEST_LINK_TARGET"] = target;
        using var process = Process.Start(start)!;
        var output = process.StandardOutput.ReadToEndAsync();
        var error = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        Assert.True(process.ExitCode == 0, "Windows junction setup failed: " + await error + await output);
        Assert.True((File.GetAttributes(link) & FileAttributes.ReparsePoint) != 0);
    }

    private sealed record Photo(string Id, byte[] Bytes);
    private sealed record StoreData(string Id, string Receipt, string Keys, CookieContainer Cookies, TestClock Clock, List<Photo> Photos);

    private async Task<StoreData> CreateClosedStore()
    {
        var clock = new TestClock();
        var cookies = new CookieContainer();
        var photos = new List<Photo>();
        string id, receipt, keys;
        await using (var factory = new ApiFactory(Source, clock))
        {
            using var phone = await factory.NewClient(cookies);
            id = (await phone.Create(reference: "BACKUP-ROUNDTRIP"))["id"]!.GetValue<string>();
            for (byte i = 0; i < 3; i++)
            {
                var bytes = ApiClient.SyntheticJpeg((byte)(60 + i * 30));
                var photo = await phone.Upload(id, bytes);
                photos.Add(new(photo["id"]!.GetValue<string>(), bytes));
            }
            using var finalized = await phone.Mutate("POST", $"/api/sessions/{id}/finalize");
            receipt = (await ApiClient.ReadSuccess(finalized))["jws"]!.GetValue<string>();
            keys = await phone.Http.GetStringAsync("/api/keys");
        }
        return new(id, receipt, keys, cookies, clock, photos);
    }

    private static SortedDictionary<string, string> Fingerprints(string directory) => new(
        Directory.GetFiles(directory, "*", SearchOption.AllDirectories)
            .Where(file => Path.GetFileName(file) != DataDirectoryLock.FileName)
            .ToDictionary(file => Path.GetRelativePath(directory, file), file => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(file)))), StringComparer.Ordinal);

    private void RefreshEntry(JsonArray files, string relative)
    {
        var entry = Assert.Single(files, entry => entry!["path"]!.GetValue<string>() == relative)!;
        var bytes = File.ReadAllBytes(Path.Combine(Snapshot, relative.Replace('/', Path.DirectorySeparatorChar)));
        entry["size"] = bytes.LongLength;
        entry["sha256"] = Convert.ToHexStringLower(SHA256.HashData(bytes));
    }

    private static void RemoveEntries(JsonArray files, string prefix)
    {
        foreach (var entry in files.Where(entry => entry!["path"]!.GetValue<string>().StartsWith(prefix, StringComparison.Ordinal)).ToArray()) files.Remove(entry);
    }
}
