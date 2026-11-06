# Reprendre Pokédle dans un nouveau chat — Guide de transfert complet

> **État vérifié le 6 novembre 2026 :** PR #287 fusionnée dans `main` au commit `cd318937864d3c3b6e6dcc8096a09604a3890800` après CI complète verte sur `817f15e`. MOB-03 : boutons du champ partagé (#285), chat et célébrations (#287) intégrés ; commandes Party/Duel/Défi à vérifier.
> **13 actions intégrées sur 43 = 30,2 %** ; **2 actions en cours** (MOB-03 et BUG-MOB-01) ; **28 non commencées** ; NIV-01 stationnée.
> **Prochaine action : MOB-03.** PC-01 est intégrée ; ne pas recommencer son audit ni sa réalisation.
>
> **Important :** le taux de progression mesure la clôture des **actions de ce plan**, pas le taux d'achèvement ou de qualité du site, qui possède déjà beaucoup de fonctionnalités. Les informations de ce guide sont une photographie : **vérifier le dernier `main`, les PR et la CI avant d'agir**.

Ce document sert à **transférer intégralement le contexte du projet dans un nouveau chat**, sans nouvel audit général, sans questions déjà résolues et sans limiter les améliorations aux statistiques. Le développement du site est avancé ; il faut **poursuivre le plan existant**, pas recommencer le projet.

## 1. Sources de vérité et ordre de lecture obligatoire

1. [`docs/PLAN_AMELIORATION_POKEDLE.md`](PLAN_AMELIORATION_POKEDLE.md) : 43 actions, statuts, priorités, garde-fous et décisions produit.
2. [`docs/ETAT_AVANCEMENT_POKEDLE.md`](ETAT_AVANCEMENT_POKEDLE.md) : total réellement intégré, numéros de PR, tests et réserves.
3. [Audit UX, gameplay, mobile et fidélisation — 05/11/2026](audits/AUDIT_UX_GAMEPLAY_FIDELISATION_2026-11-05.md).
4. [Audit économie, capture, Balls, rareté et expéditions — 05/11/2026](audits/AUDIT_ECONOMIE_CAPTURE_POKEDLE_2026-11-05.md).
5. [`docs/PLAN_RARETE_1025.md`](PLAN_RARETE_1025.md) : statut et voies d'obtention des Pokémon, à vérifier contre le code avant toute évolution.
6. [`docs/qa/MOBILE_TACTILE.md`](qa/MOBILE_TACTILE.md) et [`docs/qa/USAGE_EVENT_GRAIN.md`](qa/USAGE_EVENT_GRAIN.md) : diagnostic tactile et définition exacte des métriques.
7. [`docs/audits/README.md`](audits/README.md) : index d'audits historiques **datés**, dont certains constats ont déjà été corrigés.
8. Consulter **GitHub `main` actuel**, dernières PR fusionnées/ouvertes et leurs validations exactes. **Ne jamais remplacer l'état réel du dépôt par une ancienne phrase du guide ou d'un audit.**

**Références :** dépôt https://github.com/chebreub/Pokdle ; site https://pokdle.fr/ (ancienne URL https://pokdle.onrender.com/). Stack : Node.js / Express, JavaScript, PostgreSQL, Socket.IO, build esbuild, hébergement Render.

## 2. Objectif produit : tout Pokédle, pas seulement les statistiques

Le propriétaire veut un **Pokédle complet, amusant, stable, équilibré, agréable sur iPhone et PC, rejouable et attractif sur la durée**, sans perdre les acquis ni faciliter artificiellement les captures. Le plan couvre **8 lots complémentaires** :

| Lot | Périmètre | Avancement confirmé |
| --- | --- | --- |
| 0 | Fiabilité tactile, ergonomie iPhone/PC, compréhension des données | 3 / 7 |
| 1 | Logique des jeux, reprise de séries, animations/récompenses, données d'usage | 7 / 8 |
| 2 | Gameplay, maîtrise, pédagogie, découverte de modes | 3 / 5 |
| 3 | Pokédex, collection, rareté et objectifs personnels | 0 / 4 |
| 4 | Économie, captures, Pokéballs, Pokédollars, expéditions, événements rares | 0 / 8 |
| 5 | Invitations, défis, partage, échanges et diffusion naturelle | 0 / 5 |
| 6 | Gestes et animations facultatifs, après stabilisation tactile | 0 / 4 |
| 7 | Recette auprès de joueurs externes et acquisition | 0 / 2 |
| **Total** | **43 actions actives** | **13 / 43 = 30,2 %** |

