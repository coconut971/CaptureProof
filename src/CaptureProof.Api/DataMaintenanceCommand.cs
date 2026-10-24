namespace CaptureProof.Api;

/// <summary>Local offline maintenance only; no web host, identity or keys are initialized.</summary>
public static class DataMaintenanceCommand
{
    public static int Run(string[] arguments)
    {
        if (arguments.Length != 3 || arguments[0] is not ("--backup" or "--restore")
            || string.IsNullOrWhiteSpace(arguments[1]) || string.IsNullOrWhiteSpace(arguments[2]))
        {
            Console.Error.WriteLine("Usage : --backup <dossier-donnees-arrete> <nouvelle-sauvegarde> ou --restore <sauvegarde> <nouveau-dossier-donnees>.");
            return 2;
        }
        try
        {
            if (arguments[0] == "--backup") DataBackup.Create(arguments[1], arguments[2]);
            else DataBackup.Restore(arguments[1], arguments[2]);
            Console.WriteLine(arguments[0] == "--backup" ? "Sauvegarde créée et contrôlée." : "Restauration créée et contrôlée.");
            return 0;
        }
        catch (Exception error) when (error is not OutOfMemoryException)
        {
            // Do not print payloads, connection strings, key material or filesystem contents.
            Console.Error.WriteLine($"Opération refusée ({error.GetType().Name}). Vérifiez les chemins, l’arrêt du service, les permissions et l’intégrité des données. Aucune destination existante n’est remplacée.");
            return 1;
        }
    }
}
