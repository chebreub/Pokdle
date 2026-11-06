# ECO-04 — Coffres d'expédition : crédit unique et récupération fiable

**État : terminé et intégré.** [PR #309](https://github.com/chebreub/Pokdle/pull/309) fusionnée dans `main` au commit `be7565087755ed593e26d27cc530692476eba48d` après CI Node, PostgreSQL et navigateur vertes ; **25/43 = 58,1 %**. Aucun nouveau barème ni attribution rétroactive.

## Situation confirmée avant correction

- L'API `POST /api/expedition/chests` lit l'avancement et crédite des Balls en transaction PostgreSQL, sous verrou par identité. Une deuxième requête le **même jour** n'ajoute pas de Balls grâce à `PRIMARY KEY(identity,day,source)`.
- Un coffre de palier 25 %, 50 % ou 75 % contient **deux emplacements** numérotés `exp:<lundi>:<palier>:1|2`. Or `expedition()` marquait le coffre récupéré dès qu'**un seul** de ces emplacements figurait au registre. Une ancienne importation partielle pouvait donc masquer une Ball encore due.
- La clé unique existante inclut **le jour** : elle ne protège pas à elle seule la même source réclamée à des dates différentes. La migration invité → compte recopiant les bonus pouvait également réimporter une même source déjà créditée sur une autre date.
- Après une réponse HTTP perdue mais une transaction validée, une nouvelle tentative renvoyait `no_chest`, sans actualiser automatiquement l'affichage.
- Les coffres non ouverts avant la fin du dimanche étaient historiquement **perdus**. L'attribution automatique de ces coffres, y compris rétroactive, **n'est pas approuvée** et n'est pas activée ici.

## Correction ciblée

1. `expedition()` examine les **sources complètes des deux Balls** du palier, indépendamment du jour du crédit ; elle expose `remainingBalls`, `claimed` seulement lorsque les deux sources sont présentes, et `canClaim` si le palier est atteint et des Balls manquent.
2. `claimChests()` ajoute **uniquement les emplacements manquants** au moyen d'un `INSERT ... WHERE NOT EXISTS (identity,source)`. La transaction possède déjà un `pg_advisory_xact_lock` par identité, empêchant deux demandes concurrentes de passer la vérification. La réponse existante `no_chest` en l'absence de nouveau crédit est conservée.
3. L'adoption des Balls d'un invité dans un compte vérifie d'abord si la même source de coffre existe déjà à une autre date, pour éviter une deuxième attribution. Les opérations d'adoption restent atomiques et les compensations de consommation existantes sont conservées.
4. Le bouton de récupération affiche le nombre **réellement restant** plutôt que les deux Balls de chaque palier en cas d'historique partiel. Une réponse `no_chest` après retry recharge les états du sac et de l'expédition.
5. Le fonctionnement actuel reste inchangé pour un coffre normal : **25 % = 2 Poké Balls ; 50 % = 1 Super + 1 Poké ; 75 % = 2 Super**. Les gains sont hors plafond quotidien. Pas de migration ni de suppression de lignes.

## Preuves à obtenir en CI

Le fichier `App/test/eco04-expedition-chests.test.js` s'exécute dans un **schéma PostgreSQL éphémère isolé** et couvre :

- Cohérence des paliers et quantités officielles du site.
- Coffre hérité partiellement acquis : un emplacement sur deux, affichage `remainingBalls=1`, récupération de la seule Ball manquante.
- Interruption en plein crédit via contrainte de base injectée : rollback intégral, aucun palier partiellement ajouté, nouvel essai sain après retrait de la contrainte de **test**.
- Trois ouvertures simultanées : une seule transaction crédite ; aucun doublon ni nouvelle monnaie.
- Reconnexion/relecture à un autre jour de la même semaine et demande en double : sources immuables et crédit unique.
- Passage invité → compte avec une même source présente à deux dates : une seule source reste sur le compte, aucune perte des autres gains.
- Second joueur indépendant : garde ses propres droits.
- Lundi suivant : la semaine précédente n'est pas prolongée, aucun crédit rétroactif.

**Critère de clôture :** CI Node et PostgreSQL/navigateur complètes vertes sur le head de PR, puis fusion dans `main` et synchronisation du registre. Aucun contrôle réel sur Render ou appareil physique iPhone revendiqué.
