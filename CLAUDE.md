# Pokédle (pokdle.fr) : passation courte

Version courte (14/11/2026). **Tout l'historique détaillé** (chaque PR, chaque décision depuis octobre, études des concurrents, vidéos) est dans **`docs/HISTORIQUE_PASSATION.md`** : ne le lire qu'en cas de besoin (chercher avec grep), il est très long.

## 1. Comment me parler (Kayan / Zakaria, GitHub `chebreub`)
- Projet perso, né d'un délire au boulot. Tutoiement, **français simple, réponses courtes**, une étape à la fois (je lis sur iPhone, fatigué).
- Je valide par « go » (ou « go A », « 1 »). « Quoi faire mnt ? » = propose la suite par priorité.
- **Consigne permanente : aucun fichier modifié, aucune PR, aucune mise en ligne sans mon accord.**
- **Annonce le coût d'un gros chantier avant de le lancer** (je manque souvent de tokens) et livre du concret.
- **Maquette avant tout changement visuel** ; captures téléphone + PC du vrai site une fois la PR ouverte.
- Heures **à l'heure de Paris**. Préviens-moi quand une mise en ligne est faite. Si je dis « alors ? », donne l'état tout de suite.
- Pas de musique (choix religieux ; ambiance nature faite maison acceptée), jamais ma tête ni ma voix, pas d'images ni voix IA, pas de bruitages gratuits. Sons officiels Pokémon GO acceptés seulement pour la capture (jamais de mélodie).
- Pas d'afflux massif voulu : des retours honnêtes de fans, pas de pub.

## 2. Le projet en bref
- Site https://pokdle.fr (l'ancien pokdle.onrender.com redirige). Dépôt `chebreub/Pokdle`, branche `main`, code dans `App/`.
- Node + Express (`App/server.js`), Socket.IO (Party Room), PostgreSQL (Supabase). Front JS vanilla : morceaux `App/src/script.NN.*.js` assemblés par `App/build.mjs` dans `App/script.js` (**généré, ne jamais l'éditer**, pareil pour `App/dist/`). Logique serveur dans `App/lib/`. Tests dans `App/test/`.
- Depuis `App/` : `npm ci` (build inclus), `npm run build`, `npm test`. Postgres local s'arrête souvent : `service postgresql start`. Tests SQL : `QA_DATABASE_URL=postgresql://qa:qa-local-only@127.0.0.1:5432/pokdle_qa npm test` (base jetable, **jamais** la production).
- QA navigateur : `python3 tools/browser_quality.py --output <dossier>` (≈ 12 min). CI : la QA **complète** tourne à l'ouverture d'une PR non brouillon, avec le label `qa:full`, et sur `main` ; un push sur une PR ouverte ne lance qu'un smoke (règles : `docs/qa/ci-policy.md`).
- Hébergement Render (offre Starter) : un merge sur `main` = mise en ligne en 2-3 min. Variables d'environnement posées par moi (je ne t'en donne jamais les valeurs).
- Admin : `pokdle.fr/admin` (connecté avec mon compte : sondage, messages, modération, outils) et `pokdle.fr/admin/stats?key=…` (bouton « 📋 Tout copier pour Claude »).

