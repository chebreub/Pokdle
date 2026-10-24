Tu travailles sur mon dépôt Pokédle (HTML/CSS/JS + server.js + Postgres). La nouvelle DA « Pokédle cosy » est en place et me plaît : on la GARDE. Étape suivante : la structure. Le site doit devenir aussi clair et bien enchaîné que Pokequizz (pokequizz.com), sans être une copie, sans réécrire le site et sans changer les règles de jeu. Les captures jointes (maquette + Pokequizz) sont des références visuelles, pas du code à copier.

## 0. DA à conserver (vérifie juste qu'elle est appliquée partout via des variables CSS)
- Fond crème `#FFF8EF` + pois discrets, surfaces blanches, sable `#FBEFE0`, filet `#F0E2CF`.
- Encre `#2E2A33`, texte secondaire `#776B63`. Bleu action `#4069E0` (ombre `#2F51B8`). Jaune `#FFD45C` RÉSERVÉ au Pokémon du jour. Lavande Party `#7C5BD6`, rose accent `#FFE4EC`, Poké Ball `#F0524A`.
- Résultats : exact `#7ED3A0`/texte `#0E3F25` · partiel ou proche `#FFD66B`/texte `#5C3D00` + rayures · différent `#CFC7BD`/texte `#2E2A33`. Jamais la couleur seule (coche, rayures, flèches).
- Fredoka pour les titres uniquement, Nunito pour tout le reste. Libellés 12 px minimum, texte 16 px, cibles tactiles 44 px. Cartes arrondies 22–30 px, boutons pilule avec ombre courte dessous.
- Déco (étoiles, bulles, animations) seulement sur l'accueil et autour du Daily.

## 1. Règles anti-fouillis (priorité absolue)
1. Une seule chose à faire par écran de jeu : carte d'indice → tableau → saisie. Pendant la partie : AUCUN classement, ligue, bannière, barre latérale ou promo d'un autre mode.
2. Tous les modes « devine le Pokémon » (Pokémon du jour, Illimité, Zoom, Pixelisé, Description, Cri, Stat mystère, Combo de types) partagent LE MÊME tableau de comparaison que le Daily après chaque mauvais essai. Seule la carte d'indice du haut change. Un seul composant réutilisé.
3. Une couleur par mode, à deux endroits seulement : la pastille du mode et le visuel/bouton de la carte d'indice. Le reste reste neutre.
4. Même vocabulaire partout : « JOUR #n », « ESSAIS x/6 », série 🔥, « Du jour / Illimité », « Comment jouer ? ».
5. Un seul écran de fin pour tous les modes.
6. Avant d'ajouter un élément à un écran de jeu : aide-t-il à trouver le Pokémon ? Sinon, il va sur l'accueil ou le profil.

## 2. Coque de page de jeu (commune à TOUS les modes)
Colonne centrée (~1000 px), dans cet ordre :
1. Barre : « ← Retour » · au centre pastille du mode, « Comment jouer ? » (aide repliable en 3 étapes : but, action, lecture du retour), sélecteur « Du jour / Illimité » · à droite « ESSAIS x/6 » et série 🔥 en pastilles blanches.
2. « JOUR #278 » en petites capitales + une phrase de consigne.
3. Carte d'indice blanche au centre, propre au mode : Daily = carnet d'enquête ; Cri = gros bouton pilule « Jouer le cri » rejouable (« casque recommandé ») ; Zoom = image recadrée + paliers ; Stat mystère = barres des 6 stats + total ; Description = texte Pokédex avec le nom masqué.
4. Tableau des essais, ordre chronologique, le plus récent juste au-dessus de la saisie.
5. Champ de saisie + suggestions (sprite + nom + logos de types).
6. Légende courte, puis « Astuces pour ce jeu : lire le guide ».
Écran de fin (même composant pour tous), dans cet ordre :
1. « Bravo ! » ou « Raté, c'était… » + points gagnés en grand (« +7 pts ») avec un « ? » qui explique le calcul.
2. Fiche du Pokémon : sprite, nom, « #0094 · Spectre / Poison ».
3. 4 compteurs en cartes : Parties, Victoires, Série 🔥, Meilleure série.
4. Boutons : Partager · Classement du jour (ton rang et tes 2 voisins) · Jeu suivant → (enchaîne vers le mode suivant).
Les modes qui ne font pas deviner un Pokémon (Quiz, Intrus, Duel de poids, Higher or Lower, Draft…) gardent leur mécanique mais prennent la même barre, la même carte centrale et le même écran de fin.

## 3. Pokémon du jour (règles inchangées)
- Garder EXACTEMENT le comparateur actuel : Gén., Type 1, Type 2, Habitat, Couleur, Stade, Taille, Poids, Forme ; taille « proche » à ±0,3 m et poids à ±15 kg (`cmpNum`), types inversés = partiel, `altForm` conservé.
- Case Pokémon blanche (sprite + nom), puis les cases colorées. Types : logo rond + nom visible en 11–12 px dessous (pas seulement au survol). Second type absent : rond en pointillés.
- Flèches avec infobulle claire : « Le Pokémon recherché est plus lourd / plus grand / plus évolué / plus récent ».
- Carnet d'enquête : tampon « DÉFI N°278 », emplacement silhouette (débloquée au 5ᵉ essai), puces « Ce que tu sais déjà » déduites des essais (✓ Habitat : Grotte, Poison est son 2ᵉ type, Poids entre 7,5 et 48 kg…), objectif personnel + record du jour.
- Messages selon l'état : avant « Record du jour : N essais » ; pendant « Ton objectif : 5 essais ou moins » ; après : résultat, rang, partage. Jamais « score à battre : 1 essai » en cours de partie.
- Mobile : chaque essai = une carte (sprite + nom + « Essai n ») avec une grille 3×3 de cases étiquetées en 12 px.

