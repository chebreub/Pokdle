# Pokédle face à Pokequizz : fonctionnalités, vie du site, design

Analyse du 6 octobre 2026.

- **Pokédle** : site en ligne (pokdle.onrender.com, version du commit 41fa65d).
  - Les 29 modes ont été ouverts un par un, avec des parties tests.
  - Mesures sur ordinateur (1366 × 768) et sur mobile (375 × 812).
  - Le comportement de chaque mode a été vérifié dans le code.
- **Pokequizz** : accueil, 7 quiz (Types, Stats, Cri, Focus, Critère, Défi du jour, Œuf Chance), FAQ, À propos, 4 guides, classement, mur des chromatiques, PVP.
- **Limite** : les deux sites ont été vus sans compte.

---

## 1. Verdict

En contenu et en systèmes, Pokédle en offre déjà plus que Pokequizz :
- 29 modes, dont la Party Room et ses 9 mini-jeux ;
- une ligue hebdomadaire, l'Œuf mystère, un album, des secrets ;
- 30 succès, des niveaux, des quêtes.

Pokequizz paraît pourtant meilleur, parce que **tout y obéit aux mêmes quatre règles** :
1. Chaque quiz suit la même boucle : partie « Commun » du jour, plus « Rejouer ».
2. Partout 6 essais, le même barème de points, le même tableau, la même fin de partie.
3. Chaque quiz donne une raison de revenir demain : partie numérotée, classée, avec un « score à battre ».
4. Le site montre qu'il est vivant : records nommés, lots, fil en direct, chromatiques datés, stats publiques.

**Chez Pokédle, chaque mode est un petit site à part** : ses règles, son vocabulaire, sa fin, son aide, son suivi. Le joueur doit réapprendre à chaque mode, ne sait pas quoi faire après une partie, et ne voit personne d'autre jouer.

| Dimension (note /5, appréciation) | Pokédle | Pokequizz | Pourquoi |
|---|---|---|---|
| Quantité de contenu | 5 | 4 | 29 modes contre 15 quiz + Sprint + Défi + PVP |
| Cohérence des règles entre modes | 1,5 | 5 | Voir §2.2 |
| Rythme quotidien (raisons de revenir) | 2 | 5 | 1 quotidien contre environ 16 rendez-vous par jour |
| Fin de partie et enchaînement | 2 | 4,5 | Une quinzaine de fins différentes, pas de points ni de « jeu suivant » |
| Progression visible et motivante | 2 | 4 | Beaucoup de systèmes, invisibles pendant le jeu |
| Vie du site / preuve sociale | 1,5 | 4,5 | Classement à 1 joueur, Œuf à 1 rayé |
| Multijoueur | 4,5 | 3,5 | Party Room 2–8 joueurs, 9 jeux, sans compte |
| Direction artistique | 4 | 4,5 | La DA cosy est réussie, mais des restes (emojis, polices) |
| Ergonomie mobile | 2 | 4,5 | Saisie hors de l'écran au lancement des modes |
| Être trouvé (Google, partage, parrainage) | 1 | 5 | Aucune page par mode, aucun guide |
| Vitesse | 2 | 4,5 | 2,8 Mo et serveur lent contre 1 Mo |

---

## 2. Fonctionnalités

### 2.1 Trop de portes d'entrée, dont certaines cassées

**Le volume**
- Catalogue : 20 jeux solo + 6 « Entre amis » + 9 outils = **35 entrées**.
- Accueil : 6 cartes de jeux + Œuf + Party + Ligue + Outils.
- Pokequizz : **15 quiz construits pareil**, plus 3 modes spéciaux.

**Doublons et variantes qui se marchent dessus**
- **Draft ×4** :
  - Score Attack ;
  - PRO ;
  - Arènes, marqué « Expérimental », combats désactivés, sans écran de fin ;
  - Duel PRO, qui ne peut jamais se terminer.
- **Higher or Lower ×3** (infini, 60 s, Versus).
- **Marathon** (appelé aussi « Party Pokémon » ou « Party »), qui entre en collision avec la **Party Room**.
- **Quatre jeux « Stat Clash »** aux règles différentes.
- **Pokémon du jour, Mode illimité et Défi ami** : c'est le même jeu, présenté sous 3 portes.

