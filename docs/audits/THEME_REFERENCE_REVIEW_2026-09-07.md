# Thèmes et références visuelles — 7 septembre 2026

## Problème corrigé

Le cadre et la navigation restaient bleu nuit lorsque les réglages indiquaient
« Clair ». Le Draft associait ainsi un entourage sombre à des panneaux clairs.
Une règle historique `-webkit-text-fill-color: #fff !important` rendait également
son titre blanc sur un bandeau mauve pâle, malgré une propriété `color` foncée.

## Comparaison de sites de jeux

Les pages d'accueil ci-dessous ont été consultées et inspectées visuellement.
Les enseignements sont des choix de conception pour Pokédle, pas des mesures
d'efficacité ni une invitation à copier leurs éléments graphiques.

| Référence | Observation | Enseignement retenu |
| --- | --- | --- |
| [Poki](https://poki.com/fr) | Fond cyan et mosaïque de vignettes de jeux, avec des commandes sobres. | Porter la variété par les cartes et les visuels plutôt que par un cadre sombre omniprésent. |
| [PokeDoku](https://pokedoku.com/) | Environnement clair, accents rouge/jaune, grille de jeu centrale et navigation courte. | Donner la priorité à la zone de jeu et au contraste du contenu. |
| [Skribbl](https://skribbl.io/) | Fond bleu illustré, logo et avatars dessinés, actions Jouer et Créer une partie immédiatement identifiables. | Garder une identité ludique reconnaissable et une action principale claire. |

Gartic Phone a renvoyé un blocage Cloudflare dans le navigateur de vérification.
Il n'a pas été retenu pour les conclusions visuelles ; aucune tentative de
contournement n'a été effectuée.

## Changements

- Le fond, la navigation, le pied de page, le catalogue des modes et le cadre du
  Pokédex suivent les variables du thème sélectionné.
- En clair : fond bleu pâle, navigation claire et textes foncés. En sombre :
  surfaces foncées et textes clairs. Le choix existant dans les réglages est conservé.
- Les cartes d'accueil gardent leurs familles de couleurs dans les deux thèmes.
  Les illustrations Pokémon et le bandeau du défi quotidien restent les points
  de repère visuels.
- Le bandeau de score du Draft suit le thème. Les noms sur les cartes, les
  emplacements d'équipe et leurs libellés reçoivent des couleurs cohérentes.
- La couleur de remplissage des titres est explicitement synchronisée avec leur
  couleur de texte. Les barres décoratives qui chevauchaient les titres des
  panneaux du Draft sont retirées.
- Les panneaux opaques du Draft n'utilisent plus le filtre d'arrière-plan hérité.

## Vérification

Contrôles réalisés dans un navigateur sur la compilation de production, avec
une page de test intégrant le site à différentes largeurs CSS. Il ne s'agit pas
d'une émulation iOS ni d'une validation sur téléphone physique.

- Draft Score Attack à 1280 px : titre foncé lisible en clair, score et panneaux
  adaptés en sombre. Une sélection de Pokémon met bien le score à 525 et
  l'équipe à 1/6.
- Draft après les dernières corrections à 390 px en sombre : sprites et noms
  visibles, cartes sombres, bordures de rareté conservées.
- Draft à 320 px en clair : largeur de page et largeur de contenu égales à
  320 px ; pas de débordement horizontal. Remplissage et couleur du titre
  calculés tous deux à `rgb(23, 37, 61)`.
- Accueil à 390 px : fond et barre de navigation clairs, bandeau illustré et
  cartes de couleur visibles.
- Pokédex à 390 px en clair : grille sur deux colonnes, sprites, noms et types
  visibles ; largeur de page et de contenu égales à 390 px.
- Recherche « sa » à 390 px : Salamèche, Chrysacier, Sabelette et Sablaireau
  lisibles. Fond des suggestions `rgb(248, 251, 255)`, noms et remplissage
  `rgb(23, 37, 61)`, sous-titres `rgb(93, 108, 130)`.
- Bascule des réglages entre clair et sombre et persistance du choix au
  rechargement contrôlées.
- `node build.mjs` et `git diff --check` réussis.

Cette vérification cible le thème et les régressions visuelles signalées.
Elle ne constitue pas un nouvel audit fonctionnel de tous les modes multijoueurs.
