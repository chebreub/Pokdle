# Audit Pokédle — 2026-06-22

> Audit fondé sur un **test live réel** de pokdle.onrender.com (navigateur Chrome, console + réseau) et sur la **lecture du code** (`App/src/`, `server.js`, CSS). Modes parcourus en live : Pokémon du jour, Score Attack, Score Attack PRO (jusqu'à la finale), mini-jeu Zoom, Pokédex, Team Builder, Émulateur, Party Room (création + socket), Classement. Les modes Duel 1v1 / Stat Clash / Stat Auction ont été validés au niveau **infrastructure** (socket, menus) mais pas en partie réelle à 2 joueurs.

## Verdict global

Le site est **solide et abouti** : DA moderne et cohérente, modes nombreux et réellement fonctionnels, sécurité durcie, backend live (auth Discord + Postgres + classement) qui dépasse ce que décrit la doc projet. Le site était **éveillé** aujourd'hui (pas de cold start subi).

Trois choses méritent l'attention en priorité : **l'émulateur est cassé pour les ROMs par défaut** (404), **le mode PRO perd son identité visuelle** pendant le draft, et il reste une **dette perf/a11y** (assets lourds, `prefers-reduced-motion` quasi absent malgré la doc).

---

## 1) Bugs

**B1 — [Élevé] Émulateur : les ROMs par défaut renvoient 404.**
Le menu propose « Pokemon Rouge Feu (FR) (GBA) » et annonce « ROMs détectées : Rouge Feu, Vert Feuille, Platine », mais au lancement l'émulateur affiche **« Network Error »** / écran noir. Réseau : `GET /roms/Pokemon - Version Rouge Feu (FR).gba` → **404**. Côté serveur, **aucune route `/roms` ni dossier `App/roms/`** n'existe (le service statique restreint ne monte que `/dist`, `/types`, `/img`). Conséquence : seul « Charger une autre ROM » (fichier local) fonctionne. À noter : héberger ces ROMs serait de toute façon un problème de **copyright** — le bon correctif est de **retirer la liste de ROMs par défaut** et de ne proposer que le chargement local (avec un message clair).

**B2 — [Moyen] Émulateur : relance sans rechargement (`EJS_STORAGE already declared`).**
Bug pré-existant connu (loader.js EmulatorJS injecté plusieurs fois → écran noir à la 2ᵉ relance sans reload). Non reproductible aujourd'hui (la ROM 404 avant), mais le code reste exposé. Fix : n'injecter le loader qu'une seule fois, ou nettoyer le contexte EmulatorJS entre deux lancements.

**B3 — [Moyen] Score Attack PRO perd son identité après la sélection de génération.**
À l'entrée du mode, le titre affiche « 🔥 SCORE ATTACK PRO » et le sous-titre « run à bonus ». Mais **dès qu'on choisit une génération**, le titre repasse à « 🎯 Draft Score Attack » et le message redevient celui du mode normal. Cause : `selectDraftGeneration()` réécrit `draftArenaState.message` sans tenir compte de `scoreAttackPro` et re-monte la carte sans rappeler `syncScoreAttackProUI()`. Les bonus PRO **s'appliquent quand même** à la finale (météo + dresseur + évolutions, vérifié : +40/+35, « Nouveau record PRO »), mais pendant tout le draft **rien ne distingue PRO du mode normal** → le joueur croit s'être trompé de mode.

**B4 — [Faible] Message « Encore 1 choix » périmé à la finale PRO.**
Quand l'équipe atteint 6/6 et que le panneau « Bonus de fin de draft » s'affiche, le bandeau indique encore « Pokémon ajouté. Encore 1 choix. » (désynchronisation du message d'état).

**B5 — [Faible] Mini-jeu Zoom : première vue quasi entièrement noire.**
La zone zoomée initiale peut tomber sur une portion sombre/vide du sprite : au 1er essai l'indice est inexploitable (carré noir). Envisager de cadrer le zoom initial sur le barycentre des pixels non transparents.

**B6 — [Faible] Émulateur en anglais.** Console : « Missing language fr !! » — EmulatorJS ne trouve pas le pack FR, l'UI de l'émulateur reste en anglais.

---

## 2) UX / DA / cohérence entre modes

**U1 — Nommage des modes incohérent.** « Party Room » (home + menu Social) vs « Party Pokémon » (menu Jouer) pour le même mode ; le badge « PRO » qui disparaît (cf. B3). Uniformiser un libellé unique par mode partout.

**U2 — Taxonomie de navigation dispersée.** Les modes 1v1 sont répartis entre **Jouer** (Draft Score Attack, PRO) et **Social** (Duel 1v1, Stat Clash 1v1, Stat Auction 1v1), avec recouvrement conceptuel. « Stat Auction 1v1 » n'apparaît **nulle part sur la home**. Difficile de cartographier l'offre. Piste : regrouper tous les « 1v1 » sous une même entrée, et exposer Stat Auction sur la home s'il est prêt (sinon le marquer « beta »).

**U3 — Compteur Pokédex incohérent.** La home annonce « 1025 fiches », le Pokédex affiche « 1197 / 1197 affichés » (formes alternatives incluses). Harmoniser le discours (« 1025 Pokémon + 167 formes »).

**U4 — Vignette manquante dans l'autocomplétion.** Dans le champ de réponse, la **forme de base** (ex. Dracaufeu) n'a pas de sprite alors que les Méga X/Y en ont. Incohérence visuelle.

**U5 — Pseudo tronqué dans le lobby Party.** « TestAudit » (9 caractères) s'affiche « Test… » sur la carte joueur : la largeur de carte/ellipsis coupe trop tôt.

**U6 — Latence d'animation perçue comme un clic raté.** Sur le draft, le slot d'équipe apparaît ~1 s après le clic ; un joueur (et moi) peut croire que le clic n'a pas fonctionné et recliquer. Donner un retour immédiat (état pressé / skeleton de slot).

**U7 — Carte de progression de la home un peu fade** (beaucoup de vide, contraste faible) — déjà relevé précédemment, toujours valable.

**Points forts confirmés en live :** onboarding « Comment jouer ? » clair, grille d'indices (type/gen/taille/poids avec flèches ↑↓) réutilisée de façon cohérente entre quotidien et mini-jeux, Team Builder VGC très complet (objet, 4 attaques, nature/EV/IV/Téra, détection de rôles, analyse de types/immunités), Pokédex riche (filtres types/gen/catégorie, comparateur), création de Party Room instantanée avec code + 5 modes.

---

## 3) Perf / accessibilité

**P1 — Assets monolithiques lourds.** `script.min.js` **884 Ko** + `style.min.css` **641 Ko** + `pokemon.min.js` **226 Ko** ≈ **1,75 Mo non compressé**, chargés intégralement même pour une simple partie quotidienne. La compression **gzip est active** (middleware `compression`), ce qui ramène le transfert à ~250–400 Ko — correct, mais **pas de brotli** (gain ~15–20 % supplémentaire possible) et **aucun code-splitting / lazy-load** par mode.

**P2 — `prefers-reduced-motion` quasi absent.** Présent **uniquement dans `party-room.css`** (1 occurrence) ; **absent de `style.css` et `nav.css`** qui portent pourtant les animations (pokéball du header, hovers de cartes, transitions). La doc projet affirme « `prefers-reduced-motion` respecté » → ce n'est plus le cas globalement. Accessibilité vestibulaire à rétablir.

**P3 — A11y à reprendre.** Peu d'`alt` statiques (7 dans `index.html`), `nav.css` sans `:focus-visible` (navigation clavier des dropdowns), contrastes des textes « muets » gris clair à passer en AA. `style.css` a bien 49 `:focus-visible` globaux (bon socle), mais la nav n'en bénéficie pas.

**P4 — Cold start Render** (rappel de l'audit précédent) : toujours d'actualité même si non subi aujourd'hui. Ping de maintien (cron-job.org / UptimeRobot sur `/api/multiplayer/health`) ou petit plan payant.

**Sécurité (état sain, à ne pas régresser) :** pas de `express.static(__dirname)` ; double CSP enforce (permissive seulement sur `/emulateur`) ; `escapeHtml()` largement utilisé (~296 appels) ; `sanitizeNickname()` (trim 24, strip `<>"'\`` et caractères de contrôle) ; validation socket (payload max 64 Ko, tailles de room, regex uid). **Nouveauté non documentée** : auth Discord + Postgres (Neon) + classement live — à ajouter à la doc projet (qui dit encore « pas de base de données ») et à vérifier côté **rate-limiting** des routes `/auth/*` et `/api/*`.

**Hygiène repo :** WIP non commité (`M server.js`, `pokemon.js`, plusieurs CSS) → divergence local/déployé ; fichiers `*.patch` et `draft-pro-trainers-BROUILLON.js` traînent à la racine. À ranger/committer ou supprimer.

---

## 4) Propositions priorisées (impact vs effort)

| # | Action | Impact | Effort | Priorité |
|---|--------|:------:|:------:|:--------:|
| 1 | **Émulateur** : retirer la liste de ROMs par défaut (404 + copyright), ne garder que « Charger une ROM locale » + message clair | Élevé | Faible | 🔴 Faire d'abord |
| 2 | **Mode PRO** : faire persister titre/badge + message PRO après sélection de génération (appeler `syncScoreAttackProUI()` dans `selectDraftGeneration`, message conditionnel) | Moyen | Faible | 🔴 |
| 3 | **Nommage unique** par mode (Party Room/Pokémon, badge PRO) + corriger compteur « 1025 vs 1197 » | Moyen | Faible | 🔴 |
| 4 | **`prefers-reduced-motion`** dans `style.css`/`nav.css` (désactiver pokéball + transitions) | Moyen (a11y) | Faible | 🟠 |
| 5 | **A11y nav** : `:focus-visible` sur les dropdowns + `alt`/aria sur images clés ; passe contraste AA | Moyen | Moyen | 🟠 |
| 6 | **Émulateur** : n'injecter `loader.js` qu'une fois (fix `EJS_STORAGE`) + pack langue FR | Faible | Faible | 🟠 |
| 7 | **Taxonomie nav** : regrouper les 1v1, exposer/étiqueter Stat Auction | Moyen | Moyen | 🟠 |
| 8 | **Détails finale PRO** : message « Encore 1 choix » → état « équipe complète » ; retour immédiat au clic de draft | Faible | Faible | 🟡 |
| 9 | **Mini-jeu Zoom** : cadrer le zoom initial sur les pixels visibles du sprite | Faible | Moyen | 🟡 |
| 10 | **Perf** : brotli côté Render + amorcer un lazy-load par mode (gros chantier, plus tard) | Moyen | Élevé | 🟡 |
| 11 | **Hygiène repo** : committer/ranger le WIP, supprimer les `.patch` et le BROUILLON | Faible | Faible | 🟡 |
| 12 | **Cold start** : ping de maintien aux heures actives (rappel) | Élevé (acquisition) | Faible | 🔴 (hors-code) |
| 13 | **Doc** : mettre à jour la doc projet (BDD/auth Discord/classement désormais en place) | Faible | Faible | 🟡 |

### Ordre conseillé
1. **Quick wins rouges** (#1, #2, #3, #12) : corrigent un mode cassé et deux incohérences visibles, pour un effort minime.
2. **Passe a11y** (#4, #5, #6) : faible effort, élargit l'audience et tient la promesse de la doc.
3. **Cohérence & finition** (#7, #8, #9).
4. **Chantiers de fond** (#10 perf, #11 hygiène, #13 doc) quand le reste est stabilisé.

---

### En une phrase
Le produit tient la route et la plupart des modes fonctionnent réellement bien ; les gains rapides à viser sont **réparer/clarifier l'émulateur**, **rendre le mode PRO reconnaissable pendant le draft**, et **rattraper la dette a11y** — tout cela à faible effort.
