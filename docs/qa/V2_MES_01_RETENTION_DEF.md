# V2-MES-01 — « Retour des joueurs » : la mesure dit ce qu'elle mesure (8/11/2026, audit GPT)

## Problème
- Le tableau parlait de « J+7 », alors que le calcul compte un retour **à n'importe quel moment entre le lendemain et le 7e jour** (un joueur revenu seulement à J+2 compte).
- « Tout le site » comptait toute ligne enregistrée : cadeau du jour, bonus de bienvenue, achat, coffre, ou un Défi ouvert sans réponse. Ce n'est pas une partie jouée, alors que le texte le laissait croire.

## Correction
- `/admin/stats` › « Retour des joueurs (le lendemain, dans les 7 jours) » : colonne « Revient dans les 7 jours (entre J+1 et J+7) » et une phrase qui l'explique (« pas exactement le 7e jour »).
- **Tout le site : parties jouées** (définition `parties-jouees-2026-11-08`) : un essai, une réponse ou une fin dans un jeu du jour ; une Ball gagnée en jouant (`mode:…` ou Party Room) ; une rencontre dans les hautes herbes (hors remise à zéro de test). Cadeau, bienvenue, achat, coffre, série, Balls de l'admin, Pokémon reçu par échange et parties ouvertes sans réponse ne comptent pas.
- **Tout le site : toute activité enregistrée (mesure du 7/11)** : l'ancienne mesure reste affichée à part, sous son nom, pour comparer. Rien n'est réécrit, rien de nouveau n'est collecté.
- Inchangés : jours de Paris, cohortes mûres seulement, comptes admin exclus, mention « petit effectif ».

## Preuves
- `App/test/v2-mes01-retention-def.test.js` (PostgreSQL) : retour à J+2 compté « dans les 7 jours » mais pas « le lendemain » ; cadeau + achat + bienvenue + Défi ouvert sans réponse ne comptent pas ; rencontre « test_reset » non plus ; l'ancienne mesure les comptait.
- `App/test/data04-retention.test.js` mis à jour (l'ancienne mesure garde ses chiffres).
- `npm test` avec PostgreSQL : 1036/1036.

## Limite
Les effets du plan du 7/11 sur le retour des joueurs ne seront lisibles qu'une fois les cohortes mûres (au moins 7 jours après).
