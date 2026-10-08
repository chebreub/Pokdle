# Dossier du jour — troisième épreuve

Parcours : Enquête → Wordle → Dossier. Le Dossier reprend le Pokémon de l’Enquête,
y compris après abandon. Terminer le Wordle (victoire, six erreurs ou abandon)
est requis côté serveur avant d’ouvrir le Dossier.

- Une tentative par identité et jour de Paris, mêmes questions/options pour tous.
- Dix QCM, quatre réponses, aucune élimination. Un point par bonne réponse.
- Un 10/10 ouvre dix questions bonus distinctes, maximum 20 points.
- Chaque réponse validée est sauvegardée avant sa correction ; reprise après reload.
- Abandon : 0 point, hors classement. Une partie terminée à 0/10 reste classée.
- Classement Dossier : points décroissants, puis temps croissant. Aujourd’hui,
  sept dates civiles de Paris, meilleur record historique. Top 20 et voisins.
- Invités : cookie Daily existant, jamais classés. À la connexion, reprise de la
  partie ; un résultat invité déjà terminé ne devient pas un résultat classé.
- Aucun changement du classement historique Daily, du barème Wordle ni de Ligue.

## Données

`App/data/dossier-facts.json` : 1 025 espèces de base, extraction des CSV PokéAPI.
Provenance et SHA de chaque table dans `dossier-sources.json`, licence conservée.
Les données restent sur le serveur ; aucun appel externe n’est requis en jeu.
Questions sur talents, catégorie Pokédex, évolution, statistiques, reproduction
et courbe d’expérience. Les dix premières évitent les critères de l’Enquête.
Les égalités de statistiques et les branches d’évolution sont explicitement incluses.
Les valeurs proviennent de l’encyclopédie PokéAPI ; elles ne simulent pas un jeu précis.

## API

- GET `/api/daily/dossier` : question courante sans réponse correcte, état sauvegardé.
- POST `/api/daily/dossier/answer` : `{day, accountId, index, choice}`.
- POST `/api/daily/dossier/abandon` : `{day, accountId}`.
- GET `/api/leaderboard?mode=dossier&scope=today|week|all`.

Les réponses, les points et le bonus sont calculés par le serveur. Verrou de ligne,
clé unique de résultat, retries idempotents ; changement de jour pendant une
transaction entraîne son rollback. Le navigateur reçoit uniquement la correction
des questions auxquelles il a répondu. Pas de repli local en cas d’indisponibilité.

## Validation

`daily-dossier.test.js` : couverture des 1 025 banques, options uniques, talents FR,
égalités et évolution ; PostgreSQL réel (CI) : prérequis, score/bonus, doubles envois,
sauvegarde, migration invité, refus de replay, rollback des classements et minuit Paris.
`dossier_quality.py` : Chromium/WebKit, 1366×768 et 390×844, pertes Wordle,
corrections, reload, erreur réseau, 9/10, 10/10 + bonus, 20/20, abandon et captures.

Le Défi tournant, le classement global du parcours et les récompenses restent les
lots suivants : ils ne sont pas annoncés comme disponibles par cette PR.
