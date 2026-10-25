# To-do Pokédle

Dernière mise à jour : 13 octobre 2026 (soir). Reste : comptes (à la fin). Passation : `side-session-notes/local_6a2c80a7-670f-4312-8d28-929de97ce3b8/passation-2026-10-13-soir.md`. Passation pour un nouveau chat : `C:/Users/chahi-za/AppData/Roaming/Claude/side-session-notes/local_e3eea6b0-6233-461d-9d40-0ed64c7cd10b/passation-2026-10-13.md`.

## En attente : GPT travaille dessus
- [x] PR #99 (étape 1, PR 2) : Quiz sur 15, Ligue 12/15, boutons Ligue, accueil « Journée terminée », points de l'Enquête, aide ✓/≈/× — vérifiée en ligne le 9/10.
  - À revérifier demain ou depuis un autre appareil : vitesse du Wordle, explication du Dossier interrompu.
- Depuis le 9/10, Claude reprend seul l'étape 1 (GPT en pause, sa PR 1 n'a jamais été poussée). Ordre validé : 1 → 4 → 3 → 6 → 7 → 8 → 11 → 9 → 10.
- [x] PR 1 livrée le 9/10 (merge 34198a4). Profil complet au rechargement, Ligue durable par semaine, parties rattachées à leur compte, plus d'écrasement par un onglet inactif, victoire en une couche, 4 épreuves dans le bloc du jour, « Épreuve suivante » juste.
  - Hors périmètre : Ligue, quêtes, série de connexion et classements « Aujourd'hui » de l'arcade passés au jour de Paris + appel `queueLeaderboardSubmit` retiré + bandeau retiré des écrans de jeu : livré le 13/10 (merge 5909e87), CI verte. Reste : sauvegardes de secours jamais relues (il faudrait un écran « restaurer », à décider).
- [x] PR 4 livrée le 12/10 (merge caa872a) : Marathon débloqué après Higher or Lower 60 s, Stat Clash Party sur six manches.
- [x] PR 3 (Drafts) abandonnée : Draft PRO et Draft Arènes retirés le 13/10 (merge ea0c6c9) ; la branche `claude/etape1-pr3` ne sert plus.
- [x] PR 6 livrée le 12/10 (merge a488121), en ligne, CI verte : compteur d'en-tête selon le mode, aides Stat mystère / Illimité / Quiz / Ordre Pokédex justes. Fait : compteur d'en-tête selon le mode (Quiz « Bonnes réponses », Poids « Série », sinon « Essais ») via `setGameCounter` ; aide Stat mystère corrigée (stats visibles dès le départ) ; aide Illimité avec la colonne Forme et les formes alternatives ; consigne du Quiz sans fausse « explication » ; carte Ordre Pokédex juste (Pokémon entre deux numéros). Vérifié à la main dans le navigateur. Reste : tests complets, commit propre, « go ».
- Note PR 4 : livrée le 12/10 (merge caa872a), CI verte.
- [x] PR 7 livrée le 12/10 (merge 140cfc1), en ligne, CI verte : classements vivants avec peu de joueurs (podium dès 3, objectif pendant la partie).
  - Détail : sous 3 classés, liste simple + « le podium a encore N places » ; objectif du Pokémon du jour pendant la partie tiré du classement du jour (1ʳᵉ place, podium, puis rang encore atteignable ; invités : record du jour seulement).
- [x] PR 8 livrée le 12/10 (merge b3dafc9), en ligne (lundi : indice Génération visible), CI verte : Œuf avec un indice par jour côté serveur, fil daté, Œuf dans le catalogue.
  - Détail : indice garanti chaque jour à 00 h (lundi génération → vendredi stade), paliers de 100 rayés gardés ; « Le fil de l’enquête » avec jour + heure et les indices datés ; carte Œuf mystère dans Deviner.
- [x] PR 11 livrée le 12/10 (merge beb5ed5), en ligne, CI verte : « Entre amis » en une seule porte vers la Party Room.
  - Détail : menu Entre amis et onglet Amis → Party Room ; catalogue Entre amis = Party Room seule ; Duel 1v1, Stat Clash, Stat Auction, Défi ami et Duel PRO dans un encart du hall.
