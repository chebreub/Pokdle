# Audit du projet Pokédle

Audit réalisé sur le dossier `App/` (index.html, style.css, script.js, server.js, pokemon.js).
Le site est un Pokédle complet (devine du jour, défis, multijoueur 1v1 temps réel via Socket.io,
mode Stat Clash, Draft Arènes, Team Builder, Pokédex, succès, profil, émulateur ROM, etc.).
C'est un projet impressionnant en termes de fonctionnalités. Voici ce qui marche bien et ce qui mérite d'être nettoyé.

## TL;DR — état général

- **Fonctionnalités** : très riche, beaucoup de modes de jeu, multijoueur réel fonctionnel.
- **Backend** : globalement propre, avec rate-limiting, validation et nettoyage des entrées.
- **Frontend** : massif (script.js ≈ 700 KB, 17 362 lignes ; style.css ≈ 609 KB, 26 481 lignes), avec des problèmes structurels notables — surtout **29 fonctions JS dupliquées** dont des versions entières inutilisées qui restent dans le bundle.
- **Données** : roster Gen 1-9 complet (1025 Pokémon, 0 doublon), mais 14 noms ont du **mojibake** (`??lectrode` au lieu de `Électrode`) et **63 % des habitats sont "Rare"** ce qui rend cet indice presque inutile dans le jeu.

## 1. HTML (index.html, 63 KB, 1 292 lignes)

Points positifs :
- `<html lang="fr">`, viewport, favicon SVG inline, preconnect vers les CDN d'images / fonts / PokéAPI / emulatorjs : bon réflexe perf.
- 19 attributs ARIA présents (aria-label, aria-modal, role=dialog, aria-live), donc une accessibilité de base.
- Footer mentionne PokéAPI : bon crédit.

Points à revoir :
- **98 `onclick="..."` inline** : couplage rigide HTML ↔ JS, impossible à appliquer une CSP stricte, dur à refactor. À remplacer petit à petit par `addEventListener` (déjà 62 dans le JS).
- **Aucune balise meta description / Open Graph / Twitter cards** : si tu partages le lien, l'aperçu sera vide. À ajouter (10 minutes de travail, gros impact visuel quand quelqu'un envoie le lien sur Discord ou WhatsApp).
- Tous les écrans (`screen-config`, `screen-game`, `screen-profile`, `screen-pokedex`, `screen-team-builder`, `screen-multiplayer`, etc.) sont présents dans le DOM dès le chargement et juste masqués par `.hidden`. Le HTML initial est donc plus lourd que nécessaire. Acceptable pour l'instant, mais à garder en tête si tu sens un ralentissement au premier rendu.
- Pas de balise `<noscript>` : si JS est désactivé, l'utilisateur ne voit rien. Un petit message suffirait.
- Pas de skip-link "Aller au contenu principal" pour les utilisateurs clavier.

## 2. CSS (style.css, 609 KB, 26 481 lignes)

Points positifs :
- Variables CSS bien posées sur `:root` (couleurs, radius).
- 105 media queries : responsive sérieusement pris en compte (900px, 700px, 640px, 960px, etc.).
- Thème sombre via `body.theme-dark` — bon point.
- 67 transitions et 52 animations : feedback visuel soigné.

Points à revoir :
- **867 occurrences de `!important`** : signe d'une guerre de spécificité chronique. C'est le signe que l'architecture CSS s'est fragmentée au fil des refactos. À terme, viser une convention BEM ou un préfixe par composant et nettoyer la cascade.
- **2 288 valeurs en `px` codées en dur** : utiliser `rem` au moins pour les tailles de police permettrait de respecter le réglage de zoom système des utilisateurs malvoyants.
- Le fichier est monolithique. Pour la lisibilité (pas pour le runtime), même en restant en pur CSS, tu pourrais l'éclater en plusieurs fichiers thématiques (`base.css`, `game.css`, `pokedex.css`, `team-builder.css`, `multiplayer.css`) et les `@import` ou les concaténer.
- Le fichier n'est pas minifié. En prod, un simple `cssnano` ou équivalent diviserait la taille par ~3.

