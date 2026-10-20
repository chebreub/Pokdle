Comparaison du 9 octobre entre Pokédle (en ligne, journée complète jouée) et Pokequizz (pokequizz.com/leaderboard + quiz). Objectif : des classements et une expérience de jeu aussi harmonieux que Pokequizz. Termine d'abord les PR de l'étape 1 en cours, puis traite ce lot. Montre-moi le barème et les maquettes d'écran avant de coder.

## A. Classements : pourquoi ça paraît « étrange »

Constats chez Pokédle :
1. **8 unités différentes** selon l'onglet :
   - essais, où le plus petit gagne (Pokémon du jour, Wordle) ;
   - points puis temps (Défi, Dossier, Parcours) ;
   - bonnes réponses (Quiz) ;
   - Pokémon trouvés (Speedrun) ;
   - meilleure série (Higher/Lower) ;
   - moyenne BST (Draft) ;
   - /600 (Ligue).
   - Pokequizz : **une seule unité, les points**, sur tous ses classements (Global 165, Cri 16…), toujours dans la même mise en page. Seule la puce change.
2. **Le Wordle** affiche des points à la fin de l'épreuve, mais son classement est en essais.
3. **L'onglet par défaut** est « Pokémon du jour », pas le classement global. Pokequizz ouvre sur « Global », avec la formule expliquée en une phrase sous le titre.
4. **15 onglets neutres**, dont beaucoup vides (« Pas encore de performance ici »). L'ordre est inversé par rapport à la journée (Parcours, Défi, Dossier, Wordle, Pokémon du jour). Sur mobile, Pokequizz affiche « Global » + une liste déroulante « Autres classements ».
5. **Le classement est une fenêtre par-dessus la page**, alors que chez Pokequizz c'est une page. L'onglet Ligue ouvre une autre fenêtre « Ligue · Classement » qui remplace la première. Son titre « Classement de Ligue » est **bleu foncé sur fond bleu nuit, quasi illisible**.
6. **Aucune identité de joueur** : pas d'avatar sur le podium ni dans les lignes (sauf un avatar Discord), pas de drapeau. Pokequizz montre partout l'avatar débloqué du joueur et son drapeau.
7. **Rien à gagner** : la colonne de droite montre ta ligue personnelle. Pokequizz montre « À gagner : Raikou, 2 j 13 h avant le reset » + « Top 3 de la semaine ».
8. **Un seul joueur classé** : le podium affiche une seule grande carte isolée.

À faire :
- **Une monnaie unique, les points**, affichée en premier partout. Le détail vient en second : « 7 pts · 4 essais », « 6 pts · 2/6 », « 28 pts · 7/10 trouvés ».
  - Pour le Pokémon du jour et le Wordle, les points découlent des essais : l'ordre du classement reste exactement « essais → indices consultés → temps », comme validé.
  - Les jeux d'arcade (Quiz, Speedrun, Higher/Lower, Draft) gardent leur record natif, mais seulement dans « Autres classements », avec leur unité écrite.
- **Classement par défaut : « Global du jour »** = total des 4 épreuves de la journée.
  - Formule écrite sous le titre : « Total de tes 4 épreuves du jour : Enquête + Wordle + Dossier + Défi ».
  - Périodes : Aujourd'hui / 7 derniers jours / Records.
- **Rééquilibrer le barème de la journée.** Aujourd'hui l'Enquête vaut 10 sur 96 et le Défi 60. L'Enquête est la signature et doit peser au moins autant que le Défi. Propose un barème, par exemple Enquête 30, Wordle 20, Dossier 20, Défi 30, sur 100.
- **Ordre des puces = ordre de la journée** : Global, Enquête, Wordle, Dossier, Défi.
  - Ensuite « Autres classements » (liste déroulante sur mobile, repliée sur ordinateur).
  - Masquer les classements sans aucun résultat sur la période, au lieu d'afficher un onglet vide.
