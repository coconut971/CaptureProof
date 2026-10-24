[English](../architecture.md) · Français

# Architecture et intégration

Le produit comprend deux packages TypeScript stricts, une démonstration React/Vite et une seule API ASP.NET Core. Les images restent sur disque hors webroot. SQLite conserve les sessions, politiques figées, réservations, empreintes et reçus. La migration SQL embarquée `001_initial.sql` est appliquée dans une transaction au premier démarrage et enregistrée dans `SchemaMigrations`. Redémarrer ne rejoue pas la migration.

`CaptureController` porte les opérations caméra, les prises et le transport abstrait. Le Web Component affiche cet état. Le package de capture n’importe pas React. La détection du navigateur mobile oriente uniquement l’interface. Un client modifié peut la contourner ; le serveur continue d’imposer ses droits et ses quotas.

La démonstration construite est servie par le backend, sous la même origine que REST et SignalR. Le proxy Vite est limité au développement. SignalR transporte uniquement une invalidation `{sessionId}`. Chaque notification, reconnexion et reprise périodique relit l’état REST autorisé. Les JPEG passent par HTTP, jamais par SignalR. L’API est la source de vérité.

## Choisir les modules utiles

| Module | Rôle | Choix d’intégration |
| --- | --- | --- |
| `CaptureController` | Cycle de vie caméra, prises JPEG, état des envois et reprises | Brancher sa propre interface et son parcours |
| Web Component de capture | Vue mince prête à l’emploi sur le contrôleur | L’utiliser si son interface convient à l’application |
| `CaptureTransport` | Frontière typée entre capture et serveur | Implémenter l’adaptateur pour son backend |
| API ASP.NET Core | Référence d’appairage, autorisation, quotas, stockage et signature | L’adopter ou implémenter le protocole documenté |
| Vérificateur de reçu | Contrôle local de la signature, de l’ensemble des fichiers et du contexte | L’utiliser indépendamment de la capture et de l’API de référence |
| Application React | Démonstration d’appairage, capture et vérification | Exemple facultatif, sans enveloppe applicative imposée |

## Identité et références métier

`DemoIdentity` crée un identifiant propriétaire aléatoire, protégé par ASP.NET Data Protection dans un cookie HttpOnly. Aucun compte ni mot de passe n’est créé. Il ne s’agit pas d’une authentification métier de production. Le cookie téléphone transporte seulement l’identifiant de session, une version révocable et une expiration ; il ne donne pas les droits du propriétaire.

L’intégration doit remplacer la résolution d’identité et l’implémentation `IBusinessAuthorizer`. Celle-ci doit obtenir le véritable utilisateur authentifié côté serveur, vérifier qu’il peut agir sur la référence demandée, et retourner l’espace d’intégration et la référence attendus. L’implémentation de démonstration accepte uniquement des références alphanumériques simples dans l’espace `demo`. La catégorie sélectionne une politique serveur ; elle ne détermine pas l’identité.

Les options `CaptureProof:Policies` sont chargées depuis une configuration de confiance. Exemple :

```json
{
  "CaptureProof": {
    "PublicOrigin": "https://capture.example.invalid",
    "DataDirectory": "/private/captureproof",
    "Policies": {
      "vinyl": { "MinPhotos": 1, "MaxPhotos": 3, "MaxBytesPerPhoto": 5242880, "SessionTtlSeconds": 600 },
      "three-required": { "MinPhotos": 3, "MaxPhotos": 3, "MaxBytesPerPhoto": 5242880, "SessionTtlSeconds": 600 }
    }
  }
}
```

Le serveur choisit et copie la politique lors de la création. Des champs de politique ajoutés dans un POST client ne changent pas cette copie. La démonstration affiche la règle `vinyl` de 1 à 3 photos ; l’intégrateur peut demander exactement trois photos. Le composant permet de terminer à toute quantité autorisée et ne transforme pas une préférence en nouveau quota.

## Transactions et persistance

Les mutations emploient les transactions immédiates de Microsoft.Data.Sqlite, avec clés étrangères et contraintes SQLite réelles. Le verrou d’écriture couvre le calcul du quota et la réservation, l’acceptation de l’invitation, le dépôt final et la finalisation. Les autorisations et l’état sont revérifiés après lecture du corps HTTP. Ce serveur de référence fonctionne dans un seul processus avec une base sur disque local ; un partage réseau SQLite n’est pas pris en charge.

Le quota compte les photos acceptées et les réservations actives. Le budget global additionne les tailles acceptées et la taille maximale de chaque réservation selon sa politique figée. Les réservations expirées n’occupent plus de place. Les identifiants d’envoi déjà acceptés ou supprimés ne peuvent pas être réutilisés comme nouvelle prise.

Le serveur décode entièrement les JPEG avec SkiaSharp puis conserve les octets exacts reçus. Il n’enregistre pas une version réencodée sous l’empreinte de l’original. L’interface réduit les images visuellement, sans créer de fichier dérivé serveur. Le JPEG issu du canvas est lui-même le fichier de référence. Toute miniature future sera un dérivé, à identifier comme tel et à débarrasser des métadonnées superflues.

L’écriture suit : fichier temporaire, synchronisation sur disque, déplacement sous nom interne, insertion transactionnelle de la disponibilité. Un échec avant commit retire le fichier si possible ; un arrêt brutal peut laisser un orphelin nettoyé ensuite. Le nettoyage committe la suppression des lignes avant d’effacer les fichiers orphelins sous verrou SQLite. Aucune ligne acceptée n’est créée avant le déplacement du fichier. Une défaillance ou modification externe du stockage reste possible et est signalée lors de l’accès ou par le vérificateur.

## Choix de versions

Le SDK 10.0.402 et le runtime 10.0.13 ont été utilisés pour bénéficier du correctif .NET 10 disponible lors de cette réalisation. Microsoft.Data.Sqlite et OpenAPI suivent 10.0.13. jose-jwt signe les JWS côté .NET et `jose` les vérifie côté TypeScript, afin d’exercer une véritable interopérabilité de bibliothèques. SkiaSharp est choisi pour décoder réellement les JPEG avec une dépendance native maintenue. React reste limité à la démonstration. Les versions exactes, licences déclarées et composants transitifs sont recensés dans [l’inventaire](dependencies.md).

Références : [support .NET](https://dotnet.microsoft.com/en-us/platform/support/policy), [Media Capture](https://www.w3.org/TR/mediacapture-streams/), [autorisation SignalR](https://learn.microsoft.com/en-us/aspnet/core/signalr/authn-and-authz?view=aspnetcore-10.0), [jose-jwt](https://github.com/dvsekhvalnov/jose-jwt).
