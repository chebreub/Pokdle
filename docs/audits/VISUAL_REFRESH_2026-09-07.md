# Refonte graphique du 7 septembre 2026

## Objectif et changements

Uniformiser une interface dont les modes accumulaient des styles différents, tout en améliorant la lisibilité sur mobile.

- Couche graphique commune `App/visual-refresh.css`, compilée et versionnée par le build existant.
- Palette bleu nuit, surfaces sobres, actions principales bleues et défis mis en avant en jaune ; variantes claires et sombres.
- Typographie Inter pour les interfaces, Nunito pour les titres ; polices de secours système.
- Accueil, navigation, catalogue des modes, écrans de devinettes, Pokédex, Draft, Builder, panneaux multijoueurs, profil et fenêtres harmonisés.
- Higher or Lower : comparaison côte à côte et deux actions accessibles à 320 px.
- Poké-Connections : noms plus grands, retour à la ligne, sélection bleue ; couleurs de réussite/échec conservées dans les jeux.
- Speedrun : accueil compact sur mobile. Barres d’actions adaptatives, sans libellés tronqués dans le Builder.
- Suppression des reflets décoratifs du Pokédex et correction de textes du Draft/Builder en thème sombre.
- Onglet Profil activé lors de l’ouverture du profil.

## Vérifications réalisées

Build de production et 12 tests Node réussis ; `git diff --check` sans erreur.

Contrôles dans un navigateur avec fenêtres intégrées de 320, 390 et 1280 px (barre de défilement du navigateur incluse) :

| Écran | Contrôle |
| --- | --- |
| Accueil / tous les modes | Lisibilité, organisation du catalogue, navigation de bureau sur une ligne à 1280 px |
| Higher or Lower | Lancement infini, réponse correcte et score ; comparaison complète à 320 px sans débordement de page |
| Poké-Connections | 16 tuiles, noms, sélection et état des actions à 390 px |
| Silhouette | Lancement du mode et affichage de la saisie |
| Speedrun | Présentation du lobby et accès au démarrage |
| Pokédex | Catalogue et thème sombre ; suppression des reflets vérifiée dans les styles |
| Draft Score Attack | Sélection Gen 1, choix d’Électhor, score 580 et équipe 1/6 ; lecture en thème sombre |
| Team Builder | Thèmes clair/sombre, largeur de page, puis contrôle des cinq actions après adaptation |
| Profil / paramètres | Carte dresseur, changement de thème, onglet Profil actif après correction |

Les vérifications responsive ne constituent pas un essai sur un téléphone physique. Aucun parcours Discord authentifié, match multijoueur complet ni chargement de ROM n’a été effectué pour cette refonte. Le déploiement Render est distinct de la compilation locale et de la fusion GitHub.
