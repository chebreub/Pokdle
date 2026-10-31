# To-do Pokédle

Dernière mise à jour : 30 octobre 2026. La passation complète et à jour est dans `CLAUDE.md` (racine du dépôt) ; ce fichier garde le détail des chantiers.

## Le 29/10 (session Claude)
- [x] #158 : `CLAUDE.md`, la passation lue au début de chaque session.
- [x] #159 : tests Défi et Dossier réparés (colonne `photo_key`), CI de `main` de nouveau verte.
- [x] #160 : Stat Mystère, la première lettre s'affiche au 5e essai (3 victoires pour 43 abandons sur 14 jours).
- [x] #161 : panneau admin `/admin` (bandeau d'actualités, retrait de photos). Variable Render `ADMIN_ACCOUNT_IDS` posée par l'utilisateur le 29/10.
- [x] #162 : carte « Niveau supérieur » et bandeau « Succès débloqué ».
- [x] #163 : Draft Score Attack revue (paliers Standard / Solide / Elite / Master au lieu de « Exceptionnel » partout en Gen 9, jauge avec paliers, barre de relance sur téléphone, « Défier un ami »).
- [x] #164 : bouton des générations qui dit ce qui est choisi, classement simplifié (un menu, semaine par défaut s'il y a peu de joueurs, écart avec le joueur au-dessus).
- [x] #165 : annonce des nouveautés, invitation « Donne ton avis », TODO et kit de lancement à jour.
- [x] #166 : profil sur deux appareils, les progressions s'additionnent au lieu de s'écraser.
- [x] #167 : flèches de génération, taille et poids en pastilles (« ↑ plus récente »), et « Party Pokémon » renommé « Marathon mini-jeux » dans les missions (Entei, Scarabrute, Brutalibré, Félinferno, Victini).
- [ ] Bandeau d'actualités : l'annonce « animations et Draft revue » s'arrête le 5/11. Ensuite, la changer dans le panneau admin.
- [x] #169 : défis du jour « Consulte le Pokédex » et « Joue à 3 modes différents » réparés (ils n'étaient jamais comptés, donc impossibles).
- [x] #170 : passation à jour, images mystère non glissables (correctif rapide de la triche ci-dessous), mission Hexadron → Party Room.
- [x] #171 / #172 : nouveau jeu Party Room « Dessine-le ! », puis v2 (stylo débloqué, Remplir, 16 couleurs, modèle plus grand). À tester avec les collègues avant de l'annoncer.
- [x] 29/10 au soir : Render a coupé le site (750 heures gratuites épuisées, partagées avec carnet-force). Pokdle passé en payant (7 $/mois). Rappel le 1/11 pour décider de repasser en gratuit.
- [x] Outil vidéo rangé dans `tools/video/` (30/10, #173).

## Le 30/10 (session Claude)
- [x] #174 : QA navigateur réparée (carte « Niveau supérieur » qui bloquait des clics).
- [x] #175 : rappel du Pokémon du jour par notification (voir plus bas).
- [x] #176 : partage du Pokémon du jour en défi (`/?defi=…`, aperçu « Trouvé en N essais », objectif sous le titre).
- [x] #177 : nouveau jeu « Shiny ou normal ? ».
- [x] Testé sur mon téléphone et annoncé dans le bandeau (30/10). Le 31/10 au matin : vérifier que la notification 🔔 est bien arrivée.
- [x] #179 : chat de la Party Room (bouton dans l'en-tête du salon, réactions, réponse cachée aux autres).
- [ ] Partie avec les collègues : Dessine-le ! et le chat (retours à remonter).
- [ ] Dans quelques jours, regarder dans `/admin/stats` : rappels activés, partages, arrivées par lien de défi, parties de Shiny ou normal.
- [ ] Faire connaître le site : mail à Fildrong (rédigé le 30/10), Pokébip, Discord Pokémon FR. Pas de serveur Discord à nous avant 100 joueurs par jour.
- [ ] **Triche à corriger plus tard (signalée le 29/10) : Zoom, Pixelisé et autres jeux d'image.** En cliquant sur l'image et en la glissant sur le côté, on voit le vrai sprite, sans le zoom ni la pixelisation. Cause : le jeu affiche la vraie image (`<img id="silhouette-sprite">`, `<img id="pixel-sprite">`) et ne fait que la déformer en CSS ; l'adresse de l'image contient aussi le numéro du Pokémon. Correctif rapide (bloque le glisser) : `draggable="false"` et pas de clic sur l'image. Vrai correctif : le serveur envoie l'image déjà zoomée ou pixelisée, sous une adresse qui ne dit pas quel Pokémon c'est, et le site la dessine dans un canvas. À vérifier aussi : l'Ombre et le Qui est-ce ?.
- [x] **Rappel du Pokémon du jour par notification (idée du 29/10, codé le 30/10).** Notifications du navigateur, seulement si le joueur active « 🔔 Me rappeler le Pokémon du jour ». Une par jour au plus, à l'heure qu'il choisit, et rien s'il a déjà joué. Marche directement sur Android et PC ; sur iPhone, il faut d'abord ajouter le site à l'écran d'accueil (petit guide à prévoir). Rien à régler sur Render : les clés sont créées par le serveur et rangées dans la base (ou lues dans `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` si on les pose un jour). Nombre de rappels activés visible dans `/admin/stats`.
- [ ] Vidéos TikTok / Shorts : 10 vidéos faites (sans musique ni voix IA). « 5 pixelisés » mélangée : 0 vue. Décision du 30/10 au soir : **jamais ma tête ni ma voix**. Plus de « 5 shinies » non plus (Shiny ou normal est trop facile pour les connaisseurs).
- [x] 30/10 au soir : **vidéo de présentation du site** (52 s, motion design sur le vrai site filmé, PC et téléphone, clics de clavier, ambiance nature faite maison, vrais cris) et une **story** de 12 s. Outil rangé dans `tools/video/pub/`. À poster par moi.
- [ ] 6/11 à 10 h (rappel programmé) : relancer Fildrong avec l'angle Party Room et 4 captures, s'il n'a pas répondu.

## Plan d'attaque (validé le 30/10 au soir)
Idée : d'abord faire revenir ceux qui viennent déjà, puis être trouvé sur Google (ça monte doucement, sans afflux d'un coup), puis le bouche-à-oreille entre amis. Tiré de l'étude de PokeMind et de PokeQuizz (voir `CLAUDE.md`, section 6).

