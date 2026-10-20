Refonte du mode « Pokémon du jour » de Pokédle, inspirée du fonctionnement des quotidiens de Pokequizz (pokequizz.com), sans copier leurs règles. Garde la DA cosy et la coque de jeu déjà définies. IMPORTANT : mon analyse vient d'une copie locale de juillet ; vérifie chaque point sur la branche principale actuelle avant de coder et signale-moi ce qui a déjà changé (ligue, filtres de classement…).

## Ce qui rend les quotidiens de Pokequizz efficaces (à transposer)
- Un rendez-vous numéroté (« JOUR #153 »), identique pour tous, renouvelé à minuit heure de Paris, et limité par le SERVEUR (changer d'appareil ne contourne rien).
- Deux façons de jouer : « Commun » (la partie du jour, comptée au classement) et « Rejouer » (parties perso, compte requis, nombre compté par jour limité).
- Un score lisible et expliqué : base + bonus d'efficacité + bonus de rapidité + question bonus, avec un « ? » qui détaille le calcul.
- « Score à battre aujourd'hui : pseudo, valeur » affiché sur la carte du mode et en haut de la partie ; égalités départagées au temps.
- Une progression qui fait revenir : séries par mode, avatar débloqué à 7 victoires d'affilée, chance de chromatique par bonne réponse, mur public des chromatiques, lot de la semaine.
- Une seconde couche pour les meilleurs : un sans-faute ouvre une grille bonus qui s'ajoute au score.
- Des stats réelles publiées (taux de réussite, Pokémon les plus ratés) et un guide par mode relié au jeu.

## État actuel de Pokédle (copie de juillet, à confirmer)
- Cible tirée CÔTÉ CLIENT (`getDailyPokemon`, seed `pokedle:<date UTC>`), reset à minuit UTC, réponse connue du navigateur, aucune vérification serveur.
- Essais illimités, défaite seulement par « Abandonner ». Une partie par jour bloquée seulement en localStorage (contournable).
- Aucun score, aucun classement pour le daily (`solo:daily` n'est qu'un événement de tracking) ; +80 XP fixes à la victoire.
- Aucun indice progressif dans le daily, alors que l'accueil promet « un nouvel indice à chaque essai ».
- Série en localStorage synchronisée par `/api/profile` sans validation ; distribution des essais en mémoire serveur (perdue au redéploiement), sans authentification.
- Bugs relevés : série affichée avec un jour de retard sur l'écran de fin (`showWin` avant `registerWin`) ; partie à cheval sur minuit enregistrée sur le mauvais jour et bloquant le vrai daily ; date d'accueil locale vs cible UTC ; série périmée tant que l'onglet reste ouvert ; distribution qui ne compte que les victoires mais se présente comme « les dresseurs aujourd'hui » ; marqueur « déjà envoyé » posé même si le serveur refuse ; « Copier » visible après abandon et partage sans date ni numéro ; victoire comparée par nom au lieu de l'id ; textes d'aide (▲/▼) différents du jeu (↑/↓).

## Cible : « Pokémon du jour » v2
### A. Fiabilité (prérequis à tout classement ou récompense)
1. Tirage et comparaison CÔTÉ SERVEUR : `GET /api/daily` (numéro du jour, date, essais déjà faits, état) et `POST /api/daily/guess` (renvoie la ligne de comparaison calculée par le serveur avec les règles actuelles : `compare`, `compareColors`, `cmpNum` ±0,3 m / ±15 kg, types inversés = partiel, forme). Le secret n'est jamais envoyé avant la fin.
2. Reset à minuit Europe/Paris partout (cible, accueil, compte à rebours). Numéro « JOUR #n » depuis la date de lancement.
3. Tirage sans répétition sur une fenêtre (ex. pas le même Pokémon avant 365 jours), toujours une espèce de base.
4. Parties et résultats en Postgres par compte (et par empreinte pour les invités) : une partie Commun par jour, impossible à rejouer en vidant le cache. Série calculée par le serveur.
5. Corriger tous les bugs listés ci-dessus.

### B. Règles et score (garder l'ADN Pokédle)
- On garde les essais ILLIMITÉS (personne n'est bloqué), mais le score baisse : 10 pts au 1er essai, −1 par essai supplémentaire, minimum 1 point.
  - Alternative à me proposer si tu la juges meilleure : 8 essais maximum avec défaite.
- Bonus rapidité léger : +2 sous 1 min, +1 sous 3 min. Bonus série : +1 à partir de 3 jours d'affilée.
- Question bonus après la victoire (+1 pt) : une question à 4 choix sur le Pokémon trouvé (talent, évolution, jeu de première apparition…).
- Le « ? » de l'écran de fin détaille le calcul.
- Abandon = 0 point et série cassée, écran de fin « Raté, c'était… ».

### C. Indices progressifs (tenir la promesse de l'accueil)
- Carnet d'enquête en carte centrale : silhouette au 5ᵉ essai, description Pokédex (nom masqué ***) au 8ᵉ, cri au 11ᵉ.
- Puces « Ce que tu sais déjà » déduites des lignes (types, habitat, couleur, fourchettes de taille/poids, stade).
- Chaque indice débloqué réduit le score maximum (−1 par indice utilisé) pour garder la compétition juste.

### D. Commun / Rejouer
- Sélecteur « Du jour / Illimité » dans la coque. Du jour = la partie Commun. Illimité = parties perso (compte requis pour être comptées), les 3 premières de la journée comptent au classement « Illimité ».

### E. Classement et motivation
- Classement du jour du Pokémon du jour : score, puis essais, puis temps. Périodes Aujourd'hui / 7 derniers jours / Records.
- « Score à battre aujourd'hui : pseudo, N essais » sur la carte d'accueil et en haut de partie avant le premier essai ; pendant la partie, objectif personnel atteignable ; après, rang + voisins.
- Distribution fiable (en base, tous les résultats y compris abandons) : « Tu as fait mieux que 72 % des dresseurs aujourd'hui ».
- Partage sans spoiler : « Pokédle #278 · 4 essais · 🔥5 » + grille d'emojis + lien ; partage en image en option.

### F. Progression et récompenses
- Série du Pokémon du jour : compagnon débloqué à 7, 30 et 100 jours (avatar de profil).
- Chance de chromatique à chaque victoire (1/512), ajoutée à la collection, avec un mur public « Chromatiques » (qui, lequel, via quel mode, date).
- Les points du daily alimentent la ligue de la semaine si elle existe déjà sur la branche principale.

### G. Enchaînement quotidien (la journée Pokédle)
1. Pokémon du jour (déduction) → écran de fin.
2. Bouton « Ouvrir son dossier » : « Le Dossier du jour », 10 questions à 4 choix sur le Pokémon qu'on vient de trouver (stats, talents, évolutions, cri, Pokédex), pas de mort subite ; un 10/10 ouvre 10 questions bonus qui s'ajoutent (jusqu'à 20). Même questions pour tous, une tentative par jour, temps uniquement pour départager.
3. « Jeu suivant » : le Défi du jour (un mode différent chaque jour, ex. lundi Zoom, mardi Cri…, 10 Pokémon en 5 minutes).

### H. Guide et stats
- Page guide « Pokémon du jour » (règles, lecture des couleurs, méthode, FAQ) reliée depuis « Astuces pour ce jeu ».
- Stats publiques recalculées depuis la base : taux de réussite, essais moyens, Pokémon les plus ratés / les mieux trouvés (sans données individuelles).

## Lots
1. Lot A : fiabilité serveur + reset Paris + numérotation + bugs. Rien de visible ne doit casser : même comparateur, même ressenti.
2. Lot B + E : score, écran de fin avec « ? », classement du jour, score à battre, distribution, partage.
3. Lot C + D : indices progressifs + carnet, Du jour / Illimité.
4. Lot G : Dossier du jour, puis Défi du jour.
5. Lot F + H : récompenses (compagnons, chromatiques, mur public), guide et stats.
Pour chaque lot : une PR, tests (tirage identique pour tous, reset à minuit Paris, partie à cheval sur minuit, impossibilité de rejouer le Commun, calcul du score, série), captures 1366×768 et 390 px. Si une règle ou une donnée existante contredit ce brief, demande-moi avant de trancher.
