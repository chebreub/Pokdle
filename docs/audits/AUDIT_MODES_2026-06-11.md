# Audit des modes de jeu — Pokédle — 11 juin 2026

**Méthode.** Inventaire croisé de tous les registres de modes dans le code (pool Party, menu Jouer, écran « Tous les modes », sauvegarde/restauration, aide contextuelle, quêtes, records) + spot-checks en live des modes les moins joués (Évolution, Ordre Pokédex, Poké-Connections). Chaque constat cite le code.

---

## 1. Party Pokémon : pool obsolète — confirmé 🟠

`getPartyModePool()` (script.js:1739) contient **11 mini-jeux** : Mystère, Silhouette, Pixelisé, Cri, Quiz, Stat Mystère, Duel de poids, Évolution, Ordre Pokédex, Description, Intrus.

**Manquent les 3 modes les plus récents** : Higher or Lower, Poké-Connections, Speedrun Pokédex. Cause structurelle : ces trois-là vivent dans des écrans dédiés (`screen-higher-lower`, etc.) alors que le pool Party ne sait lancer que des modes de l'écran de jeu commun, résolus via `finishPartyRound()` (script.js:1868).

*Correctif possible : à la fin d'une run HL/Connections/Speedrun, si `isPartySessionActive()`, appeler `finishPartyRound(résultat)` et revenir à l'écran party. Critère de victoire à définir par mode (ex. HL ≥ 5 d'affilée, Connections résolu ≤ 4 erreurs, Speedrun ≥ 10). Effort moyen (~1-2 h), gros gain de variété.*

## 2. Party déséquilibré : un round Quiz = 15 questions 🟠

`QUIZ_QUESTION_COUNT = 15` (script.js:1105) s'applique aussi en Party : un round Quiz dure ~10× plus longtemps qu'une Silhouette. Une session de 5 rounds varie du simple au triple selon le tirage.

*Correctif : 5 questions quand `isPartySessionActive()` (1 ligne dans `startQuizGame`).*

## 3. Sauvegarde mono-slot : le daily se fait écraser 🟠

`saveCurrentGame()` (script.js:19911) n'a qu'**un seul slot** (`pokedle_game_v1`), partagé par tous les modes :
- Tu commences le **Pokémon du jour**, puis tu lances une Silhouette → la sauvegarde du daily est **écrasée**.
- Au refresh : la Silhouette est restaurée, ta partie daily du jour est perdue, et le hero ne dit plus « Partie en cours ».

*Correctif : slot séparé pour le daily (`pokedle_game_daily_v1`), restauré en priorité ; les autres modes gardent le slot commun. Effort faible.*

## 4. Restauration incohérente entre modes 🟡

`VALID_MODES` (script.js:1106) n'autorise que 8 modes à être restaurés (normal, challenge, daily, silhouette, pixel, mystery, cry, quiz). **Description, Intrus, Duel de poids, Évolution, Ordre Pokédex** sont pourtant sauvegardés à chaque essai… puis **purgés silencieusement** au rechargement (script.js:19941-19944). Pas de bug visible, mais un comportement à deux vitesses non documenté.

*Correctif : soit ajouter les modes restaurables proprement, soit ne pas les sauvegarder du tout (plus simple et cohérent).*

## 5. Aide contextuelle incomplète 🟡

`getHelpContentForGameMode()` (script.js:21048) couvre 8 modes. **Description, Intrus, Duel de poids, Évolution, Ordre Pokédex** retombent sur l'aide générique « Deviner » qui parle du tableau d'indices… qui n'existe pas dans ces modes. (Les écrans dédiés HL/Connections/Speedrun/Stat Auction sont, eux, bien couverts par `HELP_BY_SCREEN` ✓.)

*Correctif : 5 entrées d'aide à écrire (~30 min).*

## 6. Poké-Connections ignore le filtre de générations 🟡

Vérifié en live : avec « Gen 1 » seule sélectionnée, la grille contient Celebi, Ho-Oh, Blizzaroi, Libégon… C'est probablement voulu (le mode a besoin de diversité pour ses 4 thèmes), mais le badge « Gen 1 » reste affiché dans l'UI du jeu → contradiction visuelle. *Correctif : masquer le badge de gens dans ce mode, ou afficher « Toutes générations ».*

## 7. Détails relevés en spot-check 🟡

- **Évolution** : fonctionne ✓, mais les noms sous les sprites latéraux (Abra/Alakazam) sont quasi illisibles (gris très pâle sur blanc).
- **Ordre Pokédex** : fonctionne ✓, énoncé clair, RAS.
- **Poké-Connections** : fonctionne ✓, grille propre, compteur d'erreurs OK.

## 8. Ce qui est sain ✅

- **« Tous les modes »** : catalogue complet et à jour (les 17 modes solo + multi + outils, y compris HL/Connections/Speedrun/Stat Auction) — c'est le pool Party qui est en retard, pas le catalogue.
- **Quêtes quotidiennes** : toutes les références de modes sont valides (hl_streak, score_attack, stat_clash, connections, auction, draft).
- **Records par mode** (profil + home) : HL, Speedrun, Quiz, Party, Intrus, Duel de poids, Score Attack couverts.
- **Menu Jouer groupé** : reflète tous les modes existants.

---

## Synthèse & ordre de correction proposé

| # | Constat | Sévérité | Effort |
|---|---|---|---|
| 1 | Party pool sans HL/Connections/Speedrun | 🟠 | Moyen |
| 2 | Quiz 15 questions en Party | 🟠 | Trivial |
| 3 | Save daily écrasée par les autres modes | 🟠 | Faible |
| 4 | VALID_MODES incohérent | 🟡 | Faible |
| 5 | Aide manquante pour 5 modes | 🟡 | Faible |
| 6 | Badge gens trompeur dans Connections | 🟡 | Trivial |
| 7 | Contraste noms chaîne d'évolution | 🟡 | Trivial |

Ordre conseillé : **2 → 3 → 7 → 6 → 5 → 4 → 1** (du trivial au structurel ; le n°1 en dernier car c'est le seul qui demande de la conception).

*Aucune modification effectuée — en attente de validation.*
