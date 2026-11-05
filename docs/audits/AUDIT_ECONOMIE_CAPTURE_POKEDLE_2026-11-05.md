# Audit Pokédle — économie, rencontres, captures, rareté et collection

**Synthèse au 5 novembre 2026** des règles serveur et de la photographie agrégée allant du **22 octobre au 4 novembre 2026**. Les règles sont vérifiées sur le code connu au commit [b86a4e3](https://github.com/chebreub/Pokdle/commit/b86a4e3e7b6e08836c1174960864254809f40726). Cet audit est un **état des lieux et un plan d'expérimentation, pas une modification ni une validation de nouveaux taux**.

## Verdict

L'économie actuelle combine des récompenses quotidiennes, des Pokédollars obtenus par le jeu, un plafond journalier, une boutique et des rencontres limitées. Le système de capture reste volontairement exigeant, notamment pour les légendaires. **Aucun chiffre fourni ne justifie de rendre toutes les captures plus faciles.**

Les principaux enjeux sont la **clarté** (chances et coûts avant un lancer ou une rencontre exceptionnelle), la **frustration après plusieurs jours d'efforts** (expédition et Drattak), la lisibilité du Pokédex, et la capacité à mesurer séparément les règles récentes sans déductions trompeuses.

## 1. Preuves et limites

- Source de règles : [App/lib/poke-balls.js](../../App/lib/poke-balls.js), [App/lib/wild-rarity.js](../../App/lib/wild-rarity.js), [App/lib/prestige-quests.js](../../App/lib/prestige-quests.js) et les tests App/test/ du dépôt.
- Catalogue d'obtention exhaustif : [PLAN_RARETE_1025.md](../PLAN_RARETE_1025.md).
- Interface capture : [script.10xz.wild-grass.js](../../App/src/script.10xz.wild-grass.js), [script.10xzd.motion.js](../../App/src/script.10xzd.motion.js), [script.10xzh.shop.js](../../App/src/script.10xzh.shop.js).
- Observation économique : export JSON anonyme du tableau de bord fourni dans la conversation et arrêté au **4 novembre**. Il n'est **pas inclus** dans le dépôt ; les chiffres ci-dessous sont une transcription de cette extraction et doivent être recalculés à partir d'une copie si des vérifications statistiques plus poussées sont demandées.
- **Les statistiques du 4 novembre sont antérieures à la modification de fréquence shiny du 5 novembre** et ne permettent donc pas de juger le nouveau réglage.

## 2. Règles actuelles du jeu, à préserver sans décision explicite

### Pokédollars

| Source | Règle observée dans le code |
| --- | --- |
| Enquête quotidienne | 300 ₽ une fois par jour |
| Wordle quotidien | 150 ₽ une fois par jour |
| Dossier quotidien | 150 ₽ une fois par jour |
| Défi quotidien | 150 ₽ une fois par jour |
| Autres modes, première performance rémunérée / jour et mode | 30 ₽ pour une défaite, 60 ₽ pour une victoire, 90 ₽ au palier de performance supérieur ; le traitement exact de la première attribution est à revoir avant toute amélioration |
| Plafond des gains en jouant aux modes concernés | 2 000 ₽ par jour |
| Party Room | 150 ₽ pour la première partie éligible terminée du jour |
| Relâcher un doublon normal | 15 ₽ |
| Relâcher un doublon shiny | 1 500 ₽ |

Les récompenses sont soumises aux conditions du serveur et à des mécanismes d'idempotence ; les valeurs ne doivent pas être interprétées comme un paiement garanti pour tout écran ouvert. Les récompenses des modes quotidiens et les bonus doivent rester distincts du plafond de 2 000 ₽ qui vise les gains de jeu concernés.

### Boutique, Balls et rencontres

| Ressource | Règle au 5 novembre |
| --- | --- |
| Poké Ball | 50 ₽ à l'achat |
| Super Ball | 120 ₽ |
| Hyper Ball | 300 ₽ |
| Recharge de 4 rencontres | 100 ₽ pour la première, puis doublement à chaque recharge supplémentaire le même jour (100, 200, 400…) |
| Rencontres ordinaires | 4 nouvelles occasions toutes les 4 heures à l'heure de Paris, au maximum **24** ouvertes par le cycle journalier normal |
| Lancers autorisés sur une rencontre | **3 maximum** |
| Récompenses normales de Balls | Plafond de 10 Balls / jour pour les sources ordinaires ; bonus spéciaux à distinguer (série, bienvenue, coffre, achats) |
| Accueil nouveaux joueurs | 5 Balls de bienvenue (4 Poké, 1 Super) |
| Série de connexions | Hyper Ball au jalon de 7 jours, sous conditions de la règle serveur |

**Important :** un plafond de rencontres n'est pas un nombre de captures promises. Un joueur peut avoir des rencontres disponibles et manquer de Balls ; les recharges de rencontres et les achats de Balls sont des opérations distinctes. Ne pas mélanger allocations, achats et bonus lorsque l'on analyse l'économie.

### Probabilités de capture : règle propre à Pokédle

Les taux de base sont issus du champ de capture des espèces dans [capture-rates.json](../../App/capture-rates.json), mais **la probabilité finale n'est pas la formule exacte des jeux vidéo Pokémon** :

```text
p = min(0,95 ; 0,8 × (capture_rate / 255)^0,72 × multiplicateur)
multiplicateur : Poké Ball = 1 ; Super Ball = 1,4 ; Hyper Ball = 2
```

Exemple donné dans le commentaire du code pour un taux d'espèce 45 : approximativement **23 % Poké**, **32 % Super**, **46 % Hyper** par lancer selon la formule du site. Chaque rencontre dispose d'au plus trois lancers, donc même avec de bonnes Balls **la capture n'est pas garantie**. La chance réellement présentée et la dépense doivent être calculées / confirmées par le serveur.

**Shiny :** ancien paramètre **1/150 jusqu'au 4 novembre 2026** ; nouveau paramètre **1/500 à compter du 5 novembre 2026 (jour de Paris)**. Ni les 4 shiny rencontrés ni les 3 capturés dans l'export historique ne permettent d'évaluer ce nouvel équilibre.

### Rareté des rencontres sauvages

La pondération des hautes herbes est **une conception Pokédle**, et non une fréquence officielle d'apparition :

| Catégorie | Poids par espèce | Taux de capture servant à la classification |
| --- | ---: | --- |
| Commun | 36 | Au moins 190 |
| Peu commun | 18 | 100 à 189 |
| Rare | 8 | 60 à 99 |
| Très rare | 3 | 25 à 59 |
| Fuyant / difficile à capturer | 16 | 1 à 24 |

L'exception pour les espèces au taux de capture très bas évite de cumuler une apparition extrêmement rare avec une capture déjà extrêmement difficile. Les poids se rapportent à la table complète de rencontre ; **ils ne sont pas directement des pourcentages de rencontre**.

## 3. Photographie économique du 22/10 au 04/11/2026

| Indicateur anonyme | Valeur | Interprétation |
| --- | ---: | --- |
| Rencontres générées | 195 | Compte des rencontres, pas des comptes joueurs |
| Captures réussies | 127 | **65,1 % des rencontres générées** |
| Lancers enregistrés | 274 | **127 / 274 = 46,4 %** réussites par lancer observées |
| Rencontres dont le Pokémon s'est enfui | 29 | À distinguer des rencontres volontairement ignorées |
| Rencontres ignorées | 39 | Le joueur a choisi de ne pas aller jusqu'à une capture |
| Rencontres ouvertes en fin d'extraction | 0 | Photographie, pas règle de fonctionnement |
| Shiny rencontrés | 4 | Sur ancienne période 1/150 |
| Shiny capturés | 3 | Échantillon minuscule |
| Pokédollars crédités | 13 085 ₽ | Flux de la période |
| Pokédollars dépensés | 9 170 ₽ | Flux de la période |
| Flux net | **+3 915 ₽** | **Ne constitue pas le solde total des portefeuilles** |

L'export agrégé décrivait **10 identités de rencontre distinctes** ; la fenêtre et les échantillons par Ball ne suffisent pas pour calibrer précisément la difficulté par rareté ou génération. La distribution observée des lancers était d'environ 212 Poké Ball (100 réussites), 60 Super Ball (27 réussites), 2 Hyper Ball (aucune réussite).

**Erreur à éviter :** conclure que la Super ou l'Hyper Ball sont « moins fortes » à partir de 100/212, 27/60 et 0/2. Les joueurs choisissent souvent une meilleure Ball lorsque le Pokémon est plus difficile ; ce sont des sous-groupes **non comparables**, et le cas Hyper Ball ne compte que deux essais. Ce sont des fréquences descriptives, pas un essai contrôlé.

Les « sorties » 29 + 39 + 127 = 195 semblent exhaustives pour cette photographie, mais il faut confirmer les définitions d'état dans un prochain export avant de construire un funnel. Les montants crédités/dépensés ne prouvent pas à eux seuls l'accumulation de richesse ni sa distribution entre comptes.

## 4. Les 1 025 espèces : voies réellement disponibles

Le document de référence [PLAN_RARETE_1025.md](../PLAN_RARETE_1025.md) fournit un découpage **mutuellement exclusif par voie principale** :

| Voie | Espèces | Ce que le joueur gagne |
| --- | ---: | --- |
| Hautes herbes | 845 | Possibilité de rencontre, puis capture si une Ball réussit |
| Prestige Drattak | 1 | Rencontre sous conditions ; capture non garantie |
| Expédition légendaire | 6 | Rencontre hebdomadaire conditionnelle ; capture non garantie |
| Missions d'album | 108 | **Découverte seulement**, pas une capture gratuite |
| Secrets sans autre route | 3 | Découverte spéciale, pas possession automatique |
| Aucune voie dédiée | 62 | Espèces non obtenables par une route dédiée actuellement |
| **Total** | **1 025** | |

**852 espèces disposent d'une voie de capture identifiée (845 + 1 + 6)** ; les autres ont une découverte sans capture ou pas encore de route dédiée. La **collection actuelle** et le **Pokédex de découverte** ne doivent donc pas utiliser les mêmes dénominateurs ni compter une mission comme une capture. Les pseudo-légendaires des neuf générations sont traités comme des objectifs rares / missions, pas jetés indistinctement dans les herbes communes.

## 5. Expédition hebdomadaire : fonctionnement et difficulté

**[Code]** Rotation de six rencontres possibles : Latias (#380), Heatran (#485), Terrakium (#639), Tokopiyon (#785), Regieleki (#894) et Chongjian (#1001). La liste des numéros et espèces doit toujours être confirmée dans le Pokédex si des libellés changent.

Règles observées :

- Semaine du lundi au dimanche en heure de Paris.
- Une participation comptabilisée pour un jour où le joueur gagne des Balls dans **deux modes différents**.
- Objectif collectif au moins 7, pondéré à 1,5 × les joueurs actifs de la semaine précédente.
- Coffres d'étape aux paliers 25 % / 50 % / 75 %, actuellement à réclamer dans la fenêtre.
- Au palier collectif 100 %, rencontre du légendaire de la région si le compte est éligible et si le joueur a **au moins deux jours** de participation personnelle.
- Une rencontre n'équivaut jamais à une capture garantie ; l'éligibilité et les probabilités restent serveur.

**[Risque produit]** Un joueur qui contribue plusieurs jours peut manquer la réclamation d'un coffre ou perdre le légendaire avec trois échecs. C'est une frustration possible, pas une preuve que tous les taux sont mauvais.

**Pistes à simuler avant décision :** auto-créditer une récompense déjà gagnée et non réclamée, donner une seconde occasion de rencontre hebdomadaire après preuve de participation supplémentaire, ou conserver temporairement une rencontre spéciale ouverte. Chaque variante nécessite simulation du coût en Balls, du stock d'occasions et de l'abus possible sur plusieurs comptes.

## 6. Prestige Drattak : rareté et deuxième chance

La quête « Le rêve de Draby », définie dans [prestige-quests.js](../../App/lib/prestige-quests.js), demande notamment :

- Avoir capturé Draby (#371) ou Drackhaus (#372), vérifié serveur.
- Réussir **3 victoires Cri + 3 Silhouette + 3 Description**.
- Répartir les succès sur **5 jours distincts** au minimum parmi les **30 derniers jours**.
- Répondre à l'énigme de Drackhaus, sans que la réponse puisse contourner les preuves serveur.
- Déclencher une seule rencontre spéciale, **3 lancers maximum** et capture non garantie.
- Après un échec, période d'attente de **21 jours** et reprise de progression selon les règles serveur.

**[Analyse]** Le défi initial est cohérent avec le prestige de Drattak. La répétition de presque tout le parcours après une défaite en trois Balls peut toutefois coûter beaucoup de motivation. **Proposition non approuvée :** préserver l'effort de la première quête et définir une voie limitée de seconde chance exigeant quelques nouveaux jours vérifiés, avec plafond d'occasions. Le défi initial, la capture non garantie et l'autorité serveur restent intacts.

## 7. Expérimentations proposées : aucune en production à ce stade

| ID du plan | Hypothèse à évaluer | Garde-fous |
| --- | --- | --- |
| ECO-07 | Prévenir avant d'ouvrir une rencontre de prestige si les Balls disponibles sont insuffisantes ; montrer un ordre de grandeur des chances | Dépenser **seulement** à l'action validée côté serveur ; pas de taux client indépendant |
| ECO-08 | Conserver une rencontre spéciale ouverte jusqu'à 72 heures | **Même rencontre**, pas de nouveau tirage, pas de duplicata, expire proprement |
| ECO-01 | Deuxième occasion hebdomadaire très limitée si légendaire non capturé | Participation vérifiée, limite serveur, coût défini, capture toujours incertaine |
| ECO-02 | Reprise plus courte après échec Drattak | Les prérequis initiaux restent exigeants ; nouvelle preuve de jeu et anti-abus |
| ECO-04 | Créditer automatiquement les coffres déjà gagnés à expiration | Une attribution idempotente, aucune recréation gratuite |
| ECO-03 | Remplacer la récompense figée au premier résultat par un **complément** si un meilleur palier est atteint dans la journée | 30 puis +30 puis +30 = **90 maximum par mode/jour**, vérifier l'ensemble des sources et caps |
| ECO-05 | Ventiler statistiques par **version des règles**, Ball, ordre de lancer, espèce, classe et type de rencontre | Agrégats anonymes ; éviter les croisements ré-identifiants et mesurer de vraies cohortes |
| ECO-06 | Revoir l'autorité serveur et la résistance au rejeu des récompenses prioritaires | Aucune confiance dans un score simplement déclaré par le navigateur |

**La valeur « 72 heures », le nombre d'occasions et les conditions de reprise sont des paramètres d'étude**, pas des choix validés. Ne pas déployer un ajustement économique sans examen des tests de transactions, de la migration des états existants et sans accord explicite sur les paramètres de jeu.

## 8. Mesures qui manquent pour décider sérieusement

À produire à partir du prochain export anonyme compatible :

1. Rencontres **par jour et par version de shiny** ; distinguer jour de Paris, début de distribution et éventuel changement de formule.
2. Capture/échec/ignoré par **classe de rareté**, et par ordre du lancer, en corrigeant la sélection des Balls selon la difficulté.
3. Distribution des **portefeuilles**, taux de joueurs réellement à court de Balls, achats de recharge, pas seulement flux brut.
4. Parcours des expéditions : éligible → coffre gagné → coffre réclamé → légendaire rencontré → lancers → résultat ; unités distinctes.
5. Nombre de joueurs ayant terminé les prérequis Drattak, ayant ouvert la rencontre puis ayant capturé/échoué ; coût en jours.
6. Évolution avant/après changement **1/150 → 1/500** sur des expositions suffisantes ; pas de conclusion après quelques shinies.

Sans ces données, éviter de prétendre qu'une règle multipliera les visites, les revenus fictifs ou la fidélité.

## 9. Décisions fermes et prochaines étapes

**À préserver :** taux de capture et coefficients en vigueur, rareté spéciale des légendaires, 3 lancers, limites normales de ressources, inventaire réel, distinction découverte/capture, règles serveur et anciennes captures.

**À préparer :** clarté de l'interface Pokédex, métriques par version, simulations et tests d'idempotence des variantes de seconde chance. **Aucun changement économique dans la branche documentaire.**

Pour reprendre l'audit : lire [l'audit UX](AUDIT_UX_GAMEPLAY_FIDELISATION_2026-11-05.md), le [plan des tâches](../PLAN_AMELIORATION_POKEDLE.md), l'[état d'avancement](../ETAT_AVANCEMENT_POKEDLE.md) et le [guide nouveau chat](../REPRISE_NOUVEAU_CHAT.md), puis vérifier le dernier `main` avant toute nouvelle PR.
