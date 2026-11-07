# AUDIT UX, GAMEPLAY ET FIDÉLISATION - Pokédle

**Date : 7 novembre 2026. Référence : `88494384a068f2224bf5a63c1f3b7d5833e8d4cf`.**

Audit en lecture seule. Aucune modification de code, PR, base de production ou configuration. Les fichiers générés sont des propositions locales pour le dépôt.

## 1. Résumé décisionnel (9 lignes)

1. Le plan a produit de vrais changements ; une refonte générale ne se justifie pas.
2. Sur les 43 actions : 41 clôtures techniques conservées sur preuves de niveaux variables, 1 clôture sur déclaration (GROW-02), 1 à rouvrir partiellement (DATA-04).
3. Aucun P0 nouveau démontré ; aucun ancien bug n'est déclaré revenu par simple manque de recette production.
4. Priorité 1 : relâcher un doublon reste une action irréversible insuffisamment protégée contre double action et changement de compte.
5. Priorité 2 : expiration et quota des propositions d'échange doivent être contrôlés au moment de la transaction.
6. Priorité 3 : la rétention mesure le retour dans les 7 jours et une activité plus large que les seules parties.
7. Priorité 4 : la protection du chat Party doit être alignée/vérifiée avec celle des messages privés.
8. Priorité 5 : les sons officiels Pokémon GO et l'ensemble des droits des assets/émulateurs exigent une revue documentée.
9. Suite recommandée : plan V2 court, mesures réelles, aucune modification des prix/taux/récompenses ni nouveau système communautaire.

## Niveaux de preuve et limites

- **[code]** : source figée, fonction/SQL, test ou résultat de recette technique. Une fiche de recette de l'auteur n'est pas la même preuve qu'un test réexécuté par l'auditeur ; la distinction est indiquée quand elle compte.
- **[site]** : observation indépendante du site déployé. **Aucune recette interactive de production réalisée ici** : les tentatives d'ouverture de `pokdle.fr` par l'outil ont échoué. Cela ne démontre pas que le site est en panne.
- **[stat]** : agrégats de vrais joueurs. **Aucun nouvel export admin fourni.** Les données fictives des captures CI sont des jeux de test, pas des chiffres de fréquentation.
- **[signal]** : retour d'un joueur ou déclaration du propriétaire, explicites comme tels.
- **[hypothèse]** : conséquence possible, jugement produit ou scénario à confirmer. Pas présentée comme un incident déjà subi.

Le code est figé sur `8849438`, même si `main` évolue pendant l'audit. Les sources générées `App/script.js` ne sont pas utilisées comme référence métier.

**Recette indépendamment inspectable :** archive CI de la PR #333 (run 42383113678, head `db33b727...`). Son `revision.txt` indique `0173fde33870e50de8011247318e1c9bef72590d`, fusion temporaire de test. `browser/report.json` annoncé **410 contrôles passés, 0 échec**, avec des largeurs 360, 390, 768, 1366, 1920 et 2560 px. Il y a aussi des recettes ciblées Chromium/WebKit, PostgreSQL et multi-clients, dont les rapports ont été lus. Des cas conditionnels y sont identifiés : 410 ne veut pas dire 410 fonctionnalités indépendantes.

L'auditeur a inspecté les rapports et des captures, pas relancé ces 410 contrôles. WebKit automatisé n'est pas un iPhone physique. Les 1025/1025 de la fiche iPhone sont une exécution annoncée par l'auteur ; ils ne sont pas présentés comme une exécution personnelle de cet audit. Aucun accès authentifié avec deux comptes de production, ni lecture exhaustive de chaque ligne de chaque module, n'est revendiqué.

## 2. Vérification des 43 actions

**Sens de "vraiment fait" :** livraison dans le périmètre convenu, étayée par les sources/recettes indiquées ; pas preuve universelle sur tous les appareils et pas preuve d'une hausse de rétention. Une simple fiche d'auteur reste une preuve documentaire, pas une nouvelle exécution.

**Résultat : 42 clôtures conservées, dont GROW-02 sur [signal] ; DATA-04 partiellement fait.** Aucun "pas fait ou régressé" n'est démontré dans le périmètre des 43. Les problèmes d'échange et de relâchement relevés ci-dessous existent dans des fonctions voisines ; ils n'annulent pas arbitrairement DEX-01 ou la recherche PART-04.

