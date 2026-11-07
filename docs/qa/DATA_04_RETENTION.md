# DATA-04 — Retour J+1 / J+7 sur cohortes mûres : protocole

**Objet :** mesurer le retour des joueurs sans confondre le retour au Pokémon du jour et le retour sur l'ensemble du site, à partir des données que le serveur garde déjà. Définitions : [USAGE_EVENT_GRAIN.md](USAGE_EVENT_GRAIN.md).

## Règles
- Unité : un **joueur-jour** (identité = compte, ou navigateur invité ; jour de Paris).
- Fenêtre : les **28 derniers jours de Paris terminés**, quelle que soit la période affichée dans `/admin/stats`.
- **Jours mûrs seulement** : un joueur-jour compte dans « lendemain » si le lendemain est terminé et dans la fenêtre, dans « 7 jours » si les 7 jours suivants le sont. Les jours trop récents ne font pas baisser le taux.
- **Pokémon du jour** : au moins un essai ou un abandon ; une ligne invité fusionnée dans un compte le même jour (`excluded_stats`) n'est pas un 2e joueur.
- **Tout le site** : une partie déjà gardée par le serveur — Pokémon du jour, Wordle, Dossier, Défi, Grille, Petit Bac du jour, Ball gagnée (sauf `admin:…`), rencontre des hautes herbes (sauf Pokémon reçu par échange). Une simple visite ne compte pas.
- **Comptes admin exclus** (`ADMIN_ACCOUNT_IDS`) des deux mesures.
- « Nouveaux revenus en 7 jours » : joueurs-jours qui étaient le tout premier jour d'activité de l'identité.
- Effectifs toujours affichés ; « petit effectif » sous 20 joueurs-jours.
- Rien de nouveau n'est collecté ni stocké ; aucune donnée individuelle n'est envoyée au navigateur.

## Contrôles automatisés
- `App/test/data04-retention.test.js` : PostgreSQL (jours mûrs, Pokémon du jour ≠ tout le site, admin exclu, page ouverte sans essai et ligne fusionnée ignorées, Balls admin et échange reçu ignorés, tables absentes sautées, lecture sans écriture) ; rendu du tableau avec effectifs et « petit effectif ».
- `App/test/daily-retention-2026-10-31.test.js` et `App/test/admin-stats-v2.test.js` mis à jour.
- Rendu du tableau contrôlé à 390 et 1366 px : pas de débordement.

## Limites assumées
- Un invité qui se connecte devient une nouvelle identité : taux un peu bas, jamais trop haut.
- Un joueur qui ne fait que des modes sans trace serveur (entraînement sans Ball) n'apparaît pas dans « Tout le site ».
- La vignette « Retour des joueurs » passe de 14 à 28 jours et exclut désormais l'admin : ses chiffres ne sont pas comparables avec ceux d'avant le 7/11.
