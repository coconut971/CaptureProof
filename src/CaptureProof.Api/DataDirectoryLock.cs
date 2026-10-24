namespace CaptureProof.Api;

/// <summary>Cooperative process lock shared by the server and offline maintenance commands.</summary>
public sealed class DataDirectoryLock : IDisposable
{
    public const string FileName = ".captureproof.lock";
    private readonly FileStream handle;

    private DataDirectoryLock(FileStream handle) => this.handle = handle;

    public static DataDirectoryLock Acquire(string directory, bool createDirectory = true)
    {
        directory = BackupPaths.Full(directory);
        BackupPaths.NoLinks(directory);
        if (!Directory.Exists(directory))
        {
            if (!createDirectory) throw new InvalidOperationException("Répertoire de données introuvable.");
            Directory.CreateDirectory(directory);
        }
        BackupPaths.NoLinks(directory);
        var lockPath = Path.Combine(directory, FileName);
        BackupPaths.NoLinks(lockPath);
        try
        {
            var stream = new FileStream(lockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
            if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(lockPath, UnixFileMode.UserRead | UnixFileMode.UserWrite);
            return new(stream);
        }
        catch (IOException)
        {
            throw new InvalidOperationException("Ce répertoire est utilisé. Arrêtez son serveur et toute autre maintenance avant de recommencer.");
        }
    }

    // Keep the same inode: deleting the file could let a third process bypass an existing lock.
    public void Dispose() => handle.Dispose();
}

internal static class BackupPaths
{
    private static StringComparison Comparison => OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    public static string Full(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) throw new InvalidOperationException("Un chemin explicite est requis.");
        if (OperatingSystem.IsWindows())
        {
            // The overlap checks use normalized names. Refuse Windows spellings that can
            // address the same directory under another lexical name instead of guessing.
            var windowsPath = path.Replace('/', '\\');
            if (windowsPath.StartsWith("\\\\?\\", StringComparison.Ordinal) || windowsPath.StartsWith("\\\\.\\", StringComparison.Ordinal))
                throw new InvalidOperationException("Les chemins Windows de périphérique sont refusés pour cette opération.");
            foreach (var component in windowsPath.Split('\\', StringSplitOptions.RemoveEmptyEntries))
            {
                if (component is "." or "..") continue;
                if (component.EndsWith('.') || component.EndsWith(' ') || component.Contains('~'))
                    throw new InvalidOperationException("Les alias Windows, noms courts et composants terminés par un point ou une espace sont refusés.");
            }
        }
        return Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));
    }

    public static void NoLinks(string path)
    {
        for (string? current = Full(path); !string.IsNullOrEmpty(current); current = Path.GetDirectoryName(current))
        {
            if (!File.Exists(current) && !Directory.Exists(current))
            {
                // Exists is false for dangling links, so inspect LinkTarget as well.
                if (new FileInfo(current).LinkTarget is not null || new DirectoryInfo(current).LinkTarget is not null)
                    throw new InvalidOperationException("Les liens symboliques et points de réanalyse sont refusés.");
                continue;
            }
            if ((File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidOperationException("Les liens symboliques et points de réanalyse sont refusés.");
        }
    }

    public static void Disjoint(string first, string second)
    {
        first = Full(first); second = Full(second);
        if (string.Equals(first, second, Comparison) || IsChild(first, second) || IsChild(second, first))
            throw new InvalidOperationException("Les répertoires source et destination doivent être séparés et non imbriqués.");
    }

    private static bool IsChild(string child, string parent)
    {
        var prefix = Path.EndsInDirectorySeparator(parent) ? parent : parent + Path.DirectorySeparatorChar;
        return child.StartsWith(prefix, Comparison);
    }
}
