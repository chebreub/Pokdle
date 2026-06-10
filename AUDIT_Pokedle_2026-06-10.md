# Audit technique Pokédle — 10 juin 2026

**Méthode.** Lecture du code réel (Read/Grep + `node --check`), build esbuild reproduit hors projet pour mesurer dist/, vérifications live sur https://pokdle.onrender.com (headers HTTP, requêtes réseau, console, rendu desktop). Le rendu mobile ~390px n'a **pas pu être vérifié en live** (le navigateur a refusé le redimensionnement < ~1568px) : les constats mobile reposent sur l'analyse statique du CSS et sont marqués *(à confirmer au rendu)*. Quatre agents d'exploration ont balayé script.js / server.js / CSS / modes de jeu ; leurs constats clés ont été re-vérifiés manuellement. Chaque point est étiqueté **[vérifié]** ou **[hypothèse]**.

**État au moment de l'audit** : `node --check` OK sur script.js, server.js, pokemon.js, build.mjs, verify-names.mjs. ⚠️ **11 fichiers modifiés non commités** (dont script.js, server.js, style.css, index.html) + 5 fichiers/patches untracked — à committer avant tout nouveau chantier (cf. §1.4).

---

## 0. Vérification du travail récent demandé

| Chantier | Verdict | Preuve |
|---|---|---|
| CSP en enforce | ✅ Sain | server.js:329-333 `reportOnly: false` ; header `content-security-policy` (pas report-only) confirmé en live. `script-src 'self' https://cdn.emulatorjs.org 'wasm-unsafe-eval' 'unsafe-eval' blob:` — pas de `'unsafe-inline'`. **[vérifié]** |
| Migration ~156 handlers inline | ✅ Sain | Aucun `onclick=`/`onerror=`/`oninput=` restant dans index.html ni dans les templates de script.js ; délégation data-action en place, aucune erreur console "Refused to execute inline event handler" au chargement live. **[vérifié]** |
| Minification esbuild | ✅ Sain | build.mjs : `minifyIdentifiers: false` → globals préservés (requis par la délégation `window[nom]`). Build reproduit : script.min.js **781,5 KB** (186,8 KB gzip), pokemon.min.js 220,6 KB (23,4 KB gz), style.min.css **555,9 KB** (91,9 KB gz). Total JS+CSS ≈ **303 KB gzip**. index.html:25-31 et 1431-1433 chargent bien `dist/*.min.*` avec `defer`. Brotli appliqué par le proxy Render (`content-encoding: br` vérifié live). **[vérifié]** |
| Team Builder VGC | ✅ Sain sur le fond | Formule niveau 50 **exacte** (script.js:9683-9687 : HP = floor((2B+IV+floor(EV/4))×50/100)+50+10 ; autres = floor((core+5)×nature), nature 1.1/0.9 via script.js:8970-8977). Type Téra présent (structure slot + import `Gimmick:` script.js:10298-10301). Réserves : import silencieux (§9.6). **[vérifié]** |
| 32 noms corrigés | ✅ Sain | pokemon.js validé programmatiquement : 1025 entrées, 0 mojibake, échantillon d'accents conforme (cf. §8). Commits 133f937 + b4f2fc9. **[vérifié]** |

---

## 1. Architecture & maintenabilité

- 🟠 **Monolithes front** — script.js : 22 899 lignes / 994 KB ; style.css : 28 199 lignes / 742 KB ; ~874 fonctions et ~228 variables top-level globales, état mutable partagé sans encapsulation (partyRoomState, higherLowerState…). **[vérifié — wc/grep]** Impact : toute modification a un rayon d'impact incontrôlable, pas de tests possibles. Correctif : ne pas "big-bang refactorer" — continuer la stratégie de micro-lots ; à moyen terme, découper par écrans en modules ES (le build esbuild le permet déjà avec `bundle:true` en option).
- 🟠 **server.js a grossi à 3 526 lignes** (attendu ~1 400) : tout le moteur multi (duel, party 7 mini-jeux, stat clash, draft battle) vit dans un seul fichier. **[vérifié]** Correctif : extraire chaque mode dans `modes/*.js` (CommonJS, sans risque).
- 🟡 Duplication front : 3 autocomplétions quasi identiques, séries de `render<X>()` clonées. **[hypothèse agent, échantillonné]**
- 🟡 `pokemon.js.bak` (251 KB) traîne dans App/ — bien gitignoré et non déployé (404 live vérifié), mais à archiver hors App/.
- 🟠 **WIP non commité** : `git status` montre 11 fichiers modifiés (.gitignore, build.mjs, index.html, package.json, pokemon.js, script.js, server.js, style.css, home.css, nav.css, party-room.css) + verify-names.mjs et 5 patches untracked. **[vérifié]** Impact : risque de perte / déploiement incohérent (Render déploie le dernier push, pas votre disque). Correctif immédiat : commits bornés par chantier depuis PowerShell (le sandbox ne peut pas commit).

