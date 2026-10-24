Priorité avant la suite de l'étape 1 : refaire la liste des modes (écran « Tous les jeux ») pour qu'elle donne envie, comme la grille de quiz de Pokequizz. Ne change aucun moteur de jeu : uniquement le catalogue, ses cartes et les cartes de l'accueil. Montre-moi une capture de 2 ou 3 cartes avant de tout décliner.

Référence visuelle jointe : captures « Catalogue des jeux » (bureau et mobile) de la maquette. Reproduis cette carte :
- zone pastel à pois, grand sprite centré ;
- accessoire de mécanique dans une pastille blanche arrondie en bas à droite ;
- badge blanc en haut à gauche (« Du jour », « Défi du jour », « Nouveau ») ;
- famille en petites capitales colorées, titre, phrase, difficulté en points + libellé, « Jouer → » coloré, record éventuel en dessous.

## Constat (capture du 9/10)
- Deux systèmes visuels sans rapport :
  - 3 grandes scènes peintes (Pokémon du jour, Connections, Draft) ;
  - puis des petites cartes de type « réglages » : barre colorée sur le bord gauche, icône à gauche répétée dans une mini-vignette à droite, sprites minuscules, flèche « → » minuscule en haut à droite.
- Les familles (DEVINER, RÉFLEXION…) sont dans une colonne à gauche qui mange la largeur.
- Les cartes « Choisis ton jeu » de l'accueil sont déjà plus belles (Zoom avec la loupe, Cri avec l'onde, grand sprite sur pastel) : le catalogue utilise un autre composant.
- Référence : la grille de Pokequizz. Une seule carte pour tous les quiz : grand Pokémon sur dégradé pastel de sa couleur, titre, une phrase, pastille, « Jouer → ».

## Cible : UNE carte de mode, partagée par l'accueil et le catalogue
- **Zone visuelle** (≈150 px de haut sur ordinateur, ≈100 px sur mobile) :
  - fond pastel de la couleur du mode + texture à pois discrète, coins arrondis à l'intérieur de la carte ;
  - le **Pokémon mascotte** du mode en grand (≈120 px, artwork officiel déjà utilisé), légère ombre portée ;
  - un **objet qui montre la mécanique**, dessiné dans le composant (SVG ou CSS), pas une image générée : loupe, onde sonore, grille de pixels, lignes de texte, barres de stats, chaîne →, numéros 001→003, « TYPE + TYPE », balance, flèches ↑↓, chrono, cartes de draft…
- **Corps** :
  - famille en petites capitales, dans la couleur du mode ;
  - titre (Fredoka ≈20 px) ;
  - une phrase ;
  - pied de carte : difficulté en 1 à 4 points, « Ton record : … » s'il existe, et « Jouer → » dans la couleur du mode.
- **Badges optionnels** : « Du jour » pour les épreuves de la journée, « Nouveau ». Plus de badge « Expérimental » : un mode inachevé n'apparaît pas.
- **Effets** : la carte monte de 6 px au survol avec une ombre plus grande, le sprite rebondit légèrement. Respecter « réduire les animations ».
- **Supprimer** : la barre de couleur latérale, l'icône de gauche en double, la mini-vignette, la flèche en haut à droite.

## Mise en page du catalogue
- En haut :
  - titre « Jouer » + une phrase ;
  - pastilles Tous / Deviner / Réflexion / Arcade / Stratégie / Entre amis, avec le nombre de jeux ;
  - champ de recherche ;
  - bouton « Filtres » qui ouvre un panneau Difficulté + Générations (au lieu de les afficher en permanence).
- **Bannière « À la une »** (optionnelle) : une seule des 3 illustrations existantes, en format large (≈21:9, ≈220 px de haut), texte sur un dégradé, bouton Jouer. Elle change chaque semaine. Ne plus utiliser ces illustrations comme cartes.
- Sections par famille : titre de section (« Deviner · 6 jeux ») au-dessus d'une grille de 3 colonnes (2 sur mobile, avec la description masquée sur mobile pour garder des cartes compactes).
- **Ordre** :
  1. Deviner : Pokémon du jour, Illimité, Zoom, Pixelisé, Description, Cri, Stat mystère.
  2. Réflexion : Poké-Connections, Intrus, Quiz, Évolution, Ordre Pokédex, Combo de types.
  3. Arcade : Duel de poids, Higher or Lower, Speedrun, Marathon.
  4. Stratégie : Draft (une seule entrée, variantes à l'intérieur).
  5. Entre amis : Party Room (une seule porte).
- Les 3 illustrations peuvent aussi servir d'image d'aperçu (OG) quand on partage le lien de ces modes.

## Mascotte et couleur proposées par mode
Ajuste si un sprite rend mal, mais garde une seule mascotte par mode, réutilisée partout (carte, pastille du classement, écran de jeu) :

| Mode | Mascotte | Couleur |
|---|---|---|
| Pokémon du jour | silhouette « ? » + loupe (ou Forgerette du jour une fois trouvé) | jaune Daily |
| Illimité | Métamorph | normal / beige |
| Zoom progressif | Caméléon (Kecleon) avec loupe, comme sur l'accueil | psy / rose |
| Pixelisé | Porygon | bleu ciel |
| Description | Motisma (Rotom) | électrik / jaune pâle |
| Cri | Pijako (Chatot) avec onde, comme sur l'accueil | vert menthe |
| Stat mystère | Mackogneur | combat / corail |
| Poké-Connections | les Évolitions | rose |
| Intrus | Zorua | ténèbres / mauve gris |
| Quiz | Alakazam | psy / lilas |
| Évolution | Magicarpe → Léviator | eau / bleu |
| Ordre Pokédex | Bulbizarre (n° 001) | plante / vert |
| Combo de types | Lokhlass | glace / turquoise |
| Duel de poids | Ronflex | beige |
| Higher or Lower | Chenipan et Tyranocif, comme sur l'accueil | vert |
| Speedrun | Ninjask | insecte / vert anis |
| Marathon | Tauros | orange |
| Draft | Lucario | acier / bleu gris |
| Party Room | Pikachu et ses amis | lavande |

## Validation
- La même carte sur l'accueil et dans le catalogue.
- Plus aucune barre latérale ni vignette en double.
- Chaque carte ouvre le bon jeu.
- Captures 1366×768 et 390×844 du catalogue complet et de l'accueil.
- Aucun débordement, sprites nets (pas d'upscale flou), contraste du texte ≥ 4,5:1.
