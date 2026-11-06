# Pokédle — Plan d’amélioration et registre de reprise

> **Référence opérationnelle** pour poursuivre ce chantier dans un autre chat, sans réaudit ni perte des décisions.
> Créé le **5 novembre 2026** depuis `main` `714b41d13cd905936f257b0e59497f2a30b23d4c` (PR #259).
> **Suivi au 06/11/2026 : MOB-03 clôturé techniquement, volets #285, #287 et #289 fusionnés ; 14 actions intégrées.**

**Progression validée : 14 tâches terminées / 43 actives = 32,6 %.** Deux actions en cours (DEX-01 et BUG-MOB-01), 27 non commencées ; NIV-01 est stationné et exclu du total. Voir [état d'avancement](ETAT_AVANCEMENT_POKEDLE.md). Les 43 tâches n'ont pas le même poids : ce ratio compte des cases clôturées, pas des heures ou la maturité globale du site.

**DEX-01 a ensuite été engagé dans la [PR #290](https://github.com/chebreub/Pokdle/pull/290), encore ouverte et en validation CI.** Le total intégré reste **14/43** ; situation courante : **2 actions en cours** (DEX-01 et BUG-MOB-01), **27 non commencées**. Ne pas compter DEX-01 terminé avant sa fusion.

## MOB-03 — clôture technique vérifiée le 6 novembre 2026

[PR #289](https://github.com/chebreub/Pokdle/pull/289) fusionnée au commit `87d242e8b15b7f18f3f5e75852f4e3b188502e67`, après [CI Node verte](https://github.com/chebreub/Pokdle/actions/runs/42237885834) et [CI navigateur/base complète verte](https://github.com/chebreub/Pokdle/actions/runs/42237896376) sur `842484f479dd0ecc01e668281e7512d600a670ac`. Les trois volets (#285, #287, #289) sont intégrés. Le commit fusionné et son arbre ont été contrôlés sur `main`.

Le dernier correctif préserve le clic tactile WebKit en conservant le focus sur `mousedown`, sans envoyer au `pointerdown`. Build, 20 tests Node ciblés et parcours local Chromium/WebKit à 360/390/1366 px réussis ; la CI complète valide aussi le reste des parcours. [Détails et limites](qa/MOB_03_CONTROLS.md).

**À la clôture de MOB-03 : 14/43 = 32,6 % ; 1 action en cours : BUG-MOB-01 ; 28 non commencées ; lot 0 : 4/7. Prochaine action unique : DEX-01.** Aucun clavier iPhone physique ni déploiement Render vérifié. BUG-MOB-01 (appareil de Jade) et MOB-04 (focus/scroll Safari réel) restent distincts et ouverts. NIV-01 reste stationné, exclu du total. Économie, captures et sauvegardes inchangées.

## À lire en premier à chaque reprise

1. Lire ce document, l'[état d'avancement](ETAT_AVANCEMENT_POKEDLE.md), les [deux audits de novembre](audits/README.md) et le [guide du nouveau chat](REPRISE_NOUVEAU_CHAT.md), puis le dernier `main`, les PR fusionnées **après** le SHA ci-dessus et les tests concernés.
2. Prendre la **première action non terminée** de la section « Prochaine action ». Ne pas refaire un audit global.
3. Petits changements minimaux, tests locaux, CI GitHub, PR vérifiée ; ne pas fusionner de modifications sensibles sans contrôle.
4. **Mettre à jour ce document dans chaque PR** : statut, tests, numéro, commit et action suivante.
5. Séparer strictement **code lu**, **test automatisé réussi** et **recette réellement effectuée sur iPhone / Render**.
6. Ne pas publier de données personnelles ou d'identifiants issus du tableau de bord d'administration.

## Intentions produit validées

- Site : [Pokédle](https://pokdle.onrender.com/) ; dépôt : [chebreub/Pokdle](https://github.com/chebreub/Pokdle).
- Objectif : fiabiliser les jeux existants et le téléphone, augmenter la rejouabilité et la découverte, développer les invitations entre amis et clarifier les collections.
- **Ne pas repartir de zéro** : les modes, l'économie, les animations, les captures et de nombreuses corrections UX existent déjà.
- La remarque sur « Kokiyas / génération 9 » était **une plaisanterie entre collègues**, pas une plainte utilisateur ni une preuve de difficulté. **Ne pas créer ou prioriser de filtre de générations en réaction à cette anecdote.** Les neuf générations restent disponibles ; les filtres libres existants restent inchangés.
- Conserver les sauvegardes, comptes, Balls, captures et Pokédollars. Pas de suppression de `localStorage` en masse, pas de fausse sécurité cliente et pas de migration destructive.
- La collection distingue **vu**, **capturé au moins une fois** et **actuellement possédé** ; découvrir un Pokémon via une mission n'accorde pas une capture.
- Pour l'instant, **aucune modification des probabilités de capture** : formule actuelle et trois lancers conservés. Le shiny est à 1/500 depuis le 05/11/2026 ; les stats arrêtées le 04/11 ne l'évaluent pas.
- Toute modification économique ou de progression serveur doit être examinée séparément et faire l'objet de simulations/tests ; les propositions chiffrées ci-dessous ne sont **pas des décisions de mise en production**. **Six arbitrages de cadrage du 05/11/2026 sont consignés au Lot 4 ; les accords de principe ne valent pas validation finale.**
- Un geste iPhone est facultatif et ne remplace jamais les boutons accessibles, ni ne valide une dépense, une fuite, un abandon ou un relâchement caché.
- On vise un **partage lié à une activité** (Dessine-le, défi comparable, collection), pas des sollicitations répétitives.

## Prochaine action (une seule prioritaire)

**BUG-MOB-01 — Identifier le blocage tactile en bas d'écran avant de toucher aux couches CSS.**

Ce P0 dépend d'une **vérification sur appareil réel**, encore absente. Le correctif ciblé [#271](https://github.com/chebreub/Pokdle/pull/271) est fusionné (`0422481d`, CI verte), mais BUG-MOB-01 reste en cours. **FX-02 est terminé**, [PR #274](https://github.com/chebreub/Pokdle/pull/274) fusionnée au commit `70e75a2` (CI Node et navigateur/base vertes). **DATA-01 a documenté les unités réelles des compteurs. DATA-02 (#278) apporte la segmentation prospective admin / test / non marqué, avec historique préservé ; 'non marqué' ne prouve pas une activité humaine. Prochaine action autonome : MOB-03**, rendre les commandes mobiles principales accessibles au pouce, sans cacher chat, clavier ou récompenses ; ne pas déduire que l'anomalie tactile de Jade est entièrement résolue. Ne pas bloquer les autres lots à cause d'une hypothèse tactile ni marquer le P0 résolu.

Signalement du 04/11/2026, écran « Qui est-ce ? » et possiblement d'autres jeux : sur téléphone, des cibles en bas ne répondent pas, mais deviennent cliquables lorsqu'on les fait remonter en défilant. Navigateur et modèle **non connus**. Cause **non confirmée sur le téléphone réel** ; l'interception par un toast transparent a été corrigée dans #271, mais le retour de Jade reste à recueillir.

Méthode :
1. Reproduire sur appareil réel, avec détails modèle/navigateur, état du clavier et éventuels panneaux ouverts.
2. Sur 390×844 et 360×780 en tests navigateur, puis Safari iPhone réel : taper dans les zones haute, centrale et basse, défiler, ouvrir/fermer un panneau, clavier, app en arrière-plan.
3. Utiliser `document.elementsFromPoint(x,y)` avec coordonnées *viewport* pour identifier ce qui intercepte l'appui, plutôt que jouer avec les `z-index` sans preuve.
4. Modifier uniquement le composant fautif ; tester le retour, la navigation et les autres modes.
5. Marquer « corrigé » uniquement après vérification réelle, pas après l'existence d'un test théorique.

Voir `docs/qa/MOBILE_TACTILE.md` pour le protocole et les outils de diagnostic.

## Suivi par lots

Légende : `[ ]` à traiter, `[~]` en cours, `[x]` terminé et vérifié. Un lot n'est pas « terminé » si une recette iPhone requise reste absente.

### Lot 0 — Fiabilité tactile, ergonomie mobile/PC
- [~] **BUG-MOB-01 · P0** : retour Jade, zone basse non cliquable. [PR #271](https://github.com/chebreub/Pokdle/pull/271) : tests à coordonnées sur deux modes et correctif ciblé du toast de résultat invisible (`pointer-events` seulement pendant son affichage) ; **CI Node et navigateur vertes ; recette sur téléphone réel à vérifier avant de clôturer**. Ne pas conclure que tous les appareils sont touchés.
- [ ] **MOB-02 · P0** : nettoyer les calques invisibles/effets *uniquement si identifiés comme cause* ; éviter tout patch global de `pointer-events` ou `z-index`.
- [x] **DATA-01 · P0** : [dictionnaire de grain et couverture](qa/USAGE_EVENT_GRAIN.md) vérifié dans les sources (`trackUsage`, `recordMatchHistory`, `usage-metrics`, Party, dashboard) : distingue visites brutes, sessions navigateur, ouvertures, fins déclarées, commandes de manches et retours Daily. **Dates exactes de mise en production non disponibles** : méthode de lecture de la première observation conservée et limites des 90 jours documentées, **aucune date ni historique inventés**. Documentation uniquement ; pas de nouveau suivi individuel. Clôture du cadrage, pas vérification de dates de déploiement réelles.
- [x] **MOB-03 · P1** : clôture technique ; boutons du champ partagé (#285), chat/célébrations (#287), commandes Party/Duel/Défi (#289) intégrés après CI verte. Recette iPhone physique distincte ; voir [preuves](qa/MOB_03_CONTROLS.md).
- [ ] **MOB-04 · P1** : contrôle de focus et scroll dans les jeux rapides, Safari réel.
- [x] **PC-01 · P1** : [PR #283](https://github.com/chebreub/Pokdle/pull/283) (après fusion) : styles PC compacts à 1366×768 ; grille Course au Pokédex intégrale sans scroll de jeu, avec moteur de dimensionnement inchangé ; commandes et panneau secondaire du jeu classique visibles. Recette deux navigateurs sur plusieurs tailles et refus des doublons.
- [x] **PC-02 · P1** : [PR #282](https://github.com/chebreub/Pokdle/pull/282) (après fusion) : clavier contextualisé Solo, Défi, Party et Duel ; flèches limitées aux suggestions visibles, Échap ferme la liste avant une modale, Entrée en Duel reliée à un seul gestionnaire, saisie IME/modificateurs protégés. Chats et autres champs non interceptés, sans modification des parties ou récompenses.

### Lot 1 — Logique, reprise, données
- [x] **LOG-01 · P1** : choix 5/10/20 sans réinitialisation si valeur identique ; confirmation et conservation de l'état/préférence si changement refusé. PR [#261](https://github.com/chebreub/Pokdle/pull/261), **CI Node et navigateurs vertes**, fusionnée au commit `646d83c`.
- [x] **LOG-02 · P1** : record « Qui est-ce ? » à 0 question distingué de l'absence de record via indicateur explicite, fusion multi-appareils et affichage. [PR #266](https://github.com/chebreub/Pokdle/pull/266) fusionnée au commit `9a68b84f` ; **CI Node et navigateur vertes**.
- [x] **LOG-03 · P1** : filtre solo du catalogue ne masque pas la Party Room lors du passage « Entre amis ». [PR #264](https://github.com/chebreub/Pokdle/pull/264), CI Node et navigateur **vertes**, fusionnée au commit `cfa0d021`.
- [x] **LOG-04 · P1** : une combinaison erronée Connections déjà soumise ne coûte pas une deuxième erreur, y compris après mélange. [PR #268](https://github.com/chebreub/Pokdle/pull/268) fusionnée au commit `d8c87fe7` après **CI Node et navigateur/base de données vertes**.
- [x] **SAVE-01 · P1** : reprise locale des séries Pixelisé, Cri, Silhouette et Description par compte et sélection de générations, avec état de manche, manches achevées et bouton « Reprendre » à l'accueil. [PR #270](https://github.com/chebreub/Pokdle/pull/270) **fusionnée** au commit `f1b1abef` après [CI Node verte](https://github.com/chebreub/Pokdle/actions/runs/42065243849) et [CI navigateur/base verte](https://github.com/chebreub/Pokdle/actions/runs/42065325060) sur le head `933d4f15`. Aucune synchronisation inter-appareils ni recette sur iPhone réel revendiquée.
- [x] **FX-02 · P1** : sérialisation des célébrations de niveau et de succès, regroupement des succès débloqués simultanément, respect des notifications XP/résultat et des fenêtres de capture, cadeaux/coffres, rencontre sauvage et autres modales ; animations de sortie non cliquables. [PR #274](https://github.com/chebreub/Pokdle/pull/274) **fusionnée** au commit `70e75a2` après [CI Node verte](https://github.com/chebreub/Pokdle/actions/runs/42078493841) et [CI navigateur/base verte](https://github.com/chebreub/Pokdle/actions/runs/42078513945) sur le head `92c62a23`. Recette iPhone réel non revendiquée ; aucun gain/XP/capture modifié.
- [x] **DATA-02 · P1** : [PR #278](https://github.com/chebreub/Pokdle/pull/278) : nouveaux agrégats prospectifs admin authentifié / tests déclarés / non marqués ; totaux historiques et purge à 90 jours maintenus. Aucune attribution rétroactive aux joueurs ; voir [protocole](qa/USAGE_SEGMENTS.md). KPI bruts, estimations de navigateurs et économie non filtrés.
- [ ] **DATA-04 · P1** : rétention J1/J7 sur cohortes matures ; « retour Pokémon du jour » ≠ rétention globale.

### Lot 2 — Gameplay, maîtrise et découverte
- [x] **NIV-02 · P1** : [PR #279](https://github.com/chebreub/Pokdle/pull/279) : aide repliable pour lire les statistiques dans Stat mystère (exemple fictif, barres, total), clavier et mobile accessibles ; difficulté, première lettre après 5 essais déjà présente, récompenses et secret serveur inchangés. Signal initial 5/50 victoires parmi fins déclarées.
- [x] **SER-01 · P1** : [PR #280](https://github.com/chebreub/Pokdle/pull/280) : pilote **personnel** Pixelisé. Nombre trouvé prioritaire, puis nombre d'essais sur les trouvés pour les performances mesurées ; anciens scores numériques conservés sans inventer d'essais, fusion des profils corrigée. Les classements publics gardent le nombre trouvé tant qu'un départage serveur vérifié n'existe pas. [Protocole](qa/SER_01_PIXEL_RECORDS.md).
- [x] **MEDIA-01 · P1** : [PR #281](https://github.com/chebreub/Pokdle/pull/281) : réessais en cas de panne audio, délai borné, protection des retours tardifs et sortie sans déclarer de défaite. Même secret et même URL opaque vérifiée ; aucune tentative ou récompense modifiée. [Recette et limites](qa/MEDIA_01_CRY_PLAYBACK.md).
- [ ] **DISC-01 · P2** : une carte de découverte tournante, sans déplacer les favoris ni refaire l'accueil.
- [ ] **DISC-02 · P2** : mieux varier les missions existantes, sans nouveaux gains ni liste quotidienne obligatoire.
- [ ] **NIV-01 · STATIONNÉ** : proposition initiale de « mes générations » dans Qui est-ce non motivée par un vrai retour ; **ne pas programmer à partir de la plaisanterie Kokiyas**.

### Lot 3 — Pokédex et collection
- [~] **DEX-01 · P1** : filtres, compteurs et fiches préparés ; historique serveur distinct des exemplaires possédés, échanges reçus exclus des captures personnelles. [Données, tests et limites](qa/DEX_01_STATES.md). CI et fusion requises avant clôture.
- [ ] **DEX-02 · P1** : montrer les voies d'obtention vraies ; document actuel `docs/PLAN_RARETE_1025.md` = 852 espèces capturables, 173 non capturables maintenant.
- [ ] **DEX-03 · P1** : suivre jusqu'à 3 cibles personnelles, sans changer les probabilités ni divulguer les secrets.
- [ ] **DEX-04 · P2** : vitrine optionnelle de 6 Pokémon détenus et objectif proche ; partage volontaire.

### Lot 4 — Économie et rencontres **décisions de cadrage, sans autorisation de mise en production**
- [ ] **ECO-01 · P1 · À SIMULER** : nouvelle occasion limitée pour l'expédition légendaire, sans capture garantie et sous autorité serveur. **Pas d'accord de principe avant comparaison des scénarios.**
- [ ] **ECO-02 · P1 · ACCORD DE PRINCIPE, À CADRER** : éviter la remise à zéro intégrale après fuite de Drattak, sous réserve des tests. **Repenser l'expédition comme un rendez-vous particulier, de type événement**, avec éventuelle apparition aléatoire à discuter ; fréquence, déclenchement, récupération et conditions de reprise **non décidés**.
- [ ] **ECO-07 · P1 · ACCORD DE PRINCIPE, À TESTER** : préparation explicite des rencontres de prestige (proposition : au moins 3 Balls avant ouverture, chances visibles, annulation sans perdre la piste). Définir et vérifier les détails opérationnels avant validation finale.
- [ ] **ECO-08 · P1 · ACCORD DE PRINCIPE, À TESTER** : proposition de conserver une rencontre spéciale ouverte pendant 72 h, sans nouveau tirage ni nouveau stock gratuit. Durée et conditions exactes à confirmer après tests ; **ne pas appliquer d'office à l'événement Drattak**.
- [ ] **ECO-05 · P1** : instrumenter la version des règles (`shiny 1/150` vs `1/500`), cible, Ball, ordre du lancer et type de rencontre, en agrégats.
- [ ] **ECO-03 · P2 · À REDISCUTER** : proposition 30/60/90 ₽ (différence entre paliers, plafond 90/mode, idempotence) **non acceptée à ce stade**. Ne pas implémenter ni changer les récompenses avant nouvel échange et validation.
- [ ] **ECO-04 · P2 · ACCORD DE PRINCIPE, À TESTER** : assurer qu'un coffre d'expédition déjà acquis est crédité une seule fois, même s'il n'est pas ouvert immédiatement. Vérifier les cas de reconnexion, requête répétée et interruption avant validation finale.
- [ ] **ECO-06 · P2** : vérifier la réelle autorité serveur des récompenses pour chaque mode prioritaire.

#### Décisions de cadrage économique — 05/11/2026

**Nature de ces décisions :** orientations du propriétaire du jeu, **pas** approbations de règles définitives ni autorisations de déploiement. Elles ne terminent aucune action ECO, ne changent pas le compteur des 43 tâches et ne remplacent pas les audits historiques.

| Référence | Décision | À faire avant toute modification |
| --- | --- | --- |
| **ECO-01 — Expéditions légendaires** | **Simuler et comparer avant de décider.** | Comparer des scénarios de nouvelle occasion limitée et leur effet sur la rareté, la fréquence de rencontre, l'inventaire et le risque d'abus. Ne pas présumer d'une capture garantie. |
| **ECO-02 — Drattak** | **Accord de principe sous réserve des tests**, **concept événementiel à rediscuter**. | Préserver une partie du travail après fuite est une piste favorable, mais l'expédition doit pouvoir devenir un **rendez-vous particulier, de type événement**, possiblement déclenché de façon aléatoire. **Aucune règle fixée** sur périodicité, hasard, conditions d'accès, fenêtre, progression conservée, reprise ou récompense. Présenter des variantes avant arbitrage. |
| **ECO-07 — Préparation** | **Accord de principe sous réserve des tests.** | Étudier l'exigence proposée d'au moins trois Balls, l'affichage des chances et une annulation sans perte de piste ; vérifier les situations sans suffisamment de Balls, les interruptions et les tentatives répétées. |
| **ECO-08 — Rencontre spéciale ouverte** | **Accord de principe sous réserve des tests.** | Évaluer le maintien proposé pendant **72 h**, sans nouveau tirage ni Balls offertes ; tester expiration, reprise, multi-appareils et idempotence. **Pas d'association automatique avec l'événement Drattak**, qui reste à cadrer séparément. |
| **ECO-03 — Paliers de Pokédollars** | **À rediscuter ensemble.** | Aucune validation du barème 30/60/90 ₽, du plafond ni de la règle de complément par différence. Conserver les récompenses existantes jusqu'à nouvel arbitrage. |
| **ECO-04 — Coffres d'expédition** | **Accord de principe sous réserve des tests.** | Sécuriser le crédit unique du coffre acquis, même sans ouverture immédiate. Contrôler attribution, reprise, double clic, déconnexion et répétition de requêtes sans duplication de gains. |

**Conditions de passage à la réalisation :**
1. Établir pour chaque piste un état actuel vérifié dans le code et, si pertinent, dans les données agrégées, sans confondre règles existantes et propositions.
2. Simuler les variantes et les conséquences sur la rareté, les ressources, les dépenses et les comportements abusifs, en conservant explicitement les paramètres en vigueur.
3. Faire valider **les règles exactes**, y compris l'événement Drattak, avant tout changement d'économie ou de progression.
4. Après validation finale seulement : PR isolée, tests serveur/transactions, absence de duplication, CI verte et vérification de production. Aucune migration destructive.

**Gel maintenu :** probabilités de capture, taux shiny 1/500, nombre de lancers, prix, stocks de Balls, Pokédollars, récompenses et inventaires inchangés. **Prochaine action autonome : DEX-01** ; MOB-03, PC-01, PC-02, MEDIA-01, SER-01, NIV-02, DATA-01, DATA-02, SAVE-01 et FX-02 sont intégrées ; le cadrage économique est distinct.

### Lot 5 — Invitations et diffusion naturelle
- [ ] **PART-01 · P1** : invitation directe Dessine-le : pas de compte obligatoire, salon et jeu présélectionnés, lien expiré explicite.
- [ ] **PART-02 · P1** : défis de série réellement comparables ; même configuration/secret autorisé par serveur, sans divulgation.
- [ ] **DATA-03 · P1** : distinguer ouverture du partage, ouverture du lien reçu et partie réellement lancée.
- [ ] **PART-03 · P2** : carte partageable après vraie capture marquante ; partage natif et lien de repli.
- [ ] **PART-04 · P2** : permettre de chercher/échanger des doublons sans divulguer les données privées.

### Lot 6 — Gestes et animations (après correction tactile)
- [ ] **FX-01 · P2** : réglage « animations rapides », réduire les mouvements et boutons Passer.
- [ ] **GEST-01 · P2** : balayage entre fiches de collection, avec flèches visibles.
- [ ] **GEST-02 · P2** : fermer une fiche/panneau par la poignée, avec bouton de fermeture.
- [ ] **GEST-03 · P3 · OPTION** : lancer une Ball par glissement facultatif, même appel serveur, même taux, aucune dépense sur geste interrompu.

### Lot 7 — Validation et acquisition
- [ ] **GROW-01 · P2** : test guidé auprès de quelques joueurs externes, compétences Pokémon différentes, appareils réels.
- [ ] **GROW-02 · P2** : séquences réelles de jeu sans visage ni musique, diffusion ciblée avec accord des communautés.

### Livraison DATA-02 — PR #278 (après fusion)

- **Séparation prospective des compteurs** sans migration destructive : `usage_event_daily` reste intact en tant que total brut ; les nouvelles lignes segmentées par événement et date classent l'administration à partir de la session signée, les tests volontairement déclarés et les événements non marqués.
- **Transparence** : un test peut se déclarer côté client ; un événement non marqué ne permet pas de conclure à l'existence d'un joueur humain. La période antérieure est explicitement non ventilable. Les uniques, l'économie, les cohortes Daily et les chargements bruts ne sont pas reclassifiés.
- **Tests** : contrôles Node sur la classification, la ventilation, le navigateur et l'atomicité SQL ; CI GitHub Node et navigateur/base obligatoires avant fusion. **Pas de recette de production ni de Safari réel déclarée**.
- **Progression après fusion : 8/43 = 18,6 %**. Prochaine tâche autonome : **NIV-02**. `BUG-MOB-01` reste en attente de confirmation sur l'appareil de Jade.

### NIV-02 — aide pédagogique facultative, PR #279 (après fusion)

- Ajout d'un panneau de compréhension des statistiques de base de **Stat Mystère**, fermé par défaut et intégré à la rangée du titre. Exemple volontairement fictif ; guide accessible au clavier et cible de 44 px sur petit écran.
- **Aucune règle changée :** essais, classement, gains, secret côté serveur, capture et aide existante de la première lettre après 5 tentatives. L'aide ne dévoile aucun nouveau indice propre au Pokémon courant.
- Tests Node de structure/accessibilité + QA navigateur/serveur exigées sur le head exact ; **aucune recette physique iPhone ou Render n'est revendiquée.**
- **Progression après fusion : 9/43 = 20,9 %**. Prochain chantier **SER-01** : pilotes de records Pixelisé sans écraser les anciens scores. `BUG-MOB-01` toujours ouvert et non confirmé sur vrai appareil.

### SER-01 — records personnels Pixelisé, PR #280 (après fusion)

- **Critères** : dans les séries Pixelisé 5/10/20, maximiser le nombre trouvé, puis minimiser les essais **sur les Pokémon trouvés** à égalité, uniquement pour deux scores réellement instrumentés. Les essais des manches perdues ne sont pas comptabilisés pour le départage.
- **Historique conservé** : `guessSeriesBest` garde l'ancien nombre trouvé. Les nouvelles précisions sont dans `guessSeriesPrecision.pixel`; à égalité avec un ancien score sans essais connus, indiquer « record égalé ; 1re référence d’essais », sans inventer un nouveau record. Synchronisation entre appareils fusionnée par meilleur résultat (ne jamais convertir l'ancien objet de records en 0).
- **Limite explicite** : le tableau de classement public `pixel10` reste au nombre trouvé. Un classement interjoueurs départagé par essais nécessiterait une validation serveur, hors pilote. Aucun changement de récompense, de tirage, de sauvegarde de manche ou d'économie.
- **Tests** : nouveaux tests Node et CI navigateur/base exigés sur le head final ; pas de recette Safari iPhone ou Render physique revendiquée. [Règles et garde-fous](qa/SER_01_PIXEL_RECORDS.md).
- **Progression après fusion : 10/43 = 23,3 %** ; prochaine action **MEDIA-01**. `BUG-MOB-01` reste en investigation réelle.

### MEDIA-01 — échec audio Cri sans défaite imposée, PR #281 (après fusion)

- Le lecteur audio du mode Cri est renouvelé après erreur de lecture, délai ou média indisponible ; **12 s** maximum par chargement CDN et **20 s** pour une URL opaque servie par deux CDN côté serveur. Une interruption de lecture est également bornée.
- La lecture retardée d'une ancienne manche ne peut plus affecter le statut de la nouvelle. Sur erreur, le bouton **Réessayer le cri** se réactive et une sortie vers les autres modes est disponible **sans déclarer de défaite**. Les vraies réponses et abandons restent des actions distinctes.
- Secret toujours côté serveur pour les parties vérifiées, URL opaque inchangée ; **aucune modification** des essais, scores, séries, XP, Balls, monnaie, taux, récompenses ou transactions.
- **Validation :** tests Node dédiés et vérifications navigateur/base exigés sur le même head avant fusion ; pas de recette Safari réel / Render revendiquée. [Procédure et limites](qa/MEDIA_01_CRY_PLAYBACK.md).
- **Progression après fusion : 11/43 = 25,6 %** ; prochaine action autonome **PC-02**, raccourcis clavier PC dépendant du contexte de jeu. `BUG-MOB-01` demeure en attente de reproduction réelle.

### PC-02 — interactions clavier contextuelles (PR #282, après fusion)

- **Solo, Défi ami, Party, Duel** : flèches haut/bas ne capturent le clavier qu'avec les suggestions visibles ; Entrée valide une sélection active ou effectue l'action normale une seule fois ; Échap referme d'abord la liste, sans fermeture de modale inattendue.
- **Duel** : retrait d'un deuxième gestionnaire d'Entrée qui pouvait soumettre deux fois la même proposition. Modificateurs et composition IME ignorés. Aucun raccourci global dans les chats, formulaires ou autres modes.
- **Périmètre** : JavaScript des contrôles et tests Node, aucune modification de la partie, des données sauvegardées, du serveur, de l'économie, de la capture, des Pokédollars ou des Pokéballs. Les contrôles déjà fonctionnels d'autres modes restent en place.
- **Validation** : tests Node dédiés puis CI Node et navigateur/base sur le head exact avant fusion ; pas de recette iPhone/Safari réelle ni de test manuel Render revendiqué.
- **Après fusion : 12/43 = 27,9 %** ; prochaine action autonome **PC-01**. `BUG-MOB-01` reste ouvert sans confirmation sur appareil réel.

### PC-01 — affichage PC compact et Course au Pokédex (PR #283 fusionnée)

- Sur ordinateurs de **1280×720 à 1920×1080**, et en particulier **1366×768**, la grille 151 cases de Course au Pokédex garde toute sa place, sans scroll de jeu : en-tête, scores, horloge, plateau et saisie sont visibles. Les espaces sont réduits sur les petits écrans PC, la grille conserve son moteur `ResizeObserver`, et le jeu normal gagne de la place pour son panneau secondaire.
- **Règles inchangées** : premier Pokémon valide prend la case avec son sprite, deuxième proposition refusée sans point, score/calcul serveur, durées, équipes, générations. Aucun changement de taux, récompense, Pokédollars, Balls, base ni sauvegardes.
- **Vérification intégrée au workflow complet** : `tools/pc_desktop_quality.py` ouvre deux vrais navigateurs dans une salle locale, vérifie le plateau Gen 1 à 1280×720, 1366×768, 1600×900, 1920×1080, les entrées et la capture de case, puis Chromium et WebKit. Tests Node et CI navigateur/base à vérifier sur la PR avant la fusion. Ce n'est pas une recette physique d'iPhone ni une preuve de déploiement Render.
- **Après fusion** : 13/43 = 30,2 % ; prochaine action autonome **MOB-03**, une amélioration tactile circonscrite indépendante de `BUG-MOB-01`, qui reste ouverte jusqu'au retour réel du téléphone.

## Audits détaillés et documents de reprise

- [Audit UX, gameplay, mobile, fidélisation et diffusion](audits/AUDIT_UX_GAMEPLAY_FIDELISATION_2026-11-05.md) — constats, observations, risques et améliorations sans redéveloppement inutile.
- [Audit des Pokédollars, captures, Balls, rareté et expéditions](audits/AUDIT_ECONOMIE_CAPTURE_POKEDLE_2026-11-05.md) — règles en vigueur, export 22/10–04/11 et propositions **non validées**.
- [État d'avancement des 43 actions, % et PR](ETAT_AVANCEMENT_POKEDLE.md) — à mettre à jour après chaque fusion.
- [Prompt autonome de reprise dans un nouveau chat](REPRISE_NOUVEAU_CHAT.md) — ordre de lecture, décisions et méthode.
- [Index des audits anciens](audits/README.md) — historique : ne pas prendre leurs constats datés pour des bugs actuels sans vérification.

## Chiffres à garder correctement interprétés

**Source :** captures du tableau de bord et `pokdle-economie-2026-11-04.json` fournis dans la conversation du 05/11. 22/10–04/11 inclus, agrégats principalement, non joueurs uniques.

- 1 123 sessions, 1 586 ouvertures de jeux ; 439 Enquête, 271 Illimité, 222 Higher/Lower.
- Stat mystère : **5 victoires / 50 fins suivies**, *pas 90 % d'abandon des visiteurs*. Pixelisé 70/79, Description 32/37.
- Party : 24 manches Dessine-le sur 46, pas une part de joueurs. 5 actions « partager », 15 arrivées par lien de défi : pas de taux de conversion calculable.
- Rencontres : 195, captures : 127, lancers : 274, **10 identités**. Fréquence observée 127/274 = 46,4 % par lancer, pas une probabilité générale.
- 13 085 ₽ crédités, 9 170 ₽ dépensés. Le flux net de 3 915 ₽ **n'est pas le solde global**.
- 4 shinies vus / 3 capturés sur la période **antérieure** au 1/500 du 05/11.
- Le code actuel utilise les taux `capture_rate` sourcés de PokéAPI mais une **formule Pokédle** : `min(0.95, 0.8 * (taux/255)^0.72 * multiplicateur Ball)`. Ne pas confondre avec un taux officiel de réussite.
- Ne pas fusionner les compteurs issus de périodes/versions différentes. Certaines fins suivies sont des manches, pas des sessions.


### État GitHub au 05/11/2026 (reprise inter-chats)

- **PR [#260](https://github.com/chebreub/Pokdle/pull/260) fusionnée** dans `main` : plan, protocole tactile et tests coordinate-based. CI complète verte, aucune correction du bug utilisateur confirmée.
- **PR [#261](https://github.com/chebreub/Pokdle/pull/261) fusionnée** dans `main` : correction des remises à zéro accidentelles des séries 5/10/20 ; suite Node + CI navigateur complètes vertes. La sauvegarde et la reprise de séries sur rechargement (SAVE-01) restent un chantier distinct.
- **Point historique de novembre :** les PR #264, #266, #268 et #270 sont désormais intégrées. Au prochain chat, consulter `main` et commencer **DATA-02** sans refaire les lots antérieurs ; BUG-MOB-01 attend la confirmation sur appareil réel.

## Journal d'avancement (à mettre à jour dans les PR)

| Date | Lot | Fait | Vérification | PR |
|---|---|---|---|---|
| 2026-11-05 | 0 | Plan permanent, protocole et tests Chromium/WebKit des coordonnées tactiles ; **aucun correctif CSS** | Node + suite navigateur **vertes**, PR fusionnée ; aucune reproduction Safari iPhone réel ; bug toujours ouvert | [#260](https://github.com/chebreub/Pokdle/pull/260), commit `000728c` |
| 2026-11-05 | 1 | Anti-réinitialisation des séries 5/10/20 ; confirmation si changement en cours ; cinq tests Node | **Tests Node et suite navigateur complets verts**, PR fusionnée ; aucune nouvelle règle de capture | [#261](https://github.com/chebreub/Pokdle/pull/261), commit `646d83c` |

## Suivi de la PR #264 (au dernier contrôle du 05/11/2026)

- **LOG-03 est [x]** : [PR #264](https://github.com/chebreub/Pokdle/pull/264) fusionnée (`cfa0d021`), [CI Node](https://github.com/chebreub/Pokdle/actions/runs/42024332274) et [CI navigateur](https://github.com/chebreub/Pokdle/actions/runs/42024332512) vertes. Merge confirmé le 05/11/2026.
- Progression après fusion : **2/43 = 4,7 %** ; prochaine action LOG-02.
- Ce lot documentaire **n'implémente aucune mécanique de jeu** et n'ajoute pas de tâche [x] au décompte.

### SAVE-01 — intégrée (#270)

- La CI navigateur du head `5b1c9971` a également identifié un focus mobile non souhaité pendant la restauration (scroll du mode Cri à 360/390 px). Le focus est désormais réservé au desktop avec `preventScroll`, et un test Node couvre mobile et desktop. **Contrôle ultérieur : CI Node et navigateur vertes sur le head final `933d4f15`, puis PR fusionnée.**
- [PR #270](https://github.com/chebreub/Pokdle/pull/270) : reprise locale versionnée des séries par compte **et groupe de générations**. Le test navigateur initial a également révélé une régression quand la génération changeait : sauvegardes désormais distinctes par groupe, sans effacement du précédent. Le test initial a révélé qu'une restauration de manche passait par erreur dans la validation du Daily : condition corrigée, et contrôle de non-suppression des anciens slots ajouté. **CI Node et navigateur verte sur `933d4f15`; merge confirmé `f1b1abef`**.
- Progression après fusion : **5/43 = 11,6 %**. La sauvegarde entre appareils n'est pas couverte ; compte, inventaire et économie inchangés. La recette réelle sur Safari iPhone / Render n'est pas revendiquée.

### FX-02 — intégrée (#274)

- Célébrations de niveau et de succès auparavant autorisées **en parallèle** ; une file unique garde un seul bandeau/écran actif, et regroupe les succès déverrouillés simultanément en un bandeau (jusqu'à trois noms, puis `+N autres succès`). Les événements de récompenses sont conservés, seul leur **affichage** change.
- Les notifications visibles d'XP et de résultat, ainsi que les fenêtres de capture, cadeau/coffre, rencontre sauvage et autres modales ouvertes, gardent la priorité. Les célébrations patientent au lieu de les recouvrir. Après fermeture, l'affichage reprend automatiquement. Les fonds et bandeaux en cours de disparition ont `pointer-events:none`.
- Tests Node (file, regroupement, blocage/reprise) et navigateur Chromium/WebKit (interception tactile à coordonnées) ajoutés. **Aucune règle de gain, XP, Balls, Pokédollars, inventaire, shiny ou capture changée.**
- [PR #274](https://github.com/chebreub/Pokdle/pull/274) **fusionnée** (`70e75a2`) après [CI Node verte](https://github.com/chebreub/Pokdle/actions/runs/42078493841) et [CI navigateur/base verte](https://github.com/chebreub/Pokdle/actions/runs/42078513945) sur le head `92c62a23`. Progression **6/43 = 14,0 %** ; BUG-MOB-01 reste distinct en attente de confirmation sur appareil réel. Prochaine action autonome **DATA-01**.

### DATA-01 — dictionnaire des métriques (05/11/2026)

- Documentation de code : [grain des événements, dates de couverture et interprétation](qa/USAGE_EVENT_GRAIN.md), référencée depuis [le guide de mesure](usage-metrics.md). Les lancements ne constituent pas des parties initiées vérifiées ; les fins suivies peuvent représenter plusieurs manches par ouverture, et les événements Party sont des actions serveur distinctes.
- Le suivi est agrégé en jours UTC conservés **90 jours au plus**. Les dates d'activation réelles des compteurs sont **inconnues** sans recoupement des déploiements et données historiques, et n'ont pas été inventées. Une requête en lecture seule propose l'identification de la première journée **encore conservée**, sans l'appeler date de déploiement.
- **Cadrage documentaire achevé, pas d'implémentation de nouveau tracking** ; progression après fusion documentaire : **7/43 = 16,3 %**. Prochaine action : **DATA-02**, séparer essais/admin de l'activité réelle sans supprimer les journaux ni demander de données personnelles.

### Clôture SAVE-01 — 05/11/2026

- [PR #270](https://github.com/chebreub/Pokdle/pull/270) fusionnée (`f1b1abef`) après validations [Node](https://github.com/chebreub/Pokdle/actions/runs/42065243849) et [navigateur/base](https://github.com/chebreub/Pokdle/actions/runs/42065325060) vertes sur le head `933d4f15`. Le correctif mobile du libellé « Manche 6 / 10 » est inclus. **Pas de synchronisation inter-appareils** et **pas de recette Render/iPhone réelle** dans cette validation.
- **5/43 = 11,6 %** ; prochain chantier **FX-02**, sans modification des décisions économiques déjà consignées.

### LOG-04 — intégré

- [PR #268](https://github.com/chebreub/Pokdle/pull/268) fusionnée (`d8c87fe7`) après CI [Node verte](https://github.com/chebreub/Pokdle/actions/runs/42036602850) et [navigateur/base de données verte](https://github.com/chebreub/Pokdle/actions/runs/42036604853), sur le head exact `ed9b57f8`. Tests répétitions, mélange et quatre erreurs distinctes.
- Progression **4/43 = 9,3 %**. Prochaine tâche : SAVE-01 (reprise atomique des séries et isolation multi-comptes). BUG-MOB-01 reste non reproduit sur vrai téléphone.

### LOG-02 — intégré

- [PR #266](https://github.com/chebreub/Pokdle/pull/266) fusionnée (`9a68b84f`) après CI Node [verte](https://github.com/chebreub/Pokdle/actions/runs/42034302915) et navigateur/base de données [verte](https://github.com/chebreub/Pokdle/actions/runs/42034303017). Progression : **3/43 = 7,0 %**.
- Prochaine action : LOG-04. BUG-MOB-01 reste en investigation : aucune recette iPhone réel.

| 2026-11-05 | 1 | LOG-04 : rejets répétés dans Connections sans nouvelle pénalité | CI Node + navigateur/base de données vertes ; PR fusionnée, aucune recette Safari réel | [#268](https://github.com/chebreub/Pokdle/pull/268), commit `d8c87fe7` |

## Prompt minimal pour un nouveau chat

> **Prompt complet et directement copiable : [REPRISE_NOUVEAU_CHAT.md](REPRISE_NOUVEAU_CHAT.md).** Pour une reprise autonome, lire les deux audits et l'état d'avancement avant d'ouvrir une PR.
>
> Reprends `chebreub/Pokdle` depuis le dernier `main`, lis `docs/PLAN_AMELIORATION_POKEDLE.md` et `docs/qa/MOBILE_TACTILE.md`, puis compare les PR fusionnées depuis le dernier journal. Continue la prochaine tâche ouverte avec changements minimaux, tests et PR. Ne réaudite pas tout. Respecte les statuts et les décisions, notamment la correction de l'anecdote Kokiyas, les sauvegardes et l'autorité serveur. Termine par la mise à jour du plan et un bilan « fait / testé / non vérifié en production / prochaine action ».

### Clôture PC-01 — 06/11/2026

PR [#283](https://github.com/chebreub/Pokdle/pull/283) fusionnée, commit `e3e804de2c0cc0652280c464fd27c5eaeda69813`. CI [Node](https://github.com/chebreub/Pokdle/actions/runs/42208624207) et [navigateur/base complète](https://github.com/chebreub/Pokdle/actions/runs/42208628864) vertes sur le head `eca06a7fce06700a701ec8ac796cfa1a0b596222`. Placement des indices corrigé, résultat limité à 1 000 px, Course et doublons vérifiés ; détail dans l’état d’avancement. **13/43 = 30,2 %** ; prochaine action **MOB-03**. Render et iPhone réel non vérifiés ; BUG-MOB-01 reste ouvert.

## Historique MOB-03 — états intermédiaires, remplacés par la clôture ci-dessus

## MOB-03 — premier correctif intégré, chantier encore en cours (06/11/2026)

Le calcul de hauteur des suggestions du champ partagé réserve désormais la rangée des boutons Deviner/Abandonner, son espacement et la marge basse. Il conserve le dimensionnement stable à la saisie. Tests unitaires : quatre hauteurs visibles (260/320/400/600 px), boutons dans le viewport et absence de scroll répété ; régression Zoom inchangée. Build réussi. Cette première correction ne clôture pas MOB-03 : interactions chat/récompenses et autres commandes restent à vérifier. BUG-MOB-01 et la recette iPhone physique restent distincts. Progression intégrée inchangée : 13/43.

PR [#285](https://github.com/chebreub/Pokdle/pull/285) fusionnée au commit `ab8f0f4b4904cbd68c03fcc2d00bcf127e141812`. CI [Node](https://github.com/chebreub/Pokdle/actions/runs/42212571024) et [navigateur/base complète](https://github.com/chebreub/Pokdle/actions/runs/42212616154) vertes sur `953651f4`. Vérification Chromium locale avec viewport visuel simulé à 400 px : bouton Deviner à 375 px, accessible. Pas de recette clavier iPhone physique ni Render. Prochaine action : poursuivre MOB-03 sur les autres commandes et les superpositions chat/récompenses. Total inchangé : **13/43**, désormais **2 actions en cours** (MOB-03 et BUG-MOB-01), **28 non commencées**.

## MOB-03 — chat mobile et célébrations (06/11/2026, PR #287 fusionnée)

Deuxième volet depuis `main` `2994fd5` : le chat Party suit la hauteur et le déplacement du viewport visuel, avec commandes conservées et liste de messages réductible. Son champ explicite `type="text"` réactive la détection existante du clavier et le retrait de la barre mobile. Les célébrations attendent un chat fermé et l'absence de clavier mobile ; la file et les gains restent inchangés.

- Reproduction Chromium avant correction : pour 400 px visibles, le bas du bouton Envoyer était à 831 px, clavier non détecté. Après build : 387 px et clavier détecté.
- Tests locaux : 20 tests Node chat/MOB-03/célébrations et 8 régressions clavier/Zoom réussis ; Chromium à 360/390/1366 px avec deux joueurs locaux, envoi/réaction réels, conservation du brouillon, fermeture, reprise ordonnée des célébrations et vérification des cibles par coordonnées. Viewports visuels simulés 260/320/400 px, déplacement de 75 px ; CSS servi depuis `dist/`.
- `tools/mobile_chat_quality.py` ajouté à la CI complète Chromium/WebKit. WebKit local ne démarre pas faute de bibliothèques système : validation GitHub réussie sous Chromium/WebKit, sans la déclarer réussie localement. Aucun test Render ni iPhone physique.
- Aucun changement de règle, de gain, de capture ou de sauvegarde. **MOB-03 reste en cours ; 13/43 = 30,2 %**. Prochaine vérification ciblée : commandes de proposition Party/Duel/Défi avec clavier ; `BUG-MOB-01` attend toujours l'appareil concerné.

### Validation et livraison du deuxième volet MOB-03

PR [#287](https://github.com/chebreub/Pokdle/pull/287) fusionnée au commit `cd318937864d3c3b6e6dcc8096a09604a3890800` après [CI Node](https://github.com/chebreub/Pokdle/actions/runs/42220094265) et [CI navigateur/base complète](https://github.com/chebreub/Pokdle/actions/runs/42220123139) vertes sur `817f15ef7d9e2ae2bf9d12c9cf842a2afd12480b`. **868 tests Node réussis**, 64 tests ignorés dans le job sans base ; **78/78 PostgreSQL**, **410/410 contrôles généraux**. Chat mobile/PC et file des célébrations validés sous **Chromium et WebKit**, 360/390/1366 px. PC-01, Course au Pokédex, Party et Petit Bac restent verts. Captures finales mobile WebKit et PC Chromium revues ; artefact `revision.txt` = merge candidat `76b8ffbdb048d120c4f5339ff1f5bada67c35e84`, arbre identique au code fusionné.

Le premier run a révélé un défaut d'isolation du nouveau test : ses deux navigateurs partageaient une adresse IP et dépassaient les 10 créations/entrées de salon en 30 s. Reproduit localement ; chaque navigateur dispose désormais de son propre serveur **local**. Aucun seuil serveur ni assertion fonctionnelle n'a été assoupli. La dernière CI complète valide cette correction du scénario.

**MOB-03 reste en cours**, progression **13/43 = 30,2 %**, deux actions en cours et 28 non commencées. **Prochaine étape : commandes de proposition Party/Duel/Défi avec clavier**, en conservant les confirmations, le contexte de partie et l'absence de saut à chaque lettre. Le clavier est simulé via `visualViewport` ; aucun déploiement Render ni iPhone physique vérifié. `BUG-MOB-01` reste distinct et ouvert.

## Dernier volet MOB-03 — candidat à la clôture technique (06/11/2026)

Party, Duel et Défi ami regroupés dans un seul lot : commandes visibles avec clavier, hauteur des suggestions stable et tap sans déplacement du bouton. [Périmètre, preuves, recette et limites](qa/MOB_03_CONTROLS.md). Tests Chromium locaux réussis aux trois résolutions et tests Node ciblés verts ; **CI complète et fusion encore requises**. Progression intégrée inchangée **13/43** à ce stade ; **14/43 (32,6 %) uniquement après validation et fusion**. Ensuite **DEX-01** ; BUG-MOB-01 et MOB-04 restent distincts de cette clôture technique.

### PR #289 — correction de l’échec WebKit du dernier head

Le run complet sur `209adfe` a échoué sur le clic Duel WebKit (distinct du défaut Chromium Défi déjà corrigé). Conservation du focus déplacée de `pointerdown` vers `mousedown`, clic métier unique conservé. Build, 20 tests Node ciblés et parcours local Chromium/WebKit 360/390/1366 px réussis. [Preuves et limites](qa/MOB_03_CONTROLS.md). CI finale et fusion encore requises ; progression intégrée inchangée à 13/43.
