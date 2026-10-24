# Exemple navigateur sans React

[English](README.md)

Cet exemple utilise directement `@captureproof/capture-web` et son Web Component facultatif, sans React. Il fonctionne en mode `capture-only` : aucune API, aucun runtime .NET, aucun envoi serveur ni reçu signé. Les JPEG restent en mémoire dans la page et peuvent être téléchargés après validation.

Depuis la racine du dépôt :

```sh
npm ci
npm run build --workspace @captureproof/capture-web
npx vite examples/vanilla --host 0.0.0.0 --port 5174
```

Cette commande démarre un serveur de développement HTTP. Pour un véritable essai caméra sur téléphone, utilisez un proxy HTTPS de confiance ou une configuration de développement HTTPS. Une adresse LAN HTTP simple n'est pas une origine caméra sûre. Le [guide HTTPS](../../docs/fr/https.md) explique les exigences de certificat local et de confiance sur le téléphone.

`main.ts` enregistre le composant, crée un contrôleur de capture seule, traite `capturecomplete`, propose le téléchargement des JPEG originaux et libère les URL locales au départ de la page. La détection mobile choisit uniquement l'interface ; ce n'est ni une preuve d'origine caméra ni une frontière de sécurité serveur.

Les photos locales ou en attente ne sont pas conservées durablement. Téléchargez-les avant de fermer ou recharger la page. L'exemple ne propose aucun import depuis la galerie ou le système de fichiers.

Pour conserver votre interface, utilisez `@captureproof/capture-web/headless` et reliez le contrôleur à votre vidéo et vos boutons. Pour obtenir des reçus serveur, fournissez une session préalablement autorisée et un `CaptureTransport` compatible ; le backend doit imposer politique, autorisations, envoi idempotent et finalisation. React et l'implémentation .NET restent facultatifs. Voir le [guide d'intégration](../../docs/fr/integration.md).

Les packages sont des workspaces privés, non publiés sur le registre npm. Hors de ce dépôt, construisez-les et créez les archives avec `node scripts/package-npm.mjs`, puis installez les fichiers `.tgz` locaux produits. Voir le [README du package de capture](../../packages/capture-web/README.fr.md).

La capture seule ne fournit aucun reçu signé. Un reçu serveur lie les octets acceptés au contexte déclaré ; il n'atteste ni l'origine physique de la caméra, ni l'authenticité de l'objet, ni l'absence d'IA, ni une heure de confiance.