NIV-01 et GROW-01 ont été mis de côté par le propriétaire et sont exclus du dénominateur. ECO-01 est une étude, SER-01 un pilote personnel, SAVE-01 une reprise locale : il serait incorrect de les noter en échec parce qu'ils ne livrent pas des fonctions hors périmètre.

| Lot | Action | Verdict de livraison | Preuve et limite |
|---|---|---|---|
| 0 | BUG-MOB-01 | Vraiment fait | [code] recette `mobile-touch/report.json`, cibles basses ; correctif #271 du toast invisible. [signal] retour Jade consigné dans S01. Pas une certification de tous les téléphones. |
| 0 | MOB-02 | Vraiment fait | [code] même recette tactile, intersections des cibles et calques ; [signal] premier toucher iPhone et fenêtres confirmés le 07/11 dans S01. |
| 0 | MOB-03 | Vraiment fait | [code] `App/src/script.10ja.mobile-controls.js` ; `docs/qa/MOB_03_CONTROLS.md` ; `mobile-controls/report.json` et `mobile-chat/report.json`. Clavier simulé distinct du clavier physique. |
| 0 | MOB-04 | Vraiment fait | [code] `guessBarKeepVisible`, `guessBarScrollDelta` dans S17 ; test `ios-sound-guessbar-2026-11-07.test.js`. [signal] retour iPhone du propriétaire. |
| 0 | MOB-05 | Vraiment fait | [code] recette `header-density` et captures à 360/390 px ; #317, mesure documentée 320-1366. Le sous-protocole conserve encore une réserve iPhone : trace documentaire à réconcilier, pas débordement constaté. |
| 0 | PC-01 | Vraiment fait | [code] `pc-desktop/report.json` : plateau classique et Course au Pokédex à 1366x768, Chromium/WebKit, overflow nul ; images inspectées. |
| 0 | PC-02 | Vraiment fait | [code] clôture #282, gestion clavier contextualisée ; recettes autocomplete, Duel et Party. Pas de raccourci imposé aux discussions ; détails dans S01. |
| 0 | DATA-01 | Vraiment fait | [code] `docs/qa/USAGE_EVENT_GRAIN.md` et cadrage S01 : grains des visites/ouvertures/fins. Livraison documentaire, pas preuve rétroactive des dates de déploiement. |
| 1 | LOG-01 | Vraiment fait | [code] `App/src/script.10xm.guess-series.js`, changement de longueur de série ; #261 : même choix sans reset, refus conservé. Périmètre des séries concernées uniquement. |
| 1 | LOG-02 | Vraiment fait | [code] `mergeProfileData` dans S16, record zéro et indicateur explicite distinct de l’absence de record ; #266. |
| 1 | LOG-03 | Vraiment fait | [code] #264, catalogue et changement Entre amis ; recettes `catalog`, `party-entry`, `generation-catalog` dans CI-2. |
| 1 | LOG-04 | Vraiment fait | [code] #268, combinaison Connections déjà essayée ; recette `connections-fairness-and-play` dans CI-2. Pas de deuxième erreur pour le même ensemble. |
| 1 | SAVE-01 | Vraiment fait | [code] séries dans `App/src/script.10xm.guess-series.js`, clôture #270. Reprise locale par compte/générations ; aucune promesse de reprendre une manche sur un autre appareil. |
| 1 | FX-02 | Vraiment fait | [code] #274, file des célébrations ; `mobile-chat/report.json`, cas modales et notifications. La clôture vise les superpositions, pas la suppression de toute animation. |
| 1 | DATA-02 | Vraiment fait | [code] `docs/qa/USAGE_SEGMENTS.md`, #278 et recette admin. Segmentation prospective admin/test/non marqué ; non marqué n’est pas synonyme d’humain. |
| 1 | DATA-04 | Fait partiellement | [code] S07 `cohortRates` et `SITE_SOURCES` : cohortes mûres/admin exclus livrés, mais retour dans les 7 jours et activité issue de cadeaux/bonus ne prouvent pas uniquement des parties. Voir V2-MES-01. |
| 2 | NIV-02 | Vraiment fait | [code] #279, aide Stat Mystère ; recette `solo-mode-recipe/report.json`, cas `stat-mystere`. Ne pas transformer cette action en refonte de difficulté NIV-01, différée. |
| 2 | SER-01 | Vraiment fait | [code] #280, `docs/qa/SER_01_PIXEL_RECORDS.md` ; records personnels Pixelisé et fusion S16. Le départage public serveur n’était pas livré dans ce pilote. |
| 2 | MEDIA-01 | Vraiment fait | [code] #281, `docs/qa/MEDIA_01_CRY_PLAYBACK.md` ; chemins audio vérifiés dans S11. Réessai borné/retours tardifs/sortie sans défaite, pas garantie de disponibilité du fournisseur. |
| 2 | DISC-01 | Vraiment fait | [code] #321, `docs/qa/DISC_01_DISCOVERY_CARD.md` ; carte visible dans capture `390-cosy-home-games.jpg`. Un jeu suggéré, refus possible, pas nouveau catalogue. |
| 2 | DISC-02 | Vraiment fait | [code] #322 : 13 choix additionnels de quêtes, toujours 4 quêtes quotidiennes ; périmètre de S01/S02. Instrumentation présente, effet sur la variété non mesuré ici. |
| 3 | DEX-01 | Vraiment fait | [code] S05 `captureHistory`/`collection`, `pokedex-states/report.json` : découvert, déjà capturé et actuellement possédé ; un échange n’est pas une capture personnelle. |
| 3 | DEX-02 | Vraiment fait | [code] S05 `captureRoutes` et `catchableTotal`, `pokedex-routes/report.json` : 845 sauvages + 6 expédition + Drattak = 852 capturables ; 173 autres sans voie par Ball. |
| 3 | DEX-03 | Vraiment fait | [code] #295, `docs/qa/DEX_03_TRACKING.md` ; `pokedex-targets/report.json`, secrets masqués et suivi limité à 3. Pas de bonus de probabilité. |
| 3 | DEX-04 | Vraiment fait | [code] #296, `docs/qa/DEX_04_SHOWCASE.md` ; `pokedex-showcase/report.json`, vitrine 6 cases privée et partage volontaire avec possessions revalidées. |
| 4 | ECO-01 | Vraiment fait | [code] #299, `docs/qa/ECO_01_SIMULATION.md`. L’action est une simulation comparative ; aucune seconde chance hebdomadaire n’a été autorisée par cette seule clôture. |
| 4 | ECO-02 | Vraiment fait | [code] S05 intégration `statusForSalamence` / `recoveryForSalamence` ; #301 : reprise unique, 21 jours, 3 nouveaux jours, 2 victoires/mode et week-end. |
| 4 | ECO-03 | Vraiment fait | [code] S05 `coinPlay` et S15 : complément 30 -> 60 -> 90, plafond 90 par source/mode, plafond play 2000 ; aucun cumul 30+60+90. |
| 4 | ECO-04 | Vraiment fait | [code] S05 `claimChests` ; #309 et `docs/qa/ECO_04_EXPEDITION_CHEST_IDEMPOTENCE.md` : emplacements manquants et anti-double-crédit. Attribution automatique des coffres expirés exclue du périmètre. |
| 4 | ECO-05 | Vraiment fait | [code] #305, `docs/qa/ECO_05_CAPTURE_METRICS.md` : mesures versionnees prospectives, seuil 10 lancers pour ventilation par espèce. Aucun taux observé post-plan fourni. |
| 4 | ECO-06 | Vraiment fait | [code] S13/S11, `earn` refuse hors preuve Party ; `verifiedTimedEarning` refuse H/L 60 s sans réponse. Modes purement clients exclus des gains ₽/Balls. |
| 4 | ECO-07 | Vraiment fait | [code] #302, préparation et probabilités avant ouverture, annulation sans rencontre ; S05 et `economy-transactions/report.json` pour les dépenses distinctes. |
| 4 | ECO-08 | Vraiment fait | [code] S05 `LEGEND_HOLD_MS` et sélection des rencontres ouvertes : 72 h sur nouveaux légendaires hebdomadaires, pas sur Drattak ou rencontres ordinaires. |
| 5 | PART-01 | Vraiment fait | [code] #311 et `part01-invite/report.json` : arrivée anonyme, jeu dessin présélectionné, ancien lien et jeu changé traites. |
| 5 | PART-02 | Vraiment fait | [code] #313, `docs/qa/PART_02_COMPARABLE_SERIES.md` : 10 mêmes cibles côté serveur, 2 progressions indépendantes, 8 essais ; anciens records clairement distincts. |
| 5 | DATA-03 | Vraiment fait | [code] #315, `docs/qa/DATA_03_SHARE_STEPS.md` : ouverture partage, lien reçu, lancement distingués. Ce sont des événements, pas nécessairement des visiteurs uniques attribues. |
| 5 | PART-03 | Vraiment fait | [code] #316, `docs/qa/PART_03_CAPTURE_SHARE.md` : capture serveur, image 1080x1350 sans pseudo, lien fiche et compteurs serveur ; partage facultatif. |
| 5 | PART-04 | Vraiment fait | [code] S06 `matches`, `sharesDupes`, `setShare`, `propose` : recherche entre amis/consentement, pas album complet. Les réserves de transaction V2-TRA-01 sont distinctes de cette recherche. |
| 6 | FX-01 | Vraiment fait | [code] #324 et `docs/qa/FX_01_ANIMATION_MODES.md` : Normal/Rapide/Réduit, priorité système, Passer. Le résultat serveur ne depend pas de la mise en scene. |
| 6 | GEST-01 | Vraiment fait | [code] #326 et `docs/qa/GEST_01_DEX_SWIPE.md` : geste sur image, boutons 44 px conservés, filtre suivi ; [signal] confirmation du propriétaire dans S01. |
| 6 | GEST-02 | Vraiment fait | [code] #327 et `docs/qa/GEST_02_SHEET_HANDLE.md` : fermeture par poignee/titre, boutons/champs exclus ; [signal] confirmation dans S01. |
| 6 | GEST-03 | Vraiment fait | [code] #330 : lancer facultatif, desactive par défaut ; même route `throwBall` protégée, geste interrompu sans consommation ; S01/S05. |
| 7 | GROW-02 | Vraiment fait [signal] | [signal] publication par Kayan déclarée dans S01/S02 et par le propriétaire. Aucun compte Metricool ni publication externe consulté pendant cet audit ; pas de résultat d’acquisition certifie. |

