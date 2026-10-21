# Pokédle — mesure anonyme des modes (lot produit)

## Objectif
Aider à décider **quels modes améliorer** sur la base des usages plutôt que d'un classement supposé « populaire ».

## Périmètre
- L'API existante `POST /api/track` garde son filtrage d'événements et sa limite de requêtes.
- Les lancements de modes déjà instrumentés restent `solo:<mode>`.
- Lorsqu'un mode enregistre une manche dans l'historique via `recordMatchHistory`, le navigateur émet seulement `complete:<mode>:win|loss`.
- Les événements inconnus, les manches de Party Room et les abandons non finalisés ne doivent pas être comptés comme des parties terminées.
- Le serveur agrège les **nombres de signalements** par jour UTC et par événement dans `usage_event_daily(day,event,hits)`, sans compte, identité, navigateur, IP ni réponse de jeu.
- L'agrégat est retenu **90 jours maximum** ; nettoyage au démarrage et quotidien.
- Les statistiques continuent à être consultables uniquement sur `/admin/stats?key=...`, avec la variable Render `ADMIN_STATS_KEY`.

## Interprétation et limites
Le tableau « Modes joués » affiche les **lancements**, **fins déclarées**, **victoires** et **défaites** des 14 derniers jours. Le suivi des lancements est déjà inégal entre les différents mini-jeux ; une manche peut recommencer sans nouvel événement de lancement. Ces totaux **ne constituent pas des utilisateurs uniques, un taux de conversion ni une mesure de rétention**. Les signalements venant des navigateurs sont indicatifs et ne constituent pas des résultats de score vérifiés par le serveur.

La page indique un tiret lorsqu'un mode n'émet pas encore d'événement de fin. Les événements saisis avant le déploiement ne sont pas reconstitués : les séries commencent au moment de la mise en production.

## Confidentialité
Seuls les **totaux journaliers** sont ajoutés en base. Les compteurs existants « visiteurs uniques » utilisant un identifiant navigateur restent en mémoire, ne sont pas recopiés dans `usage_event_daily`. Aucun identifiant n'est envoyé par les nouveaux événements `complete:...`.

## Qualité
- `App/test/usage-metrics.test.js` : validation de la liste des événements, regroupement des modes, calendrier UTC, concurrence des incréments PostgreSQL et purge.
- La CI GitHub utilise une base de test isolée `QA_DATABASE_URL` ; ne jamais exécuter la suite sur la base de production.
- Après fusion validée et publication Render, contrôler dans la console `/admin/stats` que les chiffres apparaissent en jouant des manches fictives (sans comptes réels) et que les autres modes restent fonctionnels.

## Suivi ultérieur
Pour estimer honnêtement l'abandon, il faudra compléter les événements de démarrage et de sortie de **chaque mode**, gérer les nouveaux tours en boucle et attribuer des tentatives éphémères sans stockage personnel. Il ne faut pas calculer un « taux de fidélité » avec les compteurs actuels.
