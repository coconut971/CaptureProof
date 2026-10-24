[English](../testing.md) | **Français**

# Tests, preuves d’exécution et essais restants

État constaté le 24 octobre 2026, sur Windows, Node 24.18.1, SDK .NET 10.0.402, runtime 10.0.13, Vitest 4.1.12 et Playwright 1.64.1. Cette version n’est pas déclarée stable. Les revues ciblées réalisées pendant la construction sont internes ; aucun audit externe n’est revendiqué.

| Commande exécutée | Résultat |
| --- | --- |
| `npm ci` | Installation depuis verrou, audit npm : 0 vulnérabilité connue au moment du contrôle |
| `npm run typecheck` | Réussite TypeScript strict, les deux packages et la démo |
| `npm run lint` | Réussite, aucun avertissement |
| `npm run build` | Réussite des deux packages et du frontend Vite |
| `dotnet restore CaptureProof.slnx --locked-mode` | Réussite avec le SDK corrigé local |
| `dotnet test CaptureProof.slnx --no-restore` | 56 tests réussis, aucun ignoré |
| `npm test`, avec les deux répertoires d’interopérabilité issus de xUnit | 105 tests réussis, aucun ignoré |
| `npm run test:e2e` | 25 tests Chromium réussis, aucun ignoré |
| `dotnet list CaptureProof.slnx package --vulnerable --include-transitive` | Aucun package vulnérable connu dans les sources interrogées |
| `docker build -t captureproof:local .` | Image Linux construite |
| Client de test autorisé contre cette image Linux | Décodage JPEG réel, originaux inchangés, reçu stable et vérification TypeScript réussis |
| `node scripts/audit-docker-context.mjs` | 45 fichiers source réellement exportés et autorisés ; sources du contexte contrôlées sans fichier privé, base, clé ou photo |
| `node scripts/package-npm.mjs` | Deux archives npm produites puis relues : 22 et 16 fichiers, avec les deux langues de documentation |
| `npm run audit:docs` | 35 fichiers Markdown et 196 liens relatifs contrôlés |
| Commandes locales `--backup` puis `--restore` | Réussite sur des données e2e synthétiques ; destination existante refusée ; reçu et trois originaux restaurés vérifiés indépendamment |
| Même maintenance dans l’image Linux, utilisateur `app`, réseau désactivé | Réussite ; données identiques et permissions des répertoires/fichiers en `0700`/`0600` |

Le README donne les commandes Windows et Linux. `scripts/interop.ps1` reproduit la génération .NET et sa vérification TypeScript. Les tests par fichiers utilisent `CAPTUREPROOF_INTEROP_DIR` et `CAPTUREPROOF_RESTORE_INTEROP_DIR` ; sans la variable correspondante, le cas est signalé comme ignoré et ne doit pas être annoncé comme exécuté. Le test e2e d’interopérabilité produit également un véritable reçu via l’API.

## Couverture

Le point d’entrée sans interface est importé dans un processus Node distinct, sans `HTMLElement` ni `document` ; l’entrée navigateur conserve le Web Component facultatif. Les archives ont aussi été installées dans un projet consommateur séparé : le moteur sans interface et le vérificateur indépendant s’importent sans React ni DOM. Une copie des sources publiques sans matériel de travail local passe les audits de publication et de documentation.

Les tests xUnit utilisent WebApplicationFactory, de vrais fichiers SQLite isolés, leurs contraintes et un TimeProvider contrôlé pour les expirations. Ils couvrent politiques min/max, catégorie serveur malgré champs client, invitations concurrentes, consommation unique, expiration, refus/régénération/annulation, mauvais propriétaire, photos/reçus non autorisés, abonnement SignalR interdit, CSRF et origine.

Les tests de dépôt couvrent la dernière place concurrente, les réservations et leur expiration, le renouvellement après perte de réponse, le budget global concurrent, les sessions par propriétaire et globales, retry identique et concurrent sans doublon, octets différents refusés, autorisation réutilisée sur autre session ou identifiant refusée, suppression avant finalisation, min=max=3, immutabilité finale, persistance des clés et stabilité du reçu après redémarrage. Le décodeur refuse format usurpé, JPEG tronqué, taille et dimensions interdites. Un JPEG synthétique conforme est volontairement accepté par un client autorisé : ce test documente la limite d’origine.

