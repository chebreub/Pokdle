# AUDIT ÉCONOMIE ET CAPTURE - Pokédle

**Date : 7 novembre 2026. Référence : `88494384a068f2224bf5a63c1f3b7d5833e8d4cf`.**

Audit en lecture seule. Aucune modification de code, PR, base de production ou configuration. Les fichiers générés sont des propositions locales pour le dépôt.


## 1. Résumé décisionnel

L'économie a été sensiblement renforcée : sessions vérifiées, preuve Party, meilleure partie rémunérée par différence, achats/lancers avec reçus, voies d'obtention distinctes, préparation légendaire et conservation temporaire de la rencontre. Les constats du 3/11 sur faux score libre, rencontres uniformes et shiny 1/150 ne décrivent plus l'état audité.

**Ne pas changer les prix ou la rareté sur cet audit.** Les problèmes prioritaires sont transactionnels (relâchement, échanges) et de définition des mesures. L'inflation et la satisfaction réelles restent inconnues faute d'export admin actuel.

## Niveaux de preuve et limites

- **[code]** : source figée, fonction/SQL, test ou résultat de recette technique. Une fiche de recette de l'auteur n'est pas la même preuve qu'un test réexécuté par l'auditeur ; la distinction est indiquée quand elle compte.
- **[site]** : observation indépendante du site déployé. **Aucune recette interactive de production réalisée ici** : les tentatives d'ouverture de `pokdle.fr` par l'outil ont échoué. Cela ne démontre pas que le site est en panne.
- **[stat]** : agrégats de vrais joueurs. **Aucun nouvel export admin fourni.** Les données fictives des captures CI sont des jeux de test, pas des chiffres de fréquentation.
- **[signal]** : retour d'un joueur ou déclaration du propriétaire, explicites comme tels.
- **[hypothèse]** : conséquence possible, jugement produit ou scénario à confirmer. Pas présentée comme un incident déjà subi.

Le code est figé sur `8849438`, même si `main` évolue pendant l'audit. Les sources générées `App/script.js` ne sont pas utilisées comme référence métier.

**Recette indépendamment inspectable :** archive CI de la PR #333 (run 42383113678, head `db33b727...`). Son `revision.txt` indique `0173fde33870e50de8011247318e1c9bef72590d`, fusion temporaire de test. `browser/report.json` annoncé **410 contrôles passés, 0 échec**, avec des largeurs 360, 390, 768, 1366, 1920 et 2560 px. Il y a aussi des recettes ciblées Chromium/WebKit, PostgreSQL et multi-clients, dont les rapports ont été lus. Des cas conditionnels y sont identifiés : 410 ne veut pas dire 410 fonctionnalités indépendantes.

L'auditeur a inspecté les rapports et des captures, pas relancé ces 410 contrôles. WebKit automatisé n'est pas un iPhone physique. Les 1025/1025 de la fiche iPhone sont une exécution annoncée par l'auteur ; ils ne sont pas présentés comme une exécution personnelle de cet audit. Aucun accès authentifié avec deux comptes de production, ni lecture exhaustive de chaque ligne de chaque module, n'est revendiqué.

## 2. Règles effectivement présentes