### Étape 0 : sécuriser
- [x] Outil de la pub sauvegardé dans `tools/video/pub/`, plan et passation à jour.
- [ ] 31/10 : vérifier la notification 🔔. 1/11 : décision Render et import Neon.
- [ ] Mesurer le retour des joueurs dans `/admin/stats` (part qui revient le lendemain et la semaine suivante).

### Étape 1 : faire revenir
- [x] **Classement en points cumulés** (#182, 31/10) : « Semaine » et « Tout le temps » additionnent les points de chaque jour au lieu de garder la meilleure journée, et chaque épreuve jouée compte même si les quatre ne sont pas finies. Les modes « record » (Higher or Lower, Quiz, Speedrun…) gardent leur classement à part : leurs scores viennent du navigateur.
- [x] Podium du top 3 et lot de la semaine avec compte à rebours (comme PokeQuizz), fait le 31/10 (option A choisie) :
  - « Semaine » va du lundi au dimanche (heure de Paris) dans tous les classements, au lieu des 7 derniers jours ;
  - podium 2-1-3 en haut de chaque classement (dès 3 classés), avec l'artwork du partenaire ;
  - encart « À gagner cette semaine » à la place de la carte de la Ligue : le 1er du Global de la semaine a son partenaire en shiny pendant toute la semaine suivante, dans tous les classements et sur sa carte de dresseur ; médaille d'or, d'argent ou de bronze pour le podium (sur la carte de dresseur) ;
  - les gagnants sont écrits une seule fois dans la table `weekly_awards` à la première visite de la nouvelle semaine (`App/lib/weekly-awards.js`, rien à régler sur Render) ;
  - la Ligue garde son badge et son classement dans le menu « Classement ».
- [x] Clic sur un pseudo → sa carte de dresseur, fait le 31/10 : fenêtre par-dessus le classement (liste, podium, champion), avec partenaire (shiny si champion), niveau et titre, médailles, « Membre depuis », jours joués, Pokémon du jour trouvés, meilleure série, points cumulés, stats des 4 jeux du jour et 3 derniers records d'arcade. Chiffres calculés par le serveur (`App/lib/player-cards.js`, `GET /api/player/:pid`) ; chaque joueur a un identifiant public (`App/lib/player-ids.js`), jamais son numéro de compte ; la photo seulement si le joueur l'a partagée.
- [x] Chasse au shiny, faite le 31/10 (carte blanche) : trouver le Pokémon du jour = le capturer, avec une carte « Pikachu rejoint ta collection » dans le résultat. Chance de shiny : **1/40**, **1/30** dès 7 jours de série, **1/20** dès 30 jours (comme le chaînage des jeux) ; la chance s'affiche sur la carte avec le prochain palier. Tirage fait une seule fois par le serveur à la victoire et gardé avec la partie (colonne `shiny` de `daily_plays`) : impossible de tricher. Vitrine « ✨ Mes shinies » sur ma carte de dresseur et « ✨ Shinies » sur la carte des autres (clic sur un pseudo) ; filtre « ✨ Shinies » dans Pokédex → Ma collection. La collection elle-même existait déjà (chaque victoire ajoute le Pokémon). Plus tard, avec plus de joueurs : une page commune « Qui a quel shiny ? » comme PokeQuizz.
- [x] Bande « À plusieurs » sur l'accueil, faite le 31/10 (carte blanche) : les nouveaux ne voyaient pas qu'on peut jouer entre amis (la seule carte était tout en bas). Entre le Pokémon du jour et les mini-jeux : « Joue avec tes amis, en direct », 4 jeux en artwork (Dessine-le !, Qui est-ce ?, Petit Bac, Course au Pokédex), « Créer un salon » et « J'ai un code ». Un clic sur un jeu ouvre la Party Room avec ce jeu déjà choisi. Pas de compteur « en ligne » (chez PokeMind, « 1 en ligne » fait site vide).
- [x] Réglages, faits le 31/10 : curseur **Volume** de 10 à 100 % (avec « ▶ Tester ») sous « Effets sonores » et « Cris des Pokémon », pour tous les sons ; les cris joués hors du mode Cri (Pokédex, enregistrements) respectent maintenant l'interrupteur « Cris des Pokémon » ; le mode Cri joue toujours son cri, au volume choisi. **Mode « sans chrono » écarté** : les jeux de devinette n'ont déjà pas de chrono, et dans les modes chronométrés (Speedrun, Combo de types, Higher or Lower 60 s, Défi du jour, Petit Bac) le chrono fait le jeu ou le classement. À revoir si un joueur le demande.
- [x] Messages de l'admin aux joueurs connectés, faits le 31/10 : section « Écrire aux joueurs » dans `/admin` (un joueur choisi par son pseudo, ou tous ceux qui ont un compte), fenêtre 📬 « Un message pour toi » à la prochaine visite (montrée une fois), réponse possible (3 au plus par message) qui s'affiche sous le message dans `/admin`, notification si le joueur a activé 🔔 (case à cocher). Un message à tous reste visible 14 jours et ne va qu'aux comptes qui existaient déjà ; tout est effacé au bout de 90 jours ou avec le compte (`App/lib/player-messages.js`). Pas d'e-mail (on ne le garde pas) ni de message Discord (il faudrait un serveur commun). Page de confidentialité à jour.

### Étape 2 : être trouvé sur Google (en parallèle)
- [ ] Enrichir les pages `/jeux/<slug>` : comment jouer, astuces, jeux similaires (comme PokeMind). Commencé le 31/10 : « Comment jouer », « Bon à savoir » et « D'autres jeux » existaient déjà ; ajout des sections **Astuces** et **Questions fréquentes** (avec données structurées FAQ pour Google) sur le Pokémon du jour, le Wordle, Higher or Lower, Qui est-ce ?, le Petit Bac et les jeux entre amis ; page « Jeux Pokémon entre amis » mise à jour (12 jeux, Dessine-le !, chat) ; **nouvelle page `/jeux/dessine-le-pokemon`** (« le Pictionary Pokémon entre amis », le bouton ouvre le salon avec Dessine-le ! déjà choisi) ; liens vers ces deux pages sur l'accueil. Reste : astuces et questions des autres pages.
- [ ] 5 premiers guides avec artworks officiels et un bouton vers le jeu : méthode du Pokémon du jour, table des types, générations, starters, légendaires (comme PokeQuizz).
- [ ] Viser « Pokémon du jour » et « jeux Pokémon entre amis » plutôt que « pokedle », disputé par trois sites.
- [ ] Plus tard (pas avant décembre) : l'anglais.

### Étape 3 : le bouche-à-oreille
- [ ] Parrainage : le lien de défi débloque un badge ou un avatar quand un ami vient jouer.
- [ ] Fildrong le 6/11, puis d'autres streamers (un ou deux par semaine au plus).
- [ ] Vidéos : la pub, puis une ou deux vidéos courtes par semaine au plus, format « Tu reconnais ce Pokémon ? » (le seul qui marche un peu chez PokeMind).

### Plus tard (au-delà de 100 joueurs par jour)
- Serveur Discord, chat public, vrai correctif de la triche des images. Pub ou boutique seulement vers 10 000 joueurs par mois (PokeQuizz en est là).

### Suivi
- Un point par semaine dans `/admin/stats` : joueurs par jour, part qui revient, d'où ils viennent. Premier point le 5/11.

## En attente : GPT travaille dessus (archives, avant le 14/10)
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

### Prochains chantiers (notés le 25/10 à la demande de l'utilisateur)
- [x] **Niveaux, XP et aventure : nouvelle architecture.** Proposition A choisie le 25/10 (page « Nouveaux niveaux Pokédle ») :
  - 100 niveaux, chaque niveau coûte 50 XP de plus que le précédent, un titre tous les 10 niveaux, étoiles après 100. XP conservée, badge Pionnier pour les anciens « Mythe Pokémon ». Livré le 25/10 (PR #147).
  - L'aventure rapporte de l'XP (Pokémon, missions, secrets, régions) ; un jeu ne rapporte que la moitié après 500 XP dans la journée. Livré le 25/10 (PR #147).
  - Le niveau à côté des pseudos (classements, Ligue, top 3 de la semaine, Party Rooms). PR suivante.
  - Plus tard : les badges d'arène (proposition C) pour la refonte du profil ; les saisons (proposition B) si on veut un rendez-vous mensuel.
- [ ] **Profil : direction artistique et fonctionnalités à revoir** (commencé le 25/10 avec la carte de dresseur, PR #149), en regardant ce que font les concurrents ou en imaginant mieux (carte de dresseur, partenaire, progression, succès, historique, notes des jeux, favoris).

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
- [ ] **Compte par email** : inscription, connexion, mot de passe oublié, vérification de l'adresse. **Mis de côté le 24/10** : la page Confidentialité promet de ne garder ni e-mail ni mot de passe, et des mails fiables demandent un nom de domaine à soi (la décision du 24/10 de rester sur pokdle.onrender.com est annulée : le site est sur pokdle.fr depuis le 25/10).
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
- [x] **Domaine pokdle.fr (25/10)**, en ligne depuis la PR #140. Reste à confirmer côté utilisateur : adresses de retour des connexions, pingeur, Search Console et Bing (détail ci-dessous). Ancienne note : acheté chez OVH par l'utilisateur (1 an, 5,99 € TTC, renouvellement oct. 2027 à 7,79 € HT ; e-mail du titulaire confirmé pour NIS2). Un 2e débit Apple Pay de 6 € à vérifier vers le 28/10 (sinon ticket OVH, commande 261487651). Code prêt (lib/site-move.js) : 301 de pokdle.onrender.com vers pokdle.fr, transfert automatique de la progression (localStorage + cookies compte, défi du jour, œuf) au premier passage par l'ancienne page d'accueil. **À fusionner seulement quand pokdle.fr est vert dans Render.** Ensuite, côté utilisateur : adresses de retour Discord / Google / Twitch et variables `*_CALLBACK_URL` sur Render, pingeur sur `https://pokdle.fr/api/multiplayer/health`, Search Console (nouvelle propriété, sitemap, « Changement d'adresse ») et Bing (déplacement de site).
- [x] **Défi du jour : Pixelisé uniquement** (19/10) — le Cri (trop dur) et le Zoom centré (trop simple) sont retirés du quotidien ; les modes libres Zoom et Cri restent.
- [x] **(Livrée le 19/10, merge 5fcdb63 ; bonus hors barème des 100 pts, à confirmer par l'utilisateur) Grille du jour (« Puzzle » façon PokéDoku), demandée le 14/10, à faire dans la journée Pokédle avec notre DA, en mieux** : grille 3×3, 3 critères en colonnes et 3 en lignes (types, région/génération, forme Méga/Gigamax/régionale, couleur, stade…) ; chaque case = un Pokémon qui coche sa ligne ET sa colonne ; 9 essais (« PP 6/9 ») ; chaque bonne réponse affiche son % de rareté (part des joueurs qui l'ont choisie) ; score d'originalité (« UNIQ ») + rang ; bouton abandonner. Même grille pour tous chaque jour (serveur), vérifier qu'il existe au moins une réponse par case. Capture de référence fournie par l'utilisateur (site anglais sombre « Today's Puzzle »).
- [x] **(Livré le 19/10, merge d4878ff)** **Petit Bac Pokémon** (après) : une lettre, une catégorie par colonne, 2 à 8 joueurs dans la Party Room + solo contre le chrono. Validation **automatique** sur les données + **catégories libres validées par un vote** en option (décidé le 13/10). Points : 2 si réponse unique, 1 si partagée. Lettre tirée seulement si chaque catégorie a au moins une réponse.
- Comptes : l'idée retenue garde l'identifiant Discord comme numéro de compte interne (aucune migration des records) + une table de liaison des fournisseurs. Toujours pour la fin.
  - **Fait par l'utilisateur le 13/10** : Google Cloud configuré (à confirmer : clés dans Render). Avant : l'utilisateur prépare Google Cloud (projet, écran de connexion en mode Test, client Web avec `/auth/google/callback`, clés `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` dans Render). **À faire par Claude : une page de confidentialité** (`/confidentialite`), demandée par Google avant publication et obligatoire (RGPD).

### Maquette
- [x] Plus de maquettes Claude Design (9/10). Quand une maquette est demandée, elle se fait sur le vrai site en local (captures ou courte vidéo), comme pour la Draft et les niveaux le 29/10.
