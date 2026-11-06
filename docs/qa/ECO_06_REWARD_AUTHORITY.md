# ECO-06 — Autorité serveur des récompenses et résistance au rejeu

**État : terminé et intégré.** [PR #307](https://github.com/chebreub/Pokdle/pull/307) fusionnée dans `main` au commit `e707039678d90874bc929608bef6fe1dc6498887` après CI Node, PostgreSQL et navigateur vertes ; **24/43 = 55,8 %**. Périmètre : Pokédollars et Poké Balls liés aux parties (ni modification de l'XP client, ni nouveau système de récompenses).

## Chemins effectivement contrôlés (6 novembre 2026)

| Source | Décision serveur observée dans le code | Garde-fou contre double gain |
| --- | --- | --- |
| Arcade vérifiée : Quiz, Higher or Lower, version 60 s, Poids, Shiny | `verified-arcade.js`, `quiz-higher-lower.js` et `poke-balls.js` : choix contrôlé avec la manche, le secret et le score stockés côté serveur ; `/api/balls/earn` refuse les résultats librement déclarés | `arcade_runs` est verrouillée par identité/mode ; `ball_gains(identity,day,source)` unique et `coin_ledger(identity,day,source)` unique, dans une transaction |
| Arcade vérifiée : Classique, Stat Mystère, Pixelisé, Silhouette, Cri, Description | `verified-guess.js` maintient les essais, les indices et le Pokémon secret côté serveur ; une partie abandonnée sans essai ne rapporte rien | Réponses déjà proposées ou terminées identifiées, unicité des gains journaliers |
| Pokémon du jour, Wordle, Dossier et Défi du jour | `dailyGains` dans `poke-balls.js` consulte les lignes serveur de `daily_plays`, `wordle_plays`, `dossier_plays`, `challenge_plays` | `ball_gains` / `coin_ledger` ont une clé unique par identité, date et source |
| Party Room | `party-rewards.js` émet seulement à l'issue d'une partie terminée un reçu HMAC propre au jour, à l'identité et à la partie ; au moins 2 identités distinctes | Preuve obligatoire dans `/api/balls/earn`, crédit journalier `party` / `day:party` unique |

**Limite :** la vérification serveur établit l'existence d'une partie/commande et de son résultat, pas l'absence d'automatisation du joueur. Les autres modes frontend qui n'ont pas de partie serveur vérifiée ne peuvent pas produire de Pokédollars/Balls en déclarant arbitrairement un score.

## Anomalie constatée et correction

Avant ECO-06, une partie Higher or Lower **60 secondes** pouvait être ouverte puis laissée sans réponse. L'expiration (par `start`, `answer`, `next` ou `finish`) émettait alors `earned:games.result(s)` avec score zéro, qui déclenchait **30 ₽ et une Poké Ball** à la première partie du jour.

La protection `verifiedTimedEarning(s)` exige au moins une réponse acceptée par le serveur : `s.answer.choice` pour la manche courante, ou `s.round > 0` lorsqu'une réponse précédente a déjà été validée puis le tour avancé. Elle ne modifie pas le temps de 60 s, les scores, le barème 30/60/90 ₽, le plafond de 2 000 ₽, ni le nombre de Balls. **Une véritable réponse, même fausse, garde la récompense habituelle**. Les sessions déjà ouvertes sans réponse restent compatibles, sans migration.

## Tests ciblés

- Scénarios PostgreSQL isolés dans `App/test/verified-quiz-hl.test.js` : expiration sans réponse via les quatre chemins, réponse invalide refusée, aucun gain enregistré en `ball_gains` ni `coin_ledger`, client invité sans gain passif.
- Avec une réponse valide puis fin de minute : crédit normal unique (30 ₽ à score inférieur au seuil), rejeu, requêtes concurrentes, absence de second crédit.
- Régressions existantes conservées : Quiz validé (15 réponses), Higher or Lower classique, Shiny, jeu de poids, devinettes vérifiées, jeux du jour, preuve Party Room par compte/jour, déductions de stock et achats.
- Tests et navigateur GitHub à vérifier **sur le head final de PR**, sans confondre CI et test physique iPhone / déploiement Render.

**Interdictions conservées :** aucun effacement ou recalcul des comptes, Pokédex, inventaires, `ball_gains`, `coin_ledger` ou `arcade_runs`, aucune hausse/redistribution des gains, aucune modification de probabilité ou de rareté.
