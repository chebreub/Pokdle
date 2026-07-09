# Plan d'implémentation — Refonte Home « Direction 1 / Quotidien »

> Plan de mise en œuvre de la maquette `Pokedle Home Redesign.html` (Direction 1).
> **Aucun code n'est écrit ici** — c'est le plan à valider avant de commencer.
> Date : 2026-06-22.

## 0. Constat de départ (bonne nouvelle)

La Direction 1 **conserve l'architecture d'information de ta home actuelle** : mêmes 3 sections (« Jeux phares » / « Univers Pokémon » / « Préparation stratégique »), mêmes modes, mêmes liens, sélecteur de générations en haut. C'est donc un **reskin visuel mobile-first**, pas une refonte de contenu ni de logique. Le risque fonctionnel est faible : on rebranche les mêmes `data-action` sur un nouveau markup + nouveau CSS.

La maquette est en React/Babel avec données factices (Niv. 1 · 120 XP, Série 7, timer figé `08:01:02`, silhouette 149.png). On ne reprend **que le langage visuel** ; les données restent câblées sur ton état existant (série, compte à rebours, niveau, gen active).

### Mise à jour — version desktop reçue (`Pokedle Web Home.html`)

La déclinaison **desktop** existe désormais (elle comblait le seul vrai trou de ce plan). Elle reprend le même langage visuel que D1 en format web : container centré **max-width 1200px**, **grilles CSS multi-colonnes** (`grid-template-columns` + `minmax`) pour les sections de modes, nav complète (Accueil · Classement · Succès inclus), hero « Défi du jour » avec Série + « Jouer maintenant / Reprendre », et bloc « Progression ». Surtout, elle est **plus exhaustive que la maquette mobile** : on y retrouve tout le catalogue (Party, Draft Score Attack, Stat Clash, **Stat Auction**, Higher or Lower, Speedrun, Team Builder, Table des types, Émulateur).

Conséquences sur ce plan : (1) le desktop n'est plus à inventer mais à **transcrire** depuis la maquette → le Lot 7 perd son incertitude ; (2) on prend la **version desktop comme référence d'inventaire** (la plus complète) pour garantir la parité de contenu, la mobile étant la vue resserrée du même contenu.

## 1. Ce qui change visuellement (maquette → existant)

| Élément | Aujourd'hui | Direction 1 |
|---|---|---|
| En-tête | Pokéball + wordmark, pill « Niv. 1 · Recrue » | Idem + **anneau XP conique** compact (niveau au centre) |
| Nav | Barre de pills (Accueil·Jouer·Social·Pokédex·Outils·Succès·Profil) | Pills scrollables horizontales, mêmes entrées |
| Générations | Carte repliée « Gen 1 — 151 · Modifier » | **Chips de gen scrollables** (Gén 1 Kanto … 9 Paldea), état actif bleu, « 3/9 actives » |
| Hero du jour | Carte dégradée + CTA | Dégradé plus vif (rouge→magenta→bleu), chips **Série** (flamme) + **timer**, silhouette flottante en filigrane, gros CTA jaune |
| Cartes de modes | Grilles 3-up de grandes cartes | **Rangées compactes** (tuile-icône + titre + desc + chevron) et mini-bento 2 colonnes |
| Sections | Jeux phares / Univers / Préparation | Identiques (contenu inchangé) |

À noter : la maquette annonce encore « 1025 fiches » (cohérent avec ta home) alors que le Pokédex affiche 1197 — c'est l'occasion d'harmoniser au passage (cf. audit U3). Et la carte Émulateur dit « …ou ta ROM », ce qui va dans le sens du correctif émulateur de l'audit (B1).

## 2. Fichiers concernés

