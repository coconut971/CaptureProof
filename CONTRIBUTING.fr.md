# Contribuer et adapter CaptureProof

[English](CONTRIBUTING.md) · **Français**

Vous pouvez utiliser et adapter chaque module selon [Apache-2.0](LICENSE). Vos écrans, parcours et backends ne nécessitent pas la démo React. Conservez les mentions de licence et de dépendances applicables lors d’une redistribution.

## Choisir la bonne couche

- `packages/capture-web` : contrôleur, transport typé et Web Component facultatif. Utilisez `/headless` pour vos écrans.
- `packages/receipt-verifier` : vérification indépendante des reçus et fichiers exacts, avec CLI facultatif.
- `src/CaptureProof.Api` : backend de référence, clés d’émission, stockage, autorisation métier et contrat HTTP.
- `apps/web` : une démonstration React des modules.
- `examples/vanilla` : intégration HTML simple du composant.

Le [guide d’intégration](docs/fr/integration.md) décrit les points d’extension. L’identité, les règles métier et la navigation appartiennent à votre produit. Les garanties d’intégrité nécessitent des contrôles serveur et des clés de vérification explicitement reconnues.

## Valider une modification

Utilisez Node.js 24 et le SDK .NET choisi dans `global.json`. Suivez les [commandes de lancement](README.fr.md#lancer-la-démonstration) et le [guide de test](docs/fr/testing.md), notamment les variables des fichiers d’interopérabilité.

Exécutez `npm run typecheck`, `npm run lint`, `npm run build`, `dotnet test`, `npm test`, `npm run test:e2e` et `npm run audit:public` selon le changement, puis l’ensemble avant une livraison. Un essai physique se justifie par un comportement de caméra, de permission ou de cycle de vie propre au navigateur. Une correction de documentation ou de libellé ne nécessite pas de refaire les captures.

## Faciliter la revue

Décrivez le problème concret, le comportement obtenu et les contrôles réellement exécutés. Gardez les identifiants en anglais. La documentation canonique est anglaise ; mettez à jour le guide français correspondant lors d’une évolution de contrat ou de garantie.

Préservez la capture mobile, le lien entre reçu et octets exacts, la confiance explicite des clés, l’idempotence des reprises et l’arrêt de la caméra. Une préférence d’interface ne doit pas affaiblir les droits ou limites serveur. Documentez les impacts de compatibilité et testez la frontière concernée.

Utilisez des photos synthétiques et des données jetables. Ne soumettez pas de captures réelles, clés, bases, identifiants secrets ou notes locales. Suivez [SECURITY.fr.md](SECURITY.fr.md) pour les signalements sensibles.

Comptes, boutiques, marketplaces, détection d’IA et applications natives ne font pas partie de l’implémentation de référence. Le reçu ne prouve ni l’origine physique de la caméra, ni l’authenticité d’un objet, ni l’absence d’IA, ni une heure indépendante de confiance.