- [ ] PR 9 puis PR 10 : comptes multi-fournisseurs, puis Google. **Reportées à la fin (décision du 12/10)** : seulement quand le site sera vraiment présentable et publiable.
- [x] Prompt « Classements & harmonie » ([PROMPT_GPT_Classements_Harmonie.md](PROMPT_GPT_Classements_Harmonie.md)) : tout en points, Global par défaut, avatars, encart « À gagner ».
  - Partie 1 livrée le 12/10 (merge 25f51c4), en ligne, CI verte : Global du jour par défaut avec sa formule, onglets du jour colorés dans l'ordre (Global, Enquête, Wordle, Dossier, Défi), tout en points avec le détail (« 34 pts · 3 essais · 1 indice », « 8 pts · 2/6 »), arcade dans « Autres classements », titre de Ligue lisible.
  - Partie 2 livrée le 12/10 (merge fe8aa47), en ligne (compagnon de Kayan visible), CI verte : compagnon en avatar partout (sinon photo du compte, sinon Poké Ball), « À gagner cette semaine » (badge Maître de Ligue, reset, Top 3 de la semaine), classements d'arcade vides masqués.
  - Page Classement `#classement` au lieu d'une fenêtre : livrée le 12/10 (merge 23ca51b), CI verte. Chantier classements terminé.
- [x] Vérification après chaque livraison : site + CI (fait pour chaque merge, voir mémoire « rythme de livraison »).

## Priorité de l'utilisateur (9/10)
- [x] Refaire la liste des modes : une seule carte de mode sur l'accueil et le catalogue, grande mascotte, objet qui montre la mécanique, les 3 illustrations en bannière « À la une » et en image de partage. Prompt : [PROMPT_GPT_Catalogue_Modes.md](PROMPT_GPT_Catalogue_Modes.md).
  - Catalogue livré par Claude le 9/10 (merge da0f8fc), en ligne et vérifié en invité.
  - Accueil avec les mêmes cartes, record Quiz « / 15 » et noms des jeux récents corrigés : livré le 9/10 (merge cbda9d2), vérifié en ligne.
  - Image de partage : faite le 24/10 autrement. Chaque page /jeux/<slug> a son aperçu (img/og/<slug>.jpg, artwork officiel de sa mascotte, `node tools/og-game-images.js`) ; la page Pokémon du jour garde la silhouette du jour. Ancien code des visuels supprimé le 13/10 (merge 1349b79).
  - **Plus d'images IA (24/10, demande de l'utilisateur : les joueurs n'aiment pas)** : les 3 illustrations du bandeau « À la une » (dont Nymphali au ruban fondu dans la patte) sont remplacées par des compositions d'artworks officiels (`node tools/catalog-feature-images.js`).
  - Ménage du 13/10 (merge 1349b79) : moteur de combat du Draft (Arènes) et anciens visuels retirés, environ 10 700 lignes, JS du site 1,34 Mo → 1,12 Mo. Moteur PRO, salles `draft-battle:*` du serveur et CSS PRO retirés (merge a54f4f8, 13/10).

