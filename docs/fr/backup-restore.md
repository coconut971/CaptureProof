[English](../backup-restore.md) | **Français**

# Sauvegarde et restauration hors ligne

Ces commandes locales copient ensemble la base SQLite, les photos, les clés de signature et les clés de protection des cookies. Elles ne démarrent pas le serveur et ne génèrent aucune clé. Une restauration crée un **nouveau répertoire** et ne remplace jamais une installation existante.

## Sauvegarder

Arrêter le serveur qui utilise la source et attendre la fin du processus. Le serveur, la rotation de clé et la maintenance partagent un verrou de répertoire ; une opération concurrente est refusée. Ce verrou est coopératif : les versions antérieures et les outils externes ne le prennent pas. L’arrêt explicite reste obligatoire.

Construire d’abord avec `npm ci`, `npm run build`, puis `dotnet build src/CaptureProof.Api`. Sous Windows avec le SDK local, remplacer `dotnet` par `.\.tools\dotnet\dotnet.exe`. Depuis la racine du projet :

```powershell
$sourceDirectory = Join-Path (Get-Location) '.data/installation-arretee'
$backupDirectory = Join-Path (Get-Location) '.data/sauvegarde-001'
.\.tools\dotnet\dotnet.exe src/CaptureProof.Api/bin/Debug/net10.0/CaptureProof.Api.dll --backup $sourceDirectory $backupDirectory
```

Le parent de la destination doit déjà exister ; la destination elle-même doit être absente. Source et destination doivent être séparées et non imbriquées. Les liens symboliques, points de réanalyse et fichiers non prévus sont refusés. Sous Windows, les chemins de périphérique et les composants terminés par un point, un espace ou contenant `~` sont refusés pour éviter les alias ambigus. Ne pas supprimer un fichier inattendu sans en comprendre l’origine.

SQLite produit une copie autonome avec son API de sauvegarde, y compris les transactions du journal WAL. Les photos acceptées sont comparées aux tailles et empreintes stockées en base. Les clés actives, publiques historiques et de cookies sont contrôlées. Les fichiers intermédiaires `-wal`, `-shm` et le verrou de coordination ne sont pas des données à restaurer.

La copie est préparée dans un répertoire temporaire privé, contrôlée, puis déplacée vers la destination. SQLite travaille sur une copie brute temporaire de la base et de son WAL pour ne créer aucun fichier de coordination dans la source. Prévoir l’espace de cette copie intermédiaire en plus de la sauvegarde finale. En cas d’échec, seule cette zone temporaire créée par la commande est nettoyée. Une destination existante n’est jamais écrasée.

## Restaurer

Conserver la sauvegarde à part et choisir une nouvelle destination :

```powershell
$restoredDirectory = Join-Path (Get-Location) '.data/restauration-001'
.\.tools\dotnet\dotnet.exe src/CaptureProof.Api/bin/Debug/net10.0/CaptureProof.Api.dll --restore $backupDirectory $restoredDirectory
```

L’inventaire doit être complet : noms, tailles et SHA-256. Un fichier manquant, supplémentaire, modifié, un chemin interdit ou une clé incohérente fait échouer la restauration. Les données ne sont proposées au serveur qu’après validation complète.

Avant de remplacer une installation, démarrer la copie sur une origine et un port de test distincts, avec son propre `CaptureProof__DataDirectory`. Contrôler les dossiers, les téléchargements, les reçus exacts et leur vérification avec les clés publiques déjà reconnues. Les clés de cookies conservées permettent la continuité des autorisations encore valides ; elles ne prolongent pas leur expiration.

**La date de création des dossiers reste inchangée.** Le nettoyage normal s’applique au premier démarrage : une sauvegarde plus ancienne que la conservation peut être purgée. Configurer explicitement la conservation du serveur de vérification avant son lancement, dans les bornes autorisées. Restaurer ne renouvelle pas un dossier.

Les codes de sortie sont `0` pour un succès, `1` pour un refus d’opération et `2` pour une syntaxe incorrecte. Sous Linux ou depuis une publication, utiliser les mêmes options avec `dotnet CaptureProof.Api.dll --backup ...` ou `--restore ...` et les chemins de cette installation.

## Protéger les copies

Une sauvegarde contient des **clés privées et des photos**. Elle ne doit entrer ni dans Git, ni dans une archive source publique, ni dans une image Docker, ni dans un dossier web. Sous Windows, la copie est restreinte au compte opérateur et à SYSTEM ; sous Linux, les répertoires sont en `0700` et les fichiers en `0600`. Exécuter sous le compte du service ou ajuster explicitement ses droits avant le redémarrage.

L’inventaire SHA-256 détecte les altérations accidentelles. Il n’authentifie pas la sauvegarde et ne la chiffre pas : un tiers capable de modifier les données et l’inventaire peut remplacer les deux. Utiliser un stockage de confiance, protégé et chiffré selon les exigences d’exploitation. Les clés de cookies protégées par le système peuvent dépendre du compte ou de la machine d’origine.

Les limites sont de 100 000 fichiers, 128 Gio au total, 16 Gio par fichier et 32 Mio d’inventaire. Cette première procédure reste hors ligne sur un stockage local. Elle n’ajoute ni planification, ni service distant, ni sauvegarde à chaud.

## Exercice reproductible

`DataBackupTests` utilise des dossiers temporaires et des JPEG synthétiques. Le test finalise un dossier réel via l’API, arrête son serveur, sauvegarde, restaure et redémarre la copie. Il compare le reçu, les photos, les clés et les cookies. Il exerce aussi les refus de concurrence, d’écrasement, de corruption et de chemins interdits.

Définir `CAPTUREPROOF_RESTORE_INTEROP_DIR` vers un répertoire privé avant les tests exporte le reçu restauré et ses fichiers synthétiques pour le vérificateur TypeScript indépendant. Ce répertoire reste exclu de la distribution. Le bilan des commandes effectivement exécutées figure dans [le guide de test](testing.md).