**Visibles par le joueur et cassés**
- Draft PRO plante en génération 7 à 9.
- Quiz : les scores de 11 à 15 sont refusés par le classement (maximum serveur à 10 pour un quiz de 15 questions).
- Ligue : les boutons « Jouer » de Speedrun et Higher or Lower n'ouvrent pas le jeu.
- Marathon : bloqué si la manche tombe sur Higher or Lower 60 s, et le panneau du cri est affiché deux fois.
- Quête « 10 d'affilée » à Higher or Lower : validée après 4 bonnes réponses.
- Au rechargement, on perd les séries Intrus et Poids, les records PRO, et les badges et scores de ligue.

**Proposition**
- Un catalogue court, en 3 étages :
  1. **Deviner**, 7 quotidiens au même format : Pokémon du jour, Zoom, Pixelisé, Description, Cri, Stat mystère, Combo de types.
  2. **Réfléchir et réagir**, environ 6 jeux : Connections, Intrus, Quiz, Évolution, Duel de poids, Higher or Lower.
  3. **Entre amis** : une seule Party Room qui regroupe Duel, Stat Clash, Enchères et défi par lien.
- Masquer tout ce qui est expérimental ou cassé.
- Fusionner les Drafts en un seul « Draft » avec options : génération, normal/PRO, solo/duel.
- Speedrun et Marathon deviennent le « Sprint » et le « Défi du jour » (voir §2.3).

### 2.2 Chaque mode invente ses règles

- **Nombre d'essais**
  - Tous les modes « Deviner » sont à essais illimités, affichés « Essais : 0 » sans maximum.
  - Pokequizz : 6 essais partout. Les parties sont courtes, on peut perdre, donc il y a un enjeu et un score lisible.
  - Le compteur « Essais » apparaît aussi au Quiz et au Duel de poids, où il ne veut rien dire.
- **Couleurs** : 4 vocabulaires différents selon l'endroit (Vert/Jaune/Rouge, ✓/≈/× + orange, 🟩🟨⬜, Exact/Partiel/Différent).
- **Générations et formes** : certains modes respectent la sélection, d'autres l'ignorent. Les formes alternatives sont incluses ici, exclues là. Le joueur ne peut pas le deviner.
- **Égalités**
  - Higher or Lower : comptée juste.
  - Duel de poids : seul le Pokémon de gauche est juste.
  - Numéro mystère : tous les ex æquo gagnent.
  - Stat Clash : départage aux manches.