- **Une puce colorée par épreuve**, de la même couleur que sa pastille dans la frise de la journée et dans le jeu.
- **Une vraie page « Classement »**, avec son adresse, au lieu d'une fenêtre. La Ligue devient une puce de cette même page, pas une autre fenêtre. Corriger le contraste du titre de la Ligue.
- **Avatar du joueur partout** (podium, lignes, « Toi ») : son compagnon / Pokémon partenaire, déjà présent dans le profil ; pour les invités, un sprite par défaut. Le drapeau est optionnel.
- **Colonne « À gagner »** : récompense réelle de la semaine (badge / compagnon de la Ligue), compte à rebours avant le reset, « Top 3 de la semaine ».
- **Petite audience** : en dessous de 3 joueurs, pas de podium de 3 cartes. Afficher une liste simple, ta ligne et « Sois parmi les premiers aujourd'hui ».

## B. Harmonie et sensation de jeu : ce qui manque encore par rapport à Pokequizz

1. **L'identité par mode.** Chaque épreuve et chaque mode a une couleur unique, reprise partout : carte d'accueil, pastille en jeu, frise, puce du classement, bouton de la carte d'indice.
2. **Score à battre visible.** Sur chaque carte de l'accueil et en haut de chaque épreuve avant le premier essai : « Score à battre aujourd'hui : 9 pts, détenu par Kayan ». Masqué s'il n'y a pas encore de résultat.
3. **Même fin pour les 4 épreuves.** La fin de l'Enquête doit afficher ses points comme les trois autres (« +7 pts » avec « ? »).
   - Pour le Dossier interrompu, ne pas afficher « 0 / 10 points » à côté de « Dossier : 1 / 10 » sans explication.
   - À la victoire, ne plus superposer la fiche Pokédex, la notification XP et l'écran de fin.
4. **Accueil synchronisé avec la journée.** Le bloc du jour affiche la frise 1-2-3-4 avec l'état de chaque épreuve et le total « X / 100 », puis « Épreuve suivante » ou « Voir mon bilan ». Aujourd'hui, il propose « Épreuve 2 : Wordle » alors que tout est fini.
5. **Bandeau d'actualités.** Fin bandeau défilant sous le header : lot de la semaine, épreuve du Défi du jour (« Défi du jour : Pixelisé »), nouveauté, Œuf mystère. Uniquement du contenu réel.
6. **Compagnons visibles.** Le compagnon choisi apparaît dans le header (avatar), sur le podium et dans le bilan du jour. Afficher dans la fin de partie « Encore 3 jours de série pour débloquer [compagnon] ».
7. **Header plus léger.** Pokequizz : logo, bandeau, connexion. Pokédle : 6 liens + aide + réglages + Discord. Garder Accueil / Jouer / Classement / Profil ; Entre amis et Pokédex vont dans le menu Jouer ou dans le pied de page.
8. **Aide en 3 étapes avec un exemple visuel par épreuve** (mini-tableau, comme le « Comment jouer ? » de Pokequizz). La légende réelle « ✓ Exact / ≈ Partiel ou proche / × Différent » doit apparaître partout.
9. **Latence** : environ 3 s par vérification de Wordle. La cible est moins de 500 ms ressentis, avec un retour immédiat côté interface (la ligne se remplit tout de suite).

## Lot proposé
1. **PR « Classements v2 »** : page dédiée, Global du jour par défaut, points partout, puces colorées dans l'ordre de la journée, « Autres classements », avatars, colonne À gagner, petite audience, contraste Ligue.
2. **PR « Journée harmonisée »** : barème rééquilibré (validé par moi avant), points sur la fin de l'Enquête, accueil synchronisé, score à battre, fin sans superposition.
3. **PR « Identité »** : couleur par mode partout, compagnon en avatar, header allégé, bandeau d'actualités.
Pour chacune : captures 1366×768 et 390×844 de l'accueil, de la journée (4 fins + bilan) et du classement (0, 1, 3 et 10 joueurs).