## 3. JavaScript client (script.js, 699 KB, 17 362 lignes)

C'est ici que se trouvent les findings les plus impactants.

### 3.1 Bug réel : 29 fonctions déclarées deux fois

`grep -oE "^function [a-zA-Z0-9_]+" script.js | sort | uniq -c | sort -rn | awk '$1>1'` retourne **29 doublons**. Comme JS écrase la première déclaration `function foo()` par la seconde, les premières versions sont du **code mort** qui pollue le bundle. Liste partielle :

```
createMultiplayerRoom     — ligne 16180 (morte) et 17113 (active)
joinMultiplayerRoom       — ligne 16218 (morte) et 17143 (active)
submitMultiplayerGuess    — ligne 16249 (morte) et 17179 (active)
leaveMultiplayerRoom      — ligne 16288 (morte) et 17255 (active)
openMultiplayerMode       — ligne 16311 (morte) et 17276 (active)
copyMultiplayerRoomCode   — ligne 16306 (morte) et 17265 (active)
renderMultiplayerPlayers  — ligne 15963 (morte) et 16697 (active)
renderMultiplayerBotResult — ligne 16060 (morte) et 16846 (active)
renderMultiplayerBotScreen — ligne 16083 (morte) et 16992 (active)
renderMultiplayerGenerationSummary — 16035 (morte) et 16674 (active)
filterMultiplayerGuessAC  — deux versions
+ 13 fonctions Stat Clash dupliquées (getStatClashPool, createStatClashState,
  resetStatClashRuntime, trackStatClashTimeout, animateStatClashScores,
  pickStatClashStat, runStatClashRandomizer, openStatClashMode, etc.)
+ getDraftSimpleBattleStatusShortLabel (8994 et 11275)
```

Recommandation prioritaire : supprimer les versions inutilisées (en général les plus anciennes). Si tu hésites, commente la première et vérifie que le mode multijoueur / Stat Clash tourne toujours — si oui, c'était bien du code mort.

### 3.2 Surface XSS potentielle