- **Aides**
  - Cinq systèmes d'aide différents.
  - Aides fausses : Intrus (« 4 Pokémon », il y en a 6), Stat mystère (« un essai dévoile une stat », faux), Quiz (« l'explication », absente), Draft Arènes, Duel, Enchères.
  - Le bouton « Comment jouer » de l'écran de jeu ouvre le tutoriel du mode classique, même pour le Quiz ou le Poids.
  - Pokequizz : une aide par quiz, en 3 ou 4 étapes avec un exemple, ouverte automatiquement la première fois.
- **Noms**
  - « Zoom progressif » s'appelle « Silhouette » en interne, alors qu'en Party Room « Silhouette » désigne une vraie ombre.
  - « Pixelisé » est en réalité un flou.
  - « Connexions Pokémon » ou « Poké-Connections », selon l'endroit.
  - L'écran Draft Arènes s'affiche sous le titre « Draft Score Attack ».
  - Ordre Pokédex est décrit « remets dans l'ordre », alors que le jeu demande de trouver le Pokémon entre deux numéros.
  - Combo de types est classé « Réflexion » dans le catalogue et « Arcade » sur l'accueil.

**Proposition** : une fiche de règles commune, appliquée à tous les modes.
- **Deviner** : 6 essais, sauf le Pokémon du jour qui reste illimité (c'est ta signature), un seul tableau, une seule légende « Exact / Partiel ou proche / Différent ».
- **Arcade** : 60 s, ou mort subite.
- Mêmes règles pour les générations, les formes et les égalités.
- Une seule aide, toujours au même endroit.

### 2.3 Quotidien : 1 rendez-vous contre environ 16

**Pokédle**
- Le Pokémon du jour : désormais solide (cible et vérification côté serveur, minuit heure de Paris, numéroté #198).
- L'Œuf mystère (hebdomadaire) et la ligue (hebdomadaire).
- Tout le reste est aléatoire et infini.

**Pokequizz**
- Les 12 quiz ont chacun leur partie **Commun du jour**, numérotée, la même pour tous, classée, avec « score à battre ».
- Plus 3 quotidiens spéciaux à 10 questions, chacun avec une mécanique de rejouabilité :
  - **Le Focus** : un Pokémon annoncé, 10 questions sur lui, une erreur n'arrête pas la partie ; un 10/10 ouvre une grille bonus qui s'ajoute (jusqu'à 20).
  - **Le Critère** : une erreur et c'est fini, difficulté qui monte (facile → corsé → pointu) ; 2 chances par jour, seul le meilleur essai compte ; un sans-faute transforme la 2ᵉ chance en grille inédite qui s'ajoute.
  - **La Culture** : une génération tirée chaque jour, avec un tirage pondéré par l'attente (au moins 4 jours d'écart). Récompense (un starter manquant) seulement en sans-faute et en moins de 2 min 30. Le chrono ne sert sinon qu'à départager les égalités.
- Plus le **Défi du jour** : un quiz différent chaque jour, 10 Pokémon en 5 minutes ; passer remet le Pokémon en fin de file, une erreur le fait perdre.
- Plus l'**Œuf Chance** hebdomadaire.
- **Limites vérifiées par le serveur** : changer d'appareil ne permet pas de rejouer.

**Proposition**
- Les 7 modes « Deviner » ont chacun leur partie du jour (cible du serveur, même pour tous, jamais le même Pokémon que dans un autre mode le même jour) et leur version « Illimité ».
- Le **Dossier du jour** : 10 questions sur le Pokémon du jour qu'on vient de trouver ; un 10/10 en ouvre 10 de plus.
- Le **Défi du jour** : un mode différent chaque jour, chronométré (remplace Speedrun et Marathon).

### 2.4 Fin de partie et enchaînement

**Pokédle**
- Une seule fin commune (Mystère résolu / révélé), réservée aux modes à tableau.
- Ailleurs, une quinzaine de fins sur mesure, avec des boutons qui changent à chaque fois : Rejouer, Nouvelle manche, Nouveau puzzle →, Revanche →, Relancer, Nouvelle draft, Retour menu, Retour accueil…
- La fin commune n'affiche ni points ni rang, sauf pour le Daily.
- « Choisir le prochain jeu → » renvoie au catalogue au lieu de proposer un jeu.
- Une notification « Partie terminée » recouvre l'écran de fin.

**Pokequizz**
- « Bravo ! **+7 pts** », avec un « ? » qui explique le calcul.
- La fiche du Pokémon.
- 4 compteurs : Parties, Victoires, Série, Max.
- Le partage en image.
- Le classement.

**Proposition**
- **Une seule fin pour tous les modes** : résultat + points + « ? », fiche du Pokémon, 4 compteurs, rang et voisins, Partager, **Jeu suivant →**.
- « Jeu suivant » ouvre le prochain quotidien non joué aujourd'hui.

### 2.5 Progression : beaucoup de systèmes, aucun visible en jouant

**Pokédle**
- Ce qui existe : XP et niveaux, 30 succès, 108 missions d'album, 12 secrets, quêtes du jour, carte de dresseur, partenaire, badges de ligue, compagnons de l'Œuf.
- **XP sans logique commune** : 40 fixes ici, dégressive là, +3, +5 ou +6 par bonne réponse ailleurs, et rien pour Party Room, Duel, Œuf, Stat Clash en salon.
- Le rang en direct pendant la partie n'apparaît jamais.
- Le profil est saturé d'emojis.
- Le compteur « parties jouées » augmente à chaque réouverture du Daily.

**Pokequizz : peu de systèmes, mais limpides**
- Un avatar (une évolution d'Évoli) par quiz, débloqué après 7 victoires d'affilée.
- Une chance sur 1024 d'obtenir un **chromatique** à chaque bonne réponse, avec un **mur public** (qui, lequel, via quel quiz, date).
- Les starters via La Culture.
- Un lot hebdomadaire.
- **La récompense est une identité que les autres voient.**

**Proposition** : 3 boucles principales, le reste en couche « collection » secondaire.
1. Série par mode → compagnon.
2. Chromatique aléatoire → mur public.
3. Ligue → badge et lot de la semaine.
- Un barème de points unique qui alimente classement, ligue et XP.

### 2.6 Multijoueur : ton vrai avantage, mais éparpillé

**Pokédle**
- Party Room de 2 à 8 joueurs, sans compte, avec 9 mini-jeux (Course, Combo, Duo de critères, Meilleure stat, Stat Clash, Numéro mystère, Pokémon mystère, Enquête coop, Course au Pokédex).
- Plus le Duel 1v1, le Défi ami par lien, Higher or Lower Versus, le Draft 1v1, Stat Clash et les Enchères.

**Pokequizz**
- Un salon privé de 2 à 16 joueurs sur ses quiz.
- Les salons publics sont **volontairement fermés** « tant que le trafic ne suffit pas ».

**Problèmes**
- 6 entrées « Entre amis » séparées.
- Aucun suivi : ni XP, ni historique, ni classement en Party Room.
- Course Pokémon exige le nom exact alors que d'autres jeux tolèrent les fautes.
- Stat Clash Party ne marche plus au-delà de 6 manches.

**Proposition**
- La Party Room comme unique porte « Entre amis », plus le défi par lien.
- Lui donner du suivi : victoires de soirée, XP, succès.
- En faire un argument d'accueil et de partage (« Invite ta bande »).

### 2.7 Comptes

- **Pokédle** : Discord uniquement. Or l'invité ne compte jamais au classement, et beaucoup de joueurs occasionnels n'ont pas Discord.
- **Pokequizz** : Google, Discord, Facebook, Twitch, email. Le jeu reste ouvert sans compte, mais le compte garde les scores, les séries et les avatars.
- **Proposition**
  - Ajouter Google et l'email.
  - Proposer la connexion au bon moment : sur l'écran de fin, « Garde ta série et entre au classement ».

---

## 3. Vie du site

### 3.1 Montrer que des gens jouent

**Pokequizz**
- Un bandeau d'actualités qui défile : lot de la semaine, chromatique de l'Œuf, nouveau défi, parrainage.
- « Score à battre : 12, détenu par lucho » sur chaque carte de quotidien.
- Le fil « En direct » de l'Œuf.
- Le mur des chromatiques, avec pseudo et date.
- Des stats publiques (38 938 parties, 1 140 joueurs) et les Pokémon les plus ratés.

**Pokédle aujourd'hui**
- Le classement du jour : **1 joueur**.
- L'Œuf : **1 Pokémon rayé**, premier indice à 100 rayés, sans doute jamais atteint avec l'audience actuelle.
- Records seulement locaux, aucune activité visible, rien de daté.

### 3.2 Concevoir pour une petite audience (la règle Pokequizz : ne jamais montrer du vide)

- Podium et « score à battre » affichés seulement à partir de N joueurs. Sinon « Sois parmi les premiers » + ton record personnel.
- Un classement **Amis** : joueurs Discord, membres de tes salons Party.
- **Œuf** : un indice garanti chaque jour (lundi : génération, mardi : type…), en plus des paliers de rayés.
- Afficher l'activité même modeste et vraie : « 23 parties aujourd'hui », « Dernière victoire au Cri il y a 12 min ».
- Désactiver ou masquer les fonctions de foule (salons publics, etc.) tant que le trafic ne suit pas.

### 3.3 Un calendrier

**Pokequizz** : une semaine rythmée.
- Le lundi : nouveau lot et nouvel Œuf.
- Chaque jour : un défi différent.
- La Culture : une génération du jour tirée au sort.

**Pokédle** : Daily, ligue et Œuf existent, mais sans calendrier visible.

**Proposition**
- Un encart « Cette semaine sur Pokédle » : thème, lot, disciplines de ligue, défi de chaque jour.
- La ligne « Ma journée Pokédle » : les quotidiens du jour, faits ou à faire, « 3/7 ».

### 3.4 Faire venir du monde

**Pokequizz**
- 16 guides reliés aux quiz, une FAQ, une page À propos, des stats publiques.
- Un titre de page travaillé (« Quiz Pokémon : devine le Pokémon | 15 jeux gratuits »).
- 7 langues.
- Partage en image sans spoiler.
- **Parrainage** : « Débloque Dracaufeu en utilisant ton lien de partage ».

**Pokédle**
- Un seul écran, organisé en sections internes (`#game`, etc.).
- Google ne voit qu'une page.
- Aucun guide, partage en texte seulement.

**Proposition**
- Une vraie page par mode, avec une adresse partageable.
- Un guide court par mode.
- Le partage en image.
- Un **parrainage** qui débloque un compagnon.
- Plus tard, l'anglais.

### 3.5 Confiance et communauté

- **Pokequizz** : À propos, FAQ, « Signaler un bug » dans le menu, « Offrir un café », crédits PokeAPI, suppression de compte en un clic.
- **Proposition** : une FAQ, une page À propos, « Signaler un bug », et un lien vers le serveur Discord, qui est ton atout naturel.

---

## 4. Design

### 4.1 Direction artistique

**Réussie et cohérente** : crème, pastels, Fredoka et Nunito, boutons pilule, Œuf mystère très propre.

**Ce qui reste**
- **4 polices chargées** : Fredoka, Nunito, Inter, Press Start 2P.
- **Emojis utilisés comme icônes** dans Draft, Combo, Higher or Lower, Speedrun et le Profil (🎯🏟️🎲🆚🔗🧬⚡♾️⏱️📜🎮⭐🎫🏆🔥🏅📷).
- La **Party Room** garde un univers visuel différent.
- **Classement et ligue s'ouvrent dans des fenêtres** par-dessus la page, au lieu de vraies pages.
- **Textes d'intro dupliqués** : Combo de types répète sa règle deux fois et propose « Rejouer » avant même la première partie.

### 4.2 Écran de jeu

- **Bien** : la même structure sur les modes « Deviner » (barre, carte d'indice, tableau commun, carnet).
- **Mobile, mesuré à 375 × 812** :
  - la saisie est à **744 px** sur le Pokémon du jour (sous la barre du bas) ;
  - **794 px** sur Cri (cachée) ;
  - **1 605 px** sur Stat mystère.
  - Chez Pokequizz : **507 px**, visible immédiatement, avec **une seule ligne de commandes** (← ? Commun/Rejouer 0/6 🔥).
  - Chez Pokédle, il y a à la place un gros bouton « ← Jeux » sur toute la largeur, « Du jour » coupé sur deux lignes, et « Essais : 0 » sur sa propre ligne.
- **Liste de suggestions** trop basse : un seul Pokémon visible à la fois.
- **Zoom progressif** : le premier palier affiche un aplat noir.
- **Évolution et Ordre Pokédex** : la légende des couleurs est masquée.

### 4.3 Accueil

- **Bien** : le bloc Pokémon du jour (numéro, série, compte à rebours, aperçu de grille).
- **Mobile** : le bloc « Reprendre / Récents » passe **avant** le Pokémon du jour.
- Le tampon « RENDEZ-VOUS QUOTIDIEN » est coupé.
- Le catalogue mélange deux systèmes de cartes (« Trois façons de jouer » puis la liste).
- L'Œuf mystère n'est accessible que depuis l'accueil (absent du catalogue).

### 4.4 Vitesse (mesurée)

| | Pokédle | Pokequizz |
|---|---|---|
| Premier octet reçu | 513 ms (Render, avec en plus les réveils à froid) | 79 ms (Cloudflare) |
| Poids décompressé | 2,8 Mo | 1,0 Mo |
| CSS | 1,2 Mo en 12 fichiers | 119 Ko en 1 fichier |
| JS principal | 1,2 Mo + socket.io chargé dès l'accueil | 838 Ko découpés par page |
| Éléments dans la page | 4 085 (25 écrans cachés dans une seule page) | 878 |

---

## 5. Fiche par mode

| Mode Pokédle | Équivalent Pokequizz | Ce qui manque | Décision proposée |
|---|---|---|---|
| Pokémon du jour | Pokédex / Types (Commun) | Points, « Jeu suivant », saisie visible sur mobile, aide qui oublie la colonne Forme | Garder, c'est la vitrine : essais illimités + Dossier du jour |
| Mode illimité | Rejouer | Classement, nom unique | Devient « Illimité » du Pokémon du jour |
| Défi ami | PVP (lien) | « Rejouer » relance la même cible | Ranger dans Entre amis |
| Zoom progressif | Silhouette | Quotidien, 6 essais, 1er palier noir | Quotidien « Deviner » |
| Pixelisé | Carte TCG floutée | Quotidien, nom (c'est un flou) | Quotidien « Deviner » |
| Description | Pokédex | Quotidien, question bonus (« de quel jeu ? ») | Quotidien « Deviner » |
| Cri | Cri | Quotidien, saisie hors écran sur mobile | Quotidien « Deviner » (pilote) |
| Stat mystère | Stats | Quotidien, aide fausse, saisie très bas sur mobile | Quotidien « Deviner » |
| Combo de types | Type | Fin commune, historique, famille ambiguë | Quotidien « Deviner » |
| Évolution / Ordre Pokédex | — | Légende masquée, description fausse (Ordre) | Garder en Réfléchir |
| Intrus | Intrus / Critère | Fin, aide fausse, difficulté sans effet | Garder ; en faire « Le Critère Pokédle » (10 manches, mort subite) |
| Quiz | Focus / Culture | Échelle 10/15 cassée, pas d'explication | Devient le Dossier du jour, ou un « Quiz du jour » à 10 questions |
| Poké-Connections | — (exclusivité) | Points, classement, quotidien | Puzzle du jour (comme le NYT) |
| Duel de poids / Higher or Lower | — | Fin commune, quête HL cassée | Garder en Arcade |
| Speedrun / Marathon | Sprint / Défi du jour | Marathon bloqué, noms en collision | Fusionner en Sprint + Défi du jour tournant |
| Drafts (×4) | — (exclusivité) | Arènes inachevé, Duel PRO bloqué, PRO plante | Un seul Draft, masquer l'inachevé |
| Party Room + Duel + Stat Clash + Enchères | PVP | Suivi, une seule porte | Tout dans la Party Room |
| Œuf mystère | Œuf Chance | Indices trop lointains pour l'audience actuelle, absent du catalogue | Indice quotidien garanti |
| Ligue | Lot hebdo + classement | Boutons cassés, badges perdus au rechargement, objectif 8/10 sur 15 | Garder, la réparer, l'afficher dans « Ma journée » |

---

## 6. Ce que Pokédle fait mieux : à mettre en avant

- Le **carnet d'enquête** et la déduction sur 9 critères : plus riche que tous les quiz Pokequizz.
- Le **Pokémon du jour à essais illimités**, désormais fiable côté serveur.
- L'**Œuf avec indices communs**.
- La **Party Room** : 9 jeux, sans compte, 2 à 8 joueurs, enquête en coopération.
- La **ligue hebdomadaire**.
- **Poké-Connections** et le **Draft**, qui n'existent pas chez Pokequizz.
- La profondeur de collection : album, secrets, Pokédex.

---

## 7. Plan

**Étape 1 : Assainir et faire vivre (environ 2 semaines)**
1. Masquer ou fusionner les modes cassés et les doublons. Corriger les 6 bugs visibles du §2.1.
2. Mobile : une seule ligne de commandes, saisie visible sans faire défiler, 5 suggestions visibles.
3. Une seule aide par mode, réécrite pour coller au jeu réel.
4. Règles « petite audience » (§3.2) et indice quotidien de l'Œuf.
5. Connexion Google.

**Étape 2 : Une seule boucle (environ 1 mois)**
1. Les 7 modes « Deviner » en quotidien + Illimité, 6 essais, barème commun. Cri d'abord comme pilote, puis les autres.
2. Une seule fin de partie : points + « ? », fiche, compteurs, rang, « Jeu suivant ».
3. « Ma journée Pokédle » sur l'accueil.
4. Progression en 3 boucles (§2.5).

**Étape 3 : Faire venir et revenir (environ 2 mois)**
1. Une page et une adresse par mode, un guide par mode, partage en image, parrainage.
2. Dossier du jour, Défi du jour tournant, Puzzle Connections du jour.
3. Mur des chromatiques, encart « Cette semaine sur Pokédle », FAQ, À propos, Signaler un bug.

**Indicateurs à suivre**
- Part des visiteurs qui reviennent le lendemain.
- Parties par visite.
- Part des fins de partie qui mènent à un autre jeu.
- Part des joueurs connectés.
- Nombre de joueurs classés par jour.
- Visiteurs arrivant de Google ou d'un lien partagé.