### Ecarts documentaires

[code] Le plan annoncé "43/43 terminé", puis conserve "incident tactile distinct - suivi ouvert", une prochaine action MOB-03 et, plus bas, "prochaine action DEX-01". Ces passages anciens contredisent la synthèse finale et les lignes cochées. Les fiches de gestes demandent encore une confirmation physique, alors que la synthèse consigné le retour iPhone du propriétaire. C'est un défaut de traçabilité, pas la preuve d'un bug tactile toujours actif. Conserver l'historique date, mais le retirér des consignés courantes. Sources S01/S02/S12.

[code] DATA-04 livre bien des cohortes mûres, les effectifs et l'exclusion admin. Sa définition "J+7" et son périmètre "parties" ne correspondent toutefois pas exactement au calcul. La clôture doit être nuancée, sans supprimer les données historiques. Sources S07/S14.

## 3. Nouvel audit par rubrique

### 3.1 Ergonomie téléphone et PC

**Ce qui est solide.** [code] Les captures de recette à 360/390 px montrent une navigation mobile identifiable, un appel au Pokémon du jour nettement principal, des cartes de catalogue différenciées, des fenêtres et commandes de boutique lisibles. Le thème sombre reste lisible dans les vues inspectées. Le plateau Course au Pokédex tient sur l'écran PC testé. Les contrôles de hit-test et les corrections ciblées sont plus convaincants qu'un empilement arbitraire de `z-index`. CI-2 et S01.