## À décider
- [x] Décidé le 13/10 : retirer le Draft PRO **et** le Draft Arènes. Livré le 13/10 (merge ea0c6c9) ; les 2 contrôles mobiles étaient aléatoires (392/392 au passage suivant). Moteur PRO/Arènes dormant, à nettoyer plus tard. La branche `claude/etape1-pr3` est abandonnée.
- [ ] Lenteur : le 13/10, l'utilisateur trouve le Pokémon du jour et le Wordle « moins lents mais toujours un peu à charger ». Mesuré en ligne le 13/10 : aller-retour 0,23 s, serveur 0,58 à 1,47 s pour le Pokémon du jour (4 à 6 requêtes en série sous transaction), Wordle ~9 requêtes, Œuf 1,1 à 1,6 s. Corrigé (lecture directe en une requête, secret du jour en mémoire, connexions gardées 2 min) — livré le 13/10 (merge 4172270), vérifié en ligne : 146 ms de temps serveur au lieu de 0,58 à 1,47 s. Œuf accéléré de la même façon (merge a54f4f8, 13/10). Les chargements qui brillent (lot `claude/skeleton-menage`) rendent déjà l'attente moins vide.
- [x] **Zoom du Défi en couleurs** (signalé le 13/10 ; sans objet depuis le 19/10 : le Défi du jour est en Pixelisé uniquement) : le Défi du jour zoome au centre de l'image en couleurs, alors que le mode Zoom normal est en noir. Pas une décision voulue. Proposé : A) garder les couleurs pour le Défi (recommandé, mode rapide), ou B) noir en zoomant sur un bord. **Décidé le 13/10 : A, on garde les couleurs** (rien à changer).
- [x] Écran « restaurer ma progression » : **oui** (13/10). Livré le 13/10 (merge 4172270, CI verte) : une copie par jour sur l'appareil + une avant réinitialisation, avant que la sauvegarde en ligne remplace la progression locale et avant une restauration (5 copies max, par compte). Profil → « Gérer ma progression » → « Restaurer une copie ».
- [ ] Catalogue en 3 familles : expliqué le 13/10 (Deviner / Jouer / Entre amis ; Pokédex et album dans l'onglet Pokédex). **Décidé le 13/10 : oui.** Livré le 13/10 (merge 4172270, CI verte) : Deviner (8), Jouer (11), Entre amis (Party Room) + rubrique Outils à part (7) ; cartes Pokédex et Profil retirées du catalogue (dans le menu) ; accueil : Populaires / Deviner / Jouer.
- [x] Barème de la journée validé le 9/10 : 100 points, Enquête 40 (−2 par essai en plus, −4 par indice, minimum 4), Défi 30 (3 / 2 / 2 / 1 / 1 / 1 par Pokémon), Dossier 20, Wordle 10 (10 / 8 / 6 / 4 / 2 / 1). Livré le 9/10 (merge db2a6d7) avec la réparation de la vérification GitHub, vérifié en ligne.

## À faire

### Formes manquantes (signalé le 12/10)
Comparaison avec PokeAPI le 12/10 : le site a 172 formes (71 Méga), PokeAPI en a 326. Manquent notamment :
- [x] Méga livrées le 12/10 : 22 ajoutées (les variantes identiques en jeu ont été laissées de côté).
- [x] Formes de jeu livrées le 12/10 : 27 ajoutées (Ogerpon, Plumeline, Shifours, Cheniselle, Darumacho Transe, Meloetta, Lougaroc Nocturne, Terapagos…).
- [x] Décidé le 12/10 : sans Gigamax, Totems, Pikachu casquettes, Météno couleurs ni modes de Koraidon/Miraidon.
- [x] PR « Formes » livrée le 12/10 (merge 7fbfdc2), en ligne : 22 Méga + 27 formes de jeu (221 formes au lieu de 172) ; filtre Méga du Pokédex réparé (ne trouvait plus rien).
- [x] Correction serveur (Party Room) livrée le 12/10 (merge 342bfca) : les 172 anciennes formes prenaient la taille, le poids et l'image de l'espèce de base ; le serveur relit maintenant forms-data.json.
- [x] Formes : numéro « #10304 » au lieu de #26 et image/mesures de l'espèce de base dans certains modes. Livré le 12/10 (merge 4003350).
- [x] Party Room, Déduction : essais affichés comme le Pokémon du jour (tableau, logos de types, noms lisibles), actions en haut. Livré le 12/10 (merge 2a815aa).
- [x] Formes impossibles à départager retirées des jeux de devinette (décidé le 12/10) : Deoxys Attaque/Défense/Vitesse, Amphinobi Ash, Genesect ×4 (restent au Pokédex). Livré le 12/10 (merge 8721e00).

### Effets et animations : rendre le site vivant
Constat du 9 octobre :
- Pokédle a 166 animations CSS, mais presque toutes servent au Draft, aux combats et à Stat Clash. Sur l'accueil et la journée, il ne bouge quasiment rien (le tampon et l'arrivée de l'aventure).
- Pokequizz n'en a que 31, mais toutes sont dans la boucle de jeu.

Analyse du 9/10 en jouant : la révélation des cases existait (cases une par une), mais une règle plus récente l'avait remplacée par un flash de 0,16 s quasi invisible. Les confettis de victoire existent déjà et marchent.

Lot 1 livré le 9/10 (merge 536aa2d), vérifié en ligne : cases qui apparaissent une par une, champ qui tremble si le nom est refusé, Pokémon qui saute à la victoire, défloutage plus doux en Zoom et Pixelisé.
Lot 2 livré le 9/10 (merge eea27dc), vérifié en ligne : Wordle (lettres qui se retournent, champ qui tremble, Pokémon qui saute) + pastille « Outils » dans Jouer (les outils n'étaient plus accessibles qu'en bas de l'accueil depuis le 28/09).
Le Quiz avait déjà ses effets (bouton qui pulse ou tremble, « +1 » qui s'envole).
Lot 3 livré le 9/10 (merge 5bac58d) : Dossier (réponse qui réagit, pastille qui saute, correction et question qui glissent, score et bonus qui sautent), Défi (image qui tremble, indices qui sautent, Pokémon trouvé qui saute avec « +N », chrono qui bat sous 30 s), bilan du jour (total puis étapes une par une).

À reprendre de Pokequizz, adapté à Pokédle :
- [x] **Survol** : déjà en place (boutons et cartes qui montent, ombre).
- [x] **Mascottes et sprites** : compagnon qui flotte sur l'accueil, Pokémon qui saute à la victoire (en place).
- [x] **Bandeau d'actualités qui défile** sous le header. Livré le 12/10 (merge 1bbe981) : semaine de Ligue, indice du jour de l'Œuf, classés du Global, nouveauté des formes.
- [x] **Cases de résultat qui apparaissent** une par une, Wordle qui se retourne et tremble : livré le 9/10 (lots 1-2).
- [x] **Mauvaise / bonne réponse** : secousse, saut, confettis : livré le 9/10 (lots 1-3).
- [x] **Fenêtres** : ouverture en « pop » déjà en place.
- [x] **Chargement** : effet de brillance (skeleton) à la place de « Chargement… » : classement, position du jour, Ligue, fiche Pokédex, Plus ou Moins, Enchères, Œuf, Cri, Pokémon du jour (qui ne fait plus trembler le champ). Livré le 13/10 (merge 1349b79), CI verte.
- [x] **Révélations** : défloutage doux du Zoom et du Pixelisé, sprite qui saute : livré le 9/10.
- [x] **Raretés** : aura animée autour des chromatiques, des compagnons rares et des avatars légendaires. Livré le 12/10 (merge e61fdd7) : légendaires et fabuleux (formes comprises) ; mode chromatique du Pokédex en doré.
- [ ] **Règle** : toujours respecter « réduire les animations » du système, et ne jamais retarder l'action suivante.

### Comptes : plusieurs façons de se connecter + création de compte
C'est possible. Pokequizz propose Google, Discord, Facebook, Twitch et email + mot de passe, plus « Continuer sans compte ». Pokédle n'a que Discord.

Calendrier décidé le 9 octobre :
- ~~Bientôt (juste après l'étape 1)~~ → **à la fin** (décision du 12/10) : la base des comptes (PR 9) et Google, une fois le site présentable.
- **Quand le site sera fini** : email, Twitch, Facebook, écran de connexion final.
- [x] **Google** livré le 13/10 (merge 884e586) : table account_identities, comptes « google:<sub> », liaison quand on est déjà connecté, page /confidentialite (contact chebreub@gmail.com). Testé par l'utilisateur en navigation privée (OK), URL de confidentialité ajoutée et **application Google publiée le 13/10**. Son essai a créé un compte Google séparé : bouton « Supprimer mon compte » prévu au lot suivant, puis reconnexion Discord → « Relier Google ».
- [ ] **Compte par email** : inscription, connexion, mot de passe oublié, vérification de l'adresse. **Mis de côté le 24/10** : la page Confidentialité promet de ne garder ni e-mail ni mot de passe, et des mails fiables demandent un nom de domaine à soi (décision du 24/10 : rester sur pokdle.onrender.com tant qu'il y a peu de joueurs).
  - Il faut un service d'envoi d'emails (par exemple Resend ou Brevo, gratuits au début).
  - Mots de passe stockés chiffrés (bcrypt ou argon2), limite de tentatives.
  - Variante plus simple : connexion par lien magique envoyé par email.
- [x] **Twitch** livré le 24/10 (merge 02b955d) : OpenID Connect, scope `openid` seul (pas d'e-mail), comptes « twitch:<id> », liaison au compte connecté, bouton violet visible dès que TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET / TWITCH_CALLBACK_URL sont posées sur Render (fait par l'utilisateur le 24/10). Connexion vérifiée par l'utilisateur avec son compte.
- [ ] **Facebook** en dernier (vérification d'application plus lourde, politique de confidentialité obligatoire).
- [ ] **Écran de connexion** façon « Bon retour ! » : boutons pleine largeur par fournisseur, séparateur « ou », email / mot de passe, « Pas encore de compte ? Inscris-toi », « Continuer sans compte ».
- [ ] **Profil** : relier ou délier un fournisseur, supprimer son compte (obligation RGPD).
- [ ] **À faire par toi** : créer les applications OAuth (Google Cloud, Twitch Developers, Meta for Developers) avec les adresses de retour du site, puis donner les clés à GPT par les variables d'environnement Render. Jamais dans le code ni dans le chat.

### Étape suivante (prompt à préparer)
- [x] ~~Rendre Cri, Zoom et les autres modes « Deviner » quotidiens~~ : **abandonné le 13/10** (l'utilisateur pense que ce serait peu apprécié ou trop dur ; les modes actuels conviennent, il dira s'il veut changer).
- [ ] Catalogue resserré en 3 familles (la porte unique « Entre amis » est faite, PR 11). Aujourd'hui : Deviner, Réflexion, Arcade, Stratégie, Entre amis, Collection — à décider avec l'utilisateur.

### Corrections du 14/10 (retours de l'utilisateur) — livrées (merge 6540d98), CI verte
- [x] Dossier « Le connais-tu vraiment ? » : l'accueil affichait /20 et le jeu /10 (1 pt par réponse, 10 bonus seulement après un sans-faute). **Décidé : 2 points par bonne réponse aux 10 questions (20 max) ; le bonus reste pour le plaisir.** Anciennes parties et classements recalculés au démarrage.
- [x] Qui est-ce ? en ligne : cliquer une carte la retournait au lieu de deviner → sélecteur « Au clic : Retourner | Deviner » au-dessus de la grille + bouton direct quand il ne reste qu'une carte. Une question écrite « C'est X ? » confirmée par « Oui » (et juste) termine la partie ; « Non » retourne la carte.

### Nouveaux modes (idées de l'utilisateur, 13/10)
- [ ] **Qui est-ce ? Pokémon** (en premier, décidé le 13/10). **Lot 1 solo livré le 13/10 (merge f0bded9)** ; CI de ce merge en échec sur browser_quality sans détail accessible (logs GitHub réservés) alors que tout passe en local : vérifier au merge suivant. : grille de 24 Pokémon, questions oui/non choisies dans une liste (type, génération, couleur, stade, légendaire, taille, poids…), réponses automatiques, cartes éliminées retournées, proposition possible.
  - **Retour de l'utilisateur le 13/10 après un test avec un ami : la « course au même mystère » n'est pas le vrai Qui est-ce ?.** Vrai principe validé : à deux, même grille, chacun **choisit** son Pokémon, tour par tour une question sur celui de l'autre (bouton, écrite ou à l'oral) et **l'autre répond** oui/non ; **une question par catégorie (5 en tout)** ; **une mauvaise proposition fait perdre le tour** ; cartes retournées automatiquement après une question-bouton, à la main sinon. **Livré le 13/10 (merge b984652)** (mode `quiestce1v1`, la course est retirée). À refaire tester par l'utilisateur avec un ami.
  - Lot 2a livré le 13/10 (merge 40b194d) : **course à plusieurs** dans la Party Room (mode `quiestce`, lib/party-quiestce.js, 2 à 8, même grille et même mystère, questions privées, premier qui trouve +100) + **Supprimer mon compte** (POST /api/account/delete, transaction) + correctif du test Bulbizarre. Reste le **1 contre 1 classique** tour par tour (lot 2b).
  - Lot 1 : solo contre l'ordinateur (record = le moins de questions). Lot 2 (validé le 13/10) : dans la Party Room, **1 contre 1 classique** (chacun son secret, tour par tour) **et course à plusieurs** (même mystère pour 2 à 8, réponses privées, le premier qui trouve gagne).
- [ ] **Base de données (19/10)** : Neon gratuit saturé (100 CU-h/mois) → base déplacée sur Supabase gratuit, Oregon (comme Render). Import automatique en ligne (lib/db-import.js, merge d4878ff) : il se lancera seul dès que Neon répond. **Le 1/11** : vérifier dans les logs Render la ligne « [import] old data restored », importer les anciennes données Neon (variable Render `OLD_DATABASE_URL`) en gardant les meilleurs scores, et faire changer le mot de passe Neon à l'utilisateur (vu en clair sur une capture), puis mettre à jour `OLD_DATABASE_URL`.
- [ ] **Domaine pokdle.fr (25/10)** : acheté chez OVH par l'utilisateur (1 an, 5,99 € TTC, renouvellement oct. 2027 à 7,79 € HT ; e-mail du titulaire confirmé pour NIS2). Un 2e débit Apple Pay de 6 € à vérifier vers le 28/10 (sinon ticket OVH, commande 261487651). Code prêt (lib/site-move.js) : 301 de pokdle.onrender.com vers pokdle.fr, transfert automatique de la progression (localStorage + cookies compte, défi du jour, œuf) au premier passage par l'ancienne page d'accueil. **À fusionner seulement quand pokdle.fr est vert dans Render.** Ensuite, côté utilisateur : adresses de retour Discord / Google / Twitch et variables `*_CALLBACK_URL` sur Render, pingeur sur `https://pokdle.fr/api/multiplayer/health`, Search Console (nouvelle propriété, sitemap, « Changement d'adresse ») et Bing (déplacement de site).
- [x] **Défi du jour : Pixelisé uniquement** (19/10) — le Cri (trop dur) et le Zoom centré (trop simple) sont retirés du quotidien ; les modes libres Zoom et Cri restent.
- [x] **(Livrée le 19/10, merge 5fcdb63 ; bonus hors barème des 100 pts, à confirmer par l'utilisateur) Grille du jour (« Puzzle » façon PokéDoku), demandée le 14/10, à faire dans la journée Pokédle avec notre DA, en mieux** : grille 3×3, 3 critères en colonnes et 3 en lignes (types, région/génération, forme Méga/Gigamax/régionale, couleur, stade…) ; chaque case = un Pokémon qui coche sa ligne ET sa colonne ; 9 essais (« PP 6/9 ») ; chaque bonne réponse affiche son % de rareté (part des joueurs qui l'ont choisie) ; score d'originalité (« UNIQ ») + rang ; bouton abandonner. Même grille pour tous chaque jour (serveur), vérifier qu'il existe au moins une réponse par case. Capture de référence fournie par l'utilisateur (site anglais sombre « Today's Puzzle »).
- [x] **(Livré le 19/10, merge d4878ff)** **Petit Bac Pokémon** (après) : une lettre, une catégorie par colonne, 2 à 8 joueurs dans la Party Room + solo contre le chrono. Validation **automatique** sur les données + **catégories libres validées par un vote** en option (décidé le 13/10). Points : 2 si réponse unique, 1 si partagée. Lettre tirée seulement si chaque catégorie a au moins une réponse.
- Comptes : l'idée retenue garde l'identifiant Discord comme numéro de compte interne (aucune migration des records) + une table de liaison des fournisseurs. Toujours pour la fin.
  - **Fait par l'utilisateur le 13/10** : Google Cloud configuré (à confirmer : clés dans Render). Avant : l'utilisateur prépare Google Cloud (projet, écran de connexion en mode Test, client Web avec `/auth/google/callback`, clés `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` dans Render). **À faire par Claude : une page de confidentialité** (`/confidentialite`), demandée par Google avant publication et obligatoire (RGPD).

### Maquette
- [ ] (Abandonné ?) Mettre la maquette Claude Design à jour : l'utilisateur ne veut plus de maquettes depuis le 9/10.
