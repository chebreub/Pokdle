# Passation Pokédle (pokdle.fr), à lire en entier avant d'agir

Rédigée le 27/10/2026 et mise à jour le 30/10/2026 au soir, à partir de nos sessions Claude Code passées, du dépôt, de `TODO_Pokedle.md` et des PR GitHub. Les infos incertaines ou anciennes sont signalées par **(à confirmer)**.

---

## 1. Qui je suis et comment me parler

- **Prénom :** Zakaria. **Pseudo :** Kayan. Compte GitHub : `chebreub`. Chebreub est aussi mon pseudo de viewer sur Twitch **(à confirmer)**.
- Pokédle est **mon projet perso**. Il est né d'un délire au boulot avec mes collègues, qui y jouent et me font des retours. Ne mélange jamais avec mon travail.
- **Tutoiement** dans les deux sens. Réponds en **français**, simplement, sans jargon.
- **Réponses courtes**, une étape à la fois. Je lis souvent sur iPhone, fatigué, et j'écris vite avec des fautes.
- **Comment je valide :**
  - Tu proposes (avec des captures quand c'est visuel), puis tu attends mon **« go »**.
  - Si tu proposes des options A/B/C, je réponds « go A » ou juste « 1 ».
  - « Quoi faire mnt ? » veut dire : propose-moi la suite par ordre de priorité.
- **Consigne permanente** (citée telle quelle dans la passation précédente) : « Ne modifie aucun fichier, ne crée aucune PR et ne déclenche aucun déploiement sans mon accord. »
- **Ce qui m'agace :**
  - **Gaspiller mes tokens sans résultat.** Le 18/10, une session vidéo a consommé 78 % du quota pour un résultat inutilisable. J'étais furieux (« tu m'as arnaqué mes tokens »). Annonce le coût d'un gros chantier avant de le lancer et livre quelque chose de concret.
  - **Ce qui « fait IA » :** voix IA, images IA (les joueurs n'aiment pas, retirées le 24/10), vidéo façon « PowerPoint » avec des images fixes, bruitages inutiles ou mal calés.
  - **Les messages pas naturels ou trop longs** (par exemple les messages de contact que tu rédiges pour moi).
  - **Le moche ou le mal pensé :** « c'est encore plus moche », « faut penser intelligent » (boutons mal alignés, etc.).
  - **Rester sans nouvelles.** Si je demande « alors ? » ou « so ? », donne l'état tout de suite. Donne les heures **à l'heure de Paris**, pas en UTC (erreur déjà faite). Préviens-moi quand une mise en ligne est faite.
  - **Les maquettes :** depuis le 1/11, fais-moi une maquette dès que tu proposes quelque chose de visuel (avant, du 9/10 au 31/10, je préférais des captures du vrai site). Les captures du vrai site restent demandées une fois la PR ouverte.
- **Pas de musique** dans les vidéos ou contenus que tu fais pour moi : c'est un choix personnel et religieux, dit le 13/10. Les sons d'effets du jeu, oui. Le 30/10, j'ai accepté en fond une **ambiance nature faite maison** (vent, feuilles, oiseaux, sans instrument ni mélodie). Pas de vraie musique Pokémon non plus (droits de Nintendo).
- **Jamais ma tête ni ma voix** dans les vidéos (dit le 30/10 au soir) : uniquement l'écran du vrai site, du texte et des sons.
- **Pas d'afflux massif pour l'instant.** Je ne veux pas 500 personnes d'un coup tant que le serveur et mes moyens ne suivent pas. Je cherche des retours honnêtes de gens qui connaissent Pokémon, pas de la pub.

## 2. Le projet

- **Site :** https://pokdle.fr. L'ancienne adresse, pokdle.onrender.com, redirige en 301 vers la nouvelle, avec transfert automatique de la progression (`App/lib/site-move.js`, PR #140).
- **Dépôt :** GitHub `chebreub/Pokdle`, branche `main`. Tout le code est dans `App/`. À la racine : audits, prompts GPT, `TODO_Pokedle.md`, `docs/` et `tools/` (QA Python).
- **Stack :**
  - Node ≥ 18 (22 en CI), Express (`App/server.js`, environ 5 400 lignes), Socket.IO pour le multijoueur (Party Room, duels) et PostgreSQL (`pg`).
  - Front en JS vanilla : une SPA (`App/index.html`).
  - Données Pokémon dans `App/pokemon.js` et `App/forms-data.json`.
- **Structure :**
  - `App/src/script.NN.*.js` : le JS du site, en 40 morceaux concaténés par `App/build.mjs` dans `App/script.js`. Ce fichier est **généré : ne jamais l'éditer**.
  - `App/dist/` : JS et CSS minifiés par esbuild, plus `app.min.css`. Généré, ignoré par git.
  - `App/lib/*.js` : logique serveur (jeux du jour, Party Room, classements, synchro du profil, import de l'ancienne base, avis des joueurs, SEO, métriques).
  - `App/test/*.test.js` : environ 105 fichiers, environ 590 tests.
  - Une vingtaine de CSS par thème, dont `style.css` (voir les pièges).
- **Commandes,** depuis `App/` :
  - `npm ci`, qui lance déjà le build via `postinstall` ;
  - `npm run build` ;
  - `npm test` (`node --test`) ;
  - `npm run dev`.
- **Postgres local :** il s'arrête souvent dans le conteneur (erreurs `ECONNREFUSED 127.0.0.1:5432` dans les tests). Relance-le avec `service postgresql start`.
- **Tests avec une vraie base :**
  1. Lance un PostgreSQL local.
  2. Exporte `QA_DATABASE_URL` vers une base **jetable** locale. Prends le même utilisateur et la même base que dans `.github/workflows/browser-quality.yml`, avec `127.0.0.1` comme hôte.
  3. Lance `npm test`.
  4. À faire obligatoirement si tu touches au SQL ou aux tables. **Jamais** avec les identifiants de production.
- **QA navigateur :** `python3 tools/browser_quality.py --output <dossier>`, environ 12 minutes.
- **CI (GitHub Actions) :**
  - `Game regression tests` : `npm ci` puis `npm test`.
  - `Browser and database quality` : Playwright et Postgres dans un conteneur. Sur chaque push de PR, il ne lance qu'un smoke ciblé. Il lance la QA **complète** :
    - quand une PR est ouverte non brouillon, ou passe en « Ready for review » ;
    - avec le label `qa:full` ;
    - sur `main`.
  - Règles détaillées : `docs/qa/ci-policy.md`.
- **Hébergement :** Render. Chaque merge sur `main` déclenche un déploiement automatique (2 à 3 minutes).
  - **Depuis le 29/10 au soir, Pokdle est sur l'offre payante « Starter » (7 $/mois, sans engagement, facturé à la seconde).** Le 29/10, les 750 heures gratuites du mois (partagées avec mon autre service carnet-force) étaient épuisées et le site a été coupé. On change le plan dans Render : service Pokdle → Compute → Edit (une carte bancaire doit être enregistrée dans Billing). Je trouve ça cher : le 1/11, je pourrai repasser en gratuit si carnet-force est mis en pause (rappel programmé).
  - Un moniteur externe pingue `/api/multiplayer/health` pour que Render ne s'endorme pas. Il doit viser pokdle.fr depuis le déménagement **(à confirmer)**.
  - Les variables d'environnement sont réglées sur Render. Je les pose moi-même ; tu ne vois jamais leurs valeurs. Noms principaux :
    - base : `DATABASE_URL`, `OLD_DATABASE_URL` ;
    - Discord : `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_CALLBACK_URL` ;
    - Google : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` ;
    - Twitch : `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_CALLBACK_URL` ;
    - autres : `SESSION_SECRET`, `ADMIN_STATS_KEY`, `ADMIN_ACCOUNT_IDS` (mon numéro de compte, pour le panneau admin), `SITE_URL`, `LEGACY_ORIGIN`, `ALLOWED_ORIGINS`.
- **Base de données :** PostgreSQL sur **Supabase** (offre gratuite, région Oregon comme Render) depuis le 19/10. L'ancienne base **Neon** gratuite était saturée (quota de 100 CU-h par mois). Ses anciennes données sont réimportées automatiquement par `App/lib/db-import.js`, qui garde les meilleurs scores, dès que Neon répond à nouveau (voir le rappel du 1/11).
- **Connexion :**
  - Discord, le compte principal : l'identifiant Discord sert de numéro de compte interne.
  - Google, depuis le 13/10 (application Google publiée).
  - Twitch, depuis le 24/10.
  - Les fournisseurs sont liés dans la table `account_identities`.
  - Les appels Discord passent par un Worker Cloudflare (`discord-proxy-worker.js`), parce que l'IP partagée de Render était bannie par Discord.
- **Admin :**
  - `/admin/stats?key=…` (clé = `ADMIN_STATS_KEY`) montre les stats de visites et de modes, ainsi que les avis « Donne ton avis » des joueurs (PR #138, tableau refait par la #168). Depuis le 30/10 : nombre de rappels 🔔 activés (#175), lignes « Partage — Pokémon du jour partagé » et « Partage — arrivées par un lien de défi » (#176).
  - `/admin`, le panneau admin (PR #161), ouvert par le bouton « Panneau admin » du menu du compte quand je suis connecté : bandeau d'actualités, **messages aux joueurs** (31/10), retrait d'une photo de profil, « Pseudo déplacé » et « Niveau d'un joueur » (31/10).
- **Domaine :** pokdle.fr, acheté chez OVH le 25/10 pour 1 an. Renouvellement en octobre 2027 (environ 7,79 € HT).
- **SEO :**
  - Google Search Console avec une propriété `https://pokdle.fr/`.
  - Les pages de jeux sont sous `/jeux/<slug>`, chacune avec son image d'aperçu tirée de l'artwork officiel (`node tools/og-game-images.js`).
  - Il y a un sitemap.
- **Autres outils :** j'utilise aussi ChatGPT/Codex. Les fichiers `PROMPT_GPT_*.md` sont des prompts écrits pour lui, et les PR #82 à #100 (branches `codex/*`) viennent de lui. Celles de #101 à #126 (branches `fix/`, `ux/`, `seo/`…) viennent probablement de lui aussi **(à confirmer)**. Je colle parfois ses audits dans le chat : ce sont des avis à vérifier, pas des ordres.

## 3. Règles de travail et pièges connus

- **Déroulé d'un changement :**
  1. Proposer, avec des captures si c'est visuel.
  2. Attendre mon « go ».
  3. Créer une branche.
  4. Coder et tester (`npm test`, plus Postgres local si tu touches au SQL).
  5. Ouvrir la PR.
  6. M'envoyer des captures téléphone et ordinateur.
  7. Attendre que la QA **complète** soit verte **sur le SHA exact** en tête de la PR.
  8. Merger (`merge_method: "merge"`).
  9. Me prévenir que Render déploie.
- **Qualité :**
  - Un smoke vert ne suffit pas pour merger.
  - Si un commit arrive après la QA complète, repasse la PR en brouillon puis en « Ready », ou utilise `qa:full` (sans label sur la PR : l'ajouter ; déjà posé : l'enlever puis le remettre).
  - **Nouveau jeu dans le catalogue :** la QA navigateur compte les cartes en dur (`tools/browser_quality.py` : 24 jeux solo, 15 dans « Jouer » au 1/11) ainsi que `App/test/catalog.test.js` (32 cartes). Mets ces nombres à jour dans la même PR (oubli lors de la #177).
  - La carte « Niveau supérieur » peut s'ouvrir pendant la QA : `browser_quality.py` la ferme seul depuis la #174, avec un clic qui ne remonte pas (un clic normal fermait aussi des menus).
- **Branche :** la dernière session travaillait sur `claude/leaderboard-cosy-nc0axg`, réutilisée pour les PR #127 à #157. Une nouvelle branche par chantier est plus propre.
- **Piège `App/style.css` :** le fichier a des fins de ligne **mélangées** (CRLF et LF). Ne le modifie jamais avec un outil d'édition classique. Passe par un petit script Python qui travaille sur les octets en gardant la fin de chaque ligne (incident lors de la PR #151).
- **Pièges de build :** ne jamais éditer `App/script.js` ni `App/dist/`. On édite `App/src/…` et les `.css`, puis on build.
- **Piège de tests :**
  - Les tests qui créent leurs propres tables (`CREATE TABLE users(...)`) doivent suivre le schéma réel (voir la panne actuelle en section 5).
  - Des tests dépendent de dates, comme le bandeau d'actualités qui expire. Rends-les indépendants de la date.
- **Sécurité :** le secret du Pokémon du jour ne doit jamais passer par le navigateur. Le serveur calcule les comparaisons et les flèches.
- **Accessibilité :** respecte « réduire les animations » du système, et ne retarde jamais l'action suivante par une animation.
- **Direction artistique « cosy » à garder :**
  - Fond crème `#FFF8EF`, encre `#2E2A33`, bleu action `#4069E0`.
  - Jaune `#FFD45C` réservé au Pokémon du jour, lavande Party `#7C5BD6`.
  - Polices Fredoka pour les titres, Nunito pour le reste.
  - Résultats : vert pour exact, jaune rayé pour proche, gris pour faux. Jamais la couleur seule.
  - Détails complets dans `PROMPT_GPT_Pokedle_Complet.md`.
- **Images :** uniquement des artworks officiels, **plus aucune image IA** (décision du 24/10).
- **Secrets :** jamais de secret dans le code, les commits ou le chat. Si j'envoie une capture qui en montre un, dis-le-moi et fais-le-moi changer.
- **Heure :** je suis à Paris. Le « jour » des jeux quotidiens est le jour de Paris.
- **Environnement cloud :** pokdle.fr et pokemind.fr sont autorisés dans le réseau de la session (ajoutés le 30/10), puis youtube.com et la base Supabase de PokeQuizz (30/10 au soir). `cdn.jsdelivr.net` est bloqué : pour des captures locales avec les artworks, détourne les requêtes vers `raw.githubusercontent.com/PokeAPI/sprites/master/…` (Playwright `route`). Chromium headless ne peut pas s'abonner aux vraies notifications : on simule l'abonnement et on livre un message au service worker (CDP `ServiceWorker.deliverPushMessage`).

## 4. Historique (principales PR et décisions)

Clone partiel : l'historique détaillé commence vers le 2/10.

- **2–3/10 (#57–#64) :** fiabilisation : synchro du profil par compte, reprise du jeu quotidien et de la Party Room après rechargement. L'hôte de la Party Room peut changer de jeu.
- **3/10 (#65–#76) :** refonte mobile (D0–D4) puis ordinateur (PC0–PC4).
- **5–6/10 (#79–#90) :**
  - ergonomie et cartes illustrées ;
  - **refonte « cosy »** de l'accueil, du Daily et des classements (#82) ;
  - structure en lots : enquête centrale, Œuf mystère communautaire, sélecteur de génération ;
  - corrections mobiles.
- **7–9/10 (#91–#99) :**
  - parcours quotidien sur 100 points : Enquête 40, Défi 30, Dossier 20, Wordle 10 (barème validé le 9/10) ;
  - Wordle et Dossier du jour, Défi du jour.
- **9–13/10 (« étape 1 », merges directs `claude/etape1-*`) :**
  - Ligue hebdomadaire et quêtes au jour de Paris ;
  - classements vivants avec peu de joueurs ;
  - Œuf avec un indice par jour ;
  - porte unique « Entre amis » vers la Party Room ;
  - **Draft PRO et Draft Arènes retirés** (13/10) ;
  - catalogue en 3 familles (Deviner, Jouer, Entre amis) ;
  - écran « Restaurer ma progression » ;
  - accélération du Pokémon du jour (146 ms au lieu de 0,6 à 1,5 s) ;
  - +49 formes (Méga et formes de jeu).
- **Décisions du 12–13/10 :**
  - pas de Gigamax (revu le 24/10 : au Pokédex seulement), ni Totems ni Pikachu casquettes dans les jeux ;
  - les formes impossibles à départager sont retirées des devinettes ;
  - Défi du jour en couleurs ;
  - **abandon** des modes Cri et Zoom en quotidien, jugés pas assez appréciés.
- **13/10 :**
  - connexion Google et page `/confidentialite` ;
  - « Supprimer mon compte » ;
  - **Qui est-ce ?** en solo, en 1 contre 1 classique tour par tour (après un test avec un ami : la « course au même mystère » n'était pas le vrai Qui est-ce ?), puis en course à plusieurs dans la Party Room.
- **14/10 :** Dossier sur 20 (2 points par bonne réponse). Qui est-ce ? : choix entre retourner une carte ou deviner au clic.
- **19/10 :**
  - **Grille du jour** façon PokéDoku (bonus hors barème) ;
  - **Petit Bac Pokémon** (solo et Party Room) ;
  - **Défi du jour en Pixelisé seulement** (Cri trop dur, Zoom trop simple) ;
  - base déplacée de Neon vers Supabase.
- **21–23/10 (#102–#126) :**
  - décor d'Halloween saisonnier ;
  - sécurisation de l'import Neon ;
  - métriques anonymes des modes joués ;
  - rejouer ou changer de jeu depuis l'écran de résultat de chaque mode ;
  - CI accélérée (Playwright préinstallé, smoke ciblé puis QA complète) ;
  - liens de jeux lisibles par Google.
- **24/10 (#127–#137) :**
  - accueil plus clair, avec le défi du jour d'abord ;
  - corrections d'un rapport SEO ;
  - couleurs Pokédex des formes régionales et des Méga ;
  - **connexion Twitch** ;
  - **artworks officiels seulement, plus d'IA** ;
  - les 34 Gigamax au Pokédex, hors devinettes.
- **25/10 (#138–#152) :**
  - « Donne ton avis » ;
  - vraie icône du site ;
  - **déménagement vers pokdle.fr** (#140) ;
  - refonte du Pokédex (10 colonnes, fiche plus large, famille d'évolution en images, lieux en français) ;
  - **niveaux** (#147, proposition A choisie) : 100 niveaux, +50 XP par niveau, un titre tous les 10 niveaux, l'aventure rapporte de l'XP, XP divisée par deux après 500 XP par jeu et par jour, badge Pionnier ;
  - niveau affiché à côté des pseudos (#148) ;
  - **profil en carte de dresseur** (#149) ;
  - page « À propos » (#150) ;
  - corrections d'un audit GPT (#151–#152).
- **26/10 :**
  - #153 : la liste de suggestions ne saute plus sur iPhone, Zoom plus dur (je le trouvais trop simple quand il zoome au centre en couleur) ;
  - Wordle avec tirets, points et chiffres ;
  - #154 : Pokédex téléphone réparé, et choix de l'image de profil (partenaire, ma photo ou image du compte) ;
  - #155 : bilan du Quiz lisible en thème sombre ;
  - #156 : « Ma photo » visible dans les classements, partagée seulement si le joueur la choisit après le changement (drapeau `avatarPhotoShared`).
- **27/10, #157 :**
  - **flèche de génération** (« Gen 3 ↑ » / « Gen 8 ↓ ») dans le Pokémon du jour, le mode classique et la Party Room, à ma demande (mes collègues trouvaient le Pokémon du jour trop dur à trouver vite) ;
  - fourchette de génération dans le carnet d'enquête ;
  - annonce dans le bandeau d'actualités jusqu'au 3/11 ;
  - test du bandeau rendu indépendant de la date.

- **28/10 :**
  - #158 : ce `CLAUDE.md` ;
  - #159 : tests Défi et Dossier réparés (colonne `photo_key`), CI de `main` de nouveau verte ;
  - premières vidéos TikTok / Shorts filmées sur le vrai site (voir section 6).
- **29/10 (#160 à #169) :**
  - #160 : Stat Mystère, la première lettre s'affiche au 5e essai (3 victoires pour 43 abandons sur 14 jours) ;
  - #161 : panneau admin `/admin` (bandeau d'actualités, retrait de photos) ;
  - #162 : carte « Niveau supérieur » et bandeau « Succès débloqué » (proposition A) ;
  - #163 : Draft Score Attack revue (paliers Standard / Solide 500 / Elite 550 / Master 600, jauge, barre sur téléphone, « Défier un ami ») ;
  - #164 : bouton des générations plus clair, classement simplifié (un menu, semaine par défaut s'il y a peu de joueurs, écart avec le joueur au-dessus) ;
  - #165 : annonce dans le bandeau jusqu'au 5/11, invitation « Donne ton avis » en fin de partie, TODO et `KIT_LANCEMENT.md` à jour ;
  - #166 : profil sur deux appareils, les progressions s'additionnent au lieu de s'écraser ;
  - #167 : flèches de génération, taille et poids en pastilles (« ↑ plus récente », « ↓ plus léger ») ; « Party Pokémon » renommé « Marathon mini-jeux » dans les missions (Scarabrute, Entei, Brutalibré, Félinferno, Victini) ;
  - #168 : nouveau tableau `/admin/stats` (période, courbes, détail par jeu), branche `feat/…`, pas faite dans cette session **(à confirmer : sans doute Codex)** ;
  - #169 : défis du jour « Consulte le Pokédex » et « Joue à 3 modes différents » réparés (ils n'étaient jamais comptés).
  - #170 : cette passation, images du Zoom et du Pixelisé qu'on ne peut plus glisser (le vrai sprite se voyait), mission Hexadron → Party Room ;
  - #171 : **« Dessine-le ! »**, nouveau jeu de Party Room (un dessine, les autres devinent ; choix entre 3 Pokémon facile/moyen/difficile ; indices lettres, type à 30 s, génération à 50 s ; `App/lib/party-dessin.js`, `App/src/script.10xb.party-dessin.js`) ;
  - #172 (30/10) : Dessine-le ! v2 après mon test : stylo qui ne reste plus « appuyé » à la souris, outil 🪣 Remplir, 16 couleurs, image modèle plus grande.
- **30/10 (#173 à #179) :**
  - #173 : outil vidéo rangé dans `tools/video/`, passation et TODO à jour ;
  - #174 : QA navigateur réparée (la carte « Niveau supérieur » bloquait des clics au hasard, sur `main` aussi) ;
  - #175 : **rappel du Pokémon du jour par notification** (bouton « 🔔 Me rappeler demain » sous le compte à rebours, 8 h / 12 h / 18 h / 20 h, rien si déjà joué, série dans le texte ; guide « écran d'accueil » sur iPhone ; `App/lib/push-reminders.js`, `App/sw.js` sans cache, dépendance `web-push`, clés créées par le serveur et gardées dans la table `push_keys`, rien à régler sur Render) ;
  - #176 : **partage du Pokémon du jour en défi** (« Fais mieux que moi 👉 pokdle.fr/?defi=222-3 », aperçu « Trouvé en 3 essais : à toi de faire mieux ! » dans WhatsApp/Discord, objectif de l'ami sous le titre du jeu ; `App/lib/share-preview.js`) ;
  - #178 : passation de midi ;
  - #179 : **chat de la Party Room** (bouton « 💬 Chat » dans l'en-tête du salon, à côté de « Copier l'invitation », avec non-lus ; panneau du bas sur téléphone, petite fenêtre sur PC ; réactions 😂 🔥 👏 😱 ; bulle `showToast` quand un message arrive chat fermé ; rien n'est gardé, pas de liens, 120 caractères ; un message qui contient la réponse de la manche arrive caché chez les autres ; `App/lib/party-chat.js`, `App/src/script.10xe.party-chat.js`). La première version flottait en bas à droite et couvrait « Lancer la partie » à 360 px : **jamais de bouton flottant par-dessus la Party Room** (la QA `tools/party_mobile_quality.py` le vérifie) ;
  - #177 : **« Shiny ou normal ? »**, nouveau jeu dans « Jouer » (artwork officiel, 3 vies, les deux versions côte à côte après chaque réponse ; seuls les 762 Pokémon dont le shiny se voit vraiment, liste `App/shiny-pool.json` faite par `App/tools/shiny-pool.js` ; page `/jeux/shiny-ou-normal`).
- **31/10 :**
  - #182 : classement des jeux du jour en points cumulés (« Semaine » et « Total » additionnent les jours) ;
  - **podium et lot de la semaine** (option A) : « Semaine » du lundi au dimanche (Paris) partout, podium 2-1-3, encart « À gagner cette semaine » ; le 1er du Global de la semaine a son partenaire en shiny la semaine suivante (classements et carte de dresseur), médailles 🥇🥈🥉 pour le podium ; table `weekly_awards` remplie à la première visite de la nouvelle semaine (`App/lib/weekly-awards.js`, `App/lib/week-champions.js`) ;
  - **clic sur un pseudo → sa carte de dresseur** (fenêtre : partenaire, niveau, médailles, jours joués, Pokémon du jour trouvés, meilleure série, points, jeux du jour, derniers records) ; `GET /api/player/:pid` (`App/lib/player-cards.js`), identifiant public par joueur (`App/lib/player-ids.js`, HMAC de `SESSION_SECRET`).
  - **bande « À plusieurs » sur l'accueil** (« carte blanche » de ma part) : entre le Pokémon du jour et les mini-jeux, 4 jeux de Party Room en artwork (Dessine-le !, Qui est-ce ?, Petit Bac, Course au Pokédex), « Créer un salon » et « J'ai un code » ; un jeu cliqué ouvre le salon avec ce jeu déjà choisi (`App/src/script.10xf.home-party.js`). L'ancienne carte « Défis Pokémon entre amis » du bas de page est retirée. Vu chez les concurrents : PokeQuizz met son multi juste sous le titre, PokeMind affiche « 1 en ligne » (à ne pas copier) ;
  - **réglages** : curseur « Volume » (10 à 100 %, « ▶ Tester ») pour les effets et les cris ; les cris hors du mode Cri respectent « Cris des Pokémon ». Mode « sans chrono » écarté (le chrono fait le jeu là où il existe) ;
  - **chasse au shiny** (carte blanche) : le Pokémon du jour trouvé est « capturé » (carte dans le résultat), shiny à 1/40, 1/30 dès 7 jours de série, 1/20 dès 30 ; tirage par le serveur à la victoire, gardé dans `daily_plays.shiny` ; vitrine sur la carte de dresseur (la mienne et celle des autres), filtre « ✨ Shinies » dans Ma collection (`lib/daily-game.js`, `GET /api/daily/shinies`, `App/src/script.10xh.shiny-hunt.js`) ;
  - **étape 2 (Google), premier lot** : sections « Astuces » et « Questions fréquentes » (données structurées FAQ) sur 6 pages de jeux, page « Jeux Pokémon entre amis » à jour (12 jeux, Dessine-le !, chat), nouvelle page `/jeux/dessine-le-pokemon` (« Pictionary Pokémon ») dont le bouton ouvre le salon avec le jeu choisi ; 28 pages de jeux en tout ;
  - **guides** (`/guides`, `lib/seo-guides.js`) : « Pokémon du jour : la méthode », « La table des types expliquée », « Les 9 générations », « Les starters » et « Les légendaires et fabuleux » (5 guides, comme prévu au plan), plus des astuces sur les 28 pages de jeux, avec données structurées Article et FAQ, liés depuis les pages de jeux, `/jeux` et le menu ; chaque règle citée est vérifiée contre le code (`test/seo-guides-2026-10-31.test.js`) ;
  - **messages de l'admin aux joueurs** : dans `/admin`, section « Écrire aux joueurs » (un joueur par son pseudo, ou tous ceux qui ont un compte) ; le joueur voit une fenêtre 📬 à sa prochaine visite et peut répondre, la réponse s'affiche dans `/admin` ; notification si 🔔 activé. Seulement dans le site : on ne garde pas d'e-mail, pas de serveur Discord. Effacé au bout de 90 jours ou avec le compte (`App/lib/player-messages.js`, `App/src/script.10xg.player-messages.js`).
  - **Combo de types revu (style B choisi sur maquette)** : l'écran prend les couleurs des deux types, coupé en biais (un seul type : une couleur et « Trouve un Pokémon Ténèbres pur », plus jamais « Ténèbres + Ténèbres ») ; chrono en barre et score dans les coins ; la case réponse posée sur le bas ; suggestions par-dessus la page avec de petites images (une Méga affichait son artwork en entier) ; « 17 Pokémon possibles » ; une erreur montre les vrais types (« ✗ Airmure est Acier / Vol ») ; « Tes combos » en cartes avec artwork ; le texte d'intro s'efface pendant la partie. Même décor dans la manche Combo de types de la Party Room (`typeComboStageHtml`, `App/src/script.03.minijeux.js`).
  - **Description Pokédex** : les entrées en français s'arrêtent à la Gen 8 (n° 898), donc le mystère est tiré en Gen 1 à 8, mais on peut maintenant taper n'importe quel Pokémon des générations choisies (avant, impossible d'entrer un Gen 9 alors que « Toutes les régions » était affiché) ; une ligne l'explique sous l'indice quand la Gen 9 est choisie.
  - **Retour des joueurs, badges, rappel, messages, réactions** (A, B, C validés l'après-midi, puis « Mes messages » et les réactions) :
    - `/admin/stats` : la carte « Retour des joueurs » remplace « Fidélisation » : part des joueurs du Pokémon du jour qui rejouent le lendemain, dans les 7 jours, et nouveaux revenus en 7 jours, calculée avec les parties déjà gardées (`App/lib/daily-retention.js`, rien de nouveau n'est collecté) ;
    - badge « Nouveau » sur Shiny ou normal (jusqu'au 13/11) et Dessine-le ! (jusqu'au 12/11), qui disparaît seul (`App/src/script.10xi.new-badges.js`) ;
    - « Reviens demain ? 🔔 Activer » dans la carte de victoire du Pokémon du jour, tant qu'aucun rappel n'est activé ;
    - « 📬 Mes messages » dans le menu du compte : relire les messages de l'admin et y répondre plus tard (avant, la fenêtre ne s'affichait qu'une fois) ; dans `/admin`, « Vu » au lieu de « Lu » (la fenêtre affichée ne prouve pas la lecture) ;
    - réactions 😂 🔥 👏 😱 sous le résultat du Pokémon du jour (une par joueur et par jour, seulement après avoir fini, gardées 30 jours, effacées avec le compte) et « 12 joueurs l'ont trouvé aujourd'hui » à partir de 5 (table `daily_reactions`, `GET /api/daily/reactions`, `POST /api/daily/react`, `App/src/script.10xj.daily-reactions.js`). Chat public toujours écarté tant qu'il y a moins de 100 joueurs par jour.
  - **XP qui s'emballait (#193)** : Kayan, niveau 73, est devenu « Maître Pokémon ★11299825776381 ». Cause : la copie commune de la fusion téléphone/PC (#166) ne bougeait que quand l'appareil envoyait son profil, donc chaque rechargement comptait deux fois la progression partagée. Corrigé : la copie commune bouge aussi au chargement ; une fusion ignore une copie cassée et ajoute au plus 50 000 XP d'un côté ; plafond 247 500 XP (niveau 100) jusqu'au 10/11, puis +30 000 par jour ; au chargement, une XP / un nombre de quêtes ou de parties cassé reprend la plus haute valeur saine gardée par le navigateur (sinon niveau 100 sans étoile) ; le serveur ne calcule plus de niveau sur une copie cassée. Si son niveau n'est pas revenu à 73 : « Restaurer ma progression », ou le remettre à la main. Suite (#196) : la première version mettait l'XP à 0 quand les deux copies étaient cassées (Kayan est tombé niveau 1) ; maintenant une fusion de deux copies cassées garde la valeur pour que la réparation la corrige, une fusion n'ajoute jamais au-delà du plafond, la réparation tourne sur les copies enregistrées avant toute synchro, et une XP perdue ainsi revient une fois depuis la plus haute copie saine gardée par le navigateur. Le soir, Kayan était toujours niveau 1 en ligne : section **« Niveau d'un joueur »** dans `/admin` (choisir le joueur, taper le niveau). La copie en ligne prend l'XP du début de ce niveau, avec une marque `xpSetAt` (aussi `_xpSetAt` à côté, lue par le serveur) : chaque appareil reprend ce niveau à sa visite suivante au lieu d'y ajouter sa propre XP, et le serveur refuse une copie faite avant (409, l'appareil fusionne). L'XP gagnée ensuite s'additionne normalement ; celle gagnée sur un appareil entre sa dernière synchro et la remise est perdue (`App/lib/player-level-admin.js`, `POST /admin/level`).
  - **Parrainage « 🎁 Invite un ami »** : lien `pokdle.fr/?ami=<identifiant public>` (menu du compte, et lien dans la carte de victoire) ; quand l'ami trouve son tout premier Pokémon du jour, +100 XP pour lui tout de suite et pour le parrain à sa prochaine visite ; une seule fois par ami, jamais son propre lien, 10 amis par jour au plus (`App/lib/referrals.js`, table `referrals`, `POST /api/daily/referral`, `GET /api/referral/mine`, `POST /api/referral/claim`, `App/src/script.10xk.referral.js`).
  - **Admin** : section « Pseudo déplacé » dans `/admin` (remplace un pseudo par « Dresseur », qui le reste même après une nouvelle connexion ; « Rétablir » ; `App/lib/name-overrides.js`, table `name_overrides`) ; dans `/admin/stats`, la ligne « 🎯 Pokémon du jour aujourd'hui : trouvés, abandons, réactions, parrainages ».
  - **Fin de parcours et jours passés** : quand les 4 épreuves sont finies, l'accueil propose « 🔁 Pokédle en illimité → » et le bilan se termine par une carte « Parcours du jour terminé 🎉 » (illimité, mini-jeux, jours passés) ; « 📅 Jours passés » (menu du compte et carte de fin) rejoue les anciens Pokémon du jour, hors classement, toutes générations : 7 jours avec un compte, 7 de plus par ami parrainé, 60 au plus ; la réponse n'est envoyée que pour un jour fini et débloqué (`App/lib/daily-past.js`, `GET /api/daily/past`, `App/src/script.10xl.day-done.js`).
  - **Astuce des générations** : la bulle revient à chaque visite tant que le joueur n'a jamais ouvert le choix des générations (avant : une seule fois par navigateur).
  - **Jeux de devinette en série** : Pokémon pixelisé, Cri, Silhouette et Description Pokédex jouent 10 mystères par défaut, lancés tout de suite, pastilles 5 / 10 / 20 ; « Passer l'image / le cri / … » ; « … suivant(e) → » ; bilan (trouvés, essais moyens, XP, record par jeu et par longueur de série). Chaque mystère est tiré par la fonction de départ du jeu lui-même, ses règles ne changent pas (`App/src/script.10xm.guess-series.js`).
  - **Wordle Pokémon en entraînement** : nouvelle carte dans « Deviner » (et « 🔁 S'entraîner en illimité » à la fin du Wordle du jour) ; même grille que celui du jour, joué dans la page avec un Pokémon au hasard des générations choisies, hors classement ; séries de 1 / 5 / 10 / ∞ noms (5 par défaut), bilan, un peu d'XP (`App/src/script.10xn.wordle-training.js`).
  - **Google Play** : faisable (application TWA autour du site, compte développeur 25 $, test fermé de 14 jours avec une douzaine de testeurs), mais **abandonné pour l'instant** : trop cher pour le peu de joueurs (31/10).
  - **Pub payante** : déconseillée pour l'instant (mesurer d'abord le retour des joueurs ; risque de refus avec le nom Pokémon) ; plus tard un test de 30 à 50 € sur Instagram Reels avec une vraie vidéo. Pub sur le site : quelques euros par mois au mieux, à revoir à plusieurs centaines de joueurs par jour.
  - **Vidéos** : quiz « Quel Pokémon fait ce cri ? » (5 cris, 3 choix A/B/C, réponses 1B 2A 3C 4C 5B dans le commentaire épinglé, scène `tools/video/pro-cri3.js`) ; à sa demande, deux essais **avec musique** pour voir le rendu (sa musique DJ sur Higher or Lower, et Bourg-en-Vol sur le quiz), sans décision pour l'instant (droits : Content ID sur YouTube, son à ajouter depuis TikTok). Voix IA déconseillée ; si test, la voix de TikTok sur l'accroche et la fin seulement.
- **1/11 :**
  - #197 (31/10 au soir) : **« Niveau d'un joueur »** dans `/admin` (voir l'XP plus haut) ;
  - vidéo **« 3 Pokémon pixelisés »** (32 s, style de la vidéo de présentation, `tools/video/pub/pix3.js`) : Absol sur téléphone, Trousselin sur PC, puis Dodoala laissé en mystère (« Écris ta réponse en commentaire », réponse le lendemain dans le commentaire épinglé). Lanssorien, d'abord prévu, était trop connu, et la fin a été ralentie pour qu'on ait le temps de lire. Deux versions : avec Bourg-en-Vol (`tools/video/mixm.sh`) et sans musique. Programmée le 1/11 à 18 h 30 ; la réponse (Dodoala) à épingler le 2/11 ;
  - **« Mes Pokémon préférés »** refait sur maquette (v2 choisie : on garde le vrai tableau type × génération) : le tableau entier sur téléphone (types en lignes, générations en colonnes), générations en lignes sur PC, titres en français aux couleurs du site, lignes Starter / Formes / Légendes, ❤️ préféré par type et par génération, 👑 n°1 ; grilles **Normal et ✨ Shiny** ; une case ouvre une fenêtre limitée au type et à la génération ; 🎲 remplit les cases vides ; **📸 image à partager** (1080 × 1920, « Fais la tienne sur pokdle.fr »). Les choix d'avant gardent leurs clés (`pokedle_ranking_v1`), la grille shiny utilise les mêmes clés avec « s: » devant ; rien n'est envoyé au serveur. Plus caché : carte dans « Jouer », page `/jeux/pokemon-prefere-par-type`, bouton « Favoris » du profil (`App/src/script.10xo.favorites-grid.js`). Prochaine étape : la vidéo débat « ton préféré de chaque type » (normal puis shiny).
  - **Team Builder « Mon équipe » refait** (maquette validée, avec un randomizer à sa demande) : les 6 Pokémon en grandes cartes aux couleurs de leurs types (artwork, objet), « 🛡️ Ton équipe face aux types » (18 types en couleur, −2 quand 2 Pokémon ou plus sont faibles, +3 quand 3 résistent sans faiblesse, phrase « Craint surtout… »), l'éditeur en 4 onglets (Attaques, Réglages, Stats, Téra) ; sur téléphone il s'ouvre en fenêtre par-dessus l'équipe (déplacé dans le `body` le temps de l'édition, sinon la page le coinçait sous le voile), une case vide ouvre tout de suite le choix du Pokémon. En-tête : 📸 Partager, 🎲 Au hasard, 📁 Équipes, ⋯ (Exporter, Importer, Réinitialiser, Retour). **🎲 Au hasard** : générations, « Pokémon forts seulement » (≥ 450 de stats de base), sans légendaires, types variés, attaques/objet/nature au hasard ; les Pokémon marqués 🔒 sont gardés ; un set tiré prend une attaque de chacun de ses types, une d'un autre type, jamais Métronome ou Attraction, ni Evoluroc. **📸 Partager** : image 1080 × 1920 « Note mon équipe /10 ». Tout le reste (EV/IV, analyse, équipes enregistrées, import/export Showdown) ne change pas (`App/src/script.10xp.team-builder-v2.js`, styles en fin de `App/game-shell.css`). Quand une fenêtre (`.fav-sheet`, `.tb-editor-sheet`) est ouverte, la barre du bas du téléphone est cachée.
  - **⚔️ Défis entre joueurs** (« carte blanche », version A choisie sur maquette) : sur la carte de dresseur d'un joueur (clic sur un pseudo), « ⚔️ Défier » → un de mes records (Higher or Lower, H/L 60 s, Duel de poids, Intrus, Combo de types, Quiz, Speedrun, Draft) + une phrase toute faite (pas de texte libre). Le joueur défié le voit à sa visite suivante (fenêtre « Un défi pour toi », notification si 🔔), « Relever le défi » lance le jeu ; le serveur décide avec les scores qu'il enregistre déjà (`/api/leaderboard/result` → `afterResult`) : gagné si un résultat après l'envoi bat strictement la cible. Les deux sont prévenus (toast « 🏆 Défi réussi », fenêtre « Du nouveau dans tes défis », « ⚔️ Revanche »). « ⚔️ Mes défis » dans le menu du compte (reçus, envoyés, « Recevoir des défis »). 5 défis par jour, 7 jours pour relever, refuser / « Ne plus recevoir les défis de X » / tout couper, effacés au bout de 30 jours ou avec le compte (tables `player_challenges`, `player_challenge_blocks`, `App/lib/player-challenges.js`, `App/src/script.10xq.player-challenges.js`, page de confidentialité à jour). PR #200, en ligne le 1/11 vers 16 h 55.
  - **🔍 « Trouve ce Pokémon »** (maquette validée) : 2e onglet de « ⚔️ Défier » ; on tape un nom, on choisit 6, 8 ou 10 essais et une phrase (« Tu le trouveras jamais 😏 » ajoutée en fin de liste : une phrase garde son numéro). Le Pokémon (un des 1025, jamais une forme) reste sur le serveur (`player_challenges.secret_id`, essais dans `guesses`, nombre d'essais dans `target`) ; le joueur défié joue dans une fenêtre, chaque essai part au serveur (`POST /api/challenges/guess`) qui renvoie les mêmes pastilles que le Pokémon du jour (`compareDaily`) ; la réponse n'est envoyée qu'à la fin (ou à celui qui l'a choisi). Une carte par essai avec les 8 indices (2 lignes de 4 sur téléphone, 1 ligne sur PC). Gagné / raté (`lost`) / expiré ; les deux sont prévenus ; celui qui a défié peut voir « 👀 Ses essais » (`GET /api/challenges/game`).
  - **Page ouverte avant une mise en ligne** (1/11) : elle garde son ancien script (« Relever le défi » ne faisait rien chez Kayan, la page datait d'avant #201). `GET /api/version` donne la version du script servi (lue dans `dist/index.html`) ; la page la compare à la sienne quand on revient sur l'onglet (5 min au moins entre deux fois) et toutes les 10 min, et affiche en haut « 🔄 Pokédle a été mis à jour · Recharger » (jamais de rechargement tout seul : une partie en cours n'est pas perdue ; `App/src/script.10xr.update-banner.js`). Stat Clash Room 1v1 : l'encadré de la room passe sous les champs (sur PC il était coincé dans une colonne étroite, un mot par ligne) et la phrase en double « Crée une room… » n'est plus affichée.
  - **Défis et messages visibles** (1/11, « carte blanche » après maquette) : ils étaient une ligne parmi 8 du menu du compte. Maintenant : pastille rouge avec le nombre sur le bouton du compte (défis qui attendent + nouvelles de mes défis + messages non lus) et sur « Amis » / « Entre amis » (défis) ; carte en haut de l'accueil tant qu'un défi attend (« ⚔️ 2 défis t'attendent · Relever ») et ligne « 📬 nouveau message » ; bloc « ⚔️ Mes défis » en haut de la Party Room (onglet Amis), dans la page, jamais par-dessus, caché pendant une partie ; « Mes défis » et « Mes messages » en tête du menu du compte, avec leur nombre (`App/src/script.10xs.inbox-visibility.js`).
  - **Messages privés entre joueurs** : d'abord « pas pour l'instant » (beaucoup de joueurs sont des enfants), puis le soir **option B choisie** : une liste d'amis (les deux acceptent, « 🤝 Ajouter en ami » sur la carte de dresseur, pas de recherche par pseudo), puis une discussion en texte libre (200 caractères) seulement entre amis, « Signaler » vers `/admin`, « Bloquer », effacée au bout de 30 jours. **Pas de filtre de gros mots pour l'instant** (« plus tard, y a pas grand monde ») ; seul garde-fou gardé : pas de liens ni de numéros. Deux PR : les amis, puis la discussion.
  - **🤝 Amis** (1/11 au soir, 1re PR de l'option B) : « 🤝 Ajouter en ami » sur la carte de dresseur (puis « ⏳ Demande envoyée · Annuler », « 🤝 Accepter sa demande », « ✓ Ami » → Retirer / Bloquer, « Débloquer ») ; l'autre doit accepter ; demander à quelqu'un qui nous a déjà demandé, c'est accepter. Un refus reste discret (celui qui a demandé voit toujours « Demande envoyée », sans nouvelle notification). Bloquer : plus de demande dans les deux sens, l'amitié s'arrête. 50 amis et 20 demandes par jour au plus ; une demande sans réponse est effacée au bout de 30 jours. Onglets « Party Room | Mes amis » en haut d'« Entre amis » (demandes avec Accepter / ✕ / Bloquer, liste avec niveau et ⚔️ Défier, en attente, joueurs bloqués), « 🤝 Mes amis » dans le menu du compte, ligne sur la carte de l'accueil, pastilles rouges comme les défis, notification « 🤝 X veut être ton ami » / « X a accepté ta demande » (`/?amis=1`). Tables `player_friends`, `player_blocks` (effacées avec le compte), `App/lib/player-friends.js`, `App/src/script.10xu.friends.js`, page de confidentialité à jour.
  - **💬 Discussion entre amis** (1/11 au soir, 2e PR de l'option B) : « 💬 Écrire » sur la carte d'un ami et 💬 dans « Mes amis » (dernier message sous le nom, non-lus) ; fenêtre « 💬 Discussion » (bulles, heure de Paris, 200 caractères, Entrée pour envoyer), mise à jour toutes les 4 s seulement quand elle est ouverte. Seuls des amis peuvent s'écrire. Pas de filtre de gros mots ; refusés : liens, adresses e-mail, @pseudos, numéros (6 chiffres ou plus) et noms d'autres applis (Snap, Insta, WhatsApp, Discord, TikTok…), avec « 🔒 Pas de liens ni de numéros ici ». Une seule notification « 💬 Kayan » tant que le message précédent n'est pas lu (10 min). 30 messages par 10 min. ⋯ → ⚔️ Défier, 🚩 Signaler (les 30 derniers messages sont copiés dans **« Signalements » en haut de `/admin`**, bouton « Traité », gardés 90 jours ; 5 signalements par jour), ⛔ Bloquer (fin de l'amitié, donc de la discussion). Messages effacés au bout de 30 jours et avec le compte. Pastilles et ligne « 💬 Nouveau message de X » sur l'accueil. Tables `friend_messages`, `friend_reports`, `App/lib/friend-chat.js`, `App/src/script.10xv.friend-chat.js`.
  - **Étude HoloPocket** (holopocket.fr, 1/11 au soir) : jeu de collection de cartes Pokémon (boosters fidèles, énergie qui se recharge, classeurs pré-remplis « une place réservée par carte », médailles et master sets, 3 quêtes par jour, mini-jeux à pièces : Cartodle, Connexions, Voltorbe Flip, Zoom…), social (amis, équipes avec chat, objectif de la semaine et coffre, raids, duels quiz et Pictionary, échanges, enchères), compte vérifié par Discord avant le marché et les amis, ni pub ni achat. Au moins 10 000 joueurs (« 10079 joueurs l'ont dans sa collection » sur une carte commune). Moteur Google : **23 700 pages, une par carte**, + 157 pages d'extensions. Repris : l'album en classeur (ci-dessous) et l'idée d'une page Google par Pokémon. Pas pour nous : énergie, boosters, marché.
  - **📒 Mon album** (maquette validée, « go les 2 ») : « Ma collection » (menu du compte) ouvre maintenant un **classeur par région** : 9 places par page dans l'ordre du Pokédex (silhouette et numéro tant qu'il manque, ✦ pour une entrée secrète, cadre doré ✨ pour un shiny capturé), onglets des 9 régions, « Il te manque le #004 · Jouer Gen 1 » (choisit la Gen et lance l'illimité), onglet « Régions et médailles ». **Médailles par région : 🥉 au quart (+100 XP), 🥈 à la moitié (+200 XP), 🥇 complète** (pas d'XP en plus : la région complète donnait déjà +1 000) ; données une seule fois (`playerProfile.albumMedals`, clés « gen:tier », fusionnées entre appareils), petite fête à chaque médaille, les médailles déjà méritées arrivent d'un coup au premier chargement. Carte « 📒 Ton album : Hoenn 48/135 · Encore 20 pour la médaille 🥈 » sous « À plusieurs » sur l'accueil (la bande « Mon aventure » est cachée par le design actuel), bouton « 📒 Album » dans le Pokédex, et sur la carte de dresseur « 📒 194 / 1025 dans l'album » + la meilleure médaille de chaque région (`albumOf` dans `App/lib/player-cards.js`, lu dans le profil synchronisé). Sur PC : la région à gauche, la page du classeur à droite (`App/src/script.10xw.album-binder.js`).
  - **🔎 Une page Google par Pokémon** (« go les 2 », d'après HoloPocket) : `/pokemon/<nom>` pour les 1025 Pokémon (nom sans accents ni signes : `pikachu`, `nidoran-f`, `m-mime`, `ho-oh`, `type-0` ; `/pokemon/Pikachu` et `/pokemon/25` redirigent en 301). Chaque page : artwork, types, phrase d'intro faite avec ses données (légendaire, fabuleux, départ, faiblesse ×4…), fiche (numéro, génération, taille, poids, couleur, habitat, stade, premiers jeux), **faiblesses et résistances calculées** avec la table des types des guides (×4, ×2, ×½, ×¼, ×0), stats de base (`base-stats.json`), « Le deviner dans Pokédle » (les 8 indices du Pokémon du jour), 4 questions fréquentes (données structurées FAQ), 8 Pokémon du même type, précédent / suivant. Boutons « Deviner le Pokémon du jour » et « Sa fiche dans le Pokédex » (`/?pokedex=6` ouvre la fiche, `App/src/script.10xx.pokedex-link.js`). Page `/pokemon` (les 1025 par génération), lien « Pokémon » dans l'en-tête des pages Google, sitemap à 1 065 adresses. Image d'aperçu = l'artwork officiel (carte « summary »). Rendu à la demande et gardé en mémoire (`App/lib/seo-pokemon.js`, `renderPokemonPage` dans `App/lib/seo-render.js`).
  - **📲 Installer l'appli + 🔔 notifs au bon moment** (1/11 au soir) : Kayan était le seul à avoir activé les notifications (sur iPhone, il faut d'abord mettre le site sur l'écran d'accueil). Fenêtre « 📲 Pokédle en appli » avec les étapes de l'appareil (onglets iPhone / Android / PC) et un vrai bouton « Installer » quand le navigateur le propose (Chrome, Edge, Android) ; dans le menu du compte, les Paramètres (section « Appli & notifications »), le bas de page, `pokdle.fr/appli` (redirige vers `/?appli=1`), et une carte sur l'accueil à partir du 3e jour de visite (jamais dans l'appli, plus après l'avoir ouverte ou fermée). « 🔔 Sois prévenu quand X répond » juste après « Défi envoyé » et en haut des fenêtres de défis (« Plus tard » : caché 3 jours) ; la même inscription sert au rappel et aux défis ; **+50 XP une seule fois** (marque `notifXpAt` dans le profil). Pokédex : le bouton « Normal » devient « ✨ Voir le shiny » / « Voir le normal » (`App/src/script.10xt.install-app.js`).
- **Décisions du 30/10 :**
  - **pas de serveur Discord tant qu'il y a moins de 100 joueurs par jour** (un serveur vide fait site mort) : aller plutôt dans les Discord Pokémon existants ;
  - la vraie correction de la triche des images attend d'avoir plus de joueurs ;
  - la « collection » existe déjà en partie (le Pokédex enregistre chaque Pokémon trouvé) ;
  - un chat « public » sur le site (« la discussion du jour ») attendra plus de joueurs et de la modération ; le chat de la Party Room, entre amis, suffit pour l'instant ;
  - Pokébip : blog créé et premier article publié le 30/10 (pub tolérée seulement sur les blogs, interdite sur leur Discord, en commentaires et en messages privés). Jeuxvideo.com et les annuaires de jeux « -dle » avaient déjà été essayés sans résultat ;
  - pause sur la promo pendant une semaine, on regarde les chiffres le 5/11 ;
  - le soir : vidéo de présentation et story faites (section 6), étude de PokeMind et de **PokeQuizz** (section 6), et **plan d'attaque validé** (détail dans `TODO_Pokedle.md`) : d'abord faire revenir les joueurs (classement en points cumulés, podium et lot de la semaine, clic sur un pseudo → carte de dresseur, collection et shiny, réglages), en parallèle être trouvé sur Google (pages de jeux enrichies, guides), puis le bouche-à-oreille (parrainage, streamers).
- **Décisions du 29/10 :**
  - vidéos : pas le Duel de poids (« trop simple ») ; les posts YouTube attendront d'avoir des abonnés ;
  - un filtre TikTok pour le Draft est risqué (droits Pokémon, à fabriquer dans Effect House sur mon PC) : plutôt une vidéo du vrai site.

## 5. État actuel (30/10/2026, fin d'après-midi)

- `main` est vert. Aucune PR ouverte à part celle de cette mise à jour. En ligne : rappels 🔔, partage en défi, Shiny ou normal ?, chat de la Party Room. Annonce posée dans le bandeau (panneau admin). Rappel 🔔 activé sur mon téléphone le 30/10 : vérifier le 31/10 au matin que la notification est bien arrivée. Reste à tester Dessine-le ! et le chat avec mes collègues (fluidité au doigt sur iPhone).
- **Logo dans Google :** l'icône est correcte en ligne (48 px et SVG, vérifiées le 30/10) et j'ai demandé l'indexation dans la Search Console. Il n'y a plus qu'à attendre que Google mette à jour son cache.
- **Stats du 30/10 :** la vidéo « 5 pixelisés » mélangée a fait 0 vue ; 2 ou 3 nouveaux joueurs dans la journée.
- **Rappels programmés** dans la session du 29/10 :
  - le 1/11 à 10 h (Paris) : repasser Render en gratuit si je veux (et mettre carnet-force en pause), vérifier l'import Neon et **changer le mot de passe Neon** (section 7) ;
  - le 5/11 à 10 h : point sur les stats (Mystère depuis l'indice, messages « Donne ton avis », nouvelle annonce du bandeau) ;
  - le 6/11 à 10 h (programmé le 30/10) : relancer Fildrong s'il n'a pas répondu.
- **Incident du 26/10 :** un 503 de Render sur la page de santé, revenu tout seul. Cause inconnue, sans doute un redémarrage Render. Si ça revient, demande-moi une capture des logs Render.
- **Stats du 22 au 28/10 :** 55 à 60 sessions par jour, 30 à 40 navigateurs ; Pokémon du jour et Higher or Lower en tête ; aucun message « Donne ton avis ».

## 6. Idées et chantiers à venir (avec mes préférences)

1. **Vidéos TikTok / YouTube Shorts du site :**
   - Vidéos verticales 1080 × 1920 de 20 à 30 secondes, montées à partir de captures du vrai site (Playwright) avec du vrai mouvement.
   - **Pas de musique, pas de voix IA, pas de bruitages gratuits.** Les vrais cris du jeu, oui.
   - Je poste moi-même. Donne-moi à chaque fois le fichier, un titre, une description et un commentaire à épingler. Fin de vidéo : « Joue / Entraîne-toi sur pokdle.fr » et « 🔔 Abonne-toi pour le prochain défi ».
   - Déjà faites : Pixel, Cri, Pokémon du jour, Petit Bac, Higher or Lower, Stat Clash, Combo, Course au Pokédex, « 5 Pokémon pixelisés » (Gen 1, puis une version mélangée : Ectoplasma, Lucario, Amphinobi, Mimiqui, Ninjask) et « 5 cris » (Pikachu, Lucario, Zoroark, Ho-Oh, Wailord).
   - Publiées : Pixel et Higher or Lower sur YouTube ; Higher or Lower, Petit Bac et « 5 pixelisés » sur TikTok ; « 5 pixelisés » mélangée le 29/10 à 17 h (0 vue) ; « 5 cris » programmée le 30/10 vers 18 h 30.
   - Le 30/10, l'idée « ma tête et ma voix » a été **refusée** : jamais de visage ni de voix. À la place, une **vidéo de présentation du site** (52 s) : accroche « Tu connais vraiment les 1025 Pokémon ? », Pokéball, téléphone en 3D avec une vraie partie du Pokémon du jour (la pastille « ↑ plus récente » sort du téléphone), éventail de jeux, Party Room sur PC et téléphone (Dessine-le ! et chat), fin pokdle.fr. Frappe lente avec clics de clavier, son doux sur « Deviner », ambiance nature, vrais cris. Plus une **story** de 12 s. Mes retours : un rythme trop rapide fatigue, il faut montrer le PC aussi, et une frappe trop rapide fait « rush ».
   - Mes règles : pas que des Pokémon faciles ni que de la Gen 1, un bon équilibre de générations et de difficulté ; une vidéo par jour au plus.
   - L'outil de montage est rangé dans **`tools/video/`** (mode d'emploi dans son `README.md`) : sons faits maison (`synth.py`), images et cris (`fetch-assets.sh`), captures du vrai site (`cap-*.js`), scènes (`pro-*.js`), rendu (`render-all.sh`). La vidéo de présentation et la story sont dans **`tools/video/pub/`**.
   - Idées suivantes : le Pokémon mystère avec les pastilles, où on voit l'enquête se resserrer ; la Party Room seule, dans la même logique que la vidéo de présentation. Abandonné : « 5 shinies » (Shiny ou normal est trop facile pour qui connaît Pokémon).
   - **Leçon de PokeMind :** 365 Shorts faits automatiquement, 105 abonnés, la plupart à 0–10 vues. Seuls les formats « Tu reconnais ce Pokémon ? » (870 vues) et « Pokémon zoomé » (408) marchent un peu. Peu de vidéos, mais soignées.
2. **Faire connaître le site, en douceur :**
   - Des retours de gens qui connaissent Pokémon (par exemple des streamers que je suis en tant que viewer Chebreub), **sans demander de vidéo**.
   - Messages courts et naturels. Je peux dire que ça part d'un truc au boulot avec mes collègues.
   - Kit de textes : `KIT_LANCEMENT.md`, mis à jour le 29/10 pour pokdle.fr.
   - Une annonce Discord a été rédigée, mais je n'ai pas confirmé l'avoir postée **(à confirmer)**.
   - Le 30/10 : un mail court pour le youtubeur Fildrong a été rédigé et envoyé (1 ou 2 créateurs par semaine au plus). Fildrong a fait le 29/07/2026 une vidéo sur PokeMind (« Le site de quiz Pokémon ultime… », 19 748 vues, pas sponsorisée) : il teste des sites Pokémon en live sur Twitch. Relance prévue le 6/11 avec un angle différent du « tout-en-un » de PokeMind : **la Party Room pour jouer avec son chat** (Dessine-le !, Petit Bac, Qui est-ce ?, Course au Pokédex), avec 4 captures. Attention : une telle vidéo peut amener des centaines de joueurs d'un coup (vérifier Render en Starter). Pistes : blogs membres de Pokébip, Discord Pokémon FR, et un mail aux sites qui publient « la réponse du jour » (Breakflip, Millenium, Dexerto).
   - **Attention au nom :** un autre site s'appelle aussi « Pokédle » (Breakflip publie sa réponse du jour). Quand on cherche « pokedle » sur Google, on tombe sur lui. À garder en tête pour le référencement.
   - **PokeMind (pokemind.fr), étudié le 30/10 :** 44 modes, Discord et YouTube en haut de page, économie (PokéDollars, Balls, boutique, marché d'échange), amis et chat, multijoueur façon Kahoot, quiz créés par les joueurs. Le soir, en détail : leur force est la boucle « je joue → j'achète des Poké Balls → j'attrape » (Pokédex de 1025, shinies, missions, **boss de la semaine** à 1 401 dresseurs, événements). 17 joueurs en ligne un vendredi soir. Musique officielle de PokéPark en fond, réglages complets (sons, volume, sans chrono). Aucune source de revenus visible. Site lourd (≈ 6 Mo), compte obligatoire pour le défi du jour. Ce qu'on en a gardé : le partage en défi (#176) et Shiny ou normal (#177).
   - **PokeQuizz (pokequizz.com), étudié le 30/10 au soir :** le plus utile. Démarré en mai, **près de 14 000 joueurs par mois en octobre** (176 → 494 → 1 929 → 4 784 → 7 418 → 13 686, chiffres publiés par eux). Croissance par **Google** : 7 langues, 343 pages, 18 guides longs (table des types, méthode Pokédle…), `llms.txt`. Rétention : « 0/12 quiz du jour », chance de shiny et vitrine, Œuf Chance avec avatar rare, PVP entre amis. **Classement très réussi** : une seule unité (points), « Semaine » et « Cumulé » additionnent tout, podium du top 3, lot de la semaine (« Kyogre à gagner, 2 j avant le reset »), clic sur un pseudo → fiche joueur (parties, victoires, ratio, points, série, stats par quiz avec artworks). Revenus : pub (optAd360), « Offrir un café », boutique (avatars, rejeux illimités, pass de saison), appli Google Play. Style beige et cosy proche du nôtre.
3. **Panneau admin :** bandeau et retrait de photos faits (#161). **D'autres actions à ajouter : demande-moi la liste.**
4. **Bandeau d'actualités :** l'annonce « animations et Draft revue » expire le 5/11. La suivante se pose dans le panneau admin, sans PR.
5. **Rappel par notification :** fait (#175). À regarder dans `/admin/stats` (nombre de rappels activés) avant d'en faire plus.
6. **Triche des jeux d'image** (signalée le 29/10) : glisser l'image du Zoom ou du Pixelisé montrait le vrai sprite. Le glisser est bloqué depuis le 29/10, mais l'adresse de l'image dit encore quel Pokémon c'est (et « shiny » dans Shiny ou normal) : le vrai correctif (image préparée par le serveur, dessinée dans un canvas) attend d'avoir plus de joueurs (décision du 30/10).
7. **Profil :** la refonte de la direction artistique est commencée (#149). Plus tard : badges d'arène (proposition C) et saisons mensuelles (proposition B) si on veut un rendez-vous.
8. **Comptes :**
   - e-mail et mot de passe mis de côté le 24/10 (la page de confidentialité promet de ne garder ni e-mail ni mot de passe) ;
   - Facebook en dernier ;
   - écran de connexion façon « Bon retour ! » ;
   - relier ou délier un fournisseur dans le profil.
9. **Après le déménagement vers pokdle.fr, côté moi (à confirmer si c'est fait) :**
   - adresses de retour Discord, Google et Twitch, et variables `*_CALLBACK_URL` sur Render ;
   - pingeur sur pokdle.fr ;
   - Search Console : sitemap et « Changement d'adresse » ;
   - Bing.
10. **Autres notes de la TODO :**
    - catalogue à resserrer **(à confirmer)** ;
    - nettoyage du code Draft resté dormant ;
    - lenteur restante du Pokémon du jour et du Wordle (déjà très améliorée le 13/10) ;
    - les lancements du Quiz depuis le Marathon ne sont pas comptés dans les stats.

## 7. Ce qui servait de mémoire

- Ces sessions cloud n'avaient pas de mémoire Claude persistante consultable. La TODO cite une note de mémoire « rythme de livraison » et des fichiers de passation stockés dans l'appli Claude de mon PC (`side-session-notes/…`). Ils n'étaient pas accessibles et ne sont pas recopiés ici.
- Le contenu de la passation précédente (27/10) est intégré et corrigé dans ce document.
- Texte exact du rappel automatique Neon (ancien compte) :

> Rappel demandé par l'utilisateur pour le 1er novembre (voir TODO_Pokedle.md, point « Base de données (19/10) »). Le quota gratuit de Neon repart à zéro aujourd'hui. Rappelle à l'utilisateur, en français et simplement :
> 1. Ouvrir les logs Render et chercher la ligne « [import] old data restored », qui montre que les anciennes données Neon ont été récupérées automatiquement (lib/db-import.js).
> 2. Si la ligne n'y est pas, vérifier que la variable Render OLD_DATABASE_URL est bien posée, puis regarder les erreurs [import] dans les logs.
> 3. Changer le mot de passe Neon, qui a été vu en clair sur une capture, puis mettre à jour OLD_DATABASE_URL sur Render avec le nouveau.
> Propose de l'aider à lire les logs s'il te les colle, et de cocher le point dans la TODO une fois fait.