[signal] Jade a confirmé la correction du bas d'écran ; Kayan a confirmé plusieurs gestes, sons et saisies iPhone. Ces retours permettent de conserver les clôtures, sans prétendre que l'auditeur a tenu leur téléphone.

**Sons et clavier récents.** [code] `getPokedexFxAudioContext` recrée un moteur fermé et traite son interruption ; le réveil au geste évite de rejouer une rafale de sons en retard. `guessBarKeepVisible` corrige le défilement après ajout d'une proposition, sans remonter si la barre est déjà visible. Ne pas redessiner ces composants avant un nouvel incident reproduit. S12/S17 et CI-1.

**Réserve produit.** [hypothèse] Le site reste dense : quotidien, progression, cadeau, boutique, album, missions, jeux et social. La réponse n'est pas une nouvelle page d'accueil gigantesque. Garder le Pokémon du jour dominant, les recommandations déjà présentes et un objectif personnel facultatif. Mesurer les abandons de parcours et recueillir les retours spontanés ; GROW-01 reste différé.

**Réserve concrète.** [code] `tradeRelease` exécute directement le relâchement depuis la fiche. La protection "jamais le dernier exemplaire" n'est pas un consentement à perdre un doublon shiny. Une confirmation claire et une opération unique doivent être ajoutées, en conservant le retour visuel et les tarifs existants. S08/S05 ; V2-REL-01.

### 3.2 Fiabilité, sauvegarde et erreurs réseau

