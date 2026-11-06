# DEX-01 — découvert, déjà capturé, possédé actuellement

## Données et définition

| État | Source existante | Ce que cela prouve |
| --- | --- | --- |
| Vu / découvert | `playerProfile.discoveries` | Une entrée découverte en jouant, en mission ou par synchronisation existante. Ce n'est pas une capture. |
| Déjà capturé | `wild_encounters`, identité courante, statut `caught`, `released` ou `traded`, sauf `kind='trade'` | Une capture personnelle enregistrée ; son exemplaire peut avoir été cédé depuis. |
| Possédé actuellement | Collection serveur existante, statut `caught`, y compris `kind='trade'` | Un exemplaire conservé, capturé ou reçu par échange. |

Les échanges marquent l'exemplaire donné `traded` et créent chez le destinataire une ligne `caught` de type `trade`. Les cessions marquent le doublon `released`. Ces lignes existent déjà ; aucun historique n'est reconstitué depuis le profil local, aucune migration ni modification d'inventaire. Les règles actuelles interdisent de céder le dernier exemplaire normal/shiny : elles restent intactes. Le cas historique sans possession est testé explicitement sans autoriser une telle cession dans le jeu.

L'endpoint de collection ajoute `captureHistory`, un agrégat de lecture des lignes existantes pour l'identité courante. Il ne renvoie pas de données d'autres joueurs. Les effets préexistants de cet endpoint (état des Balls, adoption de l'identité invitée, expiration des rencontres ouvertes) sont inchangés ; la nouvelle requête ne fait que lire.

## Présentation

Filtres, compteurs, badges et fiche personnelle distinguent les trois états. Un Pokémon reçu par échange est « possédé » sans capture personnelle inventée. Une capture cédée reste dans « déjà capturés ». La fiche dit « aucune capture enregistrée », pas « jamais capturé ». Sans historique reçu, le compteur reste inconnu et son filtre est désactivé ; aucune déduction à partir de la possession ou d'une mission.

La réouverture de la collection et le retour depuis une rencontre rechargent les données serveur. Les profils, captures, sauvegardes, taux, shiny, prix, Balls, monnaie, gains, Drattak et expéditions ne changent pas. Les badges shiny existants restent distincts de ces trois états.

## Validation

- Tests Node : mission/découverte seule, capture conservée, capture cédée, échange reçu sans capture personnelle, historique absent, aucune écriture de profil.
- Test PostgreSQL isolé dans `wild-trades.test.js` : requête réelle, variantes normales/shiny, cessions, échanges, rencontres ouvertes/fuies et isolation d'identité ; lecture répétée sans modification des lignes de rencontre.
- `tools/pokedex_states_quality.py` : Chromium/WebKit, 390 et 1366 px, ressources reconstruites réellement servies. Réponses de collection explicites simulées pour le test de présentation, distinct de la preuve PostgreSQL. Filtres, fiches, rafraîchissement, historique manquant et débordement horizontal ; captures dans `quality-artifacts/pokedex-states/`.
- La CI finale est requise avant fusion. Aucune recette iPhone physique ni vérification Render revendiquée.