**DATA-02 achevée et NIV-02 intégrée : ne pas concentrer davantage le travail sur le dashboard.** Une fois les mesures fiabilisées, reprendre les améliorations concrètes des modes, du mobile, du Pokédex, de l'économie et du multijoueur dans l'ordre des priorités, contraintes et dépendances du plan. Les statistiques servent à orienter le gameplay ; elles ne remplacent pas le gameplay.

## 3. Réalisations déjà intégrées à `main` — ne pas refaire

| Action clôturée | Résultat réel | PR |
| --- | --- | --- |
| **LOG-01** | Changer une série 5/10/20 ne la remet plus à zéro lorsque l'option est identique ; confirmation si changement réel | [#261](https://github.com/chebreub/Pokdle/pull/261) |
| **LOG-02** | Record valide de 0 question dans « Qui est-ce ? », avec fusion cohérente des profils, sans invention des anciens zéros | [#266](https://github.com/chebreub/Pokdle/pull/266) |
| **LOG-03** | Les filtres solo ne masquent plus la Party Room en passant « Entre amis » | [#264](https://github.com/chebreub/Pokdle/pull/264) |
| **LOG-04** | Dans Connections, une mauvaise combinaison déjà tentée ne retire pas une seconde erreur, même après mélange | [#268](https://github.com/chebreub/Pokdle/pull/268) |
| **SAVE-01** | Reprise locale des séries Pixelisé/Cri/Silhouette/Description, avec compte, mode, générations et manche en cours ; conservation des sauvegardes Daily | [#270](https://github.com/chebreub/Pokdle/pull/270) |
| **FX-02** | Niveau/succès affichés l'un après l'autre, succès simultanés regroupés, fenêtres de capture/coffre prioritaires, animations sortantes non tactiles | [#274](https://github.com/chebreub/Pokdle/pull/274) |
| **DATA-01** | Dictionnaire des métriques : visite, ouverture, manche, fin déclarée, Party, partage, limites des dates et des dénominateurs | [#276](https://github.com/chebreub/Pokdle/pull/276) |
| **DATA-02** | Segmentation **prospective** admin/session test/non marquée, totaux bruts conservés, historique non ventilable ; pas de preuve d'identités réelles | [#278](https://github.com/chebreub/Pokdle/pull/278) |
| **NIV-02** | Aide facultative pour interpréter Stat Mystère, exemples fictifs et barres, sans changement aux chances ni à la première lettre déjà présente | [#279](https://github.com/chebreub/Pokdle/pull/279) |
| **SER-01** | Pilote des records **personnels** Pixelisé : trouvés puis essais connus ; historiques préservés, profils fusionnés sans perdre les records, classement public inchangé et non départagé faute de mesure serveur | [#280](https://github.com/chebreub/Pokdle/pull/280) |
| **MEDIA-01** | Cry : gérer erreurs de chargement/lecture, délai, retour tardif ; relancer le même son ou quitter vers les modes sans abandon. Secret serveur et économie inchangés | [#281](https://github.com/chebreub/Pokdle/pull/281) |
| **PC-02** | Flèches/Entrée/Échap contextuels en Solo, Défi, Party et Duel ; envoi d'une proposition en duel par un seul gestionnaire ; IME et chats préservés | [#282](https://github.com/chebreub/Pokdle/pull/282) |
| **PC-01** | PC compact : saisie à gauche et indices lisibles à droite ; résultat à 1 000 px ; Course complète sans scroll, doublon refusé | [#283](https://github.com/chebreub/Pokdle/pull/283) |

Autres PR à ne pas confondre avec une action supplémentaire terminée :
- [#260](https://github.com/chebreub/Pokdle/pull/260) : plan, diagnostic et infrastructure de tests tactiles.
- [#271](https://github.com/chebreub/Pokdle/pull/271) : correction ciblée d'un toast invisible interceptant les appuis ; **ne prouve pas** la résolution sur le téléphone de Jade.
- [#272](https://github.com/chebreub/Pokdle/pull/272) : **décisions de cadrage économique**, sans changement des règles ni clôture d'action ECO.
- [#273](https://github.com/chebreub/Pokdle/pull/273) et [#275](https://github.com/chebreub/Pokdle/pull/275) : clôtures documentaires SAVE-01 et FX-02.

Les PR techniques clôturées ont passé leurs CI Node et navigateur/base pertinentes **avant fusion**. Cela **ne prouve pas** une recette réelle sur iPhone Safari, ni un déploiement Render vérifié manuellement. `SAVE-01` est **local au navigateur** et ne synchronise pas les séries entre appareils.

## 4. Point de reprise exact et sujets en attente

**Prochaine action autonome : `MOB-03` — sur téléphone, rendre l'action principale accessible au pouce sans empilement des éléments (clavier, dock de jeu, chat, récompenses).** Traiter les jeux concernés un à un, préserver les gardes de confirmation et ne pas masquer des commandes essentielles. Ne pas confondre avec `BUG-MOB-01` (anomalie tactile observée chez Jade, non reproduite sur son téléphone).

**PC-01 :** [PR #283](https://github.com/chebreub/Pokdle/pull/283) : CSS desktop plus compact sur 1366×768, arène Course au Pokédex sur un seul viewport, moteur de dimensionnement inchangé. Recette Chromium/WebKit locale sur deux vrais joueurs, avec 151 cases et refus de doublon ; ni Safari physique ni Render réel revendiqués.

**PC-02 :** [PR #282](https://github.com/chebreub/Pokdle/pull/282), raccourcis contextuels des suggestions dans les 4 champs de jeu. Une seule écoute d'Entrée en Duel ; IME et modificateurs protégés, Échap ferme d'abord les suggestions. Aucun raccourci global dans le chat.

**MEDIA-01 :** [PR #281](https://github.com/chebreub/Pokdle/pull/281), [protocole et limites](qa/MEDIA_01_CRY_PLAYBACK.md). En cas d'échec audio du jeu Cri, le même son peut être relancé, le chargement a un délai, les erreurs tardives sont invalidées ; une sortie sans déclarer d'abandon est affichée. Aucun essai ou gain n'est inventé. Cela ne prouve pas qu'un haut-parleur a réellement émis un son.

**SER-01 :** [PR #280](https://github.com/chebreub/Pokdle/pull/280), [règles de départage](qa/SER_01_PIXEL_RECORDS.md). Le nombre trouvé historique reste la référence ; seules les nouvelles séries complètes fournissent une précision. L'égalité avec un ancien record sans essais connus ne prouve aucune amélioration. Les classements publics continuent de ne classer que par nombre trouvé.

**NIV-02 :** [PR #279](https://github.com/chebreub/Pokdle/pull/279) : aide repliable et facultative pour Stat Mystère, fermée par défaut. Première lettre après 5 essais et autorité du serveur maintenues. Aucune nouvelle récompense.

**DATA-02 :** [protocole et limites](qa/USAGE_SEGMENTS.md). Les comptes admins authentifiés et les essais déclarés sont ventilés prospectivement. Les KPI bruts, chargements, uniques estimés, économie et cohortes Daily restent inchangés ; les événements non marqués ne sont pas des personnes humaines certifiées. Aucune ventilation rétroactive.

**En parallèle : `BUG-MOB-01` reste ouvert.** Sur le téléphone de Jade, des boutons en bas de « Qui est-ce ? » ne répondaient pas, puis redevenaient accessibles après scroll. Le correctif #271 traite une cause possible ; **aucune validation réelle sur son appareil**. Ne pas annoncer le P0 résolu ni appliquer des `z-index` / `pointer-events` globaux sans reproduction. Demander modèle, navigateur, comportement du clavier et reproduction **uniquement si ces détails deviennent nécessaires pour cette recette réelle** ; avancer sur d'autres tâches indépendantes en attendant.

**Après `MOB-03` :** poursuivre les priorités et les dépendances du plan, sans figer artificiellement une file. Exemples : `DATA-04` (rétention J1/J7), `MOB-04`, `DEX-01/02`, `PART-01/02`, ainsi que les simulations économiques. Le P0 mobile conserve sa priorité de sûreté, sans bloquer le reste si la reproduction dépend du retour de Jade.

## 5. Économie, captures et décisions réservées au propriétaire

**Règles actuelles à conserver sans nouvel accord :**
- Les taux `capture_rate` proviennent de PokéAPI, mais la **formule de capture de Pokédle est spécifique au site**, et non la formule officielle du jeu : `min(0.95, 0.8 * (taux/255)^0.72 * multiplicateur Ball)`.
- Trois lancers par rencontre ; shiny à **1/500 depuis le 05/11/2026**. Les chiffres historiques du 22/10 au 04/11 précèdent ce changement.
- Ne pas modifier prix, stocks de Balls, Pokédollars, gains, probabilités, captures, progression/inventaire ou possibilité de rencontrer des espèces sur une simple suggestion.

**Décisions documentées le 05/11/2026 :**

| Action | État de décision | Travail autorisé avant nouvelle validation |
| --- | --- | --- |
| **ECO-01** Expéditions légendaires | **À simuler avant décision** | Comparer scénarios de nouvelles occasions limitées, sans capture garantie |
| **ECO-02** Drattak | **Accord de principe, événement à rediscuter** | Concevoir des variantes d'événement spécial, éventuellement aléatoire ; fréquence, reprise, fuite et gains non décidés |
| **ECO-07** Préparation des rencontres rares | **Accord de principe à tester** | Étudier au moins 3 Balls, chances affichées, annulation sans perte de piste |
| **ECO-08** Rencontre spéciale conservée | **Accord de principe à tester** | Étudier 72 h, sans nouveau tirage ni Balls gratuites ; ne pas l'appliquer d'office à Drattak |
| **ECO-03** Récompenses 30/60/90 ₽ | **Non validé, à rediscuter** | Ne pas changer le barème |
| **ECO-04** Coffres d'expédition | **Accord de principe à tester** | Vérifier un crédit **unique** même si le coffre est acquis et ouvert plus tard |

Les autres actions économiques (`ECO-05` version des règles, `ECO-06` autorité serveur) restent au plan. **Aucun accord de principe n'autorise une PR économique en production :** vérifier l'état existant, simuler les conséquences sur rareté/monnaie/ressources/abus, proposer des règles précises et obtenir la validation finale du propriétaire **avant de changer les règles**.

**Collection et rareté :** distinguer **vu / capturé au moins une fois / actuellement possédé** ; découvrir un Pokémon par mission ne donne pas une capture. L'audit historique indique 852 espèces capturables et 173 non capturables parmi 1 025 ; vérifier la situation actuelle dans le code avant toute modification. Certaines espèces légendaires ou très rares peuvent rester réservées aux événements : ne pas « corriger » leur indisponibilité sans arbitrage.

## 6. Méthode de travail : autonome, mesurée, sans régression

- **Ne pas refaire un audit général** ni reposer les questions dont les réponses figurent dans les documents et dans le code. Pour « Go » / « Suite », rechercher l'état réel de `main` et **exécuter le prochain lot autorisé**.
- Examiner les chemins de code existants et les correctifs fusionnés avant de développer. Ne pas refaire les fonctionnalités déjà présentes (Wordle longueur exacte, aide existante de Stat mystère, grille, captures et animations).
- Faire des changements **minimaux, isolés par sujet**, sur branche/PR, avec tests locaux ciblés et de régression, puis CI **verte sur le head exact** avant fusion ; vérifier `main` après fusion. N'affirmer ni réussite ni fusion sans preuve.
- Modifier les **sources** `App/src/...`, puis reconstruire via le build ; **ne pas modifier directement le JavaScript généré** `App/script.js`.
- Protéger comptes, séparation multi-comptes, localStorage, séries, Daily, inventaires, Pokémon possédés, Balls, Pokédollars, historiques et identifiants. **Aucune migration destructive**, aucun effacement global, aucune sécurité économique purement côté client ; traiter les doubles requêtes côté serveur.
- Sur mobile, conserver des commandes accessibles avec une main ; un geste facultatif ne remplace pas le bouton et ne valide pas silencieusement une dépense, une fuite ou un abandon. Distinguer QA Chromium/WebKit de recette réelle Safari/iPhone.
- Ne pas commettre données personnelles, secrets, clés, exports d'administration ou fichiers clients.
- Pour les métriques, distinguer sessions, ouvertures, manches, fins, utilisateurs et dates de couverture. Les agrégats du **22/10 au 04/11** sont historiques, les événements suivis ont des limites de rétention ; ne pas inventer d'historique, de taux de rétention ou de conversion.
- Après chaque chantier terminé : mettre à jour `docs/PLAN_AMELIORATION_POKEDLE.md` et `docs/ETAT_AVANCEMENT_POKEDLE.md` (statut, PR, SHA, CI, limites, prochaine tâche et progression recalculée). Actualiser **ce guide** quand son point de reprise devient caduc.
- Ne demander l'avis du propriétaire **que pour un choix de gameplay/économie, une autorisation sensible ou un véritable arbitrage**, pas à chaque étape technique. Si une tâche est bloquée par une recette physique, poursuivre les tâches indépendantes du plan.

## 7. Message de départ prêt à copier-coller dans le prochain chat

> Je veux que tu **reprennes réellement le développement de mon site Pokédle**, sans repartir de zéro et sans limiter l'audit aux statistiques.
> **GitHub :** https://github.com/chebreub/Pokdle — **Site :** https://pokdle.fr/
> **Lis intégralement et dans cet ordre** : `docs/REPRISE_NOUVEAU_CHAT.md`, `docs/PLAN_AMELIORATION_POKEDLE.md`, `docs/ETAT_AVANCEMENT_POKEDLE.md`, puis les deux audits du 05/11/2026 et les documents liés. **Ce guide fait foi pour le transfert ; le dernier `main`, les PR et les tests font foi pour l'état technique courant.**
> **Dernier état : #287 fusionnée, MOB-03 encore en cours, 13/43 actions terminées (30,2 %) ; `BUG-MOB-01` toujours en attente de confirmation réelle sur le téléphone de Jade ; prochaine tâche autonome `MOB-03`.** Les actions LOG-01/02/03/04, SAVE-01, FX-02, DATA-01, DATA-02, NIV-02, SER-01, MEDIA-01, PC-02 et PC-01 sont déjà intégrées : ne les recommence pas.
> **Objectif global :** améliorer tous les modes, l'équilibrage, le Pokédex, la collection, les Pokémon rares, l'économie, les captures, les événements spéciaux, le multijoueur, le mobile/PC, les animations, les statistiques et la fidélisation. **Les statistiques ne sont qu'une partie du plan de 43 actions.**
> **Travaille maintenant** : vérifie le dernier `main`, le plan et les PR puis réalise le prochain lot sûr et autorisé, avec tests, CI, PR et mise à jour du suivi. Poursuis ensuite selon les priorités sans me reposer les questions déjà tranchées. **Soumets-moi seulement les décisions de gameplay ou d'économie qui exigent mon accord**, notamment Drattak et les expéditions. Ne touche ni aux probabilités de capture ni aux ressources et sauvegardes sans validation.
> À chaque étape, dis clairement : **fait / tests et CI / PR fusionnée ou non / vérification réelle en production / progression / prochaine action**. Pour « Go » ou « Suite », continue le plan au lieu de refaire un audit.

## 8. Hiérarchie en cas de contradiction

1. **État technique** : contenu de `main` actuel, commits, PR et tests effectifs.
2. **Décisions produit** : arbitrages validés et conditions figurant dans le plan, sans transformer des pistes en règles officielles.
3. **Avancement** : seules les actions réellement terminées, testées et intégrées font monter le compteur ; nombre actuel = **13/43**, après fusion vérifiée de #283 ; vérifier main pour toute modification ultérieure.
4. **Audits historiques** : photographie datée, à confronter aux corrections plus récentes.

Ce guide remplace les anciennes instructions qui faisaient encore commencer par `LOG-02` ou `DATA-02`, ou annonçaient **2/43**, **7/43**, **8/43**, **9/43**, **10/43** ou **11/43** ; ces informations étaient dépassées au 5 novembre 2026.

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
