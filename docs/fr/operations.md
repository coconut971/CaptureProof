[English](../operations.md) | **Français**

# Exploitation, données et livrables

## Conservation et stockage

`CaptureProof:DataDirectory` désigne un répertoire privé hors webroot. Il contient `captureproof.db`, `photos/`, `signing/` et `cookie-keys/`. La base et ses fichiers WAL, les originaux, la clé privée active et les clés Data Protection sont des données locales, exclues des sources et de l’image. La clé de signature et les clés de protection des cookies survivent aux redémarrages si ce répertoire persiste. Les ACL Windows héritées doivent être restreintes à l’opérateur et au service ; la clé privée PEM reçoit des permissions utilisateur restreintes sous Linux.

Les sessions sont conservées 24 heures depuis leur création par défaut, y compris les dossiers finalisés. Le nettoyage s’exécute au démarrage puis chaque minute. Il expire les sessions ouvertes, supprime les lignes plus anciennes que la conservation puis leurs fichiers orphelins. Les anciennes clés publiques restent dans `signing/` pour les reçus déjà exportés. Une suppression physique de fichiers ne garantit pas leur effacement dans les sauvegardes ou blocs du disque.

Pour vider les dossiers de démonstration, arrêter le serveur et supprimer explicitement `captureproof.db`, ses éventuels fichiers `-wal`/`-shm` et le sous-répertoire `photos` du **DataDirectory vérifié**. Garder `signing` si les clés historiques doivent continuer de servir. Supprimer aussi `cookie-keys` révoque les cookies de démonstration. Supprimer le DataDirectory complet réinitialise tout et exige de conserver séparément les clés publiques nécessaires aux reçus historiques. Aucun script de suppression automatique n’est lancé à votre place.

Les limites par défaut sont : 10 sessions par propriétaire conservées, 1 000 globalement, 512 Mio de budget de dépôt global, 512 identifiants d’envoi par session, 150 requêtes par IP/minute, 4 corps de dépôt traités simultanément, 20 secondes pour les endpoints. Les JSON de mutation sont limités à 16 Kio avant désérialisation ; les en-têtes et la lecture HTTP restent aussi soumis aux limites Kestrel. Les limites JPEG sont 8 192 pixels par axe, 12 millions de pixels et 5 Mio par fichier pour la politique démo. La conservation doit couvrir le TTL maximal configuré. La configuration serveur borne également la politique à 32 photos, 25 Mio chacune et 128 Mio théoriques par session. Les réservations restent au plus 120 secondes et n’occupent plus de place après leur expiration.

Les photos en cours non reçues sont en mémoire du téléphone. Fermer la page peut les perdre. La reprise est possible tant que la page, ses octets et sa session restent disponibles. Une réservation orpheline peut bloquer la finalisation jusqu’à son expiration. Une requête déjà partie peut encore aboutir après fermeture du composant ; l’état REST permet de retrouver les photos acceptées. Cette version n’offre pas de file de dépôt durable hors ligne.

Après finalisation confirmée, la démonstration arrête immédiatement la caméra et la synchronisation du téléphone, libère les aperçus locaux puis remplace le document par `capture-complete.html`, une page de confirmation sans script. Les originaux et le reçu persistent côté serveur selon la conservation habituelle. Safari garde la maîtrise de la fermeture de son onglet ; aucun contournement de cette limite n’est employé. Une tentative de fin non confirmée conserve l’interface de reprise.

Le plafond de requêtes par IP est configurable avec `CaptureProof:MaxRequestsPerMinute`, de 10 à 10 000, avec une valeur par défaut de 150. Il reste actif sur le serveur de test isolé, où la suite navigateur utilise 1 000 pour ses ouvertures successives de pages. Cette configuration de test ne change pas le plafond de la démonstration LAN.

## Sauvegarde et restauration

La [procédure hors ligne](backup-restore.md) fournit les commandes locales `--backup` et `--restore`. Elle conserve la base, les photos et les clés ensemble, contrôle l’inventaire et refuse toute destination existante. Le serveur et la maintenance partagent un verrou de répertoire. Les sauvegardes contiennent des secrets et restent privées ; leur manifeste n’apporte ni chiffrement ni authentification externe.

## HTTPS et logs