[code] L'isolation des historiques et des séries, les merges de profils, le record Qui est-ce à zéro et la reprise locale des séries ont un périmètre explicite. Les recettes Daily/Wordle/Dossier vérifient reprise et erreurs réseau ; le multijoueur comporte des reprises de participants et transferts d'hôte. Aucune nouvelle perte de sauvegarde globale n'est démontrée. S16, S01 et CI-2.

**Ne pas surpromettre :** SAVE-01 ne synchronise pas une manche en cours entre deux appareils. Les règles de reprise serveur et les données personnelles locales doivent rester distinguées dans l'aide.

[code] Achats et lancers transmettent un identifiant d'action, l'état attendu et `actionScope`. Le serveur conserve un reçu, refuse un prix ou une rencontre obsolètes et détecte un changement de compte. Ce sont de vraies protections de transaction. S05 `actionReceipt`, `wild`, `handle`.

**Ecart REL-01.** [code] `/api/wild/release` n'utilise ni le reçu `actionReceipt`, ni la vérification `accountBound` appliquée aux lancers/achats. Le front n'ajoute ni confirmation ni verrou de requête dans `tradeRelease`. Deux intentions techniques identiques peuvent donc être traitées comme deux relâchements légitimes si plusieurs doublons existent. Une fiche ouverte sur A, puis un cookie passé à B dans un autre onglet, peut viser B. [hypothèse] Scénario à rejouer en environnement jetable ; aucun inventaire de joueur n'a été touché ici.

**Acceptance :** un seul exemplaire et un seul crédit pour dix rejeux d'une même action ; changement d'identité = refus ; annuler = aucune écriture. Ce n'est pas un changement de récompense.

**Page ouverte pendant une mise en ligne.** Conserver le bandeau de version et le rechargement volontaire. [hypothèse] La compatibilité ancien onglet/nouveau serveur doit faire partie d'un smoke ciblé lors des prochaines modifications d'API, pas d'une longue recette répétée après chaque modification de texte.

### 3.3 Gameplay et pédagogie par famille

| Famille | Évaluation et preuve | Limite utile / suite |
|---|---|---|
| Parcours quotidien : Enquête, Wordle, Dossier, Défi | [code] Cibles serveur, contrôles des propositions, reprise et erreurs réseau ; Wordle refuse les mauvaises longueurs dans la recette. | Pas de secret du jour fourni au navigateur pendant la partie. La difficulté réelle exige des résultats de joueurs, absents ici. |
| Classique, Pixelisé, Zoom/Silhouette, Cri, Description | [code] Séries, reprise locale et données de devinette vérifiées. MEDIA-01 traite les pannes audio, pas une mauvaise réponse forcée. | Identifier la panne comme une panne ; ne pas pénaliser ni donner une récompense arbitraire. |
| Stat Mystère | [code] Aide repliable, exemple de lecture et première lettre existante. | [hypothèse] Peut rester exigeant pour débutants ; ne pas utiliser l'anecdote Kokiyas comme preuve et ne pas rouvrir NIV-01 sans décision. |
| Quiz, Higher or Lower, Poids, Shiny | [code] Sessions serveur et meilleure performance rémunérée par différence ; minute sans réponse non rémunérée. | Les outils externes et bots ne sont pas rendus impossibles par ces contrôles ; ne pas promettre un anti-triche absolu. |
| Connections, Intrus, Combo, Speedrun, ordre/évolution | [code] Recettes `solo-mode-recipe` et Connections ; correction de double erreur. | Les modes non vérifiés ne produisent pas de monnaie via une déclaration libre. Montrer clairement leur progression personnelle et la vraie éligibilité aux gains. |
| Draft / outils d'équipe / favoris | [code] Les outils et leurs parcours demeurent disponibles, distincts des sessions rémunérées. | Ne pas rendre chaque outil obligatoire pour gagner les ressources quotidiennes. Aucun nouveau mode proposé. |
| Party Room / Dessine-le / défis entre amis | [code] Invitation directe et "Même série" existent ; anciens défis de records conservés et différenciés. | Un record obtenu sur une autre suite n'est pas un duel strictement comparable. Ne pas supprimer l'ancien usage pour autant. |

[code] SER-01 est volontairement un record personnel Pixelisé : ne pas l'annoncer comme un nouveau départage de tous les classements publics. [stat] Aucun classement des modes par réussite ou abandon actuel ne peut être calculé avec les seules captures de test.

### 3.4 Collection, Pokédex, captures et rareté

