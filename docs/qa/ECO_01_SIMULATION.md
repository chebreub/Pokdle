# ECO-01 — Simulation comparative de nouvelles occasions légendaires (hors production)

**Base analysée :** `main` `cf38d1c13daab2972bfc9587abb13ed6f9b66d70` (6 novembre 2026). **Statut :** simulation candidate à la revue, arbitrage des règles ouvert. Ce document ne valide aucune règle économique.

## Règles et risques identifiés dans le serveur

Sources : `App/lib/poke-balls.js`, `App/capture-rates.json`, `App/test/expedition.test.js` et audit du 05/11.

- Rotation de **six** espèces (#380 Latias, #485 Heatran, #639 Terrakium, #785 Tokorico, #894 Regieleki, #1001 Chongjian), une par semaine (lundi–dimanche, Paris).
- Une journée de participation = deux sources **distinctes** de Balls gagnées dans des modes éligibles, déterminées par le serveur. Objectif collectif `max(7, ceil(1.5 × joueurs distincts actifs la semaine précédente))`; l'avancement collectif compte des **jours de participation**, et non uniquement des joueurs uniques.
- À 100 % du collectif, **une rencontre hebdomadaire maximum** par identité connectée justifiant **deux jours** de participation. Elle ne consomme pas de rencontre ordinaire. Impossible sans Ball ou avec une rencontre ouverte.
- À chaque palier collectif atteint (25/50/75 %), le joueur ayant au moins une journée de contribution peut réclamer un coffre : cumul **3 Poké Balls + 3 Super Balls**, et **0 Hyper Ball**. Ces Balls bonus ne sont pas des Pokédollars et doivent être réclamées avant expiration dans la version actuelle.
- Trois lancers maximum, une Ball consommée par lancer, échec et fuite possibles, tirages et inventaire sous contrôle du serveur. L'expédition de la semaine ne fournit pas une capture garantie.
- Espèces #380/#485/#639/#785/#894 : `capture_rate=3`. #1001 : `capture_rate=6`. Formule Pokédle `min(0.95, 0.8 * (rate/255)^0.72 * ballMultiplier)`, multiplicateurs Poké=1, Super=1.4, Hyper=2. Shiny **1/500** depuis le 05/11/2026 ; aucune modification dans cette PR.
- Les prix actuels sont Poké **50 ₽**, Super **120 ₽**, Hyper **300 ₽**. La possession réelle de Balls et l'achat de nouvelles Balls sont deux questions distinctes.

**Probabilité exacte de capture avec trois lancers de même Ball**, si les trois Balls sont disponibles :

| Espèce | 3 Poké | 3 Super | 3 Hyper |
| --- | ---: | ---: | ---: |
| #380/#485/#639/#785/#894 | 9,48 % | 13,10 % | 18,34 % |
| #1001 | 15,28 % | 20,93 % | 28,92 % |

## Périmètre et hypothèses de la simulation

**Simulation Monte-Carlo reproductible**, graine `20261106`, **120 000 identités-semaines fictives**, six espèces équipondérées (20 000 chacune). **100 % sont déjà éligibles à la première rencontre** : compte, objectif collectif, deux jours de participation et Balls disponibles. Ce résultat **ne prédit pas la participation réelle** ; aucune donnée personnelle, historique de comptes ou monnaie réelle n'est utilisée.

Parmi ces identités déjà éligibles, la distribution des jours est **une hypothèse, pas une statistique observée** : 50 % à deux jours, 25 % à trois jours, 15 % à quatre jours, 10 % à cinq jours. Une deuxième rencontre n'est proposée **qu'en cas de première fuite**, une seule fois au maximum, et uniquement si le seuil de jours est respecté. Capturer le premier Pokémon exclut la deuxième tentative. Aucun nouveau Pokémon, Ball, gain, prix ou taux n'est introduit dans le jeu.

**Stratégie principale « coffres » :** 3 Super pour la première rencontre, 3 Poké pour la seconde après échec. Suppose tous les coffres gagnés, réclamés et leurs Balls disponibles. Le lancer cesse à la capture ; les Balls inutilisées restent dans le stock. Sensibilités : 3 Poké + 3 Poké, et 3 Hyper + 3 Hyper (ces dernières **ne viennent pas des coffres**).

Le coût « valeur boutique » additionne les prix de remplacement théoriques des Balls **réellement lancées**. Ce n'est **ni un débit de Pokédollars**, ni une estimation des achats futurs. Une taxe de 300 ₽ sur la seconde rencontre figure **uniquement comme scénario fictif**, sans proposition de tarification et en supposant 100 % des joueurs capables et disposés à payer.

## Résultats reproductibles (stratégie coffres)

Unités : **par 1 000 identités-semaines déjà éligibles** ; Balls et valeur boutique moyennes **par identité**.

| Scénario | Rencontres | Captures | Deuxièmes rencontres | Balls utilisées | Équivalent boutique (₽) | Taxe fictive (₽) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **A — actuel**, une rencontre | 1 000,0 | **144,8** | 0 | 2,85 | 342,0 | 0 |
| **B**, seconde après fuite + ≥3 jours | 1 427,6 | **189,0** | 427,6 | 4,09 | 403,8 | 0 |
| **C**, seconde après fuite + ≥4 jours | 1 213,6 | **166,6** | 213,6 | 3,47 | 372,9 | 0 |
| **D**, seconde après fuite + ≥5 jours | 1 085,3 | **153,4** | 85,3 | 3,10 | 354,3 | 0 |
| **E**, comme C + 300 ₽ hypothétiques | 1 213,6 | **166,6** | 213,6 | 3,47 | 372,9 | 64,1 |

Variations des captures par rapport à A : **B +30,5 %**, **C +15,1 %**, **D +6,0 %**, sous cette distribution fictive. Le scénario E n'intègre pas les refus, l'insuffisance de monnaie ou les arbitrages d'inventaire : ses 64,1 ₽/identité sont **un plafond conditionnel**, pas une recette prévisible.

### Sensibilité au type de Ball (A → C)

| Stock présumé | Captures / 1 000 : A → C | Deuxièmes rencontres / 1 000 : C | Balls utilisées/identité : A → C |
| --- | --- | ---: | --- |
| 3 Poké + 3 Poké | 104,6 → 127,8 | 223,6 | 2,89 → 3,54 |
| 3 Super + 3 Poké (coffres) | 144,8 → 166,6 | 213,6 | 2,85 → 3,47 |
| 3 Hyper + 3 Hyper | 201,5 → 241,3 | 199,9 | 2,79 → 3,35 |

Les simulations supposent l'absence d'abandon volontaire en cours de rencontre, un stock initial suffisant et une semaine où l'objectif collectif est atteint. Les résultats changeraient avec la distribution réelle des participations et des inventaires.

## Rareté, coût, shiny, abus

- Avec C, le nombre de **rencontres légendaires** augmente de **21,4 %**, mais celui de **captures** de seulement **15,1 %** dans la population simulée. Une seconde occasion ne garantit toujours rien.
- C requiert en moyenne **0,62 Ball lancée de plus par identité** que A. Sans achat réel, le **débit supplémentaire effectif de Pokédollars est 0** pour les scénarios B/C/D ; des achats éventuels nécessitent des données réelles d'inventaire/transactions.
- Avec C, un nouveau tirage shiny pour chaque seconde rencontre ajouterait environ **213,6 / 500 = 0,43** apparitions shiny attendues par 1 000 éligibles. Réutiliser le shiny de la première rencontre annulerait ces **nouveaux tirages**, mais aiderait à capturer un shiny déjà rencontré. **Ce choix n'est pas décidé** ; taux 1/500 inchangé.
- **Multi-comptes :** un second essai augmente les occasions par compte alternatif déjà éligible ; une simulation sans données comportementales ne peut quantifier l'abus réel. Une implémentation exigerait une limite atomique identité/semaine/tentative, relecture des jours serveur, absence d'ouverture après capture, rejet du rejeu/double clic/concurrence et tests multi-appareils.
- Le serveur actuel empêche tout second légendaire de la semaine en vérifiant une rencontre déjà créée. Ce garde-fou **doit être adapté seulement après arbitrage** ; on ne peut pas activer une seconde chance par un simple bouton front.

## Arbitrage recommandé (aucune règle implémentée)

**C est l'option prudente à discuter** : une seconde rencontre uniquement après fuite, après au moins **quatre jours de participation**, au maximum deux rencontres hebdomadaires et **sans nouveaux achats obligatoires, Balls offertes ou modification de capture**. Cette option améliore la perspective de capture tout en laissant le légendaire rare. **A (statu quo) reste cohérente** si la rareté est prioritaire ; B augmente plus fortement la fréquence, D réduit beaucoup le bénéfice. E ne se justifie pas sans connaître les ressources réelles.

Pour décider, il reste à approuver explicitement : A/B/C/D (ou une autre variante), coût nul ou coût éventuel, conservation ou nouveau tirage shiny, fenêtre de réouverture jusqu'au dimanche, éventuelle rencontre persistante (ECO-08), et prévention des replays. ECO-02 Drattak est un sujet séparé.

## Exécution et tests

Depuis la racine du dépôt :

```sh
node App/tools/simulate-expedition-eco01.js
node App/tools/simulate-expedition-eco01.js --json --players 120000 --seed 20261106
cd App && node --test test/expedition-eco01-simulation.test.js
```

Le script lit les constantes **du serveur** (six espèces, chances, 3 lancers, shiny, prix, coffres), vérifie des garde-fous et utilise un RNG à graine fixe. Aucun accès réseau, à la base, aux comptes, à `localStorage`, ni à une API. Les tests vérifient les contraintes, le déterminisme, l'ordre des scénarios et l'absence de capture supplémentaire garantie. La CI exécutée sur le véritable dépôt prime sur tout test effectué sur une copie minimale du module.
