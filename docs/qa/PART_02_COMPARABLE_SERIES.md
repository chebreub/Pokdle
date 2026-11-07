# PART-02 — Défis de séries réellement comparables

**État : développement en PR.** Action à compter parmi les 43 uniquement après CI complète verte et fusion dans `main`. Progrès actuel avant fusion : **26/43**.

## Défaut fonctionnel observé

Les défis « Bats mon record » des modes Pixelisé 10, Cri 10, Silhouette 10 et Description 10 utilisent le score individuel enregistré, mais **chaque partie tire ses Pokémon indépendamment**. Deux records ne constituent donc pas une confrontation avec des secrets identiques. Les anciens historiques et ces défis restent inchangés, sans leur attribuer rétrospectivement une équivalence inexistante.

## Format ajouté : « 🎯 Même série »

- Nouveau défi **`serie10`**, distinct des scores du classement et des records antérieurs : 10 Pokémon dans un ordre commun, maximum 8 tentatives par Pokémon, toutes les neuf générations.
- Le serveur tire dix Pokémon éligibles **sans répétition** et conserve la liste exclusivement dans `player_challenges.series_ids`. Les deux comptes reçoivent le même ordre figé, sans identifiant de secret, graine reproductible ni réponse envoyée à l'avance.
- Chacun joue depuis **Mes défis** ; le créateur doit lui aussi jouer, et ne peut pas gagner simplement en envoyant son record. Tous les essais et passages sont vérifiés par le serveur, par identité, dans une transaction `SELECT … FOR UPDATE` ; un rejeu ne compte pas deux fois.
- Chaque joueur voit seulement ses propres indices (comparaison Pokémon du jour) et sa progression. Le score de l'adversaire n'est divulgué qu'une fois les deux parcours terminés.
- Score : **nombre de Pokémon trouvés / 10** ; départage à égalité par **moins d'essais sur les Pokémon effectivement trouvés**. En cas de nouvelle égalité, résultat partagé. Un défi non achevé à la date limite expire sans attribuer une victoire arbitraire.
- Les contrôles existants (connexion, réception refusée, blocage, quotas d'invitations, durée de 24 h / 3 / 7 jours, annulation et nettoyage sous 30 jours) sont préservés. Aucun nouveau gain, XP, Ball ni Pokédollar.

## Base, sécurité et compatibilité

Trois colonnes additives et facultatives sur `player_challenges` : `series_ids JSONB` (privée), `series_gens INTEGER[]` (choix figé), `series_progress JSONB` (progrès de chaque participant). **Aucune migration destructive ni reconstruction des anciens défis.**

Seul un participant peut consulter/jouer un défi par API authentifiée ; les mutations POST nécessitent l'origine autorisée et subissent les limites de débit de la famille défis. Toutes les générations et paramètres sont imposés côté serveur. L'ancienne API de résultats individuels `afterResult` ne décide jamais de ce nouveau défi.

## QA

- `App/test/part02-shared-series.test.js` : choix de dix secrets distincts, validation des générations et des essais, comparaison et départage, refus des utilisateurs tiers, absence de réponse dans les payloads, rejeu/concurrence de propositions, progression différente par participant, résultat final et notifications, égalité, expiration sans crédit, coexistence avec les défis historiques.
- Scénarios PostgreSQL en **schéma éphémère isolé** via `QA_DATABASE_URL`, ajoutés à `Browser and database quality`.
- `npm test` couvre les tests unitaires et de configuration du nouveau défi et les régressions existantes ; `npm run build` sert les sources frontend modifiées.
- Ne fusionner que si `Game regression tests` et `Browser and database quality` sont vertes **sur le head exact** de la PR. Distinguer validation automatisée de l'essai sur iPhone physique et du déploiement Render.

## Hors périmètre

Aucun partage de code de compte, secret ou jeton entre amis ; aucun changement de taux shiny, de capture, de Pokédex, des inventaires ou des anciennes séries Pixelisé/Cri/Silhouette/Description. Un défi de record historique ne sera **pas rebaptisé « série identique »**.
