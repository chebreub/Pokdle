Prochaine étape Pokédle : donner à TOUS les modes le rythme et l'enchaînement des quiz Pokequizz. La DA et la coque de jeu sont validées, on n'y touche pas. Vérifie chaque point sur main avant de coder et signale-moi les contradictions.

## Constat (site en ligne, 6 octobre)
- Seul le Pokémon du jour est un rendez-vous quotidien. Zoom, Cri, Pixelisé, Description, Stat mystère, Combo de types sont des parties aléatoires infinies : pas de « JOUR #n », pas de cible commune, pas de classement. Chez Pokequizz, CHAQUE quiz a sa partie Commun du jour, classée : c'est ce qui fait revenir.
- Chaque mode a son unité de score (essais, série, points) : pas de score commun, donc pas de classement général lisible.
- L'écran de fin a les 4 compteurs, mais ni points gagnés, ni rang, ni « Jeu suivant » : la session s'arrête au lieu de s'enchaîner.
- Les modes n'ont pas d'URL propre (tout passe par #game) et le classement est une fenêtre modale : impossible de partager un lien vers un mode, retour arrière confus, aucun référencement.
- Le classement du jour montre 1 joueur : les éléments sociaux sonnent vides tant que l'audience est petite.
- Détails vus : liste de suggestions trop basse (≈55 px, on voit 1 résultat), détail du Zoom affiché en aplat noir au 1er palier, tampon « RENDEZ-VOUS QUOTIDIEN » coupé sur l'accueil, notification qui recouvre l'écran de fin.

## 1. Chaque mode « devine le Pokémon » devient un quotidien
- Zoom, Cri, Pixelisé, Description, Stat mystère, Combo de types : une partie « Du jour » par mode (même cible pour tous, minuit Europe/Paris, « JOUR #n » propre au mode, cible et comparaisons côté serveur comme le Daily v2) + « Illimité » (local, non classé).
- 6 essais maximum dans ces modes (sessions courtes, défaite possible). Le Pokémon du jour principal reste à essais illimités : c'est la signature.
- Cibles différentes entre modes le même jour (jamais le même Pokémon dans deux modes).

## 2. Un barème commun
- Victoire dans un mode à 6 essais : 1 point de base + 1 par essai non utilisé + rapidité (+3 sous 10 s, +2 sous 30 s, +1 sous 1 min) + question bonus +1. Défaite : 0.
- Le « ? » à côté des points détaille le calcul.
- Classement général du jour = somme des parties « Du jour » de tous les modes (le Pokémon du jour converti selon son propre barème) ; classements par mode conservés. La ligue garde son fonctionnement (3 disciplines, 600 pts).

## 3. Écran de fin qui enchaîne (même composant partout)
1. « Bravo ! » / « Raté, c'était… » + « +7 pts » avec « ? ».
2. Fiche du Pokémon (sprite, nom, numéro, types) + question bonus à 4 choix.
3. 4 compteurs (Parties, Victoires, Série, Meilleure série) + « Tu fais mieux que N % des joueurs » si au moins 20 parties ce jour-là.
4. Rang du jour + 2 voisins (si connecté), sinon « Connecte-toi pour être classé ».
5. Boutons : Partager (« Pokédle Zoom #12 · 3/6 · 🔥4 », sans spoiler) · « Jeu suivant → » qui ouvre le prochain mode quotidien non joué aujourd'hui · Illimité.

## 4. « Ma journée Pokédle » (là où on peut faire mieux que Pokequizz)
- Sur l'accueil, juste sous le bloc Pokémon du jour : une ligne de pastilles des quotidiens du jour (Pokémon du jour, Zoom, Cri, Pixelisé, Description, Stat mystère, Combo) avec état (à jouer / gagné en N / raté) et un compteur « 3/7 aujourd'hui ».
- Tout faire dans la journée = bonus de série globale et +points de ligue. Le bouton « Jeu suivant » suit cet ordre.

## 5. Progression visible
- Série par mode ; 7 victoires d'affilée dans un mode débloquent un compagnon lié au mode (avatar de profil).
- Chance de chromatique à chaque victoire (1/512) → collection + mur public « Chromatiques » (qui, lequel, via quel mode, date).

## 6. Navigation et partage
- Une URL par mode et par écran (/jouer/zoom, /jouer/cri, /classement, /guide/zoom…), avec retour arrière qui fonctionne et titre/OG image par mode. Le classement devient une page, plus une modale.
- Une page guide courte par mode (règles, lecture des couleurs, méthode, FAQ), reliée par « Astuces pour ce jeu ».

## 7. Petite audience : ne jamais afficher du vide
- Classements avec moins de 5 joueurs : afficher « Sois parmi les premiers » + ton propre record au lieu d'un podium vide.
- Ajouter un classement « Amis » (joueurs Discord suivis / membres de tes salons Party) quand l'utilisateur est connecté.
- Stats « mieux que N % » et « record du jour » masquées sous un seuil minimal de parties.

## 8. Corrections rapides
Hauteur de la liste de suggestions (au moins 5 résultats visibles, 44 px par ligne), premier palier du Zoom qui doit montrer des couleurs et non un aplat noir, tampon d'accueil coupé, notification qui ne recouvre plus l'écran de fin.

## Lots
1. Lot R1 : corrections rapides + URL par mode + classement en page.
2. Lot R2 : quotidien serveur + 6 essais + barème + écran de fin enchaîné sur UN mode pilote (Cri), validé avec moi avant d'étendre.
3. Lot R3 : extension aux autres modes « devine », « Ma journée Pokédle », classement général du jour.
4. Lot R4 : compagnons par mode, chromatiques et mur public, guides par mode, classement Amis.
Pour chaque lot : une PR, captures 1366×768 et 390 px, tests (cible identique pour tous, reset à minuit Paris, 6 essais, calcul des points, enchaînement « Jeu suivant »).
