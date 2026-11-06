# Pokédle — État d'avancement du plan d'amélioration

**Photographie vérifiée : 6 novembre 2026, après fusion de #295 ; DEX-03 clôturé.**
**Dépôt :** [chebreub/Pokdle](https://github.com/chebreub/Pokdle) ; base de travail documentaire : commit `967b9c8d91977be6b38af7317e7e047121394efe` sur `main` (DEX-03).
**Référence des tâches :** [PLAN_AMELIORATION_POKEDLE.md](PLAN_AMELIORATION_POKEDLE.md).
**Audits associés :** [UX/gameplay/fidélisation](audits/AUDIT_UX_GAMEPLAY_FIDELISATION_2026-11-05.md) et [économie/captures/rareté](audits/AUDIT_ECONOMIE_CAPTURE_POKEDLE_2026-11-05.md).

## Synthèse à retenir

**17 tâches terminées sur 43 actions actives = 39,5 %** après intégration de DEX-03 ; le pourcentage compte les actions validées, pas le degré de finition global du jeu.

| Statut | Nombre | Règle |
| --- | ---: | --- |
| **Terminé et intégré à main** | **17** | Action vérifiée, PR fusionnée |
| **En cours / investigation / PR ouverte** | **1** | BUG-MOB-01 (retour mobile réel à obtenir) |
| **Non commencé / à conduire ou à décider** | **25** | Dont certaines propositions économiques soumises à validation préalable |
| **Stationné et exclu du total** | **1** | NIV-01, proposition née d'une plaisanterie sur Kokiyas, à ne pas programmer |
| **Dénominateur suivi** | **43** | 7 + 8 + 5 + 4 + 8 + 5 + 4 + 2 |

**Formule explicite :** (17 actions terminées / 43 actions actives) × 100 = **39,5349 %, arrondi à 39,5 %**.

> **Limites du pourcentage :** chacune des 43 actions a le même poids dans ce calcul, même si certaines représentent une modification de quelques lignes et d'autres plusieurs semaines de travail / arbitrages. Ce n'est **ni** le pourcentage de fonctionnalités déjà présentes sur le site, **ni** une estimation des heures restantes. Les travaux de préparation et de documentation ne gonflent pas artificiellement le nombre de correctifs livrés.

## Répartition par chantier

| Lot | Périmètre | Terminées / actives | Part terminée | Travail réalisé ou engagé |
| --- | --- | ---: | ---: | --- |
| 0 | Ergonomie mobile / PC et mesures | 4 / 7 | 57,1 % | DATA-01 documenté, PC-02 clavier, PC-01 plateau PC, MOB-03 commandes mobiles ; BUG-MOB-01 toujours à confirmer sur téléphone réel |
| 1 | Fiabilité des jeux et sauvegardes | 7 / 8 | 87,5 % | LOG-01 à LOG-04, SAVE-01, FX-02 et DATA-02 terminés |
| 2 | Gameplay, pédagogie, découverte | 3 / 5 | 60 % | NIV-02 (Stat Mystère), SER-01 (records Pixelisé), MEDIA-01 (lecture Cri) |
| 3 | Pokédex et collection | 3 / 4 | 75 % | DEX-01, DEX-02, DEX-03 terminés ; DEX-04 prochain |
| 4 | Économie et rencontres | 0 / 8 | 0 % | 6 décisions de cadrage consignées le 05/11 : 4 accords de principe soumis aux tests, 1 simulation préalable, 1 sujet à rediscuter ; **aucune règle approuvée pour production** |
| 5 | Invitations et diffusion | 0 / 5 | 0 % | Proposition d'un parcours Dessine-le direct |
| 6 | Gestes et animations | 0 / 4 | 0 % | Dépend d'abord de la robustesse tactile |
| 7 | Testeurs externes et acquisition | 0 / 2 | 0 % | À préparer après stabilisation |
| **Total** | | **17 / 43** | **39,5 %** | NIV-01 stationné exclu |

**DEX-01 terminé et fusionné :** [PR #290](https://github.com/chebreub/Pokdle/pull/290), merge `904efaa26b9b2e521ad97e680d16ef4fa247c416`, head `70f24bd23050c9706d84cb0572f8ad984310fbff`. [CI Node verte](https://github.com/chebreub/Pokdle/actions/runs/42240637508) et [CI navigateur/base complète verte](https://github.com/chebreub/Pokdle/actions/runs/42240647657) sur ce head. Découvert, capturé personnellement et possédé distingués sans migration, nouveaux gains ou modification des probabilités. **15/43 = 34,9 %**, **1 en cours** (BUG-MOB-01), **27 non commencées**, lot 0 **4/7**, lot 3 **1/4**. Prochaine action autonome : **DEX-02**, voies d'obtention réellement disponibles. iPhone physique et Render non vérifiés.

## DEX-03 — clôture technique vérifiée le 6 novembre 2026

**DEX-03 terminé et fusionné :** [PR #295](https://github.com/chebreub/Pokdle/pull/295), commit `967b9c8d91977be6b38af7317e7e047121394efe`, head validé `0e02036b5b13daa88aa17996b45483ec32297824`. [CI Node verte](https://github.com/chebreub/Pokdle/actions/runs/42250700271) et [CI navigateur/base complète verte](https://github.com/chebreub/Pokdle/actions/runs/42251003537). Jusqu'à trois cibles privées, suppression et synchronisation fiables, secret non divulgué, chances inchangées. **17/43 = 39,5 %** ; 1 action en cours (BUG-MOB-01), 25 non commencées ; lot 0 **4/7**, lot 3 **3/4**. **DEX-04** est la prochaine action de développement ; aucune recette sur iPhone physique ou sur Render revendiquée.

## DEX-02 — clôture technique vérifiée le 6 novembre 2026

**DEX-02 terminé et fusionné :** [PR #293](https://github.com/chebreub/Pokdle/pull/293), merge `692b8e42ab3a86451e2fdf2eea46924a011b934d`, head `f64eb68c9a432d0eacc3fb5a578ee0eb34f451a5`, [CI Node verte](https://github.com/chebreub/Pokdle/actions/runs/42245771363) et [CI navigateur/base complète verte](https://github.com/chebreub/Pokdle/actions/runs/42245771750). Fiches de collection : voies de capture serveur (845 hautes herbes + 6 expéditions + Drattak), découvertes par missions/secrets séparées, absence de voie ou de données affichée sans extrapolation. **16/43 = 37,2 %** ; **1 action en cours** (BUG-MOB-01), **26 non commencées**, **lot 0 : 4/7**, **lot 3 : 2/4**. Prochaine action autonome : **DEX-03** (jusqu'à trois cibles personnelles). Aucune recette physique iPhone ni déploiement Render vérifié.

## MOB-03 — clôture technique vérifiée le 6 novembre 2026

[PR #289](https://github.com/chebreub/Pokdle/pull/289) fusionnée au commit `87d242e8b15b7f18f3f5e75852f4e3b188502e67`, après [CI Node verte](https://github.com/chebreub/Pokdle/actions/runs/42237885834) et [CI navigateur/base complète verte](https://github.com/chebreub/Pokdle/actions/runs/42237896376) sur `842484f479dd0ecc01e668281e7512d600a670ac`. Les trois volets (#285, #287, #289) sont intégrés. Le commit fusionné et son arbre ont été contrôlés sur `main`.

Le dernier correctif préserve le clic tactile WebKit en conservant le focus sur `mousedown`, sans envoyer au `pointerdown`. Build, 20 tests Node ciblés et parcours local Chromium/WebKit à 360/390/1366 px réussis ; la CI complète valide aussi le reste des parcours. [Détails et limites](qa/MOB_03_CONTROLS.md).

**À la clôture de MOB-03 : 14/43 = 32,6 % ; 1 action en cours : BUG-MOB-01 ; 28 non commencées ; lot 0 : 4/7. Prochaine action unique : DEX-01.** Aucun clavier iPhone physique ni déploiement Render vérifié. BUG-MOB-01 (appareil de Jade) et MOB-04 (focus/scroll Safari réel) restent distincts et ouverts. NIV-01 reste stationné, exclu du total. Économie, captures et sauvegardes inchangées.

## Journal historique — pourcentages aux dates des livraisons

## DATA-02 — intégré après fusion de la PR #278

- [PR #278](https://github.com/chebreub/Pokdle/pull/278) : nouveaux agrégats par jour UTC et événement, séparés entre compte administrateur authentifié, session de test volontaire et activité non marquée. Les totaux existants et la fenêtre de conservation de 90 jours demeurent inchangés.
- **Ce qui reste incertain :** aucune attribution rétroactive de l'ancien historique, le statut non marqué n'est pas un humain vérifié, l'estimation de navigateurs distincts et l'économie ne sont pas ventilées. Les jeux / récompenses / Balls / captures / sauvegardes ne changent pas.
- **Validation :** tests Node et base/navigateur à contrôler sur le head exact de la PR avant fusion ; QA de production et Safari iPhone non revendiquées. [Protocole et limites](qa/USAGE_SEGMENTS.md).
- **Avancement après fusion : 8/43 = 18,6 %** ; **prochaine tâche autonome : NIV-02**. BUG-MOB-01 reste ouvert sur le téléphone de Jade.

## NIV-02 — intégré après fusion de la PR #279

- [PR #279](https://github.com/chebreub/Pokdle/pull/279) : volet facultatif « Comment lire les stats ? » du mode Stat Mystère, fermé par défaut, avec exemples de compréhension des statistiques de base et des barres. Première lettre au cinquième essai : **fonction déjà existante, non créée par cette PR**.
- **Périmètre** : HTML/CSS + test Node de non-régression ; sans changement de tirage, règles, secret serveur, XP, sauvegardes, captures, Balls ou monnaie.
- **Validation :** CI Node et navigateur/base requises sur le head exact avant fusion. L'appareil iPhone de Jade et le site de production restent non vérifiés.
- **Avancement après fusion : 9/43 = 20,9 %**, prochaine tâche autonome **SER-01**. `BUG-MOB-01` reste en investigation réelle.

## SER-01 — intégré après fusion de la PR #280

- [PR #280](https://github.com/chebreub/Pokdle/pull/280) : records personnels Pixelisé départagés par **trouvés puis essais sur les Pokémon trouvés**, avec un champ de précision prospectif séparé du nombre trouvé historique. Séries 5/10/20 indépendantes ; pas d'attribution rétroactive d'essais.
- **Protection multiappareil** : `guessSeriesBest` reste un objet fusionné par maxima au lieu de devenir 0 ; nouvelles références `guessSeriesPrecision.pixel` fusionnées par priorité au nombre trouvé, puis aux tentatives mesurées.
- **Limite** : score des défis/leaderboards publics `pixel10` toujours fondé sur les trouvés ; aucun nombre d'essais fourni par le client n'est présenté comme vérifié par serveur. Les autres modes, XP, captures et Pokédollars ne changent pas.
- **Validation :** tests Node et navigateur/base à vérifier sur le head final avant fusion ; recette Render/Safari réel non revendiquée. [Règles détaillées](qa/SER_01_PIXEL_RECORDS.md).
- **Avancement après fusion : 10/43 = 23,3 %**, prochaine tâche autonome **MEDIA-01**. `BUG-MOB-01` reste à confirmer sur appareil réel.

## MEDIA-01 — intégré après fusion de la PR #281

- [PR #281](https://github.com/chebreub/Pokdle/pull/281) : lecteur de Cri relancé sur élément neuf après erreur réseau, lecture rejetée ou chargement trop long ; délais de 12 s CDN et 20 s URL opaque ; invalidation des événements et promesses périmés lors d'un changement de manche/jeu.
- **Aucune défaite implicite :** le joueur peut réessayer le même cri ou quitter vers les modes sans déclarer d'abandon, sans nouveau tirage ni attribution de récompense. L'URL vérifiée reste opaque et le Pokémon secret reste côté serveur. Volume et tentative inchangés.
- **Validation :** tests Node dédiés + régressions et contrôle navigateur/base à vérifier sur le head exact avant fusion ; Safari iPhone physique et Render réel non revendiqués. [Protocole](qa/MEDIA_01_CRY_PLAYBACK.md).
- **Progression après fusion : 11/43 = 25,6 %** ; prochaine action autonome **PC-02**, navigation clavier contextuelle sur ordinateur. `BUG-MOB-01` reste ouvert tant que le téléphone de Jade n'a pas servi à reproduire et valider son correctif.

## PC-02 — intégré après fusion de la PR #282

- [PR #282](https://github.com/chebreub/Pokdle/pull/282) : navigation clavier de Solo, Défi, Party et Duel désormais limitée aux suggestions présentes. Flèches sans intercepter le curseur lorsque la liste est masquée ; Échap referme la liste sans déclencher une fermeture de modale ; Entrée respectant les sélections, l'IME et les modificateurs.
- **Duel** : élimination du deuxième gestionnaire `keydown Enter` branché sur le même input. L'envoi d'une proposition conserve les protections métier côté client et serveur ; ce correctif supprime seulement un déclencheur redondant.
- **Protection** : aucune écoute globale introduite pour les touches de réponse, pas d'interférence volontaire avec les chats et formulaires, aucun changement de récompense, sauvegarde, Pokémon, score ou économie.
- **Validation :** tests ciblés `App/test/pc-02-keyboard-context.test.js`, et CI Node/navigateur/base exigée sur head final avant fusion ; Safari réel/production non revendiqués.
- **Après fusion : 12/43 = 27,9 %**, prochaine action autonome **PC-01** ; `BUG-MOB-01` demeure non vérifié sur téléphone réel.

## PC-01 — fusion vérifiée de la PR #283

- [PR #283](https://github.com/chebreub/Pokdle/pull/283) : mise en page compacte de l'arène Course au Pokédex et du jeu normal sur écran PC 1366×768, sans défilement du plateau. Moteur existant de grille réactive conservé ; seule la densité CSS desktop a changé.
- **Recette automatisée ciblée** `tools/pc_desktop_quality.py` : deux joueurs en salle isolée, navigateur Chromium + WebKit, résolution 1280×720 / 1366×768 / 1600×900 / 1920×1080 ; 151 cellules vérifiées dans le viewport, champ et boutons visibles, première inscription et doublon refusé. Le scénario jeu classique vérifie le champ de recherche et les deux colonnes.
- **Validation :** CI Node + navigateur/base sur le dernier commit avant fusion. Cette validation ne prouve ni un test humain sur iPhone ni le fonctionnement réel du déploiement Render.
- **Sécurité :** pas de modification de Socket.IO, scores, temps, progression, accès aux Pokémon, capture, économie ou données personnelles. `BUG-MOB-01` demeure non confirmé sur téléphone réel.
- **Après fusion : 13/43 = 30,2 %** ; prochaine action autonome **MOB-03**, ergonomie du pouce et gestion des éléments superposés en jeu, sans patch global prématuré.

### Diagnostic et correctif final PC-01 — 06/11/2026

- Les runs [42180557148](https://github.com/chebreub/Pokdle/actions/runs/42180557148) et [42180789379](https://github.com/chebreub/Pokdle/actions/runs/42180789379) ont testé le même merge candidat `0f37ae20` (head `7076e2d8`, base `bf9a11a9`), confirmé dans les logs et les deux artefacts `revision.txt`. Le premier est le smoke ciblé (`QA_FULL=false`) ; le second est la recette complète déclenchée lors du passage prêt à relire (`QA_FULL=true`), avec 408 succès et deux échecs.
- **Défauts réels visibles sur captures :** l'historique déplacé en tête du DOM par `prepareGameShell` occupait implicitement la colonne étroite de 390 px ; la saisie occupait la grande colonne. Le résultat héritait aussi de la largeur non bornée du plateau actif.
- **Correction minimale :** placement explicite saisie à gauche / indices à droite uniquement sur le PC compact, légende sous les indices, résultat limité à 1 000 px. L'assertion générale de disposition verticale reste valable hors de ce breakpoint ; sur PC compact elle vérifie désormais largeur lisible, absence de chevauchement et alignement. Le contrôle de largeur du résultat reste inchangé.
- **Tests ciblés renforcés :** vrai CSS `dist/app.min.css?v=…` servi après build, plusieurs essais, largeur des dix colonnes, ouverture du carnet, abandon/résultat et rejeu, sur Chromium et WebKit. Le moteur Course au Pokédex et les règles serveur restent intacts.
- **Local :** build et 17 tests Python + 5 tests clavier Node réussis ; parcours PC-01 Chromium réussi (jeu classique, quatre tailles de Course, inscription et doublon). WebKit local bloqué au lancement par des bibliothèques système absentes : validation exigée dans la CI, sans déclarer ce test local réussi. Aucune recette physique iPhone ni vérification Render.
- **CI finale :** 860 tests Node réussis, 64 ignorés dans le job sans base ; 78/78 tests PostgreSQL isolés réussis. Recette générale **410/410**, PC-01 renforcé **Chromium et WebKit**, suites solo/Party/Petit Bac et audit de dépendances verts. Artefact `revision.txt` = merge candidat `e2832801282f67018536d5c821c389539787ca9b`, même arbre que le code fusionné. Captures finales des indices et résultats revues.
- **Clôture vérifiée :** PR #283 fusionnée au commit `e3e804de2c0cc0652280c464fd27c5eaeda69813` après CI [Node](https://github.com/chebreub/Pokdle/actions/runs/42208624207) et [navigateur/base complète](https://github.com/chebreub/Pokdle/actions/runs/42208628864) vertes sur `eca06a7fce06700a701ec8ac796cfa1a0b596222`. **13/43 intégrées = 30,2 %** ; prochaine action **MOB-03**. Les limites de recette réelle restent inchangées.

## Journal GitHub vérifié

| PR | Réalisation | Statut GitHub | Validation |
| --- | --- | --- | --- |
| [#260](https://github.com/chebreub/Pokdle/pull/260) | Plan permanent, diagnostic tactile sur navigateur et protocole réel | **Fusionnée** ; merge `000728c` | Node + navigateur complets verts ; **bug iPhone non reproduit** |
| [#261](https://github.com/chebreub/Pokdle/pull/261) | LOG-01 : protection des séries 5/10/20 | **Fusionnée** ; merge `646d83c` | Tests Node + navigateur verts |
| [#262](https://github.com/chebreub/Pokdle/pull/262) | Journal et document de reprise des premiers lots | **Fusionnée** ; merge `b327a4d` | Documentation uniquement |
| [#263](https://github.com/chebreub/Pokdle/pull/263) | Clôture documentaire de LOG-01 dans le plan | **Fusionnée** ; merge `b86a4e3` | Mise à jour du plan |
| [#264](https://github.com/chebreub/Pokdle/pull/264) | LOG-03 : filtre solo ne doit plus cacher la Party Room | **Fusionnée** ; merge `cfa0d021` | [Tests Node verts](https://github.com/chebreub/Pokdle/actions/runs/42024332274) et [suite navigateur verte](https://github.com/chebreub/Pokdle/actions/runs/42024332512) sur le head `9dfd42f4dce2` |

**LOG-03 intégré** : #264 a été fusionnée après CI verte ; la recette sur iPhone réel concerne toujours BUG-MOB-01. Un autre chat doit **reconsulter GitHub** : ce tableau est une photographie, pas un suivi automatique.

## Lot intégré — LOG-02

[PR #266](https://github.com/chebreub/Pokdle/pull/266) fusionnée, merge `9a68b84f`. Valeur `0` conservée comme record valide via `quiEstCeRecorded`, sans migration des anciens profils : les anciennes valeurs positives restent des records ; un zéro ancien sans indicateur reste indéterminé et n'est pas inventé. Tests de fusion multi-appareils, nouvelle victoire à zéro et affichage ajoutés. CI Node [verte](https://github.com/chebreub/Pokdle/actions/runs/42034302915) et navigateur/base de données [verte](https://github.com/chebreub/Pokdle/actions/runs/42034303017) sur le head `7af64f8`. Le total intégré passe à **3/43 = 7,0 %**.

## Lot intégré — LOG-04

[PR #268](https://github.com/chebreub/Pokdle/pull/268) fusionnée, merge `d8c87fe7`. Une combinaison erronée de quatre Pokémon ne consomme qu'une erreur par partie, y compris après mélange. Message joueur explicite, tests Node et Playwright. CI [Node verte](https://github.com/chebreub/Pokdle/actions/runs/42036602850) et [navigateur/base de données verte](https://github.com/chebreub/Pokdle/actions/runs/42036604853) sur le head `ed9b57f8`. Aucun changement aux 4 erreurs autorisées, récompenses ni sauvegardes. Progression intégrée **4/43 = 9,3 %** ; prochaine tâche **SAVE-01**.

### Diagnostic supplémentaire — BUG-MOB-01

Suite `tools/mobile_touch_quality.py` élargie à **Poké-Connections** en plus de « Qui est-ce ? », avec frappes réelles aux coordonnées, contrôles de sélection et réouverture après navigation/mélange. **Cause candidate ciblée** : un toast de résultat invisible restait tactile (`.gamefeel-result-card { pointer-events:auto }` sous parent à `opacity:0`). [PR #271](https://github.com/chebreub/Pokdle/pull/271) ajoute le test caché/visible/caché et limite l'interception à la carte visible. **CI Node et navigateur vertes sur #271, mais validation sur l'appareil de Jade toujours nécessaire** ; le problème peut avoir plusieurs causes. Progression intégrée **4/43 = 9,3 %** inchangée tant que non clôturé.

## SAVE-01 — intégré dans `main`

**Dernière QA complète :** 410 parcours généraux réussis. Le scénario `series-reload` a échoué seulement à 390 px, sur Chromium et WebKit, tandis que les valeurs réelles (`index=6`, `total=10`, `getClubResumeSave().isSeries=true`) étaient correctes. **Cause identifiée :** `App/visual-refresh.css` masquait `.club-return-main small` sur mobile, donc le texte de progression n'était pas visible. La règle mobile a été corrigée sans toucher aux données ni aux calculs. **Ce défaut a été corrigé et la suite complète du dernier head a ensuite réussi.**

La CI navigateur du head `5b1c9971` a également identifié un focus mobile non souhaité pendant la restauration (scroll du mode Cri à 360/390 px). Le focus est désormais réservé au desktop avec `preventScroll`, et un test Node couvre mobile et desktop. **CI finale Node et navigateur réussie avant fusion.**

[PR #270](https://github.com/chebreub/Pokdle/pull/270) : sauvegarde versionnée locale de la série par compte, par mode et par générations sélectionnées, avec reprise au bon numéro de manche. Le premier contrôle CI a échoué sur une confusion entre une manche de série et une ancienne sauvegarde Daily ; la condition de validation a été corrigée et un test protège les sauvegardes Daily et classiques contre leur suppression lors d'une reprise. Un échec navigateur sur le sélecteur de générations a aussi été corrigé en conservant séparément les séries de groupes différents. Le bouton « Reprendre » de l'accueil sait désormais relancer le checkpoint du bon compte ; une série n'écrase plus le slot historique des jeux classiques. **CI Node et navigateur/base vertes sur `933d4f15`, fusion au commit `f1b1abef`**. Aucun transfert de cette série entre deux appareils n'est revendiqué. Progression intégrée **5/43 = 11,6 %** après fusion.

### Validation finale de SAVE-01

- [PR #270](https://github.com/chebreub/Pokdle/pull/270) **fusionnée** au commit `f1b1abefb780f97bee877d6b22f1fd04708006b1` ; [tests Node verts](https://github.com/chebreub/Pokdle/actions/runs/42065243849) et [navigateur/base de données verts](https://github.com/chebreub/Pokdle/actions/runs/42065325060) sur le dernier head `933d4f1548cdc556a9f13a0a7a733a8bfef45440`.
- Les corrections de focus et de libellé mobile, la conservation de l'ancien slot Daily/classique et l'isolation des checkpoints par compte, mode et générations sont incluses. Le scénario de reprise « manche 6/10 » est testé dans le navigateur après rechargement.
- **Non vérifié en production :** recette manuelle iPhone Safari / Render et reprise entre appareils (cette dernière n'est pas une fonctionnalité livrée). Aucun changement aux règles économiques, Balls, captures, Pokédollars ou inventaires.
- **Progression mise à jour : 5/43 = 11,6 %**. Prochaine action de développement : **FX-02**.

## FX-02 — intégré dans `main`

Proposition de PR à valider : **une seule célébration active** pour niveau et succès, regroupement en un bandeau des succès débloqués lors d'un même événement, et **attente** pendant les notifications visibles d'XP/résultat ou les fenêtres existantes de capture, cadeau/coffre, rencontre sauvage ou modale. Les bandeaux et fonds qui disparaissent ne doivent plus intercepter les appuis (contrôle via `document.elementFromPoint`).

Tests ajoutés : VM Node (ordre, regroupement, blocage pendant une modal et reprise) ; QA Playwright mobile Chromium/WebKit (cible sous un fond de célébration fermé). **CI Node et navigateur/base vertes sur le dernier head `92c62a23`, fusion au commit `70e75a2` ; recette iPhone réelle non effectuée.** Ne pas confondre succès des tests simulés avec validation sur appareil réel.

Modifications **uniquement de présentation/coordination et CSS** ; aucune réattribution d'XP, de Balls ou de Pokédollars. Progression intégrée **6/43 = 14,0 %** après fusion. BUG-MOB-01 reste ouvert à la vérification de Jade.

### Validation finale de FX-02

- [PR #274](https://github.com/chebreub/Pokdle/pull/274) **fusionnée** au commit `70e75a2ad648bcea85d588e5fa4870e4083b9170` après [CI Node verte](https://github.com/chebreub/Pokdle/actions/runs/42078493841) et [CI navigateur/base verte](https://github.com/chebreub/Pokdle/actions/runs/42078513945) sur le dernier head `92c62a23450083f1fddb7dea2d91a81d3a13975f`.
- Écrans de niveau et succès en série ; succès regroupés ; notifications XP et résultat prioritaires ; les transitions sortantes ne captent plus les touches. Aucun changement aux récompenses, XP, Balls, Pokédollars ni aux captures.
- **Non vérifié sur appareil réel :** Safari iPhone et retour de Jade. Les tests Chromium/WebKit ne constituent pas une recette physique.
- **Progression : 6/43 = 14,0 %** ; prochaine action autonome **DATA-01** ; BUG-MOB-01 reste ouvert.

## DATA-01 — dictionnaire et couverture, intégré

- [Dictionnaire vérifié](qa/USAGE_EVENT_GRAIN.md) : classe et explique les unités réelles de `visit`, `visits` (chargements bruts), `solo:<mode>`, `complete:<mode>:win|loss`, événements Party et partages, plus l'estimation d'unicité par jour UTC. Il distingue **ouverture**, **commande de début de manche** et **fin déclarée**, et souligne qu'une partie commencée n'est pas instrumentée exhaustivement par un événement de référence unique.
- Fenêtres temporelles, rétention agrégée 90 jours, périodes UTC vs économie Europe/Paris et absence de conversion fiable sont documentées dans le [guide existant](usage-metrics.md). **La date réelle de mise en production par compteur n'a pas été établie** ; seule une requête agrégée permet d'identifier les premiers jours *encore* présents, qui ne valent pas date de lancement. Aucun historique fictif produit.
- **DATA-01 clôture son objectif documentaire**, mais ne valide pas les dates de déploiement manquantes ; pas de nouveau suivi ni de modification à la base. **Progression : 7/43 = 16,3 %**. Prochaine étape : **DATA-02**, qui analysera la pollution des mesures par essais/admin sans supprimer des événements existants.

## Cadrage économique décidé le 05/11/2026 — sans implémentation

Les six réponses du propriétaire sont inscrites dans le [Lot 4 du plan](PLAN_AMELIORATION_POKEDLE.md), avec les codes ECO correspondants :

- **ECO-01** : **simuler et comparer avant décision** sur les nouvelles occasions d'expédition légendaire.
- **ECO-02** : **accord de principe, sous réserve des tests** pour éviter la perte intégrale après fuite de Drattak ; **événement spécial / rendez-vous particulier** souhaité, déclenchement potentiellement aléatoire **à rediscuter** (fréquence, conservation, reprise et récompenses non fixées).
- **ECO-07** : **accord de principe sous réserve des tests** pour la préparation des rencontres rares (proposition d'au moins trois Balls, chances visibles, annulation sans perdre la piste).
- **ECO-08** : **accord de principe sous réserve des tests** pour une rencontre spéciale persistante 72 h ; ne pas associer automatiquement au cas Drattak.
- **ECO-03** : **à rediscuter** ; les paliers 30/60/90 Pokédollars ne sont pas validés.
- **ECO-04** : **accord de principe sous réserve des tests** pour créditer une seule fois les coffres acquis même sans ouverture immédiate.

**Distinction impérative :** « accord de principe » ≠ autorisation de modifier le code, le paramétrage, les récompenses ni la base de données. Exiger simulation des conséquences, propositions de règles précises, tests/idempotence et **validation finale explicite** du propriétaire avant PR économique et déploiement. Toutes les règles actuelles (capture, shiny, 3 lancers, Balls, Pokédollars, rareté, inventaires) restent identiques. **Aucune tâche économique clôturée** ; progression globale après DATA-01 : **7/43 = 16,3 %**. Prochain chantier autonome : **DATA-02**.

## Risques et verrous à connaître

**P0 — BUG-MOB-01.** Signalement de zones basses non cliquables sur téléphone dans Qui est-ce ?. L'émulation tactile Chromium/WebKit passe, mais ni le modèle ni le navigateur ayant échoué ne sont connus. **En attente de preuve sur appareil réel ; ne pas ajouter de patch de calques arbitraire.**

**P1 — Synchronisation et reprise.** SAVE-01 est intégrée : reprise locale des séries sur le même navigateur, isolée par compte, mode et générations. **La synchronisation de ces séries entre appareils ne fait pas partie de SAVE-01** ; pas de recette Safari iPhone/Render réel revendiquée.

**P1 — Record zéro Qui est-ce ? (corrigé).** LOG-02 intégré dans #266 ; un ancien zéro sans indicateur reste indéterminé, mais les nouveaux records et les fusions de profils sont couverts par les tests.

**P1 — Économie.** Le cadrage du 05/11 donne quatre accords de principe sous réserve de tests, une simulation préalable et un sujet à rediscuter. Aucun changement aux taux shiny, capture, prix, capacités, légendaires ou Drattak dans ce plan sans simulations **et validation finale des règles exactes**. Le 05/11 est la frontière 1/150 → 1/500 pour le shiny, donc ne pas regrouper sans distinction les chiffres avant/après.

## Suite opérationnelle recommandée

1. **LOG-03 terminé dans #264.** CI Node et navigateur vertes sur le head exact, merge `cfa0d021`. Le point tactile réel reste ouvert.
2. **LOG-02 intégré via PR #266** : tests Node et navigateur verts, merge `9a68b84f`. Un ancien zéro sans indicateur demeure ambigu, aucune migration inventée.
3. **SAVE-01 (#270), FX-02 (#274), DATA-01/02 (#276/#278), NIV-02 (#279), SER-01 (#280), MEDIA-01 (#281) PC-02 (#282) et PC-01 (#283) intégrés** ; **prochain chantier MOB-03** : accès au bouton principal au pouce, sans superposition clavier/dock/chat.
4. Pendant ce temps, collecter si possible une **reproduction réelle BUG-MOB-01** avec modèle et navigateur. Ce P0 ne doit pas être « résolu » fictivement pour accélérer le plan.
5. Passer ensuite au gameplay, Pokédex, captures et invitations dans l'ordre des dépendances ; une PR sensible par lot.

**Après chaque fusion :** recenser les actions gagnées, recalculer le % avec la même formule, mettre le lien et SHA de PR, consigner la CI, et identifier la **prochaine action unique** dans le plan.

## Transmission entre chats

Le fichier [REPRISE_NOUVEAU_CHAT.md](REPRISE_NOUVEAU_CHAT.md) fournit un prompt autonome à copier-coller. Il renvoie aux deux audits, au plan des 43 tâches, au présent état, aux contraintes de sécurité et à la méthode de vérification GitHub.

**Aucune modification de gameplay, de base de données ou de production n'est incluse dans cette branche documentaire.**

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