`grep -c innerHTML script.js` → **139 occurrences**. Beaucoup injectent des noms de Pokémon ou des pseudos joueurs. Tu as bien une fonction `escapeHtml()` (ligne 4966) — il faut vérifier qu'elle est utilisée **systématiquement** quand tu injectes une valeur venant d'un joueur (pseudo, message, code de room). À auditer en particulier dans :
- `renderMultiplayerPlayers`, `renderMultiplayerAttempts`, `renderTeamBuilderSummary`, et toutes les fonctions qui injectent un `player.nickname`.
- Côté serveur, `sanitizeNickname` retire déjà `< > " ' \` et caractères de contrôle, ce qui est une bonne ceinture — mais combiner ceinture (serveur) et bretelles (escape côté client) reste la règle d'or.

### 3.3 Couplage UI ↔ JS

98 `onclick` dans le HTML pointent vers des fonctions globales (`startNormalGame()`, `openMultiplayerMode()`, etc.). Toutes les fonctions sont en variables globales. Conséquences :
- Pollution du `window` (très facile à détecter avec `Object.keys(window)` en console).
- Pas possible d'activer une CSP `script-src 'self'` qui bloquerait les `onclick=` inline.
- Refactor difficile : impossible de renommer une fonction sans `grep` global sur le HTML aussi.

À terme : passer en delegated `addEventListener` (ou data-action) avec un router central. Pas urgent mais structurant.

### 3.4 Pas de modules / pas de tests

- Tout est en variables globales, un seul fichier de ~700 KB. Aucun ES module, aucun split.
- Aucun test unitaire visible. Vu la richesse du jeu (Stat Clash, Draft Arènes, builder…), des tests sur les fonctions pures (`compare`, `compareColors`, `cmpNum`, `arrowFor`, `normalizeName`, table des types) seraient un investissement très rentable.

### 3.5 Petits points

- 27 `console.log/warn/error` qui pourraient être gardés derrière un flag debug.
- 0 commentaire TODO/FIXME (positif ou symptôme d'oubli, à toi de voir).

## 4. Backend (server.js, 54 KB, 1 405 lignes)

C'est la partie la plus solide du projet. Bon niveau pour un projet perso.

Points positifs :
- **Rate limiting par catégorie** (room-join, guess, pick, action, gen-update, restart, commit) avec fenêtres glissantes.
- **Sanitization** : `sanitizeNickname` (retire < > " ' \` et caractères de contrôle, taille 24), `sanitizeRoomCode` (uppercase, A-Z0-9 seulement), `normalizeSelectedGens` (cast entier, plage 1-9).
- **Anti-payload-bomb** : `PAYLOAD_MAX_BYTES = 64_000` avec `isPayloadOversized`.
- **Autorité serveur sur le secret** : le Pokémon mystère n'est révélé qu'à la fin de la manche (`targetRevealed` n'est rempli que si `room.status === "finished"`).
- **Codes de room sans ambiguïté** : alphabet sans 0/O ni 1/I.
- **Cleanup des rooms après déconnexion** : `scheduleRoomCleanup` à 60s.
- **Cache LRU borné** pour les stats PokéAPI (`STAT_CLASH_STATS_CACHE_MAX = 1500`).
- **Timeout fetch externe** : 8s avec `AbortController` — évite les requêtes pendantes.
- Health endpoint `/api/multiplayer/health`.

Points à revoir :
- **CORS ouvert par défaut** : si `ALLOWED_ORIGINS` n'est pas défini, `origin: "*"`. Tu logues bien un warning, mais en prod il vaut mieux refuser au démarrage plutôt que de servir tout le monde. Au minimum garder le warning bien visible et vérifier qu'il est défini sur le serveur de prod.
- **Pas de helmet / headers de sécurité** : ni CSP, ni `X-Frame-Options`, ni `Strict-Transport-Security`. `app.use(helmet())` ajouterait tout ça en une ligne.
- **Lecture du JS frontend dans le backend** : `loadStatClashExtraFormsConfig` fait `fs.readFileSync('script.js')` + regex + `vm.runInContext` pour extraire `EXTRA_FORMS` et `FORM_API_NAME_BY_NAME`. Ça marche, mais ça couple les deux côtés. Mieux : extraire ces deux structures dans un fichier `data/extra-forms.json` lu par les deux.
- **Parsing de pokemon.js par regex** : `raw.match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)` est fragile si tu changes le formatage. Idem, un fichier `pokemon.json` à côté serait plus robuste, et `pokemon.js` ne ferait que `const POKEMON_LIST = require('./pokemon.json')` (ou `window.POKEMON_LIST = ...` côté client).
- **Rate limit par socket.id** : un client malveillant peut se reconnecter pour reset son bucket. Pour un usage perso/amical c'est OK ; pour un site public, indexer aussi par IP via `socket.handshake.address`.
- **Aucune persistance** : tout est en mémoire (`rooms`, `statClashRooms`, `draftBattleRooms`). Si le serveur redémarre, toutes les rooms tombent. Pour un site perso c'est très bien — juste à savoir.

## 5. Données (pokemon.js, 245 KB, 1 025 entrées)

Très bon état général :
- 1 025 Pokémon, IDs 1 à 1 025, **0 doublon** d'id ou de nom.
- Tous les champs obligatoires présents pour chaque ligne (`id, name, type1, type2, gen, generation, habitat, color, stage, height, weight, sprite`).
- `gen` et `generation` sont toujours cohérents.
- Comptage par génération conforme au Pokédex officiel (1:151, 2:100, 3:135, 4:107, 5:156, 6:72, 7:88, 8:96, 9:120).
- Tous les sprites pointent sur le CDN PokeAPI/sprites.
- Heights et weights dans des bornes plausibles.

À corriger :
- **14 noms cassés (mojibake)** : `??lectrode`, `??lekid`, `??crémeuh`, `??lecsprint`, `??crapince`, `??oko`, `??tourmi`, `??tourvol`, `??touraptor`, `??cayon`, `??lekable`, `??caéd`, `??kaéser`, `??thernatos`. Le serveur les répare via `NAME_OVERRIDES` au chargement, mais c'est un patch à chaud. Le mieux serait de réenregistrer le fichier en UTF-8 avec les vrais caractères accentués (Élec…, Étour…, Écré…, etc.). Le fichier commence d'ailleurs par un BOM (`﻿`).
- **Habitat "Rare" appliqué à 649 / 1 025 Pokémon (63 %)** : cet indice n'apprend plus rien au joueur dans la plupart des parties. Soit en diversifier la valeur (Grotte, Ville, Volcan, Toundra, etc.), soit l'utiliser uniquement comme indice secondaire et le pondérer dans la difficulté.
- Distribution des stages (1: 541, 2: 363, 3: 121) cohérente avec la réalité Pokémon — pas d'alerte.

## 6. Outils & build

- `package.json` minimal : seul script `start`. Pas de `lint`, `test`, `build`.
- `node_modules/` versionné dans le repo (les `.git` et `Old/Archive/Data` sont bien dans `.gitignore`, mais `App/node_modules` ne l'est pas). À ajouter à `.gitignore` et nettoyer du git.
- Aucun bundler/minifier. Pour un prochain déploiement public, esbuild ou parcel feraient le travail en quelques secondes et diviseraient la taille téléchargée par ~3.
- Aucun README. Une page courte avec "npm install / npm start / ouvrir localhost:3000" + variables d'env utiles (`PORT`, `ALLOWED_ORIGINS`) suffirait.

## Recommandations priorisées

1. **Nettoyer les 29 fonctions JS dupliquées** dans `script.js` (purement gratuit en taille de bundle et en clarté). *Effort : 1 à 2h.*
2. **Réparer le mojibake** des 14 noms dans `pokemon.js` et déplacer `NAME_OVERRIDES` à la poubelle. *Effort : 15 min + tests.*
3. **Diversifier `habitat`** dans `pokemon.js` pour que ce ne soit pas "Rare" à 63 %. *Effort : 1-2h ou un script qui dérive l'habitat de la PokéAPI.*
4. **Ajouter `helmet()` + meta Open Graph + description** dans index.html. *Effort : 20 min, gros impact sécurité + partage.*
5. **Mettre `App/node_modules/` dans `.gitignore`** et le retirer du repo. *Effort : 2 min.*
6. **Auditer les `innerHTML`** qui injectent des `player.nickname` et autres entrées utilisateur, et systématiser `escapeHtml`. *Effort : 1h.*
7. **Extraire `EXTRA_FORMS` et `POKEMON_LIST` dans des JSON** lus par les deux côtés. *Effort : 1h.*
8. **À moyen terme** : éclater `script.js` en modules ES, ajouter quelques tests sur les fonctions de comparaison, remplacer les `onclick=` inline. *Effort : weekend.*

## Sources

[index.html](computer://C:\Users\chahi-za\Documents\Zak perso\Jeux pokémon\Projet Jeux Pokdle\Codex GPT pokédle\App\index.html) · [server.js](computer://C:\Users\chahi-za\Documents\Zak perso\Jeux pokémon\Projet Jeux Pokdle\Codex GPT pokédle\App\server.js) · [script.js](computer://C:\Users\chahi-za\Documents\Zak perso\Jeux pokémon\Projet Jeux Pokdle\Codex GPT pokédle\App\script.js) · [style.css](computer://C:\Users\chahi-za\Documents\Zak perso\Jeux pokémon\Projet Jeux Pokdle\Codex GPT pokédle\App\style.css) · [pokemon.js](computer://C:\Users\chahi-za\Documents\Zak perso\Jeux pokémon\Projet Jeux Pokdle\Codex GPT pokédle\App\pokemon.js)
