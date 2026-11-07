# PLAN D'AMÉLIORATION POKEDLE V2

**Date : 7 novembre 2026. Référence : `88494384a068f2224bf5a63c1f3b7d5833e8d4cf`.**

Audit en lecture seule. Aucune modification de code, PR, base de production ou configuration. Les fichiers générés sont des propositions locales pour le dépôt.


## Suivi (7/11/2026)

- **V2-FX-01 fait** : [#342](https://github.com/chebreub/Pokdle/pull/342), fusion `94192b0` (QA complète verte). A · Cinéma + carte holo C.
- **V2-JUR-01 décidé** : Kayan garde les sons de capture Pokémon GO (7/11, « on garde les sons ») ; les sons faits maison restent en secours. Registre des sources à tenir.
- **V2-REL-01 fait** : [#343](https://github.com/chebreub/Pokdle/pull/343), fusion `c5d229d` (QA complète verte). Confirmation, reçu, nombre attendu, compte.
- **V2-TRA-01** : PR en cours (expiration à l'acceptation, quota sous verrou, blocage revérifié).

**Avancement V2 : 3/12** (FX-01, JUR-01, REL-01).

## Décision

Le plan V1 n'est pas à recommencer. **42 clôtures sont conservées au niveau de preuve précisé dans l'audit (dont GROW-02 sur déclaration) ; DATA-04 est partiellement rouverte.** Les anomalies nouvelles ne doivent pas servir à rebaptiser comme "absentes" des fonctions déjà livrées.

**P0 : aucun nouveau blocage critique démontré par cet audit.** L'absence de P0 ne vaut ni audit de pénétration complet ni garantie de production. Les points P1 évitent surtout perte involontaire de doublons, incohérence des échanges, mauvaise interprétation des mesures et risques de communication/droits.

## Actions (8 de l'audit GPT + 4 ajoutées par Kayan le 07/11 = 12)

| Priorité | ID | Problème et preuve | Correction proposée | Acceptation testable | Effort | Risque |
|---|---|---|---|---|---|---|
| P1 | V2-REL-01 | Relâchement irréversible sans confirmation ni reçu/scope comparable aux achats. [code] S05/S08. | Confirmation explicite (surtout shiny), actionId/reçu, état attendu et actionScope ; reprise réseau claire. | 3 exemplaires : 10 rejeux de la même action = 1 relâchement, 1 crédit ; annulation = 0 ; changement A/B = refus. | M | Inventaire/monnaie : moyen ; ancien client à traiter sans perte. |
| P1 | V2-TRA-01 | Expiration seulement à la lecture ; quota de proposition non sérialisé. [code] S06 ; effet concurrence à reproduire. | Contrôler l’âge sous verrou à l’acceptation ; sérialiser quota et unicité des propositions ; revalider blocage. | Offre de 8 jours = aucun transfert ; 4 demandes simultanées depuis 0 = au plus 3 offres ; double acceptation = 1 échange. | M | Échanges existants : moyen ; ne pas modifier leurs règles économiques. |
| P1 | V2-MES-01 | DATA-04 : J+7 est retour dans les 7 jours ; certaines sources prouvent une activité, pas une partie. [code] S07/S14. | Nommer exactement la mesure ; définir sources du retour au jeu, filtrer et dater la nouvelle définition sans réécrire l’historique. | Retour à J+2 seulement : vrai dans les 7 jours, faux à J+7 exact ; cadeau seul et état ready ne sont pas une partie ; cohortes immatures exclues. | S/M | Comparabilité des chiffres : moyen ; versionner. |
| P1 | V2-SOC-01 | Couverture Party plus étroite dans le helper que dans le chat privé. [code] S10 ; handler complet à confirmer. | Écrire le test Socket.IO de bout en bout puis aligner les contrôles manquants et le signalement ; ne pas créer de chat public. | Deux clients de test : liens/coordonnées standards refusés selon politique ; cible de signalement correcte ; retrait/blocage conforme ; pas de faux rejet des noms Pokémon. | M | Faux positifs et modération : moyen. |
| P1 | V2-JUR-01 | Sons Pokémon GO référencés dans le code ; droits des autres assets et moteurs à documenter. [code] S09 ; L1-L4. | Registre source/licence/autorisation ; sans permission documentée, utiliser le fallback sonore maison ; vérifier ROM/BIOS/cœurs et marque. | Chaque asset sonore servi a une provenance et base d’usage ; aucun fichier de jeu/BIOS protégé distribué sans droit ; aucune musique ni image IA. | S/M | Juridique : élevé ; correctif sonore technique faible, arbitrage du propriétaire. |
| P2 | V2-DEP-01 | Avis modéré qs propagé à 3 dépendances dans l’archive. [code] CI-3 ; D1. | Mettre à jour la résolution vulnérable de façon ciblée ; documenter si la sérialisation comma est utilisée. | Nouvel npm audit sans cet avis applicable ; tests routes/query/formulaires verts ; pas de mise à niveau majeure non motivée. | S | Régression dépendances : faible à moyen. |
| P2 | V2-OBS-01 | Effets utilisateur et performances déployées non mesurées dans cet audit. [site/stat] absents. | Mesure sur version déployée : parcours essentiel mobile/PC, poids à froid, erreurs, profils performance ; bilan des cohortes après maturation. | SHA déployé consigné ; parcours quotidien/achat/capture/échange sans erreur ; rapport perf avec réseau/appareil/cache ; effectifs et définitions des KPI affichés. | M | Faible si comptes de test exclus ; aucun recrutement massif requis. |
| P3 | V2-DOC-01 | 43/43 coexiste avec des prochaines actions et réserves anciennes. [code] S01/S02/S12. | Une synthèse courante unique ; journal historique daté ; relier recette, commit, appareil réel et réserve restante. | 43 lignes sans contradiction ; DATA-04 rouverte puis reclôturée sur preuve ; distinction commit QA / commit audité / déploiement. | S | Faible ; aucune incidence gameplay. |

#### Ajouts du 07/11 (Kayan) : contrôle Osytools et captures « wow »

Source : [contrôle Osytools du 07/11](audits/OSYTOOLS_2026-11-07.md) (87/100 : référencement 100, sécurité 100, accessibilité 81, vitesse 65) et demande de Kayan pour des captures plus spectaculaires (maquette A/B/C du 07/11).

| Priorité | ID | Problème et preuve | Correction proposée | Acceptation testable | Effort | Risque |
|---|---|---|---|---|---|---|
| P2 | V2-PERF-01 | 4 artworks de la bande « À plusieurs » en PNG 475 px (83 à 129 Ko chacun, ≈ 460 Ko) ; 2 feuilles de style bloquantes dont Google Fonts avec Inter et Press Start 2P. [site] Osytools. | Vignettes WebP à la taille affichée servies par le site (artwork officiel conservé) ; ne charger que Fredoka et Nunito après vérification des écrans qui citent encore les autres polices. | Osytools : plus d'image « trop lourde » ni de PNG sur l'accueil ; poids de l'accueil réduit d'au moins 300 Ko ; rendu identique sur captures téléphone/PC. | S | Faible. |
| P2 | V2-PERF-02 | Réponse du serveur 567 ms (≈ 0,7 s mesuré) ; serveur Render en Oregon ; 1 fichier non compressé à identifier. [site] Osytools. | Mettre en cache la page d'accueil générée ; identifier et compresser le fichier en cause. Changement de région Render/Supabase : **à décider par le propriétaire** (coût, migration). | Temps de première réponse de l'accueil mesuré avant/après ; aucun fichier non compressé signalé. | S/M | Faible (cache) ; moyen (région). |
| P3 | V2-ACC-01 | Aucun moyen de contact visible sur l'accueil. [site] Osytools. | Lien « Contact » dans le bas de page qui ouvre « Donne ton avis » ; aucune adresse e-mail publiée (promesse de la page de confidentialité). | Lien visible téléphone/PC ; Osytools ne signale plus « aucun moyen de contact ». | S | Faible. |
| P2 | V2-FX-01 | Rencontre et capture jugées « pas si ouf » par Kayan depuis le 3/11. [signal] | Maquette validée à confirmer : **A · Cinéma** pour chaque rencontre, **carte holo C** pour une 1re capture ou un shiny ; résultat serveur, taux, Balls et sons inchangés ; Rapides/Réduites respectés. | Captures du vrai site téléphone/PC ; durée en Normales ≤ durée actuelle + 1 s ; Réduites sans animation ; aucun appel serveur ajouté. | M | Faible ; visuel seulement. |

**Note V2-JUR-01 :** le 4/11, Kayan a choisi en connaissance de cause d'utiliser des sons de capture de Pokémon GO (« je ne suis pas connu, on changera si je le suis »). L'action reste ouverte comme registre des sources ; le remplacement par les sons faits maison est prêt (ils servent déjà de secours) et se fera sur sa décision.

## Détails de cadrage

**V2-REL-01.** Conserver les gains actuels : 15 ₽ par doublon normal et 1500 ₽ par shiny pour un compte, ainsi que la règle du dernier exemplaire. Le problème porte sur la confirmation et le nombre d'exécutions d'une intention, pas sur le prix. Les anciens onglets sans identifiant d'action doivent recevoir une demande de rechargement explicite plutôt qu'une exécution ambiguë. Le reçu doit être rattaché à l'identité et à l'exemplaire/requête attendue.

**V2-TRA-01.** Ne pas introduire une deuxième confirmation qui changerait l'accord déjà donné par l'auteur de l'offre. Corriger les invariants : expiration de 7 jours effective à l'instant d'accepter, trois propositions quotidiennes sous concurrence, aucune duplication et vérification du blocage avant transfert. Une proposition refusée/annulée conserve le traitement actuel vis-à-vis du quota tant qu'aucun autre arbitrage n'est approuvé.

**V2-MES-01.** La mesure "retour dans les 7 jours" est utile ; elle ne doit pas être supprimée automatiquement. La correction peut consister d'abord à bien la nommer. Pour une mesure de "partie jouée", exclure les preuves insuffisantes (cadeau seul, bonus de bienvenue, achat, simple ligne ready) ou séparer explicitement les deux indicateurs. Les changements de définition ne permettent pas de reconstituer rétroactivement une activité non collectée.

**V2-SOC-01.** Avant de modifier les règles, vérifier que le handler Socket.IO ne complète pas déjà les protections du helper. L'action est validée par un test d'intégration, pas par une expression régulière plus longue. Ne pas enregistrer toutes les conversations sans besoin, information et durée de conservation déterminés.

**V2-JUR-01.** La petite audience, le caractère gratuit et les crédits ne prouvent pas une autorisation. Pas d'images IA ni de nouveaux sons musicaux. La suppression ou substitution de sons officiels non documentés peut réutiliser les effets maison existants. Pour le nom/artworks et l'émulateur, la décision de maintien doit être informée par la situation des droits ; aucune conclusion juridique absolue n'est fabriquée.

**V2-OBS-01.** L'observation ne constitue pas une campagne publicitaire. Les retours existants de Jade/Kayan sont conservés. Les mesures de performance précéderont toute proposition de découpage massif des scripts. Ne pas demander l'indexation manuelle de 1025 fiches : contrôler sitemap et rapport d'indexation, lorsqu'ils sont accessibles.

## Ordre de traitement

1. REL-01 et TRA-01, chacun en changement isolé avec base de test jetable. En parallèle, sur accord de Kayan : FX-01 (captures « wow ») et PERF-01 / ACC-01 (petits correctifs Osytools).
2. MES-01 et SOC-01 ; JUR-01 en parallèle documentaire et décision du propriétaire.
3. DEP-01 ; puis OBS-01 avec les observations disponibles, sur un environnement de test et des données disponibles.
4. DOC-01 pour figer l'état validé et les limites.

S = changement ciblé ; M = plusieurs couches et tests ; L = refonte. Aucune action L n'est préconisée. Aucun calendrier ni budget de développement n'est promis.

## Garde-fous de livraison

- Sources uniquement dans `App/src/`, `App/lib/`, CSS et tests ; fichiers générés reconstruits, jamais source de vérité.
- Pas de modification de prix, taux de capture, shiny, récompenses ou plafond dans ce plan. Toute variante ultérieure doit porter **"a décider par le propriétaire"**, avec effet chiffré et simulation avant autorisation.
- Pas de suppression globale des sauvegardes, de recalcul destructeur d'inventaires ou de monnaie.
- Tests de transactions sur PostgreSQL jetable ; zéro appel de test destructif en production.
- Pour une PR fonctionnelle : tests ciblés, puis contrôles pertinents de non-régression sur le SHA final. Ne pas présenter une recette CI comme une recette physique Safari.
- Respect du mode Animations réduites, boutons conservés à côté des gestes, aucun geste caché qui dépense ou relâche.
- Pas de musique, voix/image IA, 3DS, chat public, nouveau Discord ou afflux publicitaire.
- Aucun nouveau partage obligatoire ni modification du secret serveur du Pokémon du jour.

## Ce que le plan ne propose pas

Pas de nouveau portefeuille, boutique, système de quêtes, tracking de cibles, vitrine ou défis de même série : ils existent. Pas de capture légendaire garantie, pas de nouvelle seconde chance hebdomadaire, pas d'attribution automatique des coffres expirés. ECO-01 reste une étude tant que le propriétaire n'a pas décidé une règle exacte.

## Clôture et preuves

Chaque ligne V2 doit être accompagnée d'un constat avant/après, de son test reproductible et de la référence de livraison. Les états [code], [site], [stat], [signal], [hypothèse] restent séparés. Aucun pourcentage de rétention ou volume d'inflation ne doit être fabriqué à partir des fixtures CI.

Les preuves détaillées et les 43 lignes V1 figurent dans `docs/audits/AUDIT_UX_GAMEPLAY_FIDELISATION_2026-11-07.md`. Les invariants économiques et calculs sont dans `docs/audits/AUDIT_ECONOMIE_CAPTURE_POKEDLE_2026-11-07.md`.

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