[code] DEX-01 résout un ancien problème de sens : **découvert**, **capturé personnellement au moins une fois**, **possédé maintenant** ne sont plus interchangeables. Une mission donne une découverte ; un Pokémon reçu par échange n'est pas une capture personnelle. S05 `captureHistory`, `collection` et les captures DEX.

[code] Les compteurs de voie de capture portent sur **852 espèces**, et non une promesse mensongère de capturer les 1025 par Ball : 845 sauvages, 6 légendaires d'expédition, Drattak prestige. Les 173 autres ont une information de voie distincte. Le suivi de trois cibles et la vitrine de six possessions existent déjà. S01 et S05.

[code] Les rencontres sont **pondérées** via `wild-rarity`, et le shiny des hautes herbes vaut **1/500 depuis le 05/11**. L'ancien audit parlant de tirage uniforme et de 1/150 ne doit pas être repris comme état actuel. Le nombre de lancers reste trois.

[code] La préparation d'un légendaire et la fenêtre de 72 h existent. La reprise Drattak n'est pas une seconde chance quotidienne : elle suit la variante G validée. [hypothèse] Les occasions rares peuvent rester frustrantes, mais ECO-01 a déjà étudié cet arbitrage ; cet audit ne transforme pas sa clôture en autorisation de rendre la capture plus facile.

### 3.5 Économie

Voir le second fichier pour les règles, exemples, anomalies et scénarios de test.

**Conclusion de cette rubrique :** [code] pas de retour de l'ancien robinet `/api/balls/earn` librement alimentable par un faux score arcade ; les gains viennent des sessions vérifiées ou d'une preuve Party. ECO-03 conserve les barèmes, verse seulement le complément et reste plafonné.

**Attention au vocabulaire :** [code] les 2000 ₽ plafonnent les sources `play:*`, pas tous les crédits du portefeuille. Les jeux du jour, Party et relâchements doivent être distingués. [stat] Aucun niveau d'inflation réel n'est démontré sans mouvements de portefeuille et population de joueurs. Ne pas baisser les gains sur une intuition.

### 3.6 Social et sécurité des enfants

[code] Le chat privé a blocage, signalement et suspension ; la recette montre le signalement d'une ancienne conversation après retrait d'ami. La recherche d'échanges respecte le partage des doublons, les blocages et l'amitié. Les échanges gardent le dernier exemplaire et ne mélangent pas normal/shiny. S06, CI-2.

**TRA-01 : expiration.** [code] `respond` sélectionne un échange `pending` mais ne vérifie pas sa date ; `expire` est appelée dans `list`. Un ancien onglet ou un appel sans rafraîchissement peut donc atteindre une acceptation trop tardive. Le contrôle doit être transactionnel, pas seulement lié à l'affichage.

**TRA-01 : concurrence.** [code] `propose` fait les comptages puis l'insertion hors transaction de quota. [hypothèse] Deux requêtes simultanées, alors que deux propositions existent déjà, peuvent franchir ensemble le plafond de trois. Le transfert final est bien transactionnel : ne pas confondre ce défaut de proposition avec une duplication démontrée des Pokémon.

**SOC-01 : couverture Party a verifier/aligner.** [code] `party-chat.js` conserve un filtre d'URL plus étroit que celui du chat privé. Ses fonctions ne filtrent pas les coordonnées de la même manière et n'assurent pas à elles seules un signalement exploitable. Avant toute modification, un test d'intégration doit confirmer les contrôles ajoutés éventuellement dans le handler Socket.IO. Il ne faut pas annoncer ce chat comme protégé au même niveau sans cette preuve. Pas de nouveau chat public ni de collecte générale des conversations proposée.

### 3.7 Fidélisation et mesure

[code] Les moteurs de retour sont déjà là : quotidien, quêtes, série, missions, cibles, collection, expédition, amis. DISC-01 et DISC-02 répondent à la découverte de modes ; inutile d'ajouter une autre liste quotidienne obligatoire.

**DATA-04 / MES-01 : constat précis.** Dans `cohortRates`, `week` vaut vrai pour `b.day > a.day AND b.day <= a.day + 7`. Il mesure **un retour dans les 7 jours**, pas une présence exactement à J+7. Ce n'est pas un mauvais indicateur : c'est un indicateur à nommer correctement.

Dans `SITE_SOURCES`, `ball_gains` n'exclut que `admin:%`. Cadeau, bienvenue, achat et coffre peuvent donc alimenter l'activité. Les autres tables sont sélectionnées sans filtre uniforme d'une action de jeu effective. Dire que cet indicateur prouve uniquement des "parties jouées" serait excessif. Un jeu de test avec seulement des cadeaux deux jours de suite suffit à mettre ce périmètre en évidence ; il ne s'agit pas d'une statistique de vrais joueurs.

