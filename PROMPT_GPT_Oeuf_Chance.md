Nouveau mode communautaire pour Pokédle : « L'Œuf mystère » (inspiré du mode Œuf Chance de Pokequizz, avec une touche d'enquête propre à Pokédle). À faire APRÈS le lot 1 de la refonte cosy, avec les mêmes tokens et la même coque de page de jeu.

## Principe
- Chaque semaine, le serveur tire au sort un Pokémon parmi tous ceux du Pokédex (formes de base). Tous les joueurs cherchent LE MÊME.
- Chaque joueur a 1 essai par jour sans compte, 2 avec compte (Discord). Choix en touchant un sprite dans la grille ou en tapant son nom.
- Un mauvais essai est rayé POUR TOUT LE MONDE : la grille se vide, les chances montent (« 312 rayés · 1 chance sur 713 »).
- Signature Pokédle : tous les 100 Pokémon rayés, un indice commun se débloque pour tous, dans cet ordre : génération → 1er type → couleur → habitat → stade. Les indices débloqués grisent automatiquement les Pokémon incompatibles (option « Masquer les incompatibles »).
- Le premier qui trouve gagne la récompense de la semaine (compagnon/avatar ; s'il l'a déjà, un autre). Reset le lundi à minuit (Europe/Paris), trouvé ou non. Le mode ne compte PAS au classement.

## Écran (coque de jeu commune)
1. Barre : ← Retour · pastille « L'Œuf mystère » · « Comment jouer ? » (3 étapes) · « ESSAIS x/2 ».
2. Carte « À gagner » : sprite de la récompense en bulle pastel, nom, compte à rebours « 5 j 12 h avant le reset de lundi ».
3. Ligne d'état : « Pokémon rayés : 312 · 1 chance sur 713 » + bascule « Masquer les Pokémon tentés ».
4. Indices communs : 5 pastilles (débloquées / « dans 38 rayés »).
5. Grille de tous les sprites, regroupés par génération sur des bandes pastel (une couleur par génération), défilante dans un cadre arrondi. Rayé = sprite grisé + barré ; incompatible avec les indices = atténué. Cases ≥ 44 px sur mobile, sprites chargés en différé.
6. Champ de saisie avec suggestions (même composant que le Daily).
7. Fil « En direct » : « Pseudo a tenté Krabby · 10:38 » (20 derniers), joueurs sans compte affichés « Anonyme ».
États à prévoir : plus d'essai aujourd'hui (proposer la création de compte pour le 2e essai), gagnant trouvé cette semaine (afficher le gagnant, la grille reste consultable), chargement, erreur réseau.

## Serveur (server.js + Postgres existants)
- Tables : `egg_rounds` (id, week_start, secret_id, found_by, found_at, reward_id), `egg_guesses` (round_id, pokemon_id UNIQUE par round, player_id ou anon_id, created_at).
- Le secret n'est JAMAIS envoyé au client. Endpoints : `GET /api/egg` (état : rayés, indices débloqués, récompense, essais restants, fil), `POST /api/egg/guess` (vérifie quota, Pokémon pas déjà rayé, compare côté serveur, transaction pour que le premier gagnant soit unique).
- Quota : par compte (2/jour) et par empreinte anonyme + IP (1/jour), limite de débit sur l'endpoint.
- Récompense attribuée uniquement à un compte connecté ; en cas d'essais simultanés, le premier enregistré en base gagne.
- Temps réel : simple polling toutes les 15 s (pas besoin de WebSocket au début).

## Validation
Captures 1366×768 et 390 px, mode sombre, aucun débordement. Tests : quota, double essai sur le même Pokémon, gagnant unique, reset hebdomadaire, indices débloqués aux bons paliers. Signale-moi tout conflit avec l'existant (comptes, avatars, ligue) avant de l'inventer.