## 2. Sécurité

- 🔴 **Le serveur sert tout App/, y compris son propre code** — server.js:338 `app.use(express.static(__dirname))`. Vérifié en live : `GET /server.js` → 200, `GET /package.json` → 200, `GET /node_modules/express/package.json` → 200. **[vérifié]** Impact : divulgation de toute la logique serveur (anti-triche, validation), de l'arbre de dépendances exact (facilite l'exploitation de CVE), et de tout fichier ajouté par erreur dans App/ à l'avenir (.env, backup…). Aucun secret présent aujourd'hui (grep négatif) — la fenêtre est ouverte, pas encore exploitée. Correctif : créer `App/public/` (index.html, dist/, images, types/) et servir uniquement ce dossier ; ou a minima une denylist (`server.js`, `*.mjs`, `package*.json`, `node_modules`, `*.bak`).
- 🔴 **CSP enforce affaiblie par les besoins d'EmulatorJS** — header live : `script-src … 'unsafe-eval' blob:` + `connect-src … ws: wss:` (schémas génériques = n'importe quel hôte). server.js:287-321. **[vérifié]** Impact : si un XSS passe (ou si le CDN cdn.emulatorjs.org est compromis — pas de SRI), l'attaquant a eval + exfiltration WebSocket vers un hôte arbitraire ; la CSP ne contient plus grand-chose. Correctif : servir l'émulateur sur une page dédiée (`/emulateur.html`) avec sa propre CSP permissive, et durcir la CSP du site principal (retirer `unsafe-eval`, `blob:` de script-src, remplacer `ws: wss:` par `wss://pokdle.onrender.com`).
- 🟠 **CORS Socket.io ouvert par défaut** — server.js:16 `origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : "*"` ; simple `console.warn` ligne 2375-2376. **[vérifié]** Mitigé si la var Render est bien posée, mais un oubli = n'importe quel site peut connecter des sockets. Correctif : en production (`NODE_ENV`), refuser de démarrer sans ALLOWED_ORIGINS.
- 🟠 **Party Guess : la réponse fuite avant le reveal** — server.js:361 `publicPartyGuessRoundState()` envoie `image: room.target.sprite` (URL contenant l'ID du Pokémon) à tous les clients dès le début de manche ; le floutage silhouette/pixelisé est purement client. **[vérifié]** Idem indice via `examples` du Type Combo (server.js:736-739). Correctif : proxifier le sprite (`/api/party/sprite/<roomCode>` qui ne révèle pas l'ID) ou accepter le risque (jeu entre amis).
- 🟡 `frame-ancestors` absent de la CSP (`useDefaults: false`, server.js:330) — mais helmet garde `X-Frame-Options: SAMEORIGIN` par défaut, donc clickjacking couvert sur navigateurs modernes. Ajouter `frameAncestors: ["'self'"]` pour la cohérence. **[vérifié]**
- 🟡 **XSS : globalement sain.** escapeHtml (script.js, définition vers l. 4966) est appliqué systématiquement aux données distantes (pseudos, codes room, chat). Un seul sink non échappé trouvé : `buildComparisonRowHtml()` script.js:6669-6690 (`${pokemon.name}`, `${pokemon.habitat}`…) — données issues de POKEMON_LIST uniquement, donc non exploitable aujourd'hui. À échapper par hygiène. **[vérifié]**
- 🟡 Pas de SRI sur les CDN (fonts, EmulatorJS) — index.html:24, script.js:19163. **[vérifié]**
- ✅ Sain : validation Socket.io côté serveur solide (pseudos/codes room sanitizés, try/catch systématiques autour des handlers, rate limiting par socket + IP, codes room non prévisibles, secret Stat Clash caché jusqu'au reveal, calculs serveur — pas de confiance dans le client pour duel/higher-lower/stat auction). **[agents, spot-checks confirmés]** Réserve 🟡 : validation métier plus lâche sur `battleState` du Draft Battle et contrôle de taille de payload appliqué inégalement selon les modes. **[hypothèse agent]**

## 3. Performance

- 🟠 **Aucun cache navigateur sur les assets** — `cache-control: public, max-age=0` sur dist/*.min.* (vérifié live) : 780 KB de JS revalidés à chaque visite (les 304 observés sauvent la bande passante mais pas la latence : ~10 requêtes bloquantes par visite). **[vérifié]** Correctif : `express.static(dir, { maxAge: "7d" })` + (mieux) hash dans le nom de fichier au build pour `immutable`.
- 🟠 **~288 requêtes au premier chargement de la home**, dont ~190 appels PokeAPI (un par méga/forme alt : venusaur-mega, charizard-mega-x…) via `resolveExtraFormSprites()` script.js:861-905, plus des doublons (pokemon/93 appelé 3×). **[vérifié live]** Le cache localStorage évite la récidive, mais chaque nouveau visiteur (ou cache vidé) martèle PokeAPI (fair-use) et ralentit le premier rendu. Correctif : générer un `forms.json` statique au build (script type verify-names.mjs) et supprimer ces fetchs runtime ; dédupliquer les appels pokemon/{id}.
- 🟠 style.min.css 556 KB (92 KB gz) pour un site de ce périmètre : énorme ; lié à la dette §6. Chargé en bloc et render-blocking (7 feuilles, index.html:25-31). **[vérifié]**
- 🟡 genbar.png 394 KB + typebar.png 873 KB (App/) référencés par le partage de classement (script.js:6877-6878) — 1,2 MB pour une feature secondaire ; convertir en WebP (~-80 %). **[vérifié]**
- 🟡 Pokédex : 1025+ cartes DOM d'un coup, sans pagination/virtualisation (`renderPokedexGrid()` script.js:11035-11087) ; `loading="lazy"` présent sur les images (ce qui sauve le réseau). Fluide sur desktop moderne, lourd sur mobile bas de gamme. **[vérifié partiellement]**
- 🟡 ~13 setInterval/setTimeout sans clear systématique (45 créations / 32 clears) — surtout des timers courts ; pas de fuite majeure identifiée. listeners recréés à chaque render d'autocomplete (annulés par le reset innerHTML). **[hypothèse agent, ordre de grandeur vérifié]**
- ✅ Sain : minification efficace, defer sur les scripts, preconnect fonts/PokeAPI/CDN (index.html:19-23), Brotli via Render.

## 4. Robustesse serveur

- ✅ Sain dans l'ensemble **[agents + spot-checks]** : try/catch autour des handlers socket (pas de crash process sur payload malformé), cleanup des rooms à 60 s, gestion déconnexion duel correcte (server.js:1466-1475, 3118-3135 : victoire à l'adversaire restant + `duel:room-closed`), génération de codes room sans collision, états sérialisés sans fuite du secret (server.js:2973 : `targetRevealed` seulement si `finished`).
- 🟠 **Pas de grace period de reconnexion** : une coupure réseau de 2 s en duel = défaite immédiate. **[hypothèse agent — handleDisconnect ne marque pas de délai, à confirmer]** Correctif : timer de 15-30 s avant de déclarer forfait.
- 🟡 Comportement Party Room flou si un joueur non-host quitte en cours de manche (server.js:829+) ; doublons de pseudos possibles dans une room. **[hypothèse agent]**
- 🟡 Pas de rate limiting HTTP (seulement Socket.io) ; surface faible (statique + 1 endpoint health), acceptable. **[vérifié]**
- 🟡 Tout l'état est en mémoire (assumé) : un redeploy Render coupe toutes les parties en cours sans message dédié côté client. Correctif léger : écran "le serveur a redémarré" sur `disconnect` + `connect_error`.

## 5. Mobile / responsive (~390 px) — *statique, non vérifié au rendu*

- 🟠 **Dropdowns de nav au `:hover`** sans fallback tactile complet détecté (pas de `@media (hover: none)` dans nav.css). Sur iOS le premier tap déclenche le hover, mais le comportement est fragile. **[hypothèse — à confirmer au rendu]** Correctif : toggle au click + `aria-expanded`.
- 🟠 Couverture des breakpoints irrégulière (trou ~560-640 px signalé) ; quelques largeurs fixes > 390 px dans les écrans multi/stat clash. **[hypothèse agent]**
- 🟡 Cibles tactiles : plusieurs boutons compacts (badges, croix) sous les 44 px recommandés dans les media queries mobiles. **[hypothèse agent]**
- ✅ Travail mobile récent visible (commits "Mobile vague 1/2", grille générations compacte, escouade 2 colonnes) ; la home desktop est propre (vérifiée live, aucune erreur console).
- **Recommandation** : une passe de QA manuelle réelle sur téléphone (ou DevTools device mode) écran par écran reste indispensable ; cet audit n'a pas pu la faire.

## 6. UX / DA / Accessibilité

- 🟠 **`var(--text)` toujours cassée** : `--text: #eaf5ff` définie par le thème orphelin "POKE SKY / ARCADE" (style.css ~l.2214) avec encore **21 usages** (17 style.css, 3 pokedex.css, 1 multiplayer.css) → texte quasi blanc sur fond clair par endroits. **[vérifié — grep]** Correctif : purger le thème orphelin et remplacer les 21 `var(--text)` par une couleur sombre explicite (convention projet déjà actée).
- 🟠 **Focus clavier supprimé sans remplacement** (`outline: none` style.css:967, 1474 sans `:focus-visible`) — navigation clavier aveugle, WCAG 2.4.7 KO. **[hypothèse agent, lignes citées]** Correctif : `:focus-visible { outline: 2px solid #2f76ff }` global.
- 🟠 `prefers-reduced-motion` ignoré (classe manuelle `.reduce-motion` au lieu du media query) alors que le site anime beaucoup (pokeball, hovers, gradients). **[hypothèse agent]**
- 🟡 1 231 `!important` dans les CSS — symptôme de cascade dégradée, rend chaque fix mobile plus coûteux. **[vérifié par agent — comptage]**
- 🟡 Contrastes : gris-bleu clairs (#bdd0e8, #c8d2ff) sur blanc ≈ 2,1-2,5:1 (AA exige 4,5:1) sur des textes secondaires. **[hypothèse agent]**
- 🟡 Press Start 2P encore chargée (index.html:24) pour quelques anciens card-titles — DA à trancher : soit l'assumer sur 2-3 titres, soit la retirer (gain réseau + cohérence).
- 🟡 ARIA quasi absent des composants dynamiques (dropdowns, modales, toasts) ; les toasts ne sont pas annoncés (`aria-live`). **[hypothèse]**

## 7. SEO & diffusion

- ✅ Bonnes bases : title, meta description, Open Graph + Twitter cards, `lang="fr"`, viewport, theme-color, favicon (index.html:4-17). **[vérifié par agent]**
- 🟠 **robots.txt et sitemap.xml absents** (404 vérifiés en live). Correctif : 2 fichiers statiques, 15 min.
- 🟡 Pas de `<link rel="canonical">` ; SPA mono-URL = un seul document indexable, pas d'OG par mode. Acceptable pour un projet perso ; si ambition de diffusion : pré-rendu de pages d'atterrissage par mode (/pokedex, /duel…) + domaine propre (pokdle.onrender.com → un .fr/.com améliore partage et mémorisation).
- 🟡 og:image : vérifier qu'elle pointe vers une URL absolue accessible (les crawlers ne résolvent pas les chemins relatifs). **[à confirmer]**

## 8. Intégrité des données (pokemon.js)

Validation programmatique complète (script Node exécuté sur le fichier réel) — **tout est vert** :

| Contrôle | Résultat |
|---|---|
| Nombre d'entrées | 1025 exactement, IDs 1→1025 sans trou ni doublon |
| Types | 100 % dans les 18 types FR valides (type1 et type2) |
| Générations | 100 % cohérentes avec les bornes officielles d'ID (Gen 1: 1-151 … Gen 9: 906-1025) ; `gen` ≡ `generation` partout |
| Taille/poids/stage | Tous > 0 ; stage ∈ {1,2,3} partout |
| Habitat/couleur | Aucun manquant ; 9 habitats, 10 couleurs canoniques |
| Sprites | 1025/1025 URLs conformes au pattern PokeAPI avec ID correspondant |
| Noms | 0 doublon, 0 mojibake, accents conformes sur échantillon (Florizarre, Ectoplasma, Amphinobi, Mimiqui, Pêchaminus…) |

🟡 Seule réserve : les formes alternatives (id ≥ 20000) ne sont pas dans pokemon.js mais hydratées au runtime via PokeAPI (cf. §3) — leur intégrité dépend du réseau du client. **[vérifié]**

## 9. Qualité mode par mode

1. **Quotidien** — ✅ Seed déterministe sur date **UTC** (script.js:19335-19347) : même Pokémon pour tous, reproductible (pool trié par id, formes alt exclues). Restore de partie sain (clé jour comparée, script.js:19501-19504). Streak correcte (19371-19389). 🟠 Entièrement calculé côté client → spoilable en console (`getDailyPokemon()`) ; acceptable pour un jeu casual, le corriger impose un endpoint serveur. 🟡 Le daily ignore volontairement le filtre générations (pool = `POKEMON_LIST.slice()`, script.js:2059-2063) — cohérent (cible mondiale unique) mais à expliciter dans l'UI pour éviter la confusion. **[vérifié]**
2. **Mini-jeux** — ✅ Silhouette/Pixelisé simples et sains ; Quiz sans dépendance réseau ; Description avec fallback. 🟡 Cri : erreur réseau et blocage autoplay indistincts, message générique (script.js:6074-6108). 🟡 Légère divergence speedrunNormalize (supprime les tirets) vs norm() (les garde) — sans bug avéré car appliquée aux deux côtés de la comparaison (script.js:5089 vs 19592-19596). **[vérifié par agent]**
3. **Duel 1v1** — ✅ Sain : validation serveur, déconnexion gérée, feedback construit côté serveur (server.js:908-924, 3439+). 🟠 Pas de grace period (cf. §4).
4. **Party Room** — ✅ Flux OK. 🟠 Fuite du sprite pre-reveal (cf. §2). 🟡 Départ d'un non-host en cours de manche à clarifier.
5. **Stat Clash** — ✅ Égalités bien gérées (manche nulle, tiebreaker aux manches, draw final avec XP réduite — script.js:3439-3463) ; stats cachées jusqu'au reveal côté serveur. **[vérifié par agent]**
6. **Team Builder** — ✅ Formule lvl 50 exacte, natures OK, Téra présent (cf. §0). 🟠 Import FR : texte malformé normalisé **en silence** (EVs > 252 clampés sans avertissement, Pokémon inconnus ignorés silencieusement — script.js:10276-10361, 8573-8587) ; afficher un récap d'import ("4/6 importés, EVs ajustés").
7. **Pokédex** — ✅ Recherche insensible aux accents, formes régionales affichées. 🟡 1025 nœuds d'un coup (cf. §3).
8. **Émulateur** — ✅ ROMs fournies par l'utilisateur via `<input type="file">` + blob local : posture légale correcte, rien côté serveur (script.js:18986-19003). 🟡 Watchdog 12 s si le CDN EmulatorJS rame ; erreur CORS confondue avec 404 (script.js:19149-19177). C'est lui qui impose `unsafe-eval` à tout le site (cf. §2 🔴).
9. **Draft Arènes** — ✅ Logique badges/8 arènes cohérente (script.js:18068-18187). 🟠 **Progression non persistée** : aucun save localStorage trouvé pour draftArenaState → refresh = run perdu. **[vérifié — grep négatif]**

## 10. Bugs concrets reproductibles

1. 🟠 Refresh en plein run Draft Arènes → progression et badges perdus (aucune persistance, §9.9).
2. 🟠 N'importe qui télécharge le code serveur : ouvrir `https://pokdle.onrender.com/server.js` (§2).
3. 🟠 Party silhouette/pixelisé : onglet Réseau → URL du sprite → ID → nom du Pokémon avant le reveal (§2).
4. 🟠 Console sur la home → `getDailyPokemon().name` → réponse du jour (§9.1).
5. 🟡 Premier chargement (cache vide) : ~190 requêtes PokeAPI visibles dans l'onglet Réseau, dont triplons `pokemon/93` (§3).
6. 🟡 Texte illisible partout où `var(--text)` est encore utilisé sur fond clair (21 occurrences, §6).
7. 🟡 Team Builder : importer un set avec `EVs: 400 Atk` → accepté sans message, clampé à 252 (§9.6).
8. 🟡 Navigation clavier : Tab ne montre aucun focus sur une partie des contrôles (§6).

---

## Synthèse

| Sévérité | Nombre | Domaines |
|---|---|---|
| 🔴 Critique | **2** | Exposition du code serveur via express.static ; CSP vidée de sa substance par unsafe-eval/blob:/ws: global |
| 🟠 Important | **13** | CORS fallback *, fuite sprite party, daily spoilable, cache-control 0, ~190 fetchs PokeAPI, var(--text), focus clavier, reduced-motion, dropdowns tactiles, import TB silencieux, draft non persisté, pas de grace period, WIP non commité, robots/sitemap |
| 🟡 Mineur | **~15** | XSS interne comparateur, SRI, !important ×1231, contrastes, Press Start 2P, images PNG lourdes, Pokédex non virtualisé, timers, normaliseurs divergents, cri UX, ARIA, canonical… |

**Verdict global** : le socle récent est sain — CSP enforce réelle, migration data-action complète, minification efficace, données 100 % propres, serveur multi robuste et bien validé. Les deux vrais problèmes sont des décisions d'architecture de service (dossier statique, périmètre CSP), pas des bugs de code.

## TOP 5 actions prioritaires (impact / effort)

1. **Servir un dossier public/ au lieu de `__dirname`** — 🔴, ~1-2 h. Ferme l'exposition de server.js / package.json / node_modules. Aucun risque fonctionnel si la liste des fichiers publics est exhaustive (index.html, dist/, *.png, types/).
2. **Committer le WIP en lots bornés** — 🟠, ~30 min. Préalable à tout le reste ; 11 fichiers en suspens est le plus gros risque opérationnel immédiat.
3. **Cache headers sur dist/** (`maxAge` 7 j + hash de build pour immutable) — 🟠, ~1-2 h. Gain perçu à chaque visite récurrente, quasi gratuit.
4. **forms.json généré au build** pour remplacer les ~190 appels PokeAPI runtime — 🟠, ~3-4 h. Premier chargement plus rapide, respect du fair-use PokeAPI, formes alt fiables hors ligne.
5. **Purge var(--text) + thème POKE SKY orphelin + focus-visible global** — 🟠, ~2-3 h. Trois fixes CSS courts qui éliminent le bug visuel connu et le pire point a11y.

**Chantier de fond à planifier (pas en quick-win)** : isoler l'émulateur sur sa propre page/CSP pour retirer `unsafe-eval`, `blob:` et `ws:`/`wss:` génériques du site principal (🔴 n°2) — ~1 journée, à faire après les points 1-5.

## Feuille de route proposée

- **Lot A — Hygiène (1 soirée)** : commits WIP → dossier public/ → robots.txt + sitemap → headers de cache.
- **Lot B — Perf premier chargement (1 soirée)** : forms.json au build, dédup des fetchs PokeAPI, genbar/typebar → WebP.
- **Lot C — CSS/a11y (1-2 soirées)** : purge var(--text) + thème orphelin, :focus-visible, @media prefers-reduced-motion, contraste des textes secondaires, fallback tactile des dropdowns + QA mobile réelle écran par écran.
- **Lot D — Durcissement (1 journée)** : émulateur isolé + CSP stricte, refus de démarrer sans ALLOWED_ORIGINS en prod, frame-ancestors, proxy sprite party (optionnel), grace period de reconnexion.
- **Lot E — Confort joueur (au fil de l'eau)** : persistance Draft Arènes, récap d'import Team Builder, messages cri réseau vs autoplay, virtualisation Pokédex.
- **Lot F — Dette long terme** : découpage progressif de script.js/server.js par modes, normaliseur de noms unique partagé client/serveur, réduction des !important.

*Aucune modification n'a été apportée au code. Les patches/correctifs attendent validation du plan.*