| Sujet | État du code | Lecture correcte |
|---|---|---|
| Balls gagnées | 10 par jour pour les sources soumises au plafond ; bonus série, bienvenue, expédition, admin et boutique exclus | Ce n'est pas un plafond de possession ni de tous les crédits de Balls. |
| Pièces du parcours | Pokémon du jour 300 ₽ ; Wordle/Dossier/Défi 150 ₽ chacun | Jusqu'a 750 ₽ pour ces quatre sources, selon les conditions de validation serveur. |
| Arcade | 30 / 60 / 90 ₽ selon le résultat ; meilleure partie quotidienne | On verse le complément ; un mode/source ne depasse pas 90 ₽. |
| Plafond arcade | 2000 ₽ par jour sur `play:*` | Ne comprend pas automatiquement toutes les autres sources du portefeuille. |
| Party | Première partie éligible : 150 ₽ + 1 Poké Ball | Reçu signé, identité/jour/partie ; pas déclaration libre. |
| Relâchement | Compte : 15 ₽ normal, 1500 ₽ shiny ; maximum 10 relâchements/jour ; dernier exemplaire conservé | Monnaie par spécimen, distincte du plafond `play:*`. Invite : XP locale existante. |
| Boutique Balls | Poké 50 ₽ ; Super 120 ₽ ; Hyper 300 ₽ | Achat avec contrôle du prix attendu, identité et reçu d'action. |
| Recharge | 4 rencontres ; 100 ₽ puis doublement à chaque recharge du jour ; maximum 10 recharges | 100, 200, 400... ne sont pas un tarif fixe de 100 ₽. |
| Rencontres gratuites | 4 de plus toutes les 4 h, cumulables jusqu'a minuit, 24/jour maximum | Il ne s'agit plus des anciennes 3 rencontres + 3 a 13 h. |
| Rencontres sauvages | Tirage pondéré par `wild-rarity`, dans les pools de zones admissibles | Le schema d'origine uniforme n'est plus l'état courant. |
| Shiny herbes | 1/500 pour les jours >= 05/11/2026 ; historique antérieur 1/150 | Ne pas melanger les versions pour estimer un taux observé. Ne pas extrapoler ce taux a tous les autres systèmes shiny. |
| Lancers | 3 par rencontre ; Poké x1, Super x1,4, Hyper x2 ; plafond de réussite 95 % | La formule adaptée de Pokédle utilisé un paramètre officiel, pas une probabilité finale officielle. |
| Légendaire hebdomadaire | Préparation avant ouverture et 72 h glissantes pour les nouvelles rencontres speciales | Même cible, même shiny, même nombre de lancers ; pas de nouveau tirage gratuit. |
| Drattak | Reprise unique sous les conditions validees de la variante G | Pas de réinitialisation illimitee ni de changement de taux shiny. |
| Coffres | Deux Balls par palier, emplacements uniques et reprise des crédits partiels | Aucun droit automatique nouveau sur les coffres expirés. |
| Échanges | Amis, doublons, normal contre normal/shiny contre shiny, 3 propositions/jour | Ce plafond porte sur les propositions ; ne pas présenter "trois transferts tous sens confondus" comme la règle. |

Sources : S05, S06, S13 et S15. Le tableau de 43 actions et les limites de clôture sont dans le premier audit.

## 3. ECO-03 : vérification de la meilleure partie

[code] `coinPlay` additionne les gains `play:*` du jour et ceux de la source/mode, calculé la cible `want`, puis le complément `min(want - mine, 2000 - played)`. Si ce complément n'est pas positif, rien n'est verse. Le crédit à une source unique par palier et s'inscrit dans le verrouillage de l'identité.

| Succession des résultats d'un même mode/source | Crédits attendus | Total |
|---|---|---|
| Perdu puis gagne puis Or | +30, +30, +30 | 90 ₽ |
| Or directement puis perdu puis Or | +90, 0, 0 | 90 ₽ |
| Perdu deux fois | +30, 0 | 30 ₽ |
| 1990 ₽ déjà crédits sur `play:*`, nouveau gain théorique de 30 | +10 au maximum | 2000 ₽ play |

Ce sont des calculs déterministes issus du code, pas des observations de vrais joueurs. Le gain d'une meilleure partie n'est pas 30+60+90 = 180.

**Effet de l'option B déjà approuvée :** pour un joueur dont la première partie vaut 30 puis la meilleure 90, le maximum additionnel est 60 ₽ sur ce mode ce jour-la. Sur `m` modes ameliores de cette façon, l'effet brut est au plus `60*m`, ensuite borne par le plafond play et les modes effectivement éligibles. Aucune nouvelle augmentation n'est proposée.

**Point de langage :** `COIN_PLAY_CAP` n'est pas un plafond de tous les encaissements. Il est normal que l'indicateur `coins.today` puisse être supérieur à `coins.played`. Ne pas qualifier automatiquement ce dépassement d'exploitation ; afficher les postes distinctement.

## 4. Calculs de capture, sans changement de taux

Formule présente : `p = min(0.95, 0.8 * (capture_rate / 255)^0.72 * bonusBall)`.

| Paramètre capture_rate | Poké / lancer | Super / lancer | Hyper / lancer | Réussite sur 3 Hyper |
|---:|---:|---:|---:|---:|
| 3 | 3,27 % | 4,57 % | 6,53 % | 18,34 % |
| 45 | 22,95 % | 32,12 % | 45,89 % | 84,16 % |
| 255 | 80,00 % | 95,00 % | 95,00 % | 99,9875 % |

