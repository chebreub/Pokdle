Tu travailles sur mon dépôt Pokédle (HTML/CSS/JS + server.js). Objectif : appliquer la refonte « Pokédle cosy » validée en maquette, sans réécrire le site ni changer les règles de jeu. Les captures de la maquette sont jointes : elles sont la référence visuelle, pas du code à copier (la maquette utilise un autre système de composants et des données d'exemple).

## Direction
Fusion de l'identité Pokédle (Poké Ball rouge, bleu = action, jaune = Pokémon du jour) et de l'ambiance douce et organisée de Pokequizz : fond crème, cartes blanches très arrondies, pastels par type, sprites en grand, une seule « coque » de page de jeu réutilisée par tous les modes, classements qui s'enchaînent avec les jeux.
Déco (étoiles, bulles, animations) limitée à l'accueil et au Daily. Le jeu reste prioritaire sur le mignon.

## 1. Tokens (à poser une fois en variables CSS, puis à utiliser partout)
- Fond `#FFF8EF` + motif à pois discret `radial-gradient(#F3E4D0 1.2px, transparent 1.3px)` 26px ; surface `#FFFFFF` ; sable `#FBEFE0` ; filet `#F0E2CF`
- Encre `#2E2A33` ; texte secondaire `#776B63` (4,9:1 sur le crème) ; texte sur pastel `#5E5568`
- Action bleu `#4069E0` (ombre `#2F51B8`) ; Daily jaune `#FFD45C` (ombre `#E0A82A`, texte encre) — jaune RÉSERVÉ au Daily
- Party lavande `#EFE8FF` / bouton `#7C5BD6` ; rose `#FFE4EC` (accent) ; Poké Ball `#F0524A`
- Résultats de jeu : exact `#7ED3A0` texte `#0E3F25` ; partiel ou proche `#FFD66B` texte `#5C3D00` + rayures diagonales légères ; différent `#CFC7BD` texte `#2E2A33`. Jamais la couleur seule : coche, rayures, flèches.
- Polices : Fredoka (titres uniquement, 600) + Nunito (tout le reste : indices, scores, commandes). Google Fonts.
- Rayons : cartes 22–30px, cases de jeu 16px, boutons pilule 999px. Boutons « gelée » : fond plein + `box-shadow: 0 4px 0 <ombre>`, léger translateY au survol/clic.
- Tailles mini : 16px texte courant, 12px libellés (jamais 9–10px), cibles tactiles 44px.

## Règles anti-fouillis (priorité absolue, elles passent avant tout le reste)
1. Une seule chose à faire par écran de jeu : carte d'indice → tableau → saisie. Pendant la partie, AUCUN classement, ligue, bannière, barre latérale ou promo d'autre mode.
2. Tous les modes « devine le Pokémon » (Pokémon du jour, Illimité, Zoom, Pixelisé, Description, Cri, Stat mystère, Combo de types) partagent LE MÊME tableau de comparaison que le Daily après chaque mauvais essai. Seule la carte d'indice du haut change selon le mode. Un seul composant, réutilisé.
3. Une couleur par mode, utilisée à deux endroits seulement : la pastille du mode et le bouton/visuel de la carte d'indice. Le reste de la page reste neutre (crème, blanc, encre).
4. Même vocabulaire et mêmes règles visibles partout : « JOUR #n », « ESSAIS x/6 », série 🔥, « Du jour / Illimité », « Comment jouer ? ».
5. Un seul écran de fin pour tous les modes (voir ci-dessous).
6. Avant d'ajouter un élément à un écran de jeu, se demander s'il aide à trouver le Pokémon. Sinon, il va sur l'accueil ou le profil.

## 2. Coque de page de jeu (commune à TOUS les modes)
Ordre vertical, colonne centrée (~1000px) :
1. Barre : « ← Retour » à gauche · au centre pastille du mode (couleur du mode), bouton « Comment jouer ? » (ouvre une aide en 3 étapes repliable, pas une page), sélecteur « Du jour / Illimité » · à droite compteur « ESSAIS x/6 » et série 🔥 en pastilles blanches.
2. « JOUR #278 » (petites capitales) + une phrase de consigne.
3. Carte d'indice centrale blanche (contenu propre au mode : carnet d'enquête, image zoomée, stats, cri…).
4. Tableau / liste des essais, ordre chronologique, le plus récent juste au-dessus de la saisie.
5. Champ de saisie + suggestions (sprite + nom + logos de types).
6. Légende courte, puis lien « Astuces pour ce jeu : lire le guide ».
Exemples de cartes d'indice : Daily = carnet d'enquête ; Cri = gros bouton pilule « Jouer le cri » (rejouable à volonté, « casque recommandé ») ; Zoom = image recadrée + paliers ; Stat mystère = barres des 6 stats + total ; Description = texte Pokédex avec le nom masqué. En dessous, toujours le même tableau de comparaison.
Fin de partie (même composant pour tous les modes), dans cet ordre :
1. « Bravo ! » (ou « Raté, c'était… ») + points gagnés en grand (« +7 pts ») avec un « ? » qui explique le calcul.
2. Fiche du Pokémon : sprite, nom, « #0094 · Spectre / Poison ».
3. 4 compteurs en cartes : Parties, Victoires, Série 🔥, Meilleure série.
4. Boutons : Partager · Classement du jour (ton rang et tes 2 voisins) · Jeu suivant → (le mode suivant). C'est ce qui enchaîne les modes.

## 3. Pokémon du jour (règles inchangées)
- Garder EXACTEMENT le comparateur actuel : 9 critères Gén., Type 1, Type 2, Habitat, Couleur, Stade, Taille, Poids, Forme ; taille « proche » à ±0,3 m et poids à ±15 kg (`cmpNum`), types inversés = partiel, `altForm` conservé.
- Colonnes : case Pokémon blanche (sprite + nom) puis 9 cases colorées. Types : logo rond + nom visible en 11–12px dessous (pas seulement au survol). Second type absent : rond en pointillés.
- Flèches avec infobulle explicite : « Le Pokémon recherché est plus lourd / plus grand / plus évolué / plus récent ».
- Carte centrale = « Carnet d'enquête » : tampon « DÉFI N°278 », emplacement silhouette (débloquée au 5ᵉ essai), puces « Ce que tu sais déjà » déduites des essais (✓ Habitat : Grotte, Poison est son 2ᵉ type, Taille : 1,5 m, Poids entre 7,5 et 48 kg…), puis objectif personnel atteignable + record du jour.
- Messages selon l'état : avant de jouer « Record du jour : N essais » ; pendant « Ton objectif : 5 essais ou moins » ; après : résultat, rang, partage. Ne jamais afficher « score à battre : 1 essai » en cours de partie.
- Mobile : chaque essai = une carte (sprite + nom + « Essai n ») avec une grille 3×3 de cases étiquetées en 12px.

## 4. Accueil
- Un seul bloc Pokémon du jour en tête (fusionner l'intro et le panneau Daily) : titre, bouton Jouer/Reprendre selon l'état, mini-grille de la partie en cours, compte à rebours.
- Ensuite le catalogue « Choisis ton jeu » (filtres Populaires / Deviner / Réflexion / Arcade / Stratégie), cartes : zone pastel du type avec grand sprite, titre, une phrase, record, pastille de type, « Jouer → ».
- Puis Party (lavande) et Ligue. Le mobile garde cet ordre.
- Pas de chiffres inventés : si une stat n'existe pas en base, on n'affiche pas le bloc.

## 5. Classements (alignés sur l'API existante)
- Périodes : « Aujourd'hui », « 7 derniers jours » (fenêtre glissante actuelle), « Records » (meilleur score par jeu, pas de cumul).
- Puces par jeu aux couleurs des modes ; « Ligue · tous les jeux » pour le classement commun (points de ligue, seule monnaie comparable entre jeux).
- Podium 3 cartes (1er au centre, plus haut, fond jaune pâle) ; liste top 20 ; séparateur « autour de toi » avec tes voisins et ta ligne surlignée en bleu. Pas de pagination tant que l'API ne la gère pas.
- Colonne latérale : progression de ligue + récompense réelle (badge de maîtrise), « Tes positions aujourd'hui » par jeu avec lien direct vers le jeu.
- Faire une vraie version mobile (puces défilantes, podium compact, liste).

## 6. Connexion
Carte centrée blanche style « Bon retour ! » : mascotte (sprite Pokémon), sous-titre « Reconnecte-toi pour retrouver tes scores et ta série », boutons pleine largeur des fournisseurs DÉJÀ supportés (Discord en premier, `#5865F2`), lien « Continuer sans compte ». Ne pas ajouter de fournisseur qui n'existe pas côté serveur.

## 7. Logos de types
Utiliser le pack MIT `partywhale/pokemon-type-icons` (18 SVG ronds) en fichiers locaux. Ajouter le crédit de licence (« Type icons © James Watkins, MIT ») dans les mentions/README.

## Méthode
- Lot 1 : tokens + boutons + cartes + coque de jeu appliquée au Pokémon du jour (desktop + mobile).
- Lot 2 : la même coque et le même tableau de comparaison sur tous les modes « devine le Pokémon » (une carte d'indice par mode) + écran de fin commun avec points, compteurs et « Jeu suivant ». Les modes qui ne devinent pas un Pokémon (Quiz, Duel de poids, Higher or Lower, Draft…) gardent leur mécanique mais prennent la même barre, la même carte centrale et le même écran de fin.
- Lot 3 : accueil réorganisé + classements + connexion.
Pour chaque lot : une PR, captures avant/après en 1366×768 et 390px, aucun débordement horizontal, mode sombre vérifié, saisie/autocomplétion/résultats re-testés. Signale-moi toute règle de jeu ou donnée d'API qui contredit ce brief au lieu de la changer.