Les tests TypeScript vérifient les politiques et la caméra simulée du contrôleur : permissions, libération des pistes, arrière-plan, octroi tardif, finalisation et reprises. Ils vérifient aussi signature/payload/fichier altérés, clé inconnue/ambiguë/privée, `alg=none`, algorithmes ou en-têtes inattendus, extensions critiques, schéma/version, JSON ambigu, ressources, ensemble exact de fichiers et contexte attendu. Le test interopérable vérifie les octets et le format ES256 d’un reçu réellement émis par jose-jwt .NET avec `jose` TypeScript.

Les tests du transport de la démo couvrent le partage du bootstrap, sa reprise explicite après échec, le refus d’un jeton illisible et les réponses devenues obsolètes. Chaque appel `fetch` est borné à vingt secondes, lecture du corps comprise ; un bootstrap nécessaire a son propre délai, distinct de celui de la requête suivante. Les erreurs réseau ou de délai sont présentées en français, les statuts HTTP et les messages métier sont conservés, et les cookies ainsi que les en-têtes CSRF restent requis. Le dépôt JPEG par PUT garde son délai de quatre-vingt-dix secondes. Aucune mutation n’est répétée automatiquement ; les tests de reprise vérifient la réutilisation du même identifiant d’envoi et du même JPEG après une action explicite.

Les tests du suivi vérifient le regroupement des notifications pendant une lecture, le retour à un statut cohérent après reprise REST, le repli vers l’actualisation périodique et la réinscription SignalR. Le nettoyage arrête le minuteur et la connexion ; les retours tardifs ne publient plus de statut et ne déclenchent pas de nouveau chargement. Une requête déjà lancée reste soumise à son délai borné.

Les parcours Playwright utilisent deux contextes distincts, dont l’un émulé mobile. La caméra factice est injectée exclusivement par `tests/e2e/camera-fixture.ts`, jamais par le produit. Ils vérifient que l’ordinateur ne demande pas la caméra, que les interfaces de capture n’ont aucun input fichier, le retrait du fragment avant POST, les codes et la confirmation, les prises, SignalR, la finalisation, le refus caméra avec reprise et la perte contrôlée d’une réponse PUT suivie d’un retry identique. L’émulation iPhone dans Chromium ne teste ni Safari ni un vrai smartphone.

Le parcours de réponse PUT perdue vérifie aussi la notice affichée tant qu’une photo n’est pas confirmée : les JPEG restent uniquement en mémoire dans la page, qui doit rester ouverte sans être rechargée. La notice disparaît après réception confirmée. Elle ne promet ni sauvegarde locale durable ni conservation après fermeture ou éviction de la page.

La suite du vérificateur passe par les véritables champs fichier de `/verify`, avec un reçu émis par l’API et trois JPEG synthétiques créés en mémoire. Elle couvre le dossier valide, une altération de même taille, une taille différente, le reçu altéré, le mauvais contexte, les fichiers manquant, supplémentaire, en double et renommé, ainsi que les mauvaises clés avec ou sans identifiant correspondant. Elle contrôle aussi l’effacement d’un résultat ancien et les lectures asynchrones retardées. Tout appel `/api` ou `/hubs` depuis la page de vérification est bloqué et fait échouer le test : les fichiers sélectionnés restent locaux.

Trois scénarios d’historique vérifient l’état d’un dossier annulé au retour à la liste, une finalisation reçue avant une ancienne réponse de confirmation et une sélection de dossier dépassée par une autre. Les réponses sont volontairement retenues puis libérées ; un état terminal ne doit pas être rouvert ni une nouvelle sélection remplacée par l’ancienne.

Les quinze tests du vérificateur, les sept parcours de capture et d’interopérabilité et les trois scénarios d’historique utilisent un serveur et un répertoire de données isolés, avec des sorties de compilation distinctes. Le plafond par IP reste actif, réglé à 1 000 pour cette rafale automatique ; la valeur normale de l’application reste 150. Un test serveur vérifie explicitement le refus HTTP 429 après consommation d’un quota configuré à 10, et les configurations hors bornes sont refusées. Cette adaptation corrige un premier essai complet où une navigation `/verify` avait été refusée par le plafond normal.