## 3. Règles de travail et pièges
- Déroulé : proposer (maquette si visuel) → « go » → branche → coder + `npm test` → PR → captures → **QA complète verte sur le SHA exact** → mon « go merge » → merge (`merge_method: "merge"`) → me prévenir.
- Commit après la QA complète : enlever puis remettre le label `qa:full` (ou brouillon puis « Ready »).
- Nouveau jeu au catalogue : mettre à jour les nombres de cartes dans `tools/browser_quality.py` et `App/test/catalog.test.js`.
- **`App/style.css` a des fins de ligne mélangées** : ne le modifier qu'avec un petit script Python qui garde les octets.
- Tests qui créent leurs propres tables : suivre le schéma réel. Tests datés : les rendre indépendants de la date.
- Sécurité : le secret du Pokémon du jour ne passe jamais par le navigateur. Les jeux récompensés sont vérifiés par le serveur.
- Accessibilité : respecter « réduire les animations », ne jamais retarder une action par une animation, garder un nom lisible par les lecteurs d'écran.
- Direction artistique : fond crème `#FFF8EF`, encre `#2E2A33`, bleu `#4069E0`, jaune `#FFD45C` réservé au Pokémon du jour, lavande Party `#7C5BD6`, carte « Aurore » (dégradé violet → rose) une par page ; Fredoka (titres) + Nunito. Résultats : vert exact, jaune rayé proche, gris faux, jamais la couleur seule. **Artworks officiels seulement.**
- Jamais de secret dans le code, les commits ou le chat. Jour des jeux = jour de Paris.
- Sur téléphone, les écrans compacts **ajoutent** des versions courtes et cachent les longues (la QA et le PC lisent les éléments d'origine) : ne rien retirer de la page.
- Cloud : `cdn.jsdelivr.net` est bloqué ; pour les captures, détourner vers `raw.githubusercontent.com/PokeAPI/sprites/master/…` (Playwright `route`).
- Leçon : après un rebase avec conflit dans un CSS, vérifier les accolades et faire une capture PC + téléphone du vrai site.

## 4. Où on en est (14/11/2026)
- **Priorité 1 : traduction anglais + espagnol.** Décisions et méthode détaillées dans `docs/HISTORIQUE_PASSATION.md` (section « Traduction : audit fait, décisions prises ») et l'audit `docs/i18n/AUDIT_I18N_2026-11-13.md`. En bref :
  - langue choisie dans 🌐 (drapeaux), gardée dans le navigateur, `?lang=en` / `?lang=es` pour forcer ; le français reste la référence et le secours ; `I18N_AUTO_DETECT = false` (sinon la QA et Google passeraient en anglais) ;
  - écrans traduits par `App/src/script.10zzzzr.i18n-dom.js` + `App/i18n/ui.json` (ajouter le conteneur à `I18N_DOM_ROOTS`, relever les textes avec Playwright) ; `t()` et `fr/en/es.json` pour le nouveau code ; noms officiels EN/ES dans `App/i18n/pokemon-names.json` ;
  - pages Google : `/en/pokemon/…`, `/es/pokemon/…` (1025), `/en/games/…`, `/es/juegos/…` (`lib/seo-games-i18n.js`, `lib/seo-pokemon-i18n.js`), hreflang et sitemap ;
  - décisions : même Wordle du jour pour tous (grille dans sa langue), classements communs, en Party Room la langue de l'hôte décide et les noms sont acceptés dans les 3 langues ; relecture de l'espagnol à proposer au développeur de PokeChampions Core.
- **14/11 : accueils `/en` et `/es`** (`App/lib/home-i18n.js` : titre, description, canonique, H1 par langue ; hreflang sur les 3 accueils ; sitemap 3 140 adresses ; l'adresse choisit la langue comme `?lang=`, 🌐 met l'adresse à jour, les liens partagés repartent de `/` pour que l'ami garde sa langue). **Si le titre, la description ou le H1 de `index.html` changent, changer aussi `FR` dans `home-i18n.js`** (un test le vérifie). Reste de l'audit du 14/11, gardé pour après : bandeau « Available in English » (maquette), avis de recherche du jour + rareté visible, évolution par doublons, Tour d'arènes ; accueil : étapes 1-2-3 et compteurs à zéro cachés pour un nouveau.
- **En cours** : PR #417 (lot 6b, 2e partie : 4 jeux « Deviner » en EN/ES, sitemap 3 138 adresses) : « go merge » donné, merger quand la QA complète est verte, puis me rappeler de **renvoyer le sitemap dans la Search Console**.
- **Suite, une étape à la fois** : autres pages de jeux EN/ES par lots de 4-5 (vérifier à l'écran avec `?lang=en` / `?lang=es` que le jeu ouvert est traduit, sinon compléter `ui.json`) → les 3 guides restants → Party Room (lot 3) → autres jeux (lot 2) → compte et social (lot 4) → textes écrits (lot 5 : Quiz 99 questions, Dossier, missions).
- **Demandé ensuite** : audit du site (attirer FR/EN/ES, garder les joueurs, rendre le mode capture plus addictif et lui donner une suite) ; à faire dans une **session neuve**, avec les textes de `/admin/stats` et du sondage que je colle.
- **Plus tard** : drapeaux des pays dans le classement (après la traduction, maquette d'abord) ; communautés Pokémon FR/EN/ES (message court, accord des modérateurs d'abord) ; appli installable (PWA) avant toute appli Android/iOS.
- **Écarté** : chat public et serveur Discord (moins de 100 joueurs/jour), groupes privés / rival du jour, allègement du CSS, Stat Clash vérifié par le serveur, Évolution et Ordre Pokédex (retirés le 13/11, code dormant).
- Metricool : quota mensuel atteint, je publie à la main ; ne pas programmer de nouveaux posts ce mois-ci.
- PokeChampions Core (dév espagnol, appli Flutter) : collaboration possible, rien promis ; jamais de code, données de joueurs ni accès partagés sans ma décision.

## 5. Chiffres utiles (12/11)
50 à 120 sessions par jour ; 30 % des joueurs du Pokémon du jour reviennent le lendemain, 39 % dans les 7 jours, **16 % seulement des nouveaux**. « Tes 3 premiers jours » (13/11) vise ce problème.