- `App/index.html` — markup de la home (le bloc home dans le fichier unique). C'est là que vit le nouveau HTML.
- `App/home.css` — styles spécifiques home (le gros du travail).
- `App/style.css` et `App/nav.css` — ajustements transverses (variables, nav pills, focus, reduced-motion).
- **Pas de** modification de `server.js`, `script.js`, ni des routes statiques. Aucune nouvelle ressource statique à servir (les icônes sont des SVG inline `<symbol>`/`<use>`, pas d'images à ajouter ; la silhouette réutilise le mécanisme existant du Pokémon du jour).
- Rappel build : `index.html`/CSS sont **régénérés en `dist/` au déploiement** (`build.mjs` via postinstall) — on édite les sources, jamais `dist/`.

## 3. Découpage en lots bornés (1 commit par lot)

**Lot 1 — Fondations CSS (tokens + utilitaires).**
Poser dans `home.css` les variables manquantes (rayons 14/18/26px, ombres `drop-shadow`, dégradés hero, couleurs de tuiles-icônes pastel) et les classes de base (`.home-card`, `.mode-row`, `.icon-tile`, `.pill`, `.chip`). Aucune dépendance, zéro risque.

**Lot 2 — En-tête + nav scrollable.**
Anneau XP conique (conic-gradient câblé sur le niveau réel), nav en pills scrollables. Réutiliser la délégation `data-action` existante des entrées de nav et `aria-expanded` des dropdowns. Garder Succès (la maquette l'omet — on le conserve).

**Lot 3 — Sélecteur de générations en chips.**
Remplacer la carte repliée par la rangée de chips scrollables. **Point clé** : brancher sur la logique de sélection de gen existante (celle qui pilote tous les modes) — ne pas réécrire la logique, juste changer le rendu et l'état actif. Afficher « N/9 actives ».

**Lot 4 — Hero « Pokémon du jour ».**
Nouveau dégradé + chips Série/timer + silhouette en filigrane (via le sprite/silhouette du jour déjà calculé côté client) + CTA. Câbler série, compte à rebours et « Reprendre/Jouer » sur l'état actuel.

**Lot 5 — Sections de modes (Jeux phares / Univers / Préparation).**
Convertir les 3 sections en rangées compactes + mini-bento. Mêmes libellés, mêmes `data-action`/routes qu'aujourd'hui. Harmoniser au passage le compteur Pokédex (1025 vs 1197).

**Lot 6 — Carte progression (bas de home).**
Réaligner la carte stats/niveau sur le nouveau langage visuel (déjà identifiée « fade » dans l'audit U7).

**Lot 7 — Desktop + a11y + polish.**
Voir §4 et §5.

## 4. Points d'attention

- **Inline styles → classes CSS.** La maquette met tout en `style="…"`. À traduire en **classes dans `home.css`**, pour la maintenabilité et par prudence CSP (la politique stricte peut bloquer les styles inline). On reste sur l'approche par classes du site actuel.
- **Pas de handlers inline.** Tous les boutons/cartes passent par la délégation `data-action` (la CSP bloque `onclick=`). Réutiliser les actions existantes.
- **Desktop = transcription, plus invention.** Les deux maquettes (mobile `Pokedle Home Redesign.html` + desktop `Pokedle Web Home.html`) donnent les deux bouts du responsive. À faire : un seul markup home qui sert les deux, avec breakpoints. Cible desktop = container 1200px centré, sections de modes en grille `minmax` multi-colonnes ; cible mobile = chips + rangées empilées. Définir 2-3 breakpoints propres (mobile → ~768px → ~1024px+).
- **Animations + `prefers-reduced-motion`.** La maquette ajoute `pb-bob` (pokéball), `float-y` (silhouette), `pulse-dot` (LIVE), `sheen`. **Les encapsuler dans `@media (prefers-reduced-motion: reduce)`** pour les neutraliser — ça corrige en même temps le point a11y P2 de l'audit (reduced-motion absent de style.css/nav.css).
- **Focus clavier.** Ajouter `:focus-visible` sur chips, pills et rangées (point a11y P3 de l'audit — `nav.css` n'en a pas aujourd'hui).
- **Données réelles, pas factices.** Niveau/XP, série, timer, gen active, « Reprendre ma partie » : tout existe déjà côté client, on rebranche dessus.
- **Police.** Tout en Nunito (la maquette respecte déjà ça) ; ne pas introduire de Press Start 2P.

## 5. Risques & non-régression

- **Sélecteur de gen** = la commande la plus critique (pilote chaque mode). Tester après refonte que changer de gen met bien à jour le pool partout.
- **Vérifier `node --check` n'est pas concerné** (HTML/CSS), mais re-générer le build et **vérifier la fin de `index.html`/CSS après édition** (gros fichiers : éditer via bash/python, pas l'édition directe qui peut tronquer).
- **QA mobile réelle** écran par écran (c'est tout l'intérêt de cette refonte ; l'émulation de viewport n'est pas fiable, à tester sur vrai téléphone).
- **Parité de contenu** : s'assurer qu'aucun mode/lien existant ne disparaît (la maquette omet Succès et certains libellés — on garde l'inventaire complet).
- Workflow : commits bornés par lot depuis PowerShell, **pas de push sans ton accord** (chaque push déploie).

## 6. Estimation indicative

| Lot | Effort |
|---|---|
| 1 Fondations CSS | S |
| 2 En-tête + nav | S |
| 3 Chips générations | M (câblage logique gen) |
| 4 Hero du jour | M |
| 5 Sections modes | M |
| 6 Carte progression | S |
| 7 Desktop + a11y + polish | M |

Globalement **un chantier moyen**, surtout du CSS/markup, faible risque logique. Recommandation : faire les lots **dans l'ordre, sur une branche**, valider chacun en mobile réel avant de pousser. On peut commencer par les lots 1-2-3 (le plus visible : header + gen chips) pour avoir un premier rendu rapide.

---

### Prochaine étape
Si ce plan te va, dis-moi par quel lot tu veux démarrer (je suggère 1→3) et je passe au code — un lot à la fois, sans push tant que tu n'as pas validé le rendu.
