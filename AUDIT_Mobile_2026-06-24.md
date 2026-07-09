# Audit mobile — Pokédle (2026-06-24)

> Audit réalisé sur le **rendu mobile réel** (Chrome device mode, largeur **390px**), mode par mode. Les captures correspondantes ont été partagées en direct dans la conversation. Périmètre : **version mobile uniquement** — le format desktop reste inchangé (la DA desktop sera revue plus tard d'après les maquettes Claude design).

## Verdict global

Bonne surprise : le site est **déjà nettement plus adapté au mobile que prévu**. Il dispose d'une **barre d'onglets fixe en bas** (Accueil · Jouer · Pokédex · Duel · Profil) qui remplace la nav du haut à ≤640px, et de media queries sur la plupart des écrans. La majorité des modes sont **fonctionnels** sur téléphone. Il ne s'agit donc pas de « tout repenser », mais de **corriger des points précis** pour que ce soit nickel.

Échelle utilisée : 🟢 OK · 🟡 fonctionne mais à améliorer · 🔴 cassé / à retravailler.

---

## Home — 🟢 OK (corrigée aujourd'hui)

- En-tête mobile propre : **logo + Paramètres (+ compte)** ; l'œuf XP et Aide sont masqués sur mobile (quêtes accessibles via le widget plus bas, « Comment jouer ? » via le hero).
- Nav du haut cachée → **barre d'onglets en bas** active.
- Chips de générations qui s'enroulent, **hero empilé** (médaillon mystère centré), **cartes de modes en rangées compactes** (icône + texte).

Rien à faire de plus côté home mobile.

---

## Pokémon du jour (jeu) — 🟢 OK

- Champ « Tape un nom de Pokémon » + bouton **Deviner** pleine largeur, **Abandonner** : parfaitement utilisables.
- La **grille de comparaison** (Génération / Forme / Type 1 / Type 2 / Habitat / Couleur / Stade / Hauteur / Poids) se **réorganise en tuiles sur plusieurs lignes** (label + valeur + couleur) au lieu d'un tableau horizontal. C'est bien pensé pour le mobile.
- À améliorer (mineur) : les tuiles sont un peu **denses**, et « Habitat / Lieux » contient un texte long qui serre. On pourrait réduire légèrement la police des tuiles et tronquer les lieux.

---

## Tous les modes — 🟢 OK

- **Grille 2 colonnes** par catégorie (Deviner · Réflexion · Arcade · Stratégie · Social · Collection). Lisible et tactile. Rien à signaler.

---

## Pokédex — 🟡 fonctionne mais à corriger

- **Grille** des Pokémon en **2 colonnes** (sprite, n°, nom, types) : bien.
- **Bugs sur la barre de filtres** :
  1. Le menu **« Toutes les catégories »** s'affiche **anormalement haut** (~200px de hauteur) sur mobile — bug de rendu du `<select>`.
  2. Le **double sélecteur de types** (« Tous les types + Tous les types ») **déborde horizontalement** (barre de défilement) — peu pratique au doigt.
- **Panneau de détail** (fiche Pokémon) : sur desktop c'est un panneau latéral à droite ; sur mobile il faut s'assurer qu'il **s'empile sous la grille** ou s'ouvre en **modale plein écran** au tap (à vérifier/retravailler).

**À repenser pour mobile** : refondre la **barre de filtres** en vertical (recherche + génération + catégorie + types empilés, sélecteurs natifs à hauteur normale), et faire de la **fiche détail une vue dédiée/modale** au tap d'un Pokémon.

---

## Draft Score Attack — 🟡 fonctionne mais à améliorer

- L'écran **s'empile correctement** : sélection de génération en **grille 2 colonnes**, zone de draft, **équipe en 2 colonnes** (6 slots).
- Les **cartes de la vague** (Pokémon à drafter) passent en **1 seule colonne, grandes** → beaucoup de scroll pour voir les 6 options.
- Les BST / raretés s'affichent correctement (le correctif anti-flash s'applique aussi ici).

**À améliorer pour mobile** : passer les cartes de draft en **2 colonnes** (cartes plus compactes) pour réduire le scroll et voir plusieurs options d'un coup.

---

## Stat Clash 1v1 — 🟡 fonctionne, à resserrer

- L'écran de **configuration** est empilé et utilisable : « Partie rapide », bascule **Vs Bot / Room 1v1**, FORMAT, BOT, cases à cocher, **Lancer vs bot**.
- À resserrer : le bouton **« Lancer vs bot » chevauche un peu** la case « Règle commune » (même ligne, un peu serré) → les mettre sur des lignes séparées en mobile.
- **À vérifier** : l'**écran de jeu** lui-même (duel de stats avec les 2 Pokémon + grille de stats à choisir) n'a pas été testé en partie réelle — c'est la partie la plus à risque en mobile (grille de stats potentiellement large). À auditer en lançant une partie vs bot.

---

## Récapitulatif priorisé (mobile)

| # | Écran | Problème | Priorité | Effort |
|---|-------|----------|:--------:|:------:|
| 1 | Pokédex | `<select>` catégories trop haut + double sélecteur de types qui déborde | 🔴 | Faible |
| 2 | Pokédex | Fiche détail → vue dédiée/modale au tap (au lieu du panneau latéral) | 🟠 | Moyen |
| 3 | Draft Score | Cartes de la vague en 2 colonnes (moins de scroll) | 🟠 | Faible |
| 4 | Stat Clash | Lancer vs bot / case « Règle commune » sur lignes séparées | 🟡 | Faible |
| 5 | Stat Clash | Auditer + adapter l'écran de **jeu** (grille de stats) en partie réelle | 🟠 | À évaluer |
| 6 | Pokémon du jour | Tuiles de comparaison un peu denses (police + lieux) | 🟡 | Faible |

### Ordre conseillé
1. **Quick wins Pokédex** (#1) — bugs visibles de filtres, faible effort.
2. **Draft cards 2 colonnes** (#3) + **Stat Clash setup** (#4) — faible effort, gros confort.
3. **Fiche Pokédex en modale** (#2) + **écran de jeu Stat Clash** (#5) — un peu plus de travail.
4. **Polish tuiles** Pokémon du jour (#6).

---

### En une phrase
Le mobile est **déjà fonctionnel** grâce à la barre d'onglets et aux media queries existantes ; il reste surtout à **corriger les filtres du Pokédex**, **densifier les cartes de draft**, et **vérifier l'écran de jeu Stat Clash** pour que tout soit parfait — sans toucher au desktop.