**Recommandation :** conserver la mesure historique en la nommant correctement ; définir une vue "retour au jeu" si c'est la décision recherchée, avec sources qualifiées et tests. Ne pas inventer une identité humaine unique à partir de plusieurs cookies/comptes. Toute rupture de définition doit être datée.

[stat] La nouvelle version date du 07/11 : un effet J+7 portant sur des utilisateurs exposés à cette version ne peut pas être mesuré le jour même. À titre de calendrier, une activité du 7 avec observation jusqu'au 14 exige que cette dernière journée soit terminée. Aucun taux ni objectif de croissance chiffré inventé.

### 3.8 Performance, accessibilité et SEO

**Performance.** [code] Les recettes n'affichent pas d'échec global, mais aucun LCP/INP réel, poids transféré à froid, consommation mémoire iPhone ni taux d'erreur de production n'a été mesuré ici. Le poids de sources concaténées n'est pas le poids compressé reçu. Priorité à une mesure reproductible avant un grand découpage du JavaScript.

**Dépendances.** [code] L'archive contient 3 entrées de sévérité modérée : `qs`, `express`, `body-parser`, autour du même avis GHSA-6pq8-jhm2-2vcw. La faille porte sur `qs.stringify` avec `arrayFormat:'comma'` et objets non fiables. Aucun chemin exploitable dans Pokédle n'a été démontré. Mettre à jour de façon ciblée vers une résolution corrigée, tester les formulaires/paramètres, et conserver l'analyse d'applicabilité. D1 et CI-3 ; pas de patch majeur aveugle.

**Accessibilité.** [code] Boutons alternatifs aux gestes, textes/icônes de résultat, mode réduit, cibles tactiles et tests clavier vont dans le bon sens. [hypothèse] Il reste à mesurer contraste, zoom 200 %, ordre du focus et annoncé lecteur d'écran dans les nouveaux écrans ; une capture sombre lisible à l'œil ne prouve pas à elle seule une conformité d'accessibilité.

**SEO.** [code] Les pages jeux/guides/Pokémon et le sitemap existaient déjà ; il ne faut pas proposer leur recréation. [site] Disponibilité HTTP, canonical effectivement servie et robots de production non revalidés ici. [stat] Aucun export Search Console : impossible de conclure combien de pages sont indexées ou apportent des joueurs. Les modalités personnelles et API ne doivent pas être poussées à l'indexation comme de nouvelles pages éditoriales.

### 3.9 Risques juridiques et droits

Cette section est une revue de risques, pas une consultation juridique ni une conclusion de contrefaçon pour chaque asset.

[code] `script.10xzo.go-sfx.js` nomme explicitement les sons de capture Pokémon GO, chargés depuis `/sfx/go/*.mp3`. Le propriétaire les a choisis ; cela ne constitue pas une autorisation des ayants droit. L'absence de musique n'élimine pas les droits sur les effets sonores. **Priorité : documenter une permission ou basculer sur les effets synthétiques déjà présents**, sans mélodie. S09 et L1.

Les artworks officiels et la disponibilité via PokéAPI ne constituent pas une licence générale de réutilisation dans un jeu public. Le support Pokémon demandé de ne pas associer sa propriété intellectuelle à des projets non autorisés ; les directives de presse ont une portée éditoriale limitée. Gratuit, petite audience et mention "fan project" ne sont pas des autorisations. Ne pas remplacer les illustrations par de l'IA ; inventorier droits et provenance, puis arbitrer avec un professionnel. L1/L3/L4.

Le nom Pokédle, les références Pokémon et l'identité visuelle présentent un risque a evaluer du point de vue du public et des droits antérieurs. Aucun registre de marques ni accord individuel n'a été vérifié ici ; on ne peut affirmer ni que le nom est disponible, ni qu'un changement serait obligatoirement imposé.

**Émulateur GBA/DS :** [signal] le fonctionnement décrit charge le fichier du joueur. Ne pas fournir de ROM, BIOS protégés, clés ou liens illicites réduit un risque de distribution ; cela ne rend pas automatiquement toute copie utilisateur licite. Le droit de sauvegarde du logiciel suppose notamment un droit d'utilisation et une nécessité de préservation ; ce n'est pas une autorisation générale de télécharger n'importe quelle ROM. La licence du moteur d'émulation et de ses cœurs doit aussi être respectée. Inventaire binaire/licences non exhaustivement réalisé ici. Pas de 3DS ni d'extension du catalogue proposée. L2.