## 4. Accueil
- Un seul bloc Pokémon du jour en tête (fusionner intro et panneau Daily) : titre, Jouer/Reprendre selon l'état, mini-grille de la partie en cours, compte à rebours.
- Puis « Choisis ton jeu » (filtres Populaires / Deviner / Réflexion / Arcade / Stratégie) : cartes avec zone pastel du type et grand sprite, titre, une phrase, record, pastille de type, « Jouer → ».
- Puis Party et Ligue. Même ordre sur mobile.
- Pas de chiffres inventés : si une stat n'existe pas en base, le bloc n'apparaît pas.

## 5. Classements (alignés sur l'API existante)
- Périodes : « Aujourd'hui », « 7 derniers jours » (fenêtre glissante actuelle), « Records » (meilleur score par jeu, pas de cumul).
- Puces par jeu aux couleurs des modes ; « Ligue · tous les jeux » = classement commun en points de ligue (seule monnaie comparable entre jeux).
- Podium 3 cartes (1er au centre, plus haut) ; top 20 ; séparateur « autour de toi » avec tes voisins et ta ligne surlignée. Pas de pagination tant que l'API ne la gère pas.
- Colonne latérale : progression de ligue + récompense réelle (badge de maîtrise), « Tes positions aujourd'hui » avec lien direct vers chaque jeu.
- Vraie version mobile : puces défilantes, podium compact, liste.

## 6. Connexion
Carte centrée « Bon retour ! » : mascotte (sprite Pokémon), « Reconnecte-toi pour retrouver tes scores et ta série », boutons pleine largeur des fournisseurs DÉJÀ supportés (Discord en premier), « Continuer sans compte ». N'ajoute aucun fournisseur absent côté serveur.

## 7. Logos de types
Pack MIT `partywhale/pokemon-type-icons` (18 SVG ronds) en fichiers locaux, crédit « Type icons © James Watkins, MIT » dans les mentions/README.

## 8. Nouveau mode communautaire « L'Œuf mystère » (inspiré de l'Œuf Chance de Pokequizz)
Principe :
- Chaque semaine, le serveur tire un Pokémon (formes de base). Tout le monde cherche LE MÊME.
- 1 essai par jour sans compte, 2 avec compte. Choix en touchant un sprite de la grille ou en tapant son nom.
- Un mauvais essai est rayé POUR TOUS : « 312 rayés · 1 chance sur 713 ».
- Touche Pokédle : tous les 100 Pokémon rayés, un indice commun se débloque (génération → 1er type → couleur → habitat → stade) et atténue les Pokémon incompatibles (option « Masquer les incompatibles »).
- Le premier qui trouve gagne la récompense de la semaine (compagnon/avatar, ou un autre s'il l'a déjà). Reset lundi minuit (Europe/Paris), trouvé ou non. Ne compte PAS au classement.
Écran (même coque) : barre (← Retour · « L'Œuf mystère » · Comment jouer ? · ESSAIS x/2) → carte « À gagner » (sprite en bulle, nom, « 5 j 12 h avant le reset de lundi ») → « Pokémon rayés : N · 1 chance sur M » + bascule « Masquer les Pokémon tentés » → 5 pastilles d'indices communs → grille de tous les sprites par génération sur des bandes pastel (rayé = grisé et barré, incompatible = atténué, cases ≥ 44 px mobile, chargement différé) → saisie → fil « En direct » (« Pseudo a tenté Krabby · 10:38 », 20 derniers, « Anonyme » sans compte).
États : plus d'essai aujourd'hui (proposer le compte pour le 2ᵉ essai), gagnant trouvé (afficher le gagnant, grille consultable), chargement, erreur réseau.
Serveur :
- Tables `egg_rounds` (id, week_start, secret_id, found_by, found_at, reward_id) et `egg_guesses` (round_id, pokemon_id unique par round, player_id ou anon_id, created_at).
- Le secret n'est JAMAIS envoyé au client. `GET /api/egg` (rayés, indices débloqués, récompense, essais restants, fil) et `POST /api/egg/guess` (quota, Pokémon pas déjà rayé, comparaison côté serveur, transaction pour un gagnant unique).
- Quota par compte (2/jour) et par empreinte anonyme + IP (1/jour), limite de débit. Récompense uniquement pour un compte connecté ; en cas d'essais simultanés, le premier enregistré gagne. Temps réel par polling toutes les 15 s.

## Méthode
- Lot 1 : coque de jeu + règles anti-fouillis appliquées au Pokémon du jour (desktop + mobile), écran de fin commun.
- Lot 2 : la même coque et le même tableau sur tous les modes « devine le Pokémon », puis barre/carte/fin communes sur les autres modes.
- Lot 3 : accueil réorganisé + classements + connexion.
- Lot 4 : L'Œuf mystère.
Pour chaque lot : une PR, captures avant/après en 1366×768 et 390 px, mode sombre vérifié, aucun débordement horizontal, saisie/autocomplétion/résultats re-testés (et pour l'Œuf : quota, double essai, gagnant unique, reset, paliers d'indices). Si une règle de jeu, une donnée d'API ou une fonction existante (comptes, avatars, ligue) contredit ce brief, signale-le-moi au lieu de l'inventer ou de la changer.