Dernière colonne : `1-(1-p)^3`, en supposant trois lancers de la même Ball disponibles et effectivement exécutés. Ce tableau ne dit pas que tous les légendaires ont le même paramètre. Les secousses sont une présentation du résultat serveur, pas trois chances de capture supplémentaires.

À 1/500 par rencontre, **24 rencontres donnent environ 4,69 % de chance de voir au moins un shiny**, sous tirages indépendants. Ce n'est pas 4,69 % de chance d'en posséder un : il faut ensuite réussir sa capture. Les rencontres payantes modifient le nombre de tirages ; leurs usages réels ne sont pas fournis. Ce calcul ne justifie ni augmentation ni réduction automatique du taux.

[code] Le pool de capture explicite et les probabilités avant ouverture limitent les promesses trompeuses. [hypothèse] Un échec légendaire peut rester frustrant ; c'est déjà l'objet de la simulation ECO-01. **Toute autre occasion ou modification de taux : à décider par le propriétaire**, avec simulation. Aucun changement chiffré nouveau n'est demandé dans V2.

## 5. Autorité serveur et triche : ce qui a vraiment changé

[code] `/api/balls/earn` refuse les modes autres que Party lorsqu'ils arrivent sous forme d'une simple déclaration. Party exige un reçu signé et lié au jour/identité. Les jeux vérifiables utilisent `/api/arcade/*` et les jeux du jour leurs tables propres. `verifiedTimedEarning` ne récompense plus une minute Higher or Lower sans réponse acceptée. Les médias de devinette utilisent des adresses opaques, liées à l'identité et avec expiration. S05/S11/S13.

**Il serait faux de réutiliser le constat ancien "poster un score suffit pour gagner des Balls" comme état actuel.** Les modes purement clients non couverts ne sont pas pour autant interdits de jeu ; ils ne peuvent pas réclamer arbitrairement ces ressources.

**Limites assumées.** Le serveur prouve des commandes et un résultat, pas l'intelligence humaine derrière chaque clic. Recherche des réponses dans une encyclopédie, scripts de jeu et multicomptes restent des risques. Ne pas ajouter une collecte intrusive ni une promesse d'anti-bot parfait pour quelques dizaines de joueurs. Surveiller les anomalies agrégées, sans modifier les gains par défaut.

L'XP locale et des records personnels ont un périmètre différent ; ECO-06 indique expressément qu'il ne migre pas toute l'XP côté serveur. Ce n'est pas un échec de sa livraison. Ne pas utiliser un niveau local comme preuve suffisante pour une récompense rare échangeable.

## 6. Anomalies transactionnelles restantes

### REL-01 - Rejeu et changement de compte lors d'un relâchement

**Preuve [code] :** S08 `tradeRelease` appelle immédiatement `/api/wild/release` avec uniquement espèce/shiny. S05 `release` prend le plus récent exemplaire encore possédé ; la route ne demandé pas d'`actionId`/`actionScope`, contrairement aux achats/lancer.

**Reproduction à exécuter en base jetable :** posséder trois exemplaires de la même variante ; lancer deux fois la même intention de relâchement, ou simuler une réponse perdue puis reprendre. Tant qu'il reste deux exemplaires, le second appel peut agir de nouveau. Pour deux relâchements normaux cela crédite 30 ₽ plutôt que 15 ; pour deux shiny, 3000 ₽ plutôt que 1500, selon le barème actuel. Ce ne sont pas des gains sans contrepartie : deux spécimens ont été retirés, mais pas nécessairement avec deux consentements du joueur.

Deuxième scénario : fiche de A ouverte, connexion de B dans un autre onglet, B possède aussi le doublon ; la requête utilise le cookie courant sans vérifier le scope de la fiche. [hypothèse] Conséquence à reproduire avant patch, aucune manipulation de vrai compte réalisée.

**Correction :** même architecture de reçu et d'identité que les achats, confirmation avant l'action, état attendu/spécimen identifié, confirmation serveur réconciliée après coupure réseau. Aucun changement du barème.