## 4. Nouveau plan court

Voir `docs/PLAN_AMELIORATION_POKEDLE_V2.md` : huit actions, aucun P0 nouveau démontré, aucune hausse ou baisse des taux/prix/récompenses.

## 5. Questions et pièces manquantes

Aucune question bloquante pour cet audit en lecture seule. La conclusion sur les effets réels exige ensuite un export anonymisé admin (définitions, effectifs, économie et cohortes mûres), les mesures de performance déployées et la preuve de droits des sons. Les validations iPhone déjà signalées sont reconnues ; il n'est pas demandé au propriétaire de recommencer indistinctement tout le plan.

## Sources et reproductibilité

Tous les liens de code sont figés sur le commit audité.

- **S01** : [Plan V1](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/docs/PLAN_AMELIORATION_POKEDLE.md).
- **S02** : [État d’avancement](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/docs/ETAT_AVANCEMENT_POKEDLE.md).
- **S03** : [Audit UX précédent](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/docs/audits/AUDIT_UX_GAMEPLAY_FIDELISATION_2026-11-05.md).
- **S04** : [Audit économie précédent](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/docs/audits/AUDIT_ECONOMIE_CAPTURE_POKEDLE_2026-11-05.md).
- **S05** : [Règles, attribution et transactions](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/App/lib/poke-balls.js).
- **S06** : [Échanges](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/App/lib/wild-trades.js).
- **S07** : [Cohortes et sources de rétention](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/App/lib/daily-retention.js).
- **S08** : [Relâchement dans l’interface](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/App/src/script.10xzg.trades.js).
- **S09** : [Sons de capture officiels](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/App/src/script.10xzo.go-sfx.js).
- **S10** : [Chat Party Room](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/App/lib/party-chat.js).
- **S11** : [Arcades vérifiées](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/App/lib/verified-arcade.js).
- **S12** : [Recette iPhone du 7 novembre](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/docs/qa/IPHONE_SONS_BARRE_2026_11_07.md).
- **S13** : [Matrice autorité des récompenses](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/docs/qa/ECO_06_REWARD_AUTHORITY.md).
- **S14** : [Définition des cohortes DATA-04](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/docs/qa/DATA_04_RETENTION.md).
- **S15** : [Recette meilleure partie](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/docs/qa/ECO_03_BEST_GAME.md).
- **S16** : [Fusion des profils](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/App/src/script.07a.profile-merge.js).
- **S17** : [Ancrage de la saisie Safari](https://github.com/chebreub/Pokdle/blob/88494384a068f2224bf5a63c1f3b7d5833e8d4cf/App/src/script.10jb.guess-bar-anchor.js).
- **CI-1** : [exécution navigateur/PostgreSQL #42383113678](https://github.com/chebreub/Pokdle/actions/runs/42383113678), conclusion GitHub `success`, PR #333, head `db33b727d682e3201e3695e377bbf4d19d8e48e1`.
- **CI-2** : archivé `browser-quality-42383113678.zip`, `revision.txt` et `browser/report.json` : révision `0173fde33870e50de8011247318e1c9bef72590d`, fusion de test de la PR. Ce n'est pas le SHA documentaire `8849438`.
- **CI-3** : `dependency-audit.json` de cette archive ; 3 entrées modérées, liées à un même avis `qs`, pas trois failles indépendantes.
- **L1** : [CPI L122-4](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006278911/2026-05-27), reproduction/représentation et consentement.
- **L2** : [CPI L122-6-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044365559/2026-05-11), droits d'utilisation du logiciel et sauvegarde.
- **L3** : [Pokémon Support : usage des images et matériaux](https://support.pokemon.com/hc/en-us/articles/360000634094-Can-I-use-Pok%C3%A9mon-images-or-materials), page consultée le 07/11/2026.
- **L4** : [Directives médias TPCi](https://pokemon.gamespress.com/fr/Media-Usage-Guidelines), licence éditoriale limitée, pas une permission générale de fabriquer un jeu.
- **D1** : [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw), `qs.stringify`, correctif 6.16.1 ; exploitabilité dans Pokédle non démontrée.

La synthèse locale `preuves_qa_et_calculs.json` conserve les empreintes des rapports consultés et les calculs dérivés de la formule de capture. Les journaux ne sont pas des statistiques de production.
