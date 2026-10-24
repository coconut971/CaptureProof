[English](../protocol.md) · Français

# Protocole HTTP et états

Le contrat OpenAPI est exposé à `/openapi/v1.json`. Les réponses JSON utilisent camelCase. Les erreurs applicatives contiennent `code` et `message` sans secret. Les limites HTTP peuvent aussi produire 400, 413, 429 ou 503 avant l’exécution d’une route.

Appeler `GET /api/bootstrap` pour obtenir le cookie propriétaire de démonstration et `csrfToken`. Conserver ce jeton en mémoire, puis l’envoyer dans `X-CSRF-TOKEN` sur chaque mutation. Les cookies voyagent avec `credentials: same-origin`. Le serveur contrôle également `Origin`. Aucun jeton durable n’est placé dans localStorage et aucun CORS universel n’est configuré.

| Méthode et route | Droit | Fonction |
| --- | --- | --- |
| GET `/api/bootstrap` | Public | Identité de démonstration et antiforgery |
| POST `/api/sessions` | Propriétaire | `{category,businessReference,direct}` ; politique choisie côté serveur |
| GET `/api/sessions` | Propriétaire | Ses propres dossiers |
| GET `/api/sessions/{id}` | Propriétaire ou téléphone courant | État et métadonnées autorisées |
| POST `/api/sessions/{id}/invitation` | Propriétaire | Nouveau secret, révocation de l’ancien ; aucun dépôt actif ou reçu autorisé |
| POST `/api/pair` | Porteur de l’invitation | `{sessionId,secret}` ; consommation atomique et cookie téléphone |
| POST `/api/sessions/{id}/confirm` | Propriétaire | `{accept}` ; confirmation ou refus du téléphone |
| POST `/api/sessions/{id}/cancel` | Propriétaire | Annuler une session encore ouverte |
| POST `/api/sessions/{id}/uploads` | Téléphone confirmé | `{uploadId}` ; réserver ou renouveler une réservation non consommée |
| PUT `/api/sessions/{id}/uploads/{uploadId}` | Téléphone confirmé | Corps JPEG et `X-Upload-Authorization` |
| DELETE `/api/sessions/{id}/photos/{photoId}` | Téléphone confirmé | Supprimer avant finalisation |
| POST `/api/sessions/{id}/finalize` | Téléphone confirmé | Ensemble stable, reçu unique `{jws}` |
| GET `/api/sessions/{id}/receipt` | Propriétaire ou téléphone courant | Même reçu persistant `{jws}` |
| GET `/api/sessions/{id}/photos/{photoId}` | Propriétaire ou téléphone courant | Octets JPEG originaux, nom `<photoId>.jpg` |
| GET `/api/keys` | Public | Clés publiques à exporter ; ne crée aucune confiance automatique |
| SignalR `/hubs/capture`, `Subscribe(id)` | Propriétaire ou téléphone courant | Droit de lecture contrôlé avant le groupe |

Un identifiant de session ou de groupe ne donne aucun accès. Un propriétaire seul ne peut pas déposer : le mode direct crée séparément son droit de téléphone pour la session courante. Le téléphone ne peut pas agir sur une autre session ni confirmer son propre appairage.

## Invitation

Le secret contient 32 octets aléatoires cryptographiques. Seule son empreinte SHA-256 est conservée. Sa validité est de 120 secondes au maximum, bornée par la durée de session. Le QR est généré localement à partir de `PublicOrigin`, jamais d’un Host fourni par une requête. L’URL contient `#invite=...` ; le frontend lit ce fragment et le retire synchroniquement de l’adresse avant son premier appel réseau. Le POST d’échange consomme l’invitation, jamais un GET. Le code de comparaison à six chiffres aide la vérification humaine ; il ne remplace aucun secret.

La régénération ou le refus révoque la version précédente du droit téléphone. Après un dépôt ou une réservation active, changer de téléphone exige une nouvelle session. Cela évite une ambiguïté sur le dossier déjà constitué.

## Machine à états

| État | Transitions autorisées |
| --- | --- |
| `AwaitingPairing` | invitation ou régénération ; échange valide vers `PendingConfirmation` ; annulation ; expiration |
| `PendingConfirmation` | acceptation vers `Capturing` ; refus vers `AwaitingPairing` ; régénération ; annulation ; expiration |
| `Capturing` | réservations, dépôts, suppression ; finalisation vers `Finalized` ; annulation ; expiration ; nouvelle invitation seulement sans photo/réservation active |
| `Finalized` | lectures et répétition de finalisation avec même reçu ; aucune modification |
| `Cancelled`, `Expired` | aucune modification ; état consultable selon les droits jusqu’à purge |

Le mode direct crée une session en `Capturing`. La durée est calculée par le serveur. Une finalisation ne peut pas se produire après expiration, même si l’interface l’affiche encore ouverte. Une session finalisée demeure finalisée après sa date d’expiration et reste consultable par son propriétaire jusqu’à purge.

## Dépôts et retries

Une autorisation est liée à `(sessionId,uploadId)`, dure au plus 120 secondes et reste stockée sous empreinte. Chaque PUT contrôle le cookie téléphone courant, le CSRF, l’origine, l’état, le quota réservé et l’autorisation. Les mêmes octets avec la même autorisation valide retrouvent la même photo. Des octets différents donnent 409. Une réponse perdue ne crée pas un second identifiant.

Répéter POST pour une réservation encore non consommée réémet un nouveau secret et invalide le précédent, sans prendre une place supplémentaire. Un ancien PUT peut alors échouer et doit utiliser le secret le plus récent. Avant de renouveler, le client relit l’état pour récupérer un dépôt éventuellement déjà accepté. Après expiration d’une autorisation acceptée, la photo est récupérée par l’état ; elle n’est pas déposée une seconde fois.

La finalisation refuse moins que `minPhotos`, plus que `maxPhotos` et toute réservation active restante. Elle copie la politique et les métadonnées, signe une seule fois et conserve payload et JWS. Répéter ne change ni date ni signature. Les réservations expirées cessent d’être actives. La finalisation reste interdite tant que le composant attend une réponse de dépôt, même si une notification en a déjà montré le résultat.

La révocation est vérifiée par REST sur chaque accès. Dans cette première version, une connexion SignalR déjà dans un groupe peut encore recevoir des invalidations contenant seulement un `sessionId` précédemment connu après révocation. Elle ne peut plus récupérer les données ; le rythme d’activité peut cependant rester observable jusqu’à déconnexion.
