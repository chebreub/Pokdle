# ECO-02 — Drattak : étude de reprise et de rendez-vous événementiel

**Statut : étude et simulation hors production ; arbitrage produit ouvert.** Base lue : `main` `579367aa23044cbbf958b43e36b98fcef7291f20` (06/11/2026). Ce document n'autorise aucune modification de l'économie, des captures ni des règles de prestige.

## 1. Règle réelle contrôlée dans le serveur

Sources : `App/lib/prestige-quests.js`, `App/lib/poke-balls.js` (fonctions `prestige` et `meetPrestige`), `App/test/prestige-drattak.test.js`, `App/src/script.10xzb.expedition.js`, `App/capture-rates.json`.

Pour **ouvrir la première rencontre** de Drattak (#373), il faut :
- un **compte** et une capture serveur effective de Draby (#371) ou Drackhaus (#372) encore au statut `caught` ; une découverte ou une réponse d'énigme ne suffit pas ;
- **3 victoires vérifiées** dans chacun des modes Cri, Silhouette et Description (9 au total), sur **5 jours distincts** minimum, dans une fenêtre glissante de **30 jours**, et une victoire comptée au maximum par mode et par jour ;
- résoudre l'énigme ; une réponse connue ne contourne pas les preuves côté serveur ;
- disposer de **3 Balls au total** avant l'ouverture ; aucun Pokémon n'est offert.

La rencontre dispose d'au plus **3 lancers**. La formule de capture est celle du serveur ; Drattak possède le `capture_rate` 45.

| Trois Balls identiques effectivement disponibles | Probabilité par lancer | Probabilité de capture en 3 lancers |
| --- | ---: | ---: |
| Poké Ball | 22,94 % | 54,25 % |
| Super Ball | 32,12 % | 68,73 % |
| Hyper Ball | 45,89 % | 84,16 % |

Après une tentative, même manquée, `prestige_verified_wins` n'est **pas supprimée**, mais la requête SQL **ne compte que les victoires postérieures au dernier jour de rencontre**. La quête est donc à refaire en pratique ; une nouvelle rencontre n'est possible qu'après un **cooldown de 21 jours**, puis cinq jours et neuf nouvelles victoires vérifiées. Les Balls réellement lancées sont consommées. Les rencontres ouvrent le tirage shiny serveur au taux inchangé **1/500**. L'ouverture utilise déjà un verrou de transaction par identité ; sa robustesse devra être réexaminée pour tout événement nouveau.

**Point déterminant :** le taux de capture de Drattak (45) est sensiblement supérieur à celui des cinq légendaires d'expédition à `capture_rate=3`. Multiplier les rencontres peut donc rendre Drattak très accessible à moyen terme, même sans toucher à sa formule.

## 2. Sept variantes étudiées — aucune approuvée

On **ne modifie jamais** la quête initiale (3 victoires par mode, cinq jours, lignée capturée), le cooldown de 21 jours, les trois lancers, les prix ou le shiny. Seule la **reprise après un échec** est simulée :

| Code | Condition de nouvelle tentative après une fuite | Rendez-vous |
| --- | --- | --- |
| A | Règle actuelle : 5 nouveaux jours et 3 nouvelles victoires **par mode** | Aucune fenêtre |
| B | 2 nouveaux jours et 1 nouvelle victoire par mode, **à chaque échec** | Permanent |
| C | Comme B, à chaque échec | Fenêtre hypothétique **samedi–dimanche** |
| D | Comme B, à chaque échec | Apparition fictive **15 % par jour actif et éligible**, tirage quotidien unique |
| E | Une seule reprise allégée à 2 jours / 1 victoire par mode, puis retour à A | Permanent |
| F | Comme E | Fenêtre hypothétique samedi–dimanche pour la première reprise |
| G | Une seule reprise allégée à **3 jours / 2 victoires par mode**, puis retour à A | Fenêtre hypothétique samedi–dimanche pour cette reprise |

Les fenêtres et pourcentages sont des **paramètres de recherche**, jamais un accord d'implémentation. En particulier, **G n'est pas une règle validée**.

## 3. Méthode : exposition contrôlée, pas prévision de fidélisation

Le simulateur `App/tools/simulate-drattak-eco02.js` fixe une graine **20261106** et applique les mêmes pseudo-tirages par identité/jour/mode entre scénarios. Il examine **20 000 identités fictives** pendant **90 jours après une première rencontre déjà échouée**, avec une lignée capturée et une quête initiale préalablement terminée. Tous les joueurs du modèle disposent de **trois Balls de la sorte étudiée à chaque nouvelle rencontre**.

**Hypothèses de comportement, non mesurées** : 30 % de probabilité d'être actif un jour donné ; sur un jour actif, 35 % de probabilité d'obtenir une victoire dans chacun des trois modes, indépendamment ; 15 % de chance d'un événement D lors d'une journée active où les conditions sont déjà réunies. Tous les joueurs tentent une rencontre lorsqu'elle devient accessible ; aucun abandon, achat, connexion problématique ou désaffection n'est modélisé. Les succès ne comptent qu'une fois par mode/jour, sont postérieurs à la tentative précédente et appartiennent à la fenêtre de 30 jours. Chaque scénario respecte 21 jours entre deux essais et s'arrête après une capture.

**Dénominateurs** : une identité-semaine fictive n'est **pas** un joueur réel. Ici les unités sont des **identités initialement en échec**, suivies pendant 90 jours ; les résultats ne représentent **ni l'ensemble des comptes ni les nouveaux joueurs**. Le coût « équivalent boutique » valorise les Balls effectivement consommées selon leurs prix existants. **Zéro achat et zéro débit de Pokédollars sont simulés**.

## 4. Résultats : stratégie 3 Super Balls par rencontre

| Scénario | Rencontres supplémentaires pour 1 000 échecs initiaux | Joueurs ayant réessayé | Capturés au bout de 90 jours | Attente médiane du 1er retour | Balls consommées / compte |
| --- | ---: | ---: | ---: | ---: | ---: |
| **A — actuelle** | 1 009,5 | 85,6 % | **68,9 %** | 36 jours | 2,17 |
| B — reprise courte répétée | 1 420,3 | 100,0 % | **97,5 %** | 21 jours | 3,04 |
| C — reprise courte répétée, week-end | 1 410,3 | 100,0 % | **96,8 %** | 22 jours | 3,02 |
| D — aléatoire 15 % | 1 138,0 | 94,1 % | **78,1 %** | 36 jours | 2,44 |
| E — reprise courte unique | 1 255,8 | 100,0 % | **86,2 %** | 21 jours | 2,69 |
| F — reprise unique, week-end | 1 251,5 | 100,0 % | **85,9 %** | 22 jours | 2,68 |
| **G — reprise modérée unique, week-end** | **1 191,4** | **97,8 %** | **81,6 %** | **29 jours** | **2,56** |

Avec G, la probabilité de capture **dans cette cohorte fictive déjà en échec** augmente de **12,7 points** par rapport à A ; B et C augmentent de plus de **27 points**. Dans G, l'équivalent boutique des Balls dépensées passe de **260,2 ₽ à 306,7 ₽ par compte** (+46,5 ₽ de valeur théorique consommée), **sans débit de cette somme dans le jeu**. Les retours supplémentaires impliqueraient de nouvelles occasions de shiny au taux constant 1/500, jamais une amélioration de ce taux.

### Sensibilité importante : effet des inventaires et de l'activité

Sur le même modèle d'activité :
- avec **3 Poké Balls** par nouvelle rencontre : A capture 58,7 % des échecs initiaux d'ici 90 jours et G **70,2 %** ; les résultats complets sont calculables avec le script ;
- avec **3 Hyper Balls** : la capture par rencontre monte à 84,16 % ; la capture par cohorte atteint **78,2 % (A)** et **91,0 % (G)** à 90 jours ;
- en activité hypothétique **55 % des jours et 45 % de succès par mode**, les participants remplissent déjà facilement les exigences initiales après 21 jours ; l'écart A/G devient faible. Les paramètres jouent donc **beaucoup** sur la recommandation.

La simulation ne remplace pas la mesure du nombre réel de joueurs ayant ouvert et raté Drattak, de leurs habitudes de jeu, de leurs Balls et du délai entre deux sessions. Ne jamais présenter ces résultats comme une prévision réelle de rétention ou d'achat.

## 5. Risques et garde-fous de réalisation future

- **Rareté / saturation :** B/C multiplient fortement les captures après échec à horizon 90 jours ; ils ne sont pas conseillés sans connaître les données d'engagement.
- **Aléatoire :** D ne doit pas être redessiné à chaque rafraîchissement. Il faudrait une décision durable du serveur, au plus une par identité/jour/période, avec idempotence et expiration explicite ; la frustration liée au hasard est difficile à prévoir.
- **Fenêtre :** « événement samedi–dimanche » n'est qu'un prototype d'horaire. Décider fuseau Europe/Paris, heure d'ouverture, délai, accessibilité et information des joueurs.
- **Reprise unique :** vérifier sur le serveur que la reprise réduite est utilisée une seule fois **par quête/personnage**, y compris après reconnexion, sur plusieurs appareils et malgré les doubles requêtes ; aucun drapeau client ne suffit. Ne jamais réinitialiser les rencontres ou victoires historiques pour ajouter la logique.
- **Preuve de jeu :** ne jamais autoriser une capture depuis un score déclaré ou une énigme seule. Conserver les victoires serveur postérieures à la dernière tentative et l'exigence de lignée capturée.
- **ECO-07/ECO-08 :** préparation des Balls et éventuelle conservation d'une rencontre ouverte doivent être arbitrées séparément ; **ne pas appliquer automatiquement les 72 h à Drattak**.
- **Shiny, prix, récompenses :** strictement inchangés. Aucun nouveau Pokémon cadeau, aucun tirage spécial, aucun multiplicateur.

## 6. Recommandation et arbitrage nécessaire

**A, la règle existante, reste le choix par défaut en production.** Si l'objectif est de réduire la frustration d'une quête à refaire entièrement sans banaliser Drattak, **étudier prioritairement G**, avec une seule reprise modérée et une fenêtre événementielle fixe **ou un équivalent**. E/F sont des variantes plus souples ; B/C sont trop généreuses dans les hypothèses centrales ; D ajoute de l'incertitude qui peut se retourner contre le joueur.

**Décisions du propriétaire encore nécessaires** : conserver A ou essayer un raccourci ; choisir exactement les jours/victoires de reprise, nombre de reprises et conditions de réactivation ; choisir événement fixe, aléatoire ou aucun ; définir calendrier et conservation éventuelle de la rencontre ; conserver les prérequis initiaux et le contrôle serveur (recommandé). Aucun de ces choix n'est automatiquement validé par cette PR.

## 7. Reproduction

```bash
node App/tools/simulate-drattak-eco02.js
node App/tools/simulate-drattak-eco02.js --json --seed 20261106 --players 20000 --horizon 90
node App/tools/simulate-drattak-eco02.js --players 12000 --active 0.55 --win 0.45
cd App && node --test test/expedition-eco02-drattak-simulation.test.js
```

Le simulateur est strictement **hors ligne**, lecture seule des constantes serveur. Les tests vérifient la graine, les contraintes d'accès, la fenêtre de 30 jours, le cooldown de 21 jours, les scénarios, la consommation de Balls et l'absence de Pokédollars inventés. Aucun changement de code de `App/lib/`, de `App/src/` ou de base de données.