Les tests de [sauvegarde et restauration](backup-restore.md) créent un dossier signé synthétique, arrêtent son serveur, copient et restaurent les données dans un nouveau répertoire, puis redémarrent la copie. Ils vérifient les originaux, le reçu exact, la signature et la continuité des cookies encore valides. Les scénarios de concurrence, d’écrasement, de corruption, d’inventaire incomplet et de chemins interdits utilisent uniquement des répertoires temporaires privés. L’export optionnel `CAPTUREPROOF_RESTORE_INTEROP_DIR` permet une seconde vérification avec le package TypeScript indépendant.

Les tests ne prétendent pas couvrir toutes les défaillances de disque, arrêts forcés à chaque instruction ou attaques de déni de service. Le protocole et les limites doivent encore être revus avant exposition publique.

L’essai Docker a utilisé le HTTP de boucle locale en environnement de développement pour vérifier Linux et le décodeur natif. Une origine HTTPS LAN a ensuite été configurée avec mkcert et vérifiée sans désactiver TLS dans Windows et Chromium. La CI distante n’a pas été exécutée. Les contrôles de distribution locaux ne signifient pas une publication.

La fin mobile est testée avec navigation de confirmation volontairement retardée : toutes les pistes sont arrêtées et aucun GET de suivi n’est émis pendant l’attente. La page statique finale ne contient ni script, caméra, miniature, navigation ni import. Un échec réseau avant confirmation serveur conserve la capture et permet de terminer ensuite. Le mode capture seule continue de proposer les JPEG locaux au téléchargement. Les tests unitaires couvrent aussi les réponses tardives après destruction et un état Capturing périmé arrivant après la finalisation.

## Choisir les validations

La consolidation s’appuie d’abord sur les commandes automatiques indiquées plus haut. Les tests ciblés vérifient le comportement modifié ; l’ensemble des contrôles est exécuté pour valider le lot avant livraison. Les parcours physiques déjà réalisés servent de référence pour choisir les vérifications complémentaires.

Un essai sur téléphone doit répondre à un risque précis que les tests automatiques ne permettent pas de trancher : cycle de vie ou permission de la caméra, comportement d’un navigateur mobile, interruption et reprise propres à l’appareil. Une modification de libellé, de documentation ou de liste de dossiers ne justifie pas de répéter les captures. Regrouper les manipulations nécessaires dans un parcours court et consigner le résultat, y compris un échec ou une vérification non effectuée.

## Checklist physique

Deux parcours ont été effectués par l’utilisateur sur son iPhone avec Safari : il a confirmé la prise de trois photos, le nouvel écran « Capture terminée » et la caméra éteinte. Le navigateur ordinateur montrait les trois originaux et le reçu finalisé. Les téléchargements réels et leur vérification locale ont réussi. Les essais de copies altérées, reçu modifié, mauvaises clés, mauvais contexte, fichiers manquant, supplémentaire, en double et renommé ont donné les refus attendus. Les originaux ont été contrôlés inchangés. Le modèle de l’iPhone et la version iOS n’ont pas été relevés ; cela ne valide pas toutes les versions de Safari ni les autres scénarios. Aucune photo de ces essais n’est incluse dans les livrables publics.

Le 24 octobre 2026, trois parcours ont aussi été effectués sur un Xiaomi avec Mi Browser. Le premier a confirmé la capture de trois photos, la finalisation, « Capture terminée » et la caméra éteinte. Le deuxième a inclus une coupure du Wi-Fi : la miniature de la photo en attente est restée visible, puis l’utilisateur a utilisé « Réessayer l’envoi » après le retour du réseau. Le troisième a ajouté un verrouillage de dix secondes avec le Wi-Fi toujours coupé et une deuxième photo en attente. Après déverrouillage, l’utilisateur a constaté les deux miniatures conservées, « Caméra arrêtée » et le message de caméra interrompue. Il a ensuite rétabli le réseau, repris l’envoi, relancé explicitement la caméra et finalisé avec trois photos. Il a confirmé l’écran de fin et la caméra éteinte.

