# Audit Pokédle — check-up complet (juin 2026)

> Audit fondé sur le site **live** (pokdle.onrender.com, desktop + image OG), le **code** du dépôt, et l'historique de cette session. Les points « à vérifier sur vrai téléphone » sont signalés car l'émulation mobile n'a pas pu être forcée de façon fiable.

---

## Verdict global

**Le site est en bon état — nettement plus abouti qu'il n'y paraît.** La DA est moderne et cohérente, le SEO et le partage social sont excellents, la sécurité est durcie et les perfs sont optimisées. 

**Le principal frein à la popularité n'est pas le site, c'est l'hébergement** (démarrage à froid Render). C'est là qu'il faut agir en priorité, avant toute campagne de diffusion.

---

## ✅ Points forts (à garder tels quels)

- **DA home moderne et cohérente** : logo en Nunito (plus de pixel), hero « Pokémon du jour » épuré, cartes à liseré dégradé, icônes et tags homogènes, sélecteur de générations **condensé** (« Gen 1 — 151 Pokémon · Modifier »).
- **SEO complet** : `lang`, `description`, `theme-color`, **Open Graph complet** + Twitter card, `canonical`, `robots.txt`, `sitemap.xml`.
- **Image OG générée dynamiquement** (logo + date du jour + silhouette du Pokémon du jour + URL) — partage social vraiment soigné, rare pour un projet perso.
- **Partage de résultat style Wordle déjà implémenté** (grille 🟩🟨 + `navigator.share` + copie presse-papiers) — le moteur viral est en place.
- **Sécurité** : CSP en mode enforce (pas d'`unsafe-inline` script), handlers inline migrés.
- **Perf** : minification JS+CSS au déploiement (esbuild).
- **Données** : 32 coquilles d'accent de noms corrigées, encodage propre.
- Console **sans erreur** sur la home.

---

## 🔴 Priorité 1 — ce qui freine réellement la popularité

### 1. Démarrage à froid Render (~1 min) + `robots` bloquant pendant la veille
- **Constat** : offre gratuite Render → le service **s'endort après 15 min** sans trafic, réveil en **~1 min** avec page de chargement. Pire : **pendant la veille, Render répond `Disallow: all` sur `/robots.txt`** → les moteurs voient « interdit » quand le site dort.
- **Impact** : un nouveau visiteur (et un robot d'indexation) tombe souvent sur ~1 min d'attente → forte perte de conversion et SEO plombé. C'est LE point bloquant pour faire connaître le site.
- **Correctif** : ping de maintien aux heures actives (cron-job.org / UptimeRobot sur `/api/multiplayer/health`, ~toutes les 12 min, ex. 8h-minuit pour rester sous les 750 h/mois), **ou** petit plan payant Render (supprime veille + plafond + souci robots). + **nom de domaine perso** (`.com`/`.fr`) plus crédible que `onrender.com`.

---

## 🟠 Important

### 2. Expérience mobile — à valider sur vrai téléphone
- Gros progrès déjà faits (gen selector condensé, badges de type compacts, header non tronqué, escouade 2 colonnes). Mais à confirmer sur un vrai 390 px :
  - **Nav à dropdowns au survol** (Jouer/Social/Outils) : le survol n'existe pas au doigt — vérifier que les menus s'ouvrent bien au tap.
  - Écrans denses (Pokédex, multijoueur, mini-jeux) au doigt.
- **Action** : une passe sur ton téléphone, écran par écran, et corriger les rares points qui coincent.

### 3. Accessibilité (a11y)
- Peu d'`alt` statiques (les images dynamiques en ont, mais à vérifier partout), états **focus** clavier, **contraste** de certains textes « muets » (gris clair), navigation clavier des dropdowns.
- **Action** : passe a11y ciblée (focus visibles, contrastes AA, aria sur les contrôles custom).

### 4. Poids des assets
- `script.js` (~775 Ko minifié) et `style.css` (~554 Ko minifié) restent **monolithiques et lourds**. La minification aide, mais le vrai levier est la **compression** : vérifier que **gzip/brotli** est bien actif côté Render (réduit ~70-80 % le transfert). Si oui, c'est ok ; sinon, c'est la priorité perf.

### 5. Dette technique / maintenabilité
- `script.js` ~22 000 lignes en variables globales : invisible pour le joueur, mais ralentit toute évolution future et augmente le risque de régression. À découper si le projet continue de grossir (pas urgent).

---

## 🟡 Mineur

- **Press Start 2P** : encore ~15 usages en CSS. Le logo est déjà passé en Nunito (bien). Vérifier qu'aucun ne gêne la lisibilité sur du contenu important (le rétro de l'émulateur, lui, est légitime).
- **Carte de progression (home)** : un peu fade / beaucoup de vide autour ; contraste et densité à resserrer.
- **Émulateur** : bug pré-existant connu — relancer une ROM sans recharger la page → `EJS_STORAGE already declared` → écran noir. 1er lancement après rechargement OK. Fixable en n'injectant `loader.js` qu'une fois.
- Surveiller `style.css` (une fin de fichier avait été tronquée par le passé, corrigée depuis).

---

## ⚡ Quick wins (fort impact / faible effort)

1. **Ping de maintien** aux heures actives (10 min de setup sur cron-job.org). → règle le frein n°1.
2. **Nom de domaine perso** + le brancher sur Render (HTTPS gratuit).
3. **Poster dans les communautés** : Discords Pokémon FR, subreddits, et surtout communautés **VGC / Pokémon Champions** — ton Team Builder orienté VGC (import/export, stats niv. 50, Téra) est un vrai angle d'accroche.
4. **Vérifier gzip/brotli** actif côté Render.
5. **Mettre en avant le partage du résultat** quotidien (déjà codé) pour amorcer la boucle virale.

---

## 🗺️ Feuille de route popularité (ordre conseillé)

1. **Hébergement fiable** (ping ou plan payant) + **domaine perso** — sinon tout le reste fuit.
2. **Passe mobile** sur vrai téléphone (corriger les derniers points).
3. **Distribution** : communautés ciblées + boucle quotidienne partagée bien visible.
4. **A11y + contraste** (élargit l'audience, bon pour le SEO/qualité).
5. (plus tard) **Découpe technique** de `script.js`/`style.css` si le projet continue de grandir.

---

### En une phrase
Le produit et la DA sont au niveau ; la prochaine vraie marche n'est pas « refaire le site » mais **le garder éveillé, lui donner un vrai nom, et aller le montrer aux bonnes communautés**.
