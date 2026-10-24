[English](../https.md) | **Français**

# Premier essai HTTPS sur ordinateur, iPhone et Android

Cette procédure donne une origine commune aux trois appareils. Des parcours utilisateur ont été effectués sur iPhone avec Safari et sur un Xiaomi avec Mi Browser, dont une coupure Wi-Fi suivie d’une reprise et un verrouillage de dix secondes avec une photo en attente. Les résultats, les vérifications non effectuées et les versions encore inconnues sont consignés dans [la checklist physique](testing.md). Chrome Android reste à tester sur appareil réel. Les étapes d’installation et de confiance du certificat sur le Xiaomi n’ont pas été relevées. Le HTTPS de boucle locale et les caméras factices des tests ne remplacent pas les contrôles propres à l’appareil. Ne désactivez ni TLS ni les protections du navigateur.

Prérequis : même réseau local privé, adresse IP LAN stable du PC, Node et .NET indiqués dans le README, et [mkcert](https://github.com/FiloSottile/mkcert) installé suivant sa documentation. Exemple d’adresse ci-dessous : `192.168.1.20`, à remplacer par celle du PC. Aucun tunnel n’est créé automatiquement.

1. Construire la démonstration avec `npm ci` puis `npm run build`.
2. Dans PowerShell, depuis la racine du projet, générer une autorité locale de développement et un certificat contenant les noms effectivement utilisés :

```powershell
mkcert -install
New-Item -ItemType Directory -Force .data/tls | Out-Null
mkcert -cert-file .data/tls/cert.pem -key-file .data/tls/key.pem 192.168.1.20 localhost 127.0.0.1
mkcert -CAROOT
```

3. Installer **seulement le certificat racine `rootCA.pem`** de ce répertoire sur les deux téléphones de test, par un moyen privé. Sur iPhone, installer le profil puis activer explicitement la confiance complète dans Réglages, Général, Informations, Réglages des certificats. Sur Android, installer comme certificat d’autorité utilisateur dans les réglages de sécurité ; le chemin dépend du constructeur. Ne jamais copier `rootCA-key.pem`, la clé privée serveur ou une clé de signature. Cette autorité est réservée aux appareils de test maîtrisés ; la retirer après les essais si elle n’est plus utile.
4. Configurer le serveur en HTTPS direct. Les chemins de certificat sont absolus :

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Production'
$env:AllowedHosts = '192.168.1.20;localhost;127.0.0.1'
$env:CaptureProof__PublicOrigin = 'https://192.168.1.20:7443'
$env:CaptureProof__DataDirectory = Join-Path (Get-Location) '.data/demo'
$env:Kestrel__Endpoints__Https__Url = 'https://0.0.0.0:7443'
$env:Kestrel__Endpoints__Https__Certificate__Path = Join-Path (Get-Location) '.data/tls/cert.pem'
$env:Kestrel__Endpoints__Https__Certificate__KeyPath = Join-Path (Get-Location) '.data/tls/key.pem'
.\.tools\dotnet\dotnet run --no-launch-profile --project src/CaptureProof.Api
```

Remplacer la commande locale par `dotnet` si le SDK corrigé est installé normalement. Autoriser le port 7443 uniquement sur le réseau privé dans le pare-feu du PC, selon sa politique locale. Le projet ne change pas le pare-feu.

Après préparation de `.data/tls/cert.pem` et `.data/tls/key.pem`, le même lancement peut être répété avec le script Windows :

```powershell
pwsh -File scripts/start-lan-https.ps1 -Address 192.168.1.20
```

Il vérifie que l’adresse appartient au PC, sélectionne le SDK local s’il existe, conserve les données de `.data/demo`, configure `PublicOrigin` et `AllowedHosts`, puis lance Kestrel en environnement Production avec HTTPS lié à cette adresse. Il ne génère pas de certificat et ne modifie pas le pare-feu. Si l’adresse IP du PC change, régénérer le certificat avec la nouvelle adresse et relancer le script.

5. Ouvrir `https://192.168.1.20:7443` sur l’ordinateur puis sur chaque téléphone. Vérifier une connexion de confiance sans avertissement de certificat. Une IP HTTP du réseau local ne permet pas ce test caméra.
6. Sur ordinateur, créer une session, scanner le QR, comparer les six chiffres, confirmer, puis autoriser la caméra du téléphone. Prendre, supprimer/reprendre et finaliser. Contrôler la réception sur l’ordinateur, télécharger les originaux et le reçu, importer explicitement les clés reconnues dans le vérificateur et indiquer la référence attendue.
7. Sur téléphone, ouvrir directement la racine HTTPS et vérifier que « Commencer la capture mobile » ne crée pas de QR.

Sous Linux, les mêmes réglages s’expriment avec `export Kestrel__Endpoints__Https__...=...` et des chemins absolus. La démo construite est servie avec l’API ; Vite ne participe pas à cet essai.

## Essai d’interruption ciblé

Choisir un essai sur téléphone selon [le changement à valider](testing.md#choisir-les-validations). Pour une coupure réseau ou un verrouillage, conserver la même page ouverte et ne pas la recharger. Les JPEG non envoyés restent uniquement en mémoire : une fermeture ou une éviction de la page par Android peut les perdre. Les essais effectués ne démontrent pas une conservation après rechargement.

Recevoir une première photo en ligne permet de relever une référence côté serveur. Une deuxième photo prise hors ligne doit rester visible dans la page ; rétablir ensuite le réseau et utiliser « Réessayer l’envoi » sur cette même photo. Pour un essai de verrouillage, vérifier l’arrêt de la caméra au retour dans la page avant de la relancer explicitement. Finaliser avant l’expiration indiquée, puis contrôler le nombre exact de photos, l’absence de doublon et la vérification du reçu avec les originaux. Consigner les observations de l’utilisateur séparément des contrôles par empreinte ou signature.

En cas de proxy ou tunnel choisi explicitement par l’exploitant, `PublicOrigin` doit être son origine HTTPS externe. Cette version n’active pas aveuglément les en-têtes transférés : configurer un proxy de confiance ou conserver HTTPS jusqu’au backend. Le proxy doit préserver les cookies et WebSocket, et ne pas journaliser les corps, cookies ou secrets. Aucun compte tiers ni service payant n’est obligatoire.