En environnement `Production`, les cookies sont Secure, HttpOnly et SameSite Strict et les accès API/hub exigent HTTPS. L’exception HTTP existe en développement pour les origines de boucle locale explicitement configurées, à ne pas exposer comme méthode d’essai mobile. Configurer `AllowedHosts` et `PublicOrigin` pour l’origine réellement utilisée. Les en-têtes CSP, Referrer-Policy, Permissions-Policy et nosniff sont présents ; HSTS est émis sur HTTPS.

Les logs applicatifs contiennent des types d’erreur et identifiants techniques, sans corps, cookies, secrets ou clés. SignalR détaillé est désactivé et le client met sa journalisation SignalR à None. Aucun outil analytique ou ressource tierce n’est utilisé. L’opérateur doit contrôler la journalisation du proxy : pas de corps de requêtes, cookies, autorisations de dépôt ou URL client complète ; ne pas journaliser le fragment d’invitation via un script. Ne pas exposer des traces de navigateur personnelles dans des artefacts publics.

## Docker facultatif

Le Dockerfile compile frontend et API avec des versions explicites, puis copie seulement le résultat publié dans une image ASP.NET Core. Son contexte est une liste autorisée dans `.dockerignore` et ses COPY sont explicites. L’utilisateur final est `app`, les données persistent dans `/data`, les certificats sont montés séparément. Ne pas intégrer de clés dans l’image.

Construction :

```sh
docker build -t captureproof:local .
```

Exemple de lancement HTTPS, avec des chemins de certificats préparés par [le guide HTTPS](https.md), lisibles par l’utilisateur `app` :

```sh
docker run --rm --name captureproof -p 7443:7443 \
  -v captureproof-data:/data \
  -v /chemin/absolu/tls:/tls:ro \
  -e AllowedHosts=192.168.1.20 \
  -e CaptureProof__PublicOrigin=https://192.168.1.20:7443 \
  -e Kestrel__Endpoints__Https__Url=https://0.0.0.0:7443 \
  -e Kestrel__Endpoints__Https__Certificate__Path=/tls/cert.pem \
  -e Kestrel__Endpoints__Https__Certificate__KeyPath=/tls/key.pem \
  captureproof:local
```

Les lignes `\` sont des continuations shell Linux ; PowerShell peut utiliser une seule ligne. Le nom de volume conserve données et clés entre conteneurs. Les sauvegarder ensemble. Ne pas exécuter une seconde instance sur la même base ni placer SQLite sur un partage réseau. Les fichiers de licences et notices SkiaSharp natifs accompagnent le résultat publié dans `third-party/`.

## Contrôle de distribution

`scripts/public-files.mjs` définit la liste explicite des fichiers et répertoires de source publiables, avec exclusions des sorties, données et matériel local. `npm run audit:public` contrôle les sources candidates, l’index Git et les exclusions locales ; ce contrôle local nécessite les exclusions privées propres à l’espace de travail. `node scripts/audit-deliverables.mjs` contrôle les listes et le contenu effectivement calculé par `npm pack --dry-run` pour les deux packages, sans dépendre de fichiers privés d’un clone.

`npm run package:source` construit un répertoire de staging depuis cette liste uniquement, produit une archive `.tar.gz`, puis relit sa table des entrées et la compare exactement. Les archives sont dans `artifacts/`, exclu de Git. Ne pas archiver ou publier le répertoire de travail entier. Les deux packages demeurent marqués `private:true` pour empêcher une publication involontaire. Cette préparation ne réalise aucun commit, push ou publication.

La licence Apache-2.0 est fournie pour revue avant publication. [L’inventaire des dépendances](dependencies.md) conserve les expressions et notices disponibles ; il ne remplace pas une revue juridique de la distribution choisie. Pour le régénérer après changement de dépendances : `node scripts/licenses.mjs`, puis `node scripts/licenses.mjs --check`.

`node scripts/package-npm.mjs` produit les deux archives npm dans `artifacts/` puis en relit les entrées. `node scripts/audit-docker-context.mjs` construit une image temporaire du contexte réellement transmis, exporte son contenu et compare chaque fichier à la liste source avant de supprimer ses propres ressources temporaires. L’image d’exécution se contrôle séparément, avant démarrage, avec `docker run --rm --entrypoint sh captureproof:local -c 'find /app /data -type f'` : aucune clé, base ou photo ne doit y être intégrée. Après démarrage, les données générées appartiennent au volume `/data`.
