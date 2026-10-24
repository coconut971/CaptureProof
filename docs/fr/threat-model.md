[English](../threat-model.md) · Français

# Modèle de menace et limites

Le serveur et sa configuration sont supposés administrés par l’intégrateur. Le navigateur, les métadonnées client et tous les fichiers envoyés sont non fiables. La détection mobile n’est pas une barrière de sécurité. Les clés publiques ne deviennent fiables que par la décision explicite du vérificateur ou de l’intégrateur.

| Menace | Protection réalisée | Limite |
| --- | --- | --- |
| Accès croisé | Propriétaire produit serveur, cookie protégé, droit téléphone session/version, routes et Subscribe contrôlés | Identité anonyme de démonstration à remplacer pour une intégration de production |
| Appairage non autorisé | Secret 256 bits sous empreinte, fragment, POST unique atomique, code comparé et confirmation propriétaire | Un secret volé ou une comparaison humaine négligée peut appairer le mauvais téléphone |
| Rejeu | Invitation consommée une fois, droits expirants/révocables, upload lié session/identifiant, finalisation unique | Cookie ou appareil compromis demeure un accès jusqu’à révocation/expiration |
| Quota concurrent | Transactions immédiates SQLite, réservations comptées, budget global et bornes | Ne remplace pas une infrastructure publique de lutte contre un déni de service |
| Fichier ou reçu modifié | Hash serveur des octets exacts, signature ES256, schéma strict et ensemble exact | Serveur, stockage ou clé de signature compromis sortent de la garantie |
| Substitution de contexte | Contexte signé et comparaison aux champs attendus | Contrôle facultatif omis visible comme non fourni |
| Secret exposé | Pas de secret dans URL serveur, logs applicatifs ou tiers ; pas de token localStorage | L’administrateur doit garder proxy, sauvegardes et journaux sans corps, cookies ou fragments |
| Abus de dépôt | JPEG entièrement décodé, tailles/dimensions/pixels, 4 traitements simultanés, timeout, débit, sessions et stockage bornés | Décodeur natif et dépendances nécessitent mises à jour ; l’identité démo n’empêche pas toutes créations abusives |

Le test contrôlé `SyntheticJpegIsAcceptedByAuthorizedClientAndOriginalBytesArePreserved` envoie un JPEG créé par logiciel via un client autorisé. Le serveur l’accepte, calcule son empreinte et signe le dossier. Ce résultat expose la frontière de confiance : retirer le bouton d’import ne rend pas impossible une requête modifiée.

Cette version ne résout pas : JavaScript modifié, caméra virtuelle, fichier conforme substitué dans une requête valide, photographie d’un écran, appareil compromis, authenticité de l’objet, origine IA, compromis du serveur ou de la clé et confiance indépendante dans l’horloge. Aucun modèle de vision, détecteur d’IA, score « réel », reconnaissance faciale ou traitement biométrique n’est présent.

Les notifications d’une connexion déjà abonnée peuvent révéler le rythme d’activité d’une session après révocation, sans en autoriser les lectures REST. Les politiques de conservation courtes réduisent l’exposition des dossiers mais ne réalisent pas un effacement cryptographique du disque ou des sauvegardes.

HTTPS chiffre le transport. Les permissions du disque protègent l’accès local selon le système. Les fichiers de référence et la clé PEM ne sont pas annoncés comme chiffrés au repos. La signature assure une vérification d’intégrité et d’émetteur selon les clés de confiance ; elle ne chiffre aucun contenu.

Références : [envois de fichiers OWASP](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [sessions OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
