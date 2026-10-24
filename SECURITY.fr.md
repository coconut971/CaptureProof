[English](SECURITY.md) | **Français**

# Sécurité

Cette première version est un prototype de référence à revoir avant tout déploiement public. Les tests automatisés et les revues ciblées internes ne constituent pas un audit externe. Des parcours ont été validés par l’utilisateur sur iPhone Safari et Xiaomi avec Mi Browser, y compris l’écran final et l’arrêt de la caméra. Sur le Xiaomi, une coupure Wi-Fi et un verrouillage court avec une photo en attente ont aussi été suivis d’une reprise réussie dans la même page. Les modèles exacts et versions n’ont pas été relevés. Les autres conditions réelles, dont Chrome Android, sont documentées dans [la checklist physique](docs/fr/testing.md).

Pour signaler une vulnérabilité, contacter en privé le mainteneur ou l’intégrateur par son canal habituel. Aucun contact nominatif n’est inventé dans ce dépôt. Si une plateforme de dépôt proposant un canal privé est mise en place, l’utiliser. Ne jamais joindre publiquement clé privée, cookie, invitation active ou photo personnelle. Donner la version, le scénario minimal et les conséquences observées avec des données synthétiques.

Les limites et hypothèses sont détaillées dans [le modèle de menace](docs/fr/threat-model.md). Le point d’identité de démonstration doit être remplacé et les références métier autorisées côté serveur avant intégration dans une marketplace.

L’exploitant doit appliquer les mises à jour .NET, npm, NuGet et du décodeur natif, limiter les permissions de la clé et du répertoire de données, configurer HTTPS, la conservation, les sauvegardes et les logs du proxy. Une compromission de clé demande sa rotation et une décision de confiance sur les anciens reçus. Les images ne sont pas chiffrées par leur signature.

La [maintenance hors ligne](docs/fr/backup-restore.md) conserve également les clés privées et les clés de cookies : les copies doivent rester protégées. Leur inventaire d’empreintes détecte une corruption mais n’authentifie pas une sauvegarde hostile. Le verrou partagé protège les processus coopératifs de cette version ; il ne remplace pas l’arrêt du service ni les permissions du système.
