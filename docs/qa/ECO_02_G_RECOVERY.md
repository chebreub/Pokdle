# ECO-02 G — Reprise unique de l'épreuve Drattak

**Périmètre :** réalisation autorisée explicitement par le propriétaire après [l'étude ECO-02](ECO_02_DRATTAK_EVENT_STUDY.md). Aucun changement de formule de capture, shiny, prix, inventaire, récompense, sauvegarde ou migration.

## Règles et conservation des acquis

- **Quête initiale inchangée :** posséder une capture Draby/Drackhaus vérifiée serveur, 3 victoires dans chacun de Cri/Silhouette/Description, au moins 5 jours distincts dans les 30 derniers jours, compte connecté et bonne réponse à l'énigme.
- **Après la toute première rencontre Drattak perdue** (`status='fled'`) : une seule reprise allégée. Elle exige 3 **nouveaux** jours de victoires et 2 **nouvelles victoires** dans chacun des trois modes, enregistrées par le serveur **après la dernière tentative**, dans une fenêtre de 30 jours. La reprise ne s'ouvre qu'après le cooldown existant de **21 jours** et **le samedi ou dimanche en heure de Paris**.
- La disponibilité est déterminée par la lecture serveur des **deux dernières rencontres Drattak** déjà stockées. Deux rencontres ou plus, une première réussite ou un abandon volontaire ne donnent pas ce raccourci. Pas de table nouvelle ni purge de l'historique.
- **Après cette reprise**, le défi complet redevient nécessaire. Les joueurs qui remplissent déjà le défi complet peuvent l'utiliser comme auparavant, y compris hors week-end.
- La même énigme, la condition de **3 Balls au total**, les **3 lancers maximum**, la capture serveur et le taux shiny **1/500** sont conservés. Aucune seconde capture garantie ni nouveau tirage gratuit hors ouverture normale.
- L'UI affiche les objectifs adaptés et l'attente du week-end depuis l'état renvoyé par le serveur. Le client ne décide ni les dates ni les gains.

## Conditions d'entrée et protection contre les abus

Le serveur utilise un verrou transactionnel par identité avant chaque ouverture de rencontre. Le contrôle re-lit les preuves enregistrées, les derniers essais, le compteur de jours, l'inventaire et le statut de la rencontre ouverte. En cas de double requête simultanée, une seule rencontre doit être créée. La tentative de reprise est consommée par **la création effective** de la deuxième rencontre, même si celle-ci se termine sans capture.

Les tentatives antérieures à ce changement restent valables : le joueur ayant une unique première fuite conserve le droit éventuel de reprise, sans réinitialisation de sa collection. Les événements de victoire historiques **avant** la fuite ne sont jamais réutilisés pour déverrouiller la reprise.

## Tests et limites de validation

Tests ajoutés dans `App/test/prestige-drattak-recovery.test.js` :
- conservation des contraintes de la première quête et blocage après deux rencontres ;
- manque d'une victoire ou d'un jour, cooldown et bornes vendredi/samedi/dimanche ;
- rendu UI du rendez-vous sans bouton d'ouverture anticipée ;
- PostgreSQL isolé : ancien premier échec, preuves vérifiées sur trois jours, refus le vendredi, accès le samedi, double requête, trois lancers et impossibilité de reproduire la reprise.

Commandes :

```bash
cd App
node --test test/prestige-drattak.test.js test/prestige-drattak-recovery.test.js
npm run build
```

Pour exécuter le scénario PostgreSQL, fournir `QA_DATABASE_URL` pointant vers une **base de test isolée**. Sans variable, le test PostgreSQL est ignoré et **ne constitue pas une validation du comportement de concurrence**. La CI GitHub et une recette de jeu réelle restent distinctes des tests locaux.

**Hors périmètre :** nouvelle apparition aléatoire, changement de taux, conservations 72 h (ECO-08), récompenses ou nouveau plafond hebdomadaire. Le test d'un événement sur téléphone physique n'est pas revendiqué.