Pour chaque dossier Xiaomi, l’ordinateur montrait trois photos acceptées et le reçu finalisé. Les téléchargements ont été comparés aux fichiers conservés par le serveur, puis vérifiés avec le package TypeScript indépendant et dans le navigateur : signature, clé reconnue, format, ensemble de fichiers et contexte valides. Les deux essais d’interruption n’ont créé aucun doublon ni laissé de réservation en attente. La première photo reçue avant chaque interruption a conservé ses identifiants, sa taille et son empreinte. La conservation de la photo en attente a été observée dans l’interface puis confirmée par son arrivée ; son empreinte n’a pas été mesurée sur le téléphone avant l’envoi.

Le modèle exact du Xiaomi, la version Android et celle de Mi Browser n’ont pas été relevés. Les étapes d’installation et de confiance du certificat sur ce téléphone n’ont pas été consignées. Chrome sur Android n’a pas été testé sur appareil réel. Ces résultats couvrent les parcours observés dans la même page restée ouverte. Les JPEG non envoyés sont gardés en mémoire ; la fermeture, le rechargement ou l’éviction de la page par le système peuvent les perdre. Aucun stockage hors ligne persistant n’est revendiqué.

La checklist décrit les résultats et les limites connus. Pour un nouvel essai physique nécessaire, consigner date, modèle, version iOS/Android, navigateur, origine HTTPS, résultat et erreur éventuelle avec des données non personnelles. Les confirmations utilisateur sont distinguées des tests automatiques.

| Vérification | Safari iPhone | Mi Browser sur Xiaomi |
| --- | --- | --- |
| HTTPS de confiance, même application et QR valide | Parcours utilisateur effectué ; modèle et version à relever | Parcours QR sur origine HTTPS effectué ; installation et confiance du certificat non consignées |
| Secret retiré de l’adresse ; codes égaux ; confirmer/refuser/régénérer | Appairage effectué ; cas de refus et régénération à tester | Appairage effectué ; retrait du fragment, refus et régénération non relevés sur appareil |
| Création directe sans QR ; aucune galerie/import/collage/dépôt de fichier | À tester sur appareil réel | À tester sur appareil réel |
| Permission caméra autorisée/refusée puis reprise ; audio absent | Capture autorisée réussie ; refus/reprise et audio à vérifier explicitement | Capture autorisée réussie ; refus/reprise et audio à vérifier explicitement |
| Caméra arrière, aperçu playsinline, orientation portrait/paysage | À tester sur appareil réel | À tester sur appareil réel |
| Compteur, miniatures, suppression/reprise, min/max serveur | Trois photos reçues ; suppression et limites à tester | Trois photos reçues, miniatures conservées et envoi repris ; suppression et limites à tester |
| Arrière-plan, verrouillage, interruption caméra/appel et libération des pistes | À tester sur appareil réel | Verrouillage de dix secondes : caméra arrêtée, deux miniatures conservées dont une photo en attente, relance explicite ; appel et autres interruptions à tester |
| Réseau coupé puis rétabli, réponse perdue, réservation expirée | À tester sur appareil réel | Coupure et retour Wi-Fi, photo en attente conservée et renvoi manuel sans doublon ; réponse perdue et réservation expirée à tester |
| Expiration, annulation, finalisation immuable et message après confirmation serveur | Finalisation, écran de fin et caméra éteinte confirmés ; expiration/annulation à tester | Finalisation avant échéance, écran de fin et caméra éteinte confirmés ; expiration/annulation à tester |
| Retour ordinateur, export originaux/reçu, contrôle local bon/mauvais contexte | Téléchargements et contrôles locaux effectués sur l’ordinateur avec succès | Originaux et reçus téléchargés, octets et bon contexte vérifiés localement ; mauvais contexte non refait sur ces dossiers |

Sur ordinateur réel, vérifier également que le navigateur ne demande jamais de caméra. Les cas encore ouverts sont choisis selon le changement à valider, en utilisant [la procédure HTTPS](https.md). Les résultats Xiaomi ne valent pas validation de Chrome Android ni de tous les modèles, versions ou comportements de suspension.
