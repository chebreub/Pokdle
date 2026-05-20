# Prompt Codex — Stat Clash : imposer une règle à l'adversaire

## Contexte projet

Pokédle est un site web Pokémon (live https://pokdle.onrender.com, deploy Render auto-push). Stack : Node.js Express 4 + Socket.io 4, vanilla JS/HTML/CSS, pas de bundler, pas de tests. Tout vit dans `App/` :

- `App/server.js` (~1770 lignes) — backend Express + Socket.io, gère les rooms Duel / Stat Clash / Draft Battle
- `App/script.js` (~18 500 lignes) — front monolithique, beaucoup d'`onclick=` inline et variables globales
- `App/index.html` — toutes les vues dans un seul fichier
- `App/style.css` — monolithique, ~600 KB
- `App/pokemon.js` — base statique 1025 Pokémon

Stat Clash est un mode versus 1v1 où chaque manche, un Pokémon mystère apparaît, et chaque joueur choisit secrètement une stat ; la stat choisie ajoute sa valeur au score, et la stat la plus haute gagne la manche. Le mode existe en deux variantes : **solo bot** (`statClashState.mode === "bot"`) et **room online** (`statClashState.mode === "room"`, sync via Socket.io).

## État actuel du système "règles maison"

Aujourd'hui, **une seule règle est tirée aléatoirement par partie**, appliquée aux **deux** joueurs simultanément. 9 règles existent (server.js `STAT_CLASH_HOUSE_RULES` ligne ~58, script.js équivalent ligne ~730) :

1. `noSpeedEarly` — Vitesse interdite avant la manche 4
2. `atkRound3` — Manche 3 : ATK obligatoire
3. `noHpFinal` — Manche finale : pas de PV
4. `weakStart` — Manche 1 : stat la plus faible imposée
5. `pressureLate` — Pression : timer 5 s aux manches 4-5-6
6. `doubleStat` — Stat star vaut double (1 stat tirée au début, vaut ×2 quand jouée)
7. `blindRound5` — Manche 5 : choix aléatoire imposé
8. `mirrorRound4` — Manche 4 : stat imposée identique des deux côtés
9. `comboBonus` — Combo 3 victoires d'affilée = +2 pts

Côté serveur, les fonctions clés sont :
- `pickRandomStatClashHouseRule()` ~ligne 75
- `getStatClashHouseRuleForcedStatsRoom(room, side)` ~ligne 87 — renvoie le tableau de stats permises selon la règle (déjà patché récemment pour respecter `room.houseRuleTargetSide` sur `atkRound3` et `weakStart`)
- `getStatClashAllowedStatsRoom(room, side)` ~ligne 99 — pool final autorisé pour le seat
- `getStatClashHouseRuleTimerMsRoom(room)` ~ligne 111 — timer (concerné par `pressureLate`)
- `applyStatClashDoubleStatRoom(room, statKey, value)` ~ligne 117 — multiplicateur si `doubleStat`
- `startStatClashMatch(room)` ~ligne 1052 — pick la règle au démarrage
- `startStatClashRound(room)` ~ligne 1073 — init de chaque manche (mirrorRound4 calculé ici)
- `resolveStatClashRound(room)` ~ligne 1191 — applique comboBonus ici
- `publicStatClashRoomState(room, viewerId)` ~ligne 1360 — payload Socket.io envoyé au client (déjà inclut `houseRule`, `doubleStatKey`, `mirrorStatKey`, `houseRuleTargetSide`)

Côté client, fonctions équivalentes dans `script.js` :
- `pickRandomStatClashHouseRule()` ~ligne 730
- `getStatClashHouseRuleForcedStats(state, side)` ~ligne 743
- `getStatClashAllowedStats(state, side)` ~ligne 764
- `useStatClashJoker(side, type)` ~ligne 2912
- `startStatClashBotRound()` ~ligne 2771
- `applyStatClashRoomState(roomState)` ~ligne 3250
- `renderStatClashScreen()` — le rendu du screen Stat Clash, gros bloc (chercher `screen-stat-clash` dans index.html)

Patches récents existants à connaître (déjà mergés) :
- `room.houseRuleTargetSide` (random `"left"` / `"right"` au start du match) — partiellement utilisé pour rendre `atkRound3` et `weakStart` asymétriques. Ce mécanisme va devenir obsolète si tu refactores en `houseRuleBySide`.
- `room.jokersBySide` : reroll, preview, double (×2) — préservé tel quel.

## Feature à implémenter (le bug 4)

**Objectif** : permettre à chaque joueur de choisir UNE règle maison qu'il impose à l'**adversaire** (et non à lui-même). Donc il y a deux règles actives par partie, chacune ne contraignant qu'un seul des deux seats — chaque joueur subit la règle choisie par l'autre.

### Découpage règles imposables vs règles symétriques

Certaines règles sont des **handicaps** (ont du sens en imposition), d'autres sont par nature **symétriques** ou des **bonus** qui n'ont aucun sens si imposées à un seul.

**Règles imposables (handicap-like)** — pool pour le sélecteur d'imposition :
- `noSpeedEarly` (interdit Vitesse au seat ciblé avant M4)
- `atkRound3` (force ATK au seat ciblé en M3)
- `noHpFinal` (interdit PV au seat ciblé à la finale)
- `weakStart` (force stat la plus faible au seat ciblé en M1)
- `blindRound5` (force pick aléatoire au seat ciblé en M5)
- `pressureLate` (raccourcit le timer du seat ciblé en M4-6 — **nécessite un timer par seat**, refactor non trivial ; si trop lourd à découpler, simplifier en "timer raccourci globalement quand l'un des deux joueurs a cette règle imposée")

**Règles symétriques / bonus** — exclues du pool d'imposition, à statut spécial :
- `doubleStat` — si imposée à 1 seul, ça **avantage** le ciblé → contre-productif comme handicap. **Décision recommandée** : exclure du sélecteur.
- `mirrorRound4` — par essence identique des 2 côtés. Si imposée → on perd le sens.
- `comboBonus` — bonus en cas de streak, avantage le ciblé. Contre-productif.

**Recommandation design** : ne mettre dans le sélecteur que les 6 règles imposables. Garder un toggle optionnel "Règles maison communes ON/OFF" qui, séparément, peut activer un tirage random parmi les 3 symétriques (`doubleStat`, `mirrorRound4`, `comboBonus`) en plus des règles imposées. À discuter avec Zakaria avant de coder.

### Nouveau modèle de données

Côté serveur (room state) :

```js
room.houseRuleBySide = {
  left: null,   // { id: "noSpeedEarly", label, desc } ou null
  right: null,
};
// Les règles imposées sont stockées du côté DE QUI EST CONTRAINT (pas de qui impose).
// Donc room.houseRuleBySide.left = la règle subie par le seat "left", choisie par le seat "right".

// Champ commun optionnel (règle symétrique tirée au random si toggle activé) :
room.houseRuleShared = null;  // ou { id: "doubleStat", ... }
room.houseRuleSharedEnabled = false;  // toggle lobby
```

Côté client, miroirs identiques dans `statClashState`.

### Sélection au lobby

- Quand les 2 joueurs ont rejoint la room, avant le démarrage, chacun voit un **sélecteur de règle à imposer à l'adversaire** (dropdown ou grille de 6 cartes, label + desc).
- Le choix est envoyé via un nouvel event Socket.io `stat-clash:select-imposed-rule` avec `{ ruleId }`.
- Le serveur stocke le choix dans `room.pendingImposedRuleBySide[side]` (où `side` est le seat de celui qui choisit). Côté ciblé : `room.houseRuleBySide[oppositeSide(side)] = rule`.
- Tant que les 2 joueurs n'ont pas choisi, `canStatClashRoomStart` reste `false`.
- Affichage : chaque joueur voit "Tu imposes : [règle]" et "Tu subis : [règle]" en attente.

### Mode solo bot

- Le bot pick une règle random parmi les 6 imposables et l'impose au user.
- Le user choisit dans le sélecteur avant le démarrage.
- Une fois les 2 choix faits, la partie démarre.

### Application seat-aware dans le gameplay

Refactor `getStatClashHouseRuleForcedStatsRoom(room, side)` pour lire `room.houseRuleBySide[side]` (et plus `room.houseRule`) :

```js
function getStatClashHouseRuleForcedStatsRoom(room, side) {
  if (!room || !room.houseRuleBySide) return null;
  const rule = room.houseRuleBySide[side];  // règle imposée à CE seat
  if (!rule) return null;
  const id = rule.id;
  const round = room.round;
  const total = room.totalRounds || STAT_CLASH_TOTAL_ROUNDS;
  if (id === "atkRound3" && round === 3) return ["attack"];
  if (id === "noSpeedEarly" && round <= Math.min(3, total - 1)) return STAT_CLASH_STAT_KEYS.filter((k) => k !== "speed");
  if (id === "noHpFinal" && round === total) return STAT_CLASH_STAT_KEYS.filter((k) => k !== "hp");
  if (id === "weakStart" && round === 1) {
    const low = getStatClashLowestStatKey(room.currentStats);
    return low ? [low] : null;
  }
  // mirrorRound4 reste en room.houseRuleShared si shared rules activées
  return null;
}
```

Pour `pressureLate` :
- Option simple : timer divisé par 2 uniquement pour le seat ciblé, mais le serveur résout actuellement avec UN seul `setTimeout` global → faut soit 2 timers, soit accepter compromis "timer global = min des 2 timers".
- Recommandation : commencer par compromis global (`min`), itérer plus tard si besoin.

Pour `blindRound5` :
- Modifier le bloc `if (id === "blindRound5" && round === 5)` dans `startStatClashRound` (~ligne 1101) pour ne forcer l'auto-pick que sur le ou les seats qui subissent cette règle.

Pour les règles symétriques :
- `doubleStat`, `mirrorRound4`, `comboBonus` → conservées via `room.houseRuleShared` si toggle activé. Code existant à adapter pour lire `room.houseRuleShared` au lieu de `room.houseRule` quand pertinent.

### Propagation au client

`publicStatClashRoomState` : remplacer `houseRule`, `houseRuleTargetSide`, `mirrorStatKey`, `doubleStatKey` par les nouveaux champs :

```js
houseRuleBySide: {
  left: room.houseRuleBySide?.left || null,
  right: room.houseRuleBySide?.right || null,
},
houseRuleShared: room.houseRuleShared || null,
houseRuleSharedEnabled: Boolean(room.houseRuleSharedEnabled),
mirrorStatKey: room.mirrorStatKey || null,    // si shared = mirrorRound4
doubleStatKey: room.doubleStatKey || null,    // si shared = doubleStat
pendingImposedRuleBySide: {
  left: room.pendingImposedRuleBySide?.left || null,
  right: room.pendingImposedRuleBySide?.right || null,
},
```

Ne PAS retirer `houseRule` du payload immédiatement : le client lit encore via `roomState.houseRule` en plusieurs endroits, faire la transition progressive.

### UI (script.js + style.css)

- Lobby : nouvelle section "Règles imposées" qui affiche 6 cartes (1 par règle imposable). Click → envoi Socket.io.
- En partie : remplacer le badge "règle maison" actuel par 2 badges visuels : "Tu imposes : [icône] [label court]" et "Tu subis : [icône] [label court]".
- Si toggle shared activé : badge supplémentaire pour la règle commune éventuelle.

### Compatibilité ascendante

- Les rooms en cours au moment du deploy ne doivent pas crasher. Pour ça, `room.houseRule` peut rester en fallback : si `houseRuleBySide` est null/absent (ancienne room), on retombe sur l'ancien comportement.
- Idéalement migrer progressivement : v1 = code accepte les deux formes, v2 = ne lit plus que `houseRuleBySide`.

## Contraintes workflow (à respecter strictement)

1. **Diagnostic avant code** : avant de toucher au code, lis attentivement les fichiers cibles, présente ton plan détaillé (fichiers, fonctions, signatures changées, structure du payload), attends ma validation avant d'écrire.
2. **Pas de refactor opportuniste** : on règle UNIQUEMENT cette feature. Pas de nettoyage de variables globales, pas de migration onclick→addEventListener, pas de découpe de fichier.
3. **Éviter Edit massif** : sur ce projet, l'outil Edit a tendance à tronquer le fichier au-delà de ~200 lignes en un edit. Privilégie Python via bash avec `str.replace` pour les patchs lourds. Toujours `node --check App/script.js && node --check App/server.js` après chaque modif.
4. **Vérifier l'état après écriture** : `wc -l` et `tail -5` du fichier modifié, comparer avec `git show HEAD:App/<fichier> | wc -l` pour détecter une troncature accidentelle. Si troncature → restaurer depuis `git show HEAD:App/<fichier>` et re-appliquer les patches en une seule passe Python.
5. **Exécution groupée par défaut** : prépare un seul bloc PowerShell paste-friendly `git add + commit + push` mono-ligne en messages sans accents. À exécuter depuis la racine du projet (`Codex GPT pokédle`), PAS dans `App/`. Le sandbox bash ne peut PAS faire git commit (bindfs + index.lock fantôme), tous les commits passent par PowerShell côté Windows.
6. **Réponses courtes** : pas de récap inutile après opération git, pas de checklist de vérifs si je ne le demande pas.
7. **IDs nav à préserver** : `nav-config`, `nav-game`, `nav-social`, `nav-collection`, `nav-extras` — ne pas les modifier.
8. **Pas de CSS** `var(--text)` (variable cassée dans le projet). Hardcode les couleurs comme `#12213d` (light) ou `#edf5ff` (dark).
9. **Convention noms FR** : utilise les vrais noms français Pokémon partout (le projet est francophone).
10. **CSP désactivée** : les `onclick=` inline sont autorisés (98 occurrences dans le HTML, on ne migre pas pour cette feature).

## Variables d'environnement

- Render : `ALLOWED_ORIGINS=https://pokdle.onrender.com` (déjà set, ne pas toucher)
- Pas de `.env`, pas de secret à manipuler

## Décisions à clarifier avec Zakaria avant code

1. **Pool des règles imposables** : confirmer 6 règles (`noSpeedEarly`, `atkRound3`, `noHpFinal`, `weakStart`, `blindRound5`, `pressureLate`) ou différent ?
2. **Règles symétriques** : garder ou supprimer (`doubleStat`, `mirrorRound4`, `comboBonus`) ? Si gardées → toggle séparé "Règles maison communes" dans le lobby ? On/off par défaut ?
3. **`pressureLate`** : timer global (min des 2) ou timer par seat (refactor plus lourd) ?
4. **UX sélecteur lobby** : dropdown simple ou grille de 6 cartes interactives (préférable visuellement) ?
5. **Restart en cours de partie** : si le host clique "Nouvelle partie" ou bouge un setting, les choix de règles imposées doivent-ils être reset (probable yes) ?
6. **Mode solo bot** : le bot pick une règle au hasard parmi les 6 imposables, ou la même règle est tirée pour les 2 (équilibrage minimal) ?

## Livrables attendus

- Diff `App/server.js` : nouveau modèle de données + refactor seat-aware + nouveaux events Socket.io
- Diff `App/script.js` : sélecteur lobby + rendering badges + mode solo bot
- Diff `App/style.css` : styles minimum pour le sélecteur et les badges
- Diff `App/index.html` : marquage HTML du sélecteur si nécessaire (sinon généré via innerHTML dans script.js)
- Bloc PowerShell de commit/push final, paste-friendly mono-ligne, message sans accents
- Court paragraphe explicatif (5-10 lignes max) résumant ce qui a changé, à coller dans le commit message

Pas de README, pas de tests automatisés à écrire, pas de migration de données (pas de DB de toute façon).

## Démarrage

Commence par lire :
- `App/server.js` lignes 50-130 (constantes Stat Clash, règles, helpers forced/allowed)
- `App/server.js` lignes 1050-1230 (`startStatClashMatch`, `startStatClashRound`, `resolveStatClashRound`)
- `App/server.js` lignes 1360-1450 (`publicStatClashRoomState`)
- `App/script.js` lignes 720-790 (helpers Stat Clash côté client)
- `App/script.js` lignes 2770-2990 (`startStatClashBotRound`, `useStatClashJoker`)
- `App/script.js` lignes 3250-3320 (`applyStatClashRoomState`)
- `App/script.js` autour de la ligne 3640 (rendu cartes joueur Stat Clash)
- `App/index.html` : chercher `screen-stat-clash`

Présente ton plan détaillé avant le moindre `str.replace` ou Edit. Attends validation explicite.