### TRA-01 - Expiration et concurrence des propositions

**Preuve [code] :** S06 `expire` ne conditionne pas directement `respond`. Le SELECT verrouille `pending`, mais pas la date de création. `propose` effectue le quota, l'unicité et l'INSERT sur des appels séparés hors transaction dédiée.

**Scénarios :** offre vieille de huit jours acceptée sans appel préalable à `list` ; deux propositions simultanées quand le compte en a déjà fait deux ; doublon d'une même proposition transmis pendant un réseau lent. [hypothèse] L'effet concurrent exact doit être démontré par test PostgreSQL, pas par une attaque en production.

**Correction :** âge vérifié sous verrou au transfert, quota par émetteur/jour sérialisé, unicité d'offre ou identifiant de requête ; revalider l'amitié/blocage à un moment compatible avec les verrous. Conserver les vérifications existantes du dernier exemplaire et l'atomicité du transfert. Pas de changement aux trois propositions par jour.

### MET-01 - Les indicateurs ne peuvent pas prouver seuls l'absence d'inflation

[code] Sources `play:*`, `day:*`, `release:*` et `shop:*` ont des usages différents. Une progression du solde peut venir d'un faible achat, d'un bonus ponctuel ou d'une vente de doublon shiny, pas automatiquement d'une faille.

[stat] Il manque les flux et stocks actuels par source : monnaie gagnée/dépensée, Balls gagnées/lancées, recharges et captures, ainsi que les effectifs hors admin/tests. La fréquence des légendaires et shiny doit être segmentée par version depuis le 05/11 et par type de rencontre. Aucun export arrêté le 04/11 ne mesure le shiny actuel 1/500.

## 7. Observations de progression et de communauté

[code] L'album, les missions, les cibles, les zones, les expéditions et les échanges offrent déjà plusieurs moyens d'accomplissement. Les 852 capturables n'autorisent pas à colorer automatiquement comme captures les récompenses de mission. Les doublons ont un usage social ou de relâchement ; ne pas leur ajouter une nouvelle monnaie.

[hypothèse] Le risque produit est plutôt la multiplication des obligations et l'incompréhension des plafonds. Garder les rencontres cumulables de la journée, la préparation et les choix facultatifs. Ne pas transformer les six vagues en six notifications quotidiennes.

[code] Les coffres restent manuels et périment selon les règles approuvées. ECO-04 sécurise leur crédit, il ne les rend pas automatiques. Toute modification de cette règle serait **a décider par le propriétaire** ; son effet dépendrait du nombre de coffres non ouverts et ne peut pas être chiffré sans cet export.

## 8. Tests d'acceptation recommandés (sans exécution production)

| Groupe | Jeu de test | Invariant |
|---|---|---|
| ECO-03 | Perdu, gagne, Or ; Or répété ; sources alias ; concurrence ; changement de jour Paris | 90 maximum par source/jour, 2000 play, pas de nouveau crédit au rejeu |
| Achat | Réponse perdue, double clic, nouveau compte, prix de recharge changé | Une intention = une dépense ; ancien prix/scope refuse |
| Capture | Réponse perdue, dernier lancer, changement d'onglet, expiration spéciale | Aucun lancer/double débit supplémentaire ; rencontre/shiny inchangés |
| Relâchement | Trois doublons, deux appels même action, annulation, changement A/B | Un spécimen/crédit ; aucun effet sans confirmation |
| Échange | Offre 8 jours, deux acceptations, quatre propositions simultanées, retrait/blocage | Offre expirée refusée ; quota effectif ; aucun dernier exemplaire transféré |
| Coffre | Palier partiel, autre jour, adoption invite, reprise après panne | Crédit par emplacement unique et complet, pas de nouveau bonus |
| Rétention | Cadeau seul, bienvenue seule, échange reçu seul, ready sans action, retour J+2 sans J+7 | Sources et libellés correspondent à ce qui est annoncé |

## 9. Décision

Aucune modification économique autorisée par ce document. Le plan V2 retient REL-01, TRA-01, MES-01 et des contrôles techniques/juridiques. Les mêmes plafonds, probabilités et sources de récompense doivent passer les tests après correction. Si un arbitrage de rareté est souhaité, reprendre ECO-01 au lieu de produire un nouveau barème de mémoire.


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
