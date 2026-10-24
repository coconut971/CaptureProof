using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using Microsoft.Data.Sqlite;

namespace CaptureProof.Api;

/// <summary>Offline, new-directory-only snapshots. The manifest detects corruption, not a hostile backup owner.</summary>
public static class DataBackup
{
    public const string ManifestFileName = "backup-manifest.json";
    private const long MaxTotalBytes = 128L * 1024 * 1024 * 1024;
    private const long MaxFileBytes = 16L * 1024 * 1024 * 1024;
    private const int MaxFiles = 100_000;
    private const int MaxManifestBytes = 32 * 1024 * 1024;
    private static readonly Regex PhotoName = new("^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}\\.jpg$", RegexOptions.CultureInvariant);
    private static readonly Regex PublicName = new("^public-[a-f0-9]{24}\\.json$", RegexOptions.CultureInvariant);
    private static readonly Regex CookieName = new("^key-[a-fA-F0-9-]{36}\\.xml$", RegexOptions.CultureInvariant);
    private static readonly Regex Digest = new("^[a-f0-9]{64}$", RegexOptions.CultureInvariant);
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true, UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
    };

    private sealed record FileEntry(string Path, long Size, string Sha256);
    private sealed record Manifest(int FormatVersion, DateTimeOffset CreatedAt, List<FileEntry> Files);

    public static void Create(string sourceDirectory, string backupDirectory)
    {
        sourceDirectory = BackupPaths.Full(sourceDirectory);
        backupDirectory = PrepareDestination(sourceDirectory, backupDirectory);
        using var sourceLock = DataDirectoryLock.Acquire(sourceDirectory, createDirectory: false);
        var sourceFiles = Enumerate(sourceDirectory, backup: false);
        Require(sourceFiles.Contains("captureproof.db"), "Base de données absente.");
        var stage = NewStage(backupDirectory);
        try
        {
            CreateDataDirectories(stage);
            var database = Path.Combine(stage, "captureproof.db");
            SnapshotDatabase(sourceDirectory, stage, database);
            PrivateFile(database);
            foreach (var file in sourceFiles.Where(file => file != "captureproof.db"))
                Copy(sourceDirectory, stage, file);
            ValidateStore(stage);
            var files = Enumerate(stage, backup: false).Select(file => Entry(stage, file)).ToList();
            var manifest = new Manifest(1, DateTimeOffset.UtcNow, files);
            var manifestBytes = JsonSerializer.SerializeToUtf8Bytes(manifest, Json);
            Require(manifestBytes.Length <= MaxManifestBytes, "Inventaire de sauvegarde trop volumineux.");
            WriteNew(Path.Combine(stage, ManifestFileName), manifestBytes);
            // Locks are coordination artifacts, never database or key content.
            WriteNew(Path.Combine(stage, DataDirectoryLock.FileName), []);
            ValidateBackup(stage);
            Promote(stage, backupDirectory);
        }
        catch
        {
            RemoveOwnStage(stage, backupDirectory);
            throw;
        }
    }

    private static void SnapshotDatabase(string sourceDirectory, string stage, string database)
    {
        // Even a readonly WAL connection may create SHM/WAL coordination files. Open only a
        // private raw copy, so the stopped source directory is never changed by SQLite.
        var scratch = Path.Combine(stage, ".sqlite-source");
        PrivateDirectory(scratch);
        try
        {
            foreach (var name in new[] { "captureproof.db", "captureproof.db-wal" })
            {
                var input = Path.Combine(sourceDirectory, name);
                if (!File.Exists(input)) continue;
                BackupPaths.NoLinks(input);
                using (var reader = new FileStream(input, FileMode.Open, FileAccess.Read, FileShare.Read))
                using (var writer = new FileStream(Path.Combine(scratch, name), FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    Require(reader.Length <= MaxFileBytes, "Base ou journal SQLite trop volumineux.");
                    reader.CopyTo(writer);
                    writer.Flush(flushToDisk: true);
                }
                PrivateFile(Path.Combine(scratch, name));
            }
            using var source = OpenDatabase(Path.Combine(scratch, "captureproof.db"));
            using var destination = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = database, Pooling = false }.ToString());
            destination.Open();
            source.BackupDatabase(destination);
            using var command = destination.CreateCommand();
            command.CommandText = "PRAGMA journal_mode=DELETE;";
            command.ExecuteScalar();
        }
        finally
        {
            // This fixed scratch child is ours, and contains only SQLite raw/coordination files.
            BackupPaths.NoLinks(scratch);
            foreach (var file in Directory.EnumerateFileSystemEntries(scratch))
            {
                BackupPaths.NoLinks(file);
                Require(!Directory.Exists(file) && Path.GetFileName(file) is "captureproof.db" or "captureproof.db-wal" or "captureproof.db-shm", "Nettoyage du répertoire SQLite temporaire refusé.");
                File.Delete(file);
            }
            Directory.Delete(scratch);
        }
    }

    public static void Restore(string backupDirectory, string destinationDirectory)
    {
        backupDirectory = BackupPaths.Full(backupDirectory);
        destinationDirectory = PrepareDestination(backupDirectory, destinationDirectory);
        using var backupLock = DataDirectoryLock.Acquire(backupDirectory, createDirectory: false);
        var manifest = ValidateBackup(backupDirectory);
        var stage = NewStage(destinationDirectory);
        try
        {
            CreateDataDirectories(stage);
            foreach (var file in manifest.Files) Copy(backupDirectory, stage, file.Path, file);
            ValidateStore(stage);
            // Re-read the input inventory while its cooperative lock is held.
            ValidateBackup(backupDirectory);
            Promote(stage, destinationDirectory);
        }
        catch
        {
            RemoveOwnStage(stage, destinationDirectory);
            throw;
        }
    }

    private static string PrepareDestination(string source, string destination)
    {
        destination = BackupPaths.Full(destination);
        BackupPaths.Disjoint(source, destination);
        BackupPaths.NoLinks(source);
        BackupPaths.NoLinks(destination);
        Require(!File.Exists(destination) && !Directory.Exists(destination), "La destination existe déjà. Choisissez un nouveau répertoire.");
        var parent = Path.GetDirectoryName(destination);
        Require(parent is not null && Directory.Exists(parent), "Le répertoire parent de destination doit déjà exister.");
        return destination;
    }

    private static string NewStage(string destination)
    {
        var parent = Path.GetDirectoryName(destination)!;
        BackupPaths.NoLinks(parent);
        var stage = Path.Combine(parent, ".captureproof-stage-" + Guid.NewGuid().ToString("N"));
        Require(!File.Exists(stage) && !Directory.Exists(stage), "Répertoire temporaire déjà présent.");
        PrivateDirectory(stage);
        return stage;
    }

    private static void CreateDataDirectories(string stage)
    {
        foreach (var name in new[] { "photos", "signing", "cookie-keys" }) PrivateDirectory(Path.Combine(stage, name));
    }

    private static void Promote(string stage, string destination)
    {
        BackupPaths.NoLinks(stage);
        BackupPaths.NoLinks(destination);
        Require(!File.Exists(destination) && !Directory.Exists(destination), "La destination existe déjà. Aucun écrasement effectué.");
        Directory.Move(stage, destination);
    }

    private static void RemoveOwnStage(string stage, string destination)
    {
        // Never recursively remove an operator path, only our GUID sibling created above.
        if (!Directory.Exists(stage)) return;
        var parent = Path.GetDirectoryName(BackupPaths.Full(destination));
        Require(string.Equals(Path.GetDirectoryName(BackupPaths.Full(stage)), parent, StringComparison.Ordinal), "Nettoyage temporaire refusé.");
        Require(Regex.IsMatch(Path.GetFileName(stage), "^\\.captureproof-stage-[a-f0-9]{32}$", RegexOptions.CultureInvariant), "Nettoyage temporaire refusé.");
        BackupPaths.NoLinks(stage);
        Enumerate(stage, backup: true); // Refuse to follow a link introduced into the staging tree.
        Directory.Delete(stage, recursive: true);
    }

    private static List<string> Enumerate(string directory, bool backup)
    {
        BackupPaths.NoLinks(directory);
        Require(Directory.Exists(directory), "Répertoire introuvable.");
        var files = new List<string>();
        long total = 0;
        foreach (var entry in Directory.EnumerateFileSystemEntries(directory))
        {
            BackupPaths.NoLinks(entry);
            var name = Path.GetFileName(entry);
            if (Directory.Exists(entry))
            {
                Require(name is "photos" or "signing" or "cookie-keys", "Sous-répertoire inattendu dans les données.");
                foreach (var file in Directory.EnumerateFileSystemEntries(entry))
                {
                    BackupPaths.NoLinks(file);
                    Require(!Directory.Exists(file), "Les sous-répertoires imbriqués sont refusés.");
                    var relative = name + "/" + Path.GetFileName(file);
                    Require(Allowed(relative), "Fichier inattendu dans les données.");
                    Add(relative, file);
                }
            }
            else if (name == DataDirectoryLock.FileName) { /* Coordination file is not data. */ }
            else if (!backup && name is "captureproof.db-wal" or "captureproof.db-shm")
            {
                // SQLite consumes these, but their input size must still be bounded.
                var size = new FileInfo(entry).Length;
                Require(size <= MaxFileBytes, "Journal SQLite trop volumineux.");
                total = checked(total + size);
                Require(total <= MaxTotalBytes, "Sauvegarde trop volumineuse.");
            }
            else if (backup && name == ManifestFileName) { /* Checked independently before JSON parsing. */ }
            else
            {
                Require(name == "captureproof.db", "Fichier racine inattendu dans les données.");
                Add(name, entry);
            }
        }
        return files.Order(StringComparer.Ordinal).ToList();

        void Add(string relative, string full)
        {
            var size = new FileInfo(full).Length;
            Require(size <= MaxFileBytes && size >= 0, "Fichier trop volumineux pour cette sauvegarde.");
            total = checked(total + size);
            Require(total <= MaxTotalBytes && files.Count < MaxFiles, "Sauvegarde trop volumineuse.");
            files.Add(relative);
        }
    }

    private static bool Allowed(string relative)
    {
        if (relative == "captureproof.db") return true;
        var parts = relative.Split('/');
        if (parts.Length != 2 || parts.Any(part => part.Length == 0 || part is "." or "..") || relative.Contains('\\') || relative.Contains(':')) return false;
        return parts[0] switch
        {
            "photos" => PhotoName.IsMatch(parts[1]),
            "signing" => parts[1] == "active-private.pem" || PublicName.IsMatch(parts[1]),
            "cookie-keys" => CookieName.IsMatch(parts[1]),
            _ => false,
        };
    }

    private static Manifest ValidateBackup(string directory)
    {
        var manifestPath = Path.Combine(directory, ManifestFileName);
        BackupPaths.NoLinks(manifestPath);
        Require(File.Exists(manifestPath), "Inventaire de sauvegarde absent.");
        Require(new FileInfo(manifestPath).Length <= MaxManifestBytes, "Inventaire de sauvegarde trop volumineux.");
        Manifest? manifest;
        try { manifest = JsonSerializer.Deserialize<Manifest>(File.ReadAllBytes(manifestPath), Json); }
        catch (JsonException) { throw new InvalidOperationException("Inventaire de sauvegarde invalide."); }
        Require(manifest is { FormatVersion: 1, Files.Count: > 0 and <= MaxFiles }, "Version ou contenu de sauvegarde invalide.");
        var verified = manifest!;
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        long total = 0;
        foreach (var file in verified.Files)
        {
            Require(file is not null && file.Path is not null && Allowed(file.Path) && names.Add(file.Path), "Chemin de sauvegarde interdit ou dupliqué.");
            Require(file!.Size is >= 0 and <= MaxFileBytes && file.Sha256 is not null && Digest.IsMatch(file.Sha256), "Empreinte ou taille invalide.");
            total = checked(total + file.Size);
            Require(total <= MaxTotalBytes, "Sauvegarde trop volumineuse.");
        }
        var actual = Enumerate(directory, backup: true);
        Require(actual.SequenceEqual(verified.Files.Select(file => file.Path).Order(StringComparer.Ordinal), StringComparer.Ordinal), "Inventaire incomplet ou fichier supplémentaire dans la sauvegarde.");
        foreach (var expected in verified.Files) CheckEntry(directory, expected);
        ValidateStore(directory);
        return verified;
    }

    private static FileEntry Entry(string directory, string relative)
    {
        var file = Path.Combine(directory, relative.Replace('/', Path.DirectorySeparatorChar));
        BackupPaths.NoLinks(file);
        using var stream = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.Read);
        return new(relative, stream.Length, Convert.ToHexStringLower(SHA256.HashData(stream)));
    }

    private static void CheckEntry(string directory, FileEntry expected)
    {
        var actual = Entry(directory, expected.Path);
        Require(actual.Size == expected.Size && actual.Sha256 == expected.Sha256, "La sauvegarde est altérée ou incomplète.");
    }

    private static void Copy(string source, string destination, string relative, FileEntry? expected = null)
    {
        Require(Allowed(relative), "Chemin de données interdit.");
        var input = Path.Combine(source, relative.Replace('/', Path.DirectorySeparatorChar));
        var output = Path.Combine(destination, relative.Replace('/', Path.DirectorySeparatorChar));
        BackupPaths.NoLinks(input); BackupPaths.NoLinks(output);
        using (var reader = new FileStream(input, FileMode.Open, FileAccess.Read, FileShare.Read))
        using (var writer = new FileStream(output, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            reader.CopyTo(writer);
            writer.Flush(flushToDisk: true);
        }
        PrivateFile(output);
        if (expected is not null) CheckEntry(destination, expected);
        else Require(Entry(source, relative) == Entry(destination, relative), "Les données ont changé pendant la copie.");
    }

    private static SqliteConnection OpenDatabase(string file)
    {
        Require(File.Exists(file), "Base de données absente.");
        BackupPaths.NoLinks(file);
        var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = file, Mode = SqliteOpenMode.ReadOnly, Pooling = false, DefaultTimeout = 15 }.ToString());
        connection.Open();
        return connection;
    }

    private static void ValidateStore(string directory)
    {
        using var db = OpenDatabase(Path.Combine(directory, "captureproof.db"));
        using var command = db.CreateCommand();
        command.CommandText = "PRAGMA quick_check;";
        Require(command.ExecuteScalar() as string == "ok", "La base de données est endommagée.");
        command.CommandText = "PRAGMA foreign_key_check;";
        using (var rows = command.ExecuteReader()) Require(!rows.Read(), "La base contient des références invalides.");
        command.CommandText = "SELECT COUNT(*) FROM SchemaMigrations WHERE Version=1;";
        Require(Convert.ToInt64(command.ExecuteScalar()) == 1, "Schéma de base non pris en charge.");
        command.CommandText = "SELECT COUNT(*) FROM SchemaMigrations;";
        Require(Convert.ToInt64(command.ExecuteScalar()) == 1, "Schéma de base non pris en charge.");
        command.CommandText = "SELECT PhotoId,Size,Sha256 FROM Uploads WHERE Status='Accepted';";
        using (var rows = command.ExecuteReader())
        {
            var count = 0;
            while (rows.Read())
            {
                Require(++count <= MaxFiles && !rows.IsDBNull(0) && !rows.IsDBNull(1) && !rows.IsDBNull(2), "Référence photo invalide.");
                var name = rows.GetString(0) + ".jpg";
                Require(PhotoName.IsMatch(name), "Référence photo invalide.");
                var expected = new FileEntry("photos/" + name, rows.GetInt64(1), rows.GetString(2));
                Require(expected.Size is > 0 and <= 25 * 1024 * 1024 && Digest.IsMatch(expected.Sha256), "Métadonnées photo invalides.");
                CheckEntry(directory, expected);
            }
        }
        command.CommandText = "SELECT Id,State,ContextJson,PolicyJson,CreatedAt,ExpiresAt,PhoneVersion,ReceiptJws,PayloadJson FROM Sessions LIMIT 1;";
        using (var rows = command.ExecuteReader()) { while (rows.Read()) { /* Ensure required schema columns exist. */ } }
        command.CommandText = "SELECT COUNT(*) FROM Sessions;";
        var hasSessions = Convert.ToInt64(command.ExecuteScalar()) > 0;
        ValidateCookieKeys(directory, hasSessions);
        ValidateSigningKey(directory);
    }

    private static void ValidateSigningKey(string directory)
    {
        var signing = Path.Combine(directory, "signing");
        var privatePath = Path.Combine(signing, "active-private.pem");
        Require(File.Exists(privatePath) && new FileInfo(privatePath).Length <= 65536, "Clé de signature active absente ou invalide.");
        using var key = ECDsa.Create();
        key.ImportFromPem(File.ReadAllText(privatePath));
        Require(key.KeySize == 256, "Clé de signature non prise en charge.");
        Require(key.ExportParameters(includePrivateParameters: true).D is { Length: 32 }, "La clé de signature privée est absente.");
        var parameters = key.ExportParameters(includePrivateParameters: false);
        Require(parameters.Curve.Oid.Value == ECCurve.NamedCurves.nistP256.Oid.Value, "Courbe de signature non prise en charge.");
        var kid = Protocol.Hash(key.ExportSubjectPublicKeyInfo())[..24];
        var publicPath = Path.Combine(signing, "public-" + kid + ".json");
        Require(File.Exists(publicPath) && new FileInfo(publicPath).Length <= 65536, "Clé publique active absente ou invalide.");
        using var document = JsonDocument.Parse(File.ReadAllBytes(publicPath));
        var root = document.RootElement;
        Require(root.GetProperty("kid").GetString() == kid && root.GetProperty("kty").GetString() == "EC" && root.GetProperty("crv").GetString() == "P-256"
            && root.GetProperty("x").GetString() == Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlEncode(parameters.Q.X!)
            && root.GetProperty("y").GetString() == Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlEncode(parameters.Q.Y!) && !root.TryGetProperty("d", out _), "Clé publique active incohérente.");
        foreach (var file in Directory.GetFiles(signing, "public-*.json"))
        {
            Require(new FileInfo(file).Length <= 65536, "Clé publique historique trop volumineuse.");
            using var historical = JsonDocument.Parse(File.ReadAllBytes(file));
            var value = historical.RootElement;
            var publicKid = value.GetProperty("kid").GetString();
            Require(value.GetProperty("kty").GetString() == "EC" && value.GetProperty("crv").GetString() == "P-256"
                && value.GetProperty("alg").GetString() == "ES256" && value.GetProperty("use").GetString() == "sig"
                && Path.GetFileName(file) == "public-" + publicKid + ".json" && !value.TryGetProperty("d", out _), "Clé publique historique invalide.");
            using var publicKey = ECDsa.Create(new ECParameters
            {
                Curve = ECCurve.NamedCurves.nistP256,
                Q = new ECPoint
                {
                    X = Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlDecode(value.GetProperty("x").GetString()!),
                    Y = Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlDecode(value.GetProperty("y").GetString()!),
                },
            });
            Require(Protocol.Hash(publicKey.ExportSubjectPublicKeyInfo())[..24] == publicKid, "Identifiant de clé publique incohérent.");
        }
    }

    private static void ValidateCookieKeys(string directory, bool required)
    {
        var keyDirectory = Path.Combine(directory, "cookie-keys");
        var files = Directory.Exists(keyDirectory) ? Directory.GetFiles(keyDirectory, "key-*.xml") : [];
        Require(!required || files.Length > 0, "Les clés de protection des cookies sont absentes.");
        foreach (var file in files)
        {
            Require(new FileInfo(file).Length <= 1024 * 1024, "Clé de protection des cookies trop volumineuse.");
            using var reader = XmlReader.Create(file, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 1024 * 1024 });
            var document = XDocument.Load(reader);
            Require(document.Root?.Name.LocalName == "key" && Guid.TryParse(document.Root.Attribute("id")?.Value, out var id)
                && Path.GetFileName(file).Equals("key-" + id.ToString() + ".xml", StringComparison.OrdinalIgnoreCase), "Clé de protection des cookies invalide.");
        }
    }

    private static void WriteNew(string file, byte[] bytes)
    {
        using (var stream = new FileStream(file, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            stream.Write(bytes); stream.Flush(flushToDisk: true);
        }
        PrivateFile(file);
    }

    private static void PrivateFile(string file)
    {
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(file, UnixFileMode.UserRead | UnixFileMode.UserWrite);
    }

    private static void PrivateDirectory(string directory)
    {
        if (OperatingSystem.IsWindows())
        {
            Directory.CreateDirectory(directory);
            var security = new DirectorySecurity();
            security.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
            var inheritance = InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit;
            using var identity = WindowsIdentity.GetCurrent();
            var owner = identity.User ?? throw new InvalidOperationException("Identité Windows indisponible.");
            security.AddAccessRule(new FileSystemAccessRule(owner, FileSystemRights.FullControl, inheritance, PropagationFlags.None, AccessControlType.Allow));
            security.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null), FileSystemRights.FullControl, inheritance, PropagationFlags.None, AccessControlType.Allow));
            new DirectoryInfo(directory).SetAccessControl(security);
        }
        else Directory.CreateDirectory(directory, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
}
