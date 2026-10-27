# Passation Pokédle (pokdle.fr), à lire en entier avant d'agir

Rédigée le 27/10/2026, à partir de nos sessions Claude Code passées, du dépôt, de `TODO_Pokedle.md` et des PR GitHub. Les infos incertaines ou anciennes sont signalées par **(à confirmer)**.

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
  - **Les maquettes :** je n'en veux plus depuis le 9/10. Montre plutôt des captures du vrai site.
- **Pas de musique** dans les vidéos ou contenus que tu fais pour moi : c'est un choix personnel et religieux, dit le 13/10. Les sons d'effets du jeu, oui.
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
  - `App/test/*.test.js` : environ 95 fichiers, environ 556 tests.
  - Une vingtaine de CSS par thème, dont `style.css` (voir les pièges).
- **Commandes,** depuis `App/` :
  - `npm ci`, qui lance déjà le build via `postinstall` ;
  - `npm run build` ;
  - `npm test` (`node --test`) ;
  - `npm run dev`.
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
  - Un moniteur externe pingue `/api/multiplayer/health` pour que Render ne s'endorme pas. Il doit viser pokdle.fr depuis le déménagement **(à confirmer)**.
  - Les variables d'environnement sont réglées sur Render. Je les pose moi-même ; tu ne vois jamais leurs valeurs. Noms principaux :
    - base : `DATABASE_URL`, `OLD_DATABASE_URL` ;
    - Discord : `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_CALLBACK_URL` ;
    - Google : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` ;
    - Twitch : `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_CALLBACK_URL` ;
    - autres : `SESSION_SECRET`, `ADMIN_STATS_KEY`, `SITE_URL`, `LEGACY_ORIGIN`, `ALLOWED_ORIGINS`.
- **Base de données :** PostgreSQL sur **Supabase** (offre gratuite, région Oregon comme Render) depuis le 19/10. L'ancienne base **Neon** gratuite était saturée (quota de 100 CU-h par mois). Ses anciennes données sont réimportées automatiquement par `App/lib/db-import.js`, qui garde les meilleurs scores, dès que Neon répond à nouveau (voir le rappel du 1/11).
- **Connexion :**
  - Discord, le compte principal : l'identifiant Discord sert de numéro de compte interne.
  - Google, depuis le 13/10 (application Google publiée).
  - Twitch, depuis le 24/10.
  - Les fournisseurs sont liés dans la table `account_identities`.
  - Les appels Discord passent par un Worker Cloudflare (`discord-proxy-worker.js`), parce que l'IP partagée de Render était bannie par Discord.
- **Admin :** `/admin/stats?key=…` (clé = `ADMIN_STATS_KEY`) montre les stats de visites et de modes, ainsi que les avis « Donne ton avis » des joueurs (PR #138).
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
  - Si un commit arrive après la QA complète, repasse la PR en brouillon puis en « Ready », ou utilise `qa:full`.
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

## 5. État actuel (27/10/2026 au soir)

- `main` est sur `5c104a0` (merge de la #157). Aucune PR ouverte, rien en cours.
- **Cassé :** la CI `Browser and database quality` est **rouge sur `main` depuis la #156**. Le site en ligne n'est pas touché.
  - Cause : deux tests créent une table `users` sans la nouvelle colonne `photo_key`, d'où l'erreur `column u.photo_key does not exist`.
  - Correctif prêt, **en attente de mon « go »** : dans `App/test/daily-challenge.test.js` et `App/test/daily-dossier.test.js`, ligne 29, ajouter `,photo_key TEXT` à la fin du `CREATE TABLE users(...)`.
  - Ensuite, vérifier avec Postgres local et ouvrir la PR.
- **Incident du 26/10 :** un 503 de Render sur la page de santé, revenu tout seul. Cause inconnue, sans doute un redémarrage Render. Si ça revient, demande-moi une capture des logs Render.
- **`TODO_Pokedle.md` est en partie périmé** (dernière mise à jour générale le 13/10). Exemple : il dit encore « rester sur pokdle.onrender.com », décision annulée le 25/10. Il faudra le remettre à jour.

## 6. Idées et chantiers à venir (avec mes préférences)

1. **Vidéos TikTok / YouTube Shorts du site** (demandé le 27/10) :
   - Vidéos verticales 1080 × 1920 filmées automatiquement sur le vrai site (Playwright), de 15 à 30 secondes.
   - Mes modes préférés :
     - **Pixel** : l'image se dépixelise ;
     - **Cri** : le son est activé sur TikTok ;
     - **Pokémon du jour** : cases colorées et flèches ;
     - **Petit Bac** et **Party Room**, à filmer avec de vrais joueurs (moi et mes amis).
   - J'ajoute ma tête en fond vert dans CapCut et je poste moi-même.
   - **Pas de musique, pas de voix IA, pas de bruitages gratuits.** Rythme pas trop rapide, cohérent, avec du vrai mouvement (« motion design »), pas un diaporama.
   - Commence par **une vidéo test de 20 secondes** et dis-moi avant combien ça coûte.
   - L'ancienne passation disait « Kayan ajoutera la musique » : c'est **faux**, pas de musique.
2. **Faire connaître le site, en douceur :**
   - Des retours de gens qui connaissent Pokémon (par exemple des streamers que je suis en tant que viewer Chebreub), **sans demander de vidéo**.
   - Messages courts et naturels. Je peux dire que ça part d'un truc au boulot avec mes collègues.
   - Kit de textes déjà prêt : `KIT_LANCEMENT.md`. Il est ancien et utilise encore l'adresse onrender : mets-le à jour.
   - Une annonce Discord a été rédigée, mais je n'ai pas confirmé l'avoir postée **(à confirmer)**.
3. **Panneau admin :** pour retirer une photo choquante **et plusieurs autres actions**. Demande-moi la liste. « On fera plus tard quand on aura plus de tokens. »
4. **Profil sur deux appareils :** risque d'écrasement de la progression. À reproduire avant de corriger.
5. **Bandeau d'actualités :** la note sur la flèche de génération expire le 3/11. Prévoir une nouvelle annonce si besoin.
6. **Profil :** la refonte de la direction artistique est commencée (#149). Plus tard : badges d'arène (proposition C) et saisons mensuelles (proposition B) si on veut un rendez-vous.
7. **Comptes :**
   - e-mail et mot de passe mis de côté le 24/10 (la page de confidentialité promet de ne garder ni e-mail ni mot de passe) ;
   - Facebook en dernier ;
   - écran de connexion façon « Bon retour ! » ;
   - relier ou délier un fournisseur dans le profil.
8. **Après le déménagement vers pokdle.fr, côté moi (à confirmer si c'est fait) :**
   - adresses de retour Discord, Google et Twitch, et variables `*_CALLBACK_URL` sur Render ;
   - pingeur sur pokdle.fr ;
   - Search Console : sitemap et « Changement d'adresse » ;
   - Bing.
9. **Autres notes de la TODO :**
   - catalogue à resserrer **(à confirmer)** ;
   - nettoyage du code Draft resté dormant ;
   - lenteur restante du Pokémon du jour et du Wordle (déjà très améliorée le 13/10).

## 7. Ce qui servait de mémoire

- Ces sessions cloud n'avaient pas de mémoire Claude persistante consultable. La TODO cite une note de mémoire « rythme de livraison » et des fichiers de passation stockés dans l'appli Claude de mon PC (`side-session-notes/…`). Ils n'étaient pas accessibles et ne sont pas recopiés ici.
- Le contenu de la passation précédente (27/10) est intégré et corrigé dans ce document.
- Texte exact du rappel automatique Neon (ancien compte) :

> Rappel demandé par l'utilisateur pour le 1er novembre (voir TODO_Pokedle.md, point « Base de données (19/10) »). Le quota gratuit de Neon repart à zéro aujourd'hui. Rappelle à l'utilisateur, en français et simplement :
> 1. Ouvrir les logs Render et chercher la ligne « [import] old data restored », qui montre que les anciennes données Neon ont été récupérées automatiquement (lib/db-import.js).
> 2. Si la ligne n'y est pas, vérifier que la variable Render OLD_DATABASE_URL est bien posée, puis regarder les erreurs [import] dans les logs.
> 3. Changer le mot de passe Neon, qui a été vu en clair sur une capture, puis mettre à jour OLD_DATABASE_URL sur Render avec le nouveau.
> Propose de l'aider à lire les logs s'il te les colle, et de cocher le point dans la TODO une fois fait.
