# PART-03 — Carte de capture partageable : protocole

**Objet :** après une **vraie** capture marquante dans les hautes herbes, l'Expédition ou une épreuve de prestige, proposer « 📸 Partager ma capture ».

## Règles
- Capture marquante = confirmée par le serveur (réponse de `/api/wild/throw`) **et** shiny, 1re capture de l'espèce, rencontre légendaire / de prestige ou espèce légendaire. Un doublon ordinaire ou une fuite n'affichent pas le bouton.
- Carte 1080 × 1350 dessinée dans le navigateur : artwork officiel, nom, n°, région, types, « Attrape-le aussi sur pokdle.fr ». **Aucun pseudo, compte ni identifiant.**
- Partage natif de l'image quand le navigateur sait partager un fichier ; sinon « 🔗 Copier le lien » vers la fiche publique `/pokemon/<nom>?via=capture` ; « ⬇️ Enregistrer » toujours disponible.
- Rien ne change dans les captures, l'économie, les récompenses ou les données gardées. Pas de migration.

## Mesure (DATA-03)
Voir [USAGE_EVENT_GRAIN.md](USAGE_EVENT_GRAIN.md#part-03--carte-de-capture-partagée-7-novembre-2026) : `share:capture` (navigateur, une fois par capture), `share:capture-visit` (serveur, personnes seulement), robots dans `share:preview`.

## Contrôles automatisés
- `App/test/part03-capture-share.test.js` : lien client = slug serveur pour les 1025 fiches ; bouton seulement sur une capture marquante ; aucune donnée de joueur dans la carte ; étape 1 comptée une fois ; étape 2 comptée uniquement sur la vraie fiche avec `?via=capture` (ni sans paramètre, ni sur redirection) ; compteurs serveur refusés par `/api/track`.
- `npm test` avec PostgreSQL local : 997/997 (7/11/2026).

## Contrôle local (7/11/2026)
Chromium (iPhone 13 émulé et PC 1366 px) : carte « Attrapé ! » avec le bouton, fenêtre de partage avec l'image, « Copier le lien » quand le partage de fichier n'existe pas. **Aucune recette sur iPhone physique ni vérification Render revendiquée.**
