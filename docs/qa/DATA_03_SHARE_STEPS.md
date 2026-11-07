# DATA-03 — Partage, lien ouvert, partie lancée : protocole

**Objet :** séparer les trois étapes d'un lien partagé, sans suivi individuel. Définitions et sources : [USAGE_EVENT_GRAIN.md](USAGE_EVENT_GRAIN.md#data-03--trois-étapes-dun-lien-partagé-7-novembre-2026).

## Contrôles automatisés
- `App/test/data03-share-steps.test.js` :
  - robots d'aperçu (WhatsApp, Discordbot, facebookexternalhit, Twitterbot, Slackbot, TelegramBot, Googlebot, headless, user-agent vide) séparés des navigateurs (Safari iPhone, Chrome Android, Firefox) ;
  - câblage serveur et client des trois étapes ;
  - PostgreSQL : seul le **1er essai accepté** d'une partie du jour marque un lancement ; un essai rejoué, un 2e essai, la victoire, un essai après la fin et un abandon ne le marquent pas, et l'indicateur ne part jamais au navigateur.
- `App/test/admin-stats-v2.test.js` : le tableau « Partage et découverte » affiche les colonnes « 2. Lien ouvert » et « 3. Partie lancée ».

## Contrôle manuel local (7/11/2026)
Serveur local avec une base jetable :
- `?defi=300-3` ouvert par Safari iPhone → `share:visit` +1 ; par WhatsApp → `share:preview` +1.
- `?party=abc12&game=dessin` par Safari iPhone → `share:party-visit` +1 ; `?party=ABC12` par Discordbot → `share:preview` +1 ; `?party=xx` (code invalide) → rien.
- `POST /api/track {"event":"share:party"}` → `share:party` +1.

## Limites assumées
- Compteurs agrégés et indépendants : pas de taux de conversion par personne.
- L'origine « venu du lien » est déclarée par le navigateur ; le lancement lui-même est vérifié par le serveur.
- Pas de reconstitution de l'historique ; `share:visit` incluait les robots avant cette mesure.
- Aucune vérification du déploiement Render ni recette sur iPhone physique revendiquée.
