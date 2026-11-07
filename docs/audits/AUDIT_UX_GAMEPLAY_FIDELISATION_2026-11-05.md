# Audit de continuité Pokédle — UX, gameplay, fidélisation et diffusion

**Date de synthèse : 5 novembre 2026.**  
**Périmètre :** état du site fin octobre / début novembre 2026, lecture du code référencé au commit [b86a4e3](https://github.com/chebreub/Pokdle/commit/b86a4e3e7b6e08836c1174960864254809f40726), captures du tableau de bord arrêtées au 4 novembre et échanges de conception antérieurs.  
**Nature :** audit de consolidation et plan d'amélioration, **pas une certification** du fonctionnement sur un appareil réel. Les constats historiques plus anciens se trouvent dans [l'index des audits](README.md).

## Résumé décisionnel

Pokédle dispose **déjà** d'un catalogue fourni de modes, de jeux quotidiens, d'une Party Room, de captures sauvages et spéciales, d'un Pokédex, de Pokédollars, de quêtes et de mécaniques sociales. L'objectif n'est ni de recommencer le développement ni de multiplier mécaniquement les modes : **faire fonctionner sans friction ce qui existe, donner envie de revenir, puis rendre le partage entre amis naturel**.

Priorités :

1. **Fiabilité des interactions et de la reprise** : signalement tactile mobile, protection des séries, sauvegarde et synchronisation par compte, corrections de régressions ciblées.
2. **Jeux accessibles mais rejouables** : progression pédagogique facultative et retours utiles dans les modes les plus exigeants ; pas d'abaissement systématique de difficulté.
3. **Collection lisible** : « vu », « capturé au moins une fois », « possédé aujourd'hui », et voie d'obtention réelle.
4. **Capture et économie sans inflation** : réduire les frustrations extraordinaires (expédition / prestige) sans banaliser légendaires, shiny ou Balls.
5. **Invitation entre amis** : entrée directe dans un salon Dessine-le, défis comparables, partage volontaire d'une capture ou d'une équipe, mesure des parties effectivement engagées.

Les décisions précises, les lots et leur état sont tenus dans [PLAN_AMELIORATION_POKEDLE.md](../PLAN_AMELIORATION_POKEDLE.md), complété par [ETAT_AVANCEMENT_POKEDLE.md](../ETAT_AVANCEMENT_POKEDLE.md).

## 1. Méthode, périmètre et limites

- **Code relu / source de vérité** : fichiers App/src/…, App/lib/…, App/test/…, docs/PLAN_RARETE_1025.md et les anciennes recettes du dépôt. Pour les chiffres économiques et les règles serveur, voir l'[audit économie](AUDIT_ECONOMIE_CAPTURE_POKEDLE_2026-11-05.md).
- **Observations fournies dans la conversation** : huit captures d'administration et un export agrégé anonyme nommé pokdle-economie-2026-11-04.json ; fenêtre du **22 octobre au 4 novembre 2026 inclus**. Les captures et l'export brut **ne sont pas copiés dans ce dépôt** ; seuls des agrégats sans données identifiantes sont rapportés.
- **Retour joueur** : le problème de boutons non cliquables en bas du téléphone est un signal à reproduire, **pas un bug dont la cause est confirmée**. Le commentaire « Kokiyas / génération 9 » était une plaisanterie entre collègues et **n'est pas une plainte produit**.
- **Tests distincts de la réalité** : une lecture de code, un test Node, une émulation tactile Chromium/WebKit et une recette sur iPhone Safari sont **quatre niveaux de preuve différents**. Le test en émulation n'atteste ni le comportement exact des barres système ni le clavier réel.
- **Statut des constats** : [code] = mécanisme constaté dans la source ; [stat] = données agrégées fournies ; [signal] = retour utilisateur non reproduit ; [hypothèse] = cause ou amélioration à tester ; [déjà en place] = pas une fonctionnalité nouvelle.

## 2. Trafic et usages : ce que l'on sait

| Mesure | Valeur observée | Lecture prudente |
| --- | ---: | --- |
| Sessions | 1 123 | Pas 1 123 utilisateurs uniques |
| Ouvertures de jeux | 1 586 | Lancements, pas nécessairement parties terminées |
| Enquête | 439 | Mode le plus ouvert dans la fenêtre |
| Pokédle Illimité | 271 | Forte attraction du jeu libre |
| Higher or Lower illimité | 222 | Trois principaux modes : 932 / 1 586, soit **58,8 %** des ouvertures |
| Silhouette / Zoom | 111 | Audience plus petite que les trois premiers |
| Cri | 98 | Usage significatif pour un mode d'identification |
| Pixelisé | 91 | Mode de répétition intéressant |
| Connections | 70 | À préserver et faire découvrir |
| Stat Mystère | 54 | Faible lancement relatif |
| Stat Mystère, résultats suivis | 5 victoires sur 50 fins | **10 % parmi les fins**, pas 90 % de joueurs qui abandonnent |
| Pixelisé, résultats suivis | 70 victoires sur 79 fins | Cohorte de fins, pas taux de réussite par visiteur |
| Description, résultats suivis | 32 victoires sur 37 fins | Même réserve |
| Party Room | 17 salons créés, 13 entrées, 46 manches lancées | Compteurs de différentes unités, **pas un entonnoir de conversion** |
| Dessine-le | 24 manches | 24 / 46 des manches Party, pas 52 % des personnes |
| Partages du jeu quotidien | 5 actions | Action de partage, pas invitation effectivement acceptée |
| Arrivées via lien de défi | 15 | Ne démontre pas le lancement d'une partie |

Les autres données de rétention visibles dans le tableau de bord étaient **27 % J1** et **39 % sur sept jours**, sur une cohorte circonscrite au jeu quotidien et avec une population limitée : **ne pas les présenter comme rétention de l'ensemble de Pokédle**. Plusieurs compteurs ont été ajoutés en cours de période et ne disposent pas d'historique comparable. Les « fins de partie » et manches de certains modes peuvent dépasser les ouvertures de modes et ne constituent pas un funnel brut.

**Conséquences :** consolider d'abord les trois modes qui amènent les joueurs, puis tester des introductions légères vers les modes secondaires. Un bouton de partage ne suffit pas pour démontrer la viralité : mesurer arrivée du lien, création / entrée dans le salon, début de partie, puis retour à J1/J7 sur des cohortes matures.

## 3. Ergonomie mobile : anomalie prioritaire, non reproduite

**BUG-MOB-01 [signal] :** sur le mode « Qui est-ce ? », des cibles situées en bas de l'écran n'auraient pas réagi au toucher ; en les ramenant vers le haut par défilement, le joueur pouvait de nouveau cliquer. Le modèle de téléphone, le navigateur et l'état de la page sont inconnus.

**État de preuve :** la PR [#260](https://github.com/chebreub/Pokdle/pull/260), fusionnée, a ajouté une recette de hit-test au point touché sur Chromium et WebKit en 360, 390 et 1366 px. La CI complète passe, **mais aucune reproduction physique sur iPhone/Android n'a été effectuée**. Il n'existe donc **pas de justification** pour une correction globale de z-index, pointer-events ou du système de navigation.

**Protocole à suivre :** [docs/qa/MOBILE_TACTILE.md](../qa/MOBILE_TACTILE.md). À vérifier : overlays invisibles, panneau de chat, modales de récompenses, nav fixe, safe-area iOS, visualViewport, focus clavier, scroll interne, orientation et retour d'arrière-plan. Inspecter les éléments au point de contact avant de changer le CSS.

### Pistes ergonomiques à traiter ensuite

- **Mobile, une main :** action primaire dans une zone accessible au pouce, cibles d'au moins ~48 px, barre basse et clavier qui n'écrasent pas les commandes ; retour visible et hiérarchie des actions destructives.
- **Safari réel :** contrôle des sauts de scroll à la saisie, menu de suggestions, rotation, touches entrée/retour, clavier et gestes système.
- **PC à 1366 × 768 :** modes de grille compétitive sans scroll du plateau de jeu, informations secondaires repliables ; raccourcis contextuels sans intercepter les champs de chat.
- **Gestes facultatifs :** balayage entre fiches Pokédex et fermeture d'un panneau par poignée, avec boutons équivalents. Un éventuel glissement de Ball n'aurait **aucun** bonus de capture et ne doit pas consommer de ressources lors d'un abandon du geste.

### Ce qui existe déjà

Le projet dispose de styles mobiles dédiés, d'un dock de navigation, d'un gestionnaire visualViewport, de mécanismes prefers-reduced-motion et de traitements spécifiques de la recherche. Ne pas recréer ces éléments sans lecture préalable du code : App/mobile.css, App/src/script.01.core.js, App/src/script.10j.game-shell.js.

### Ajout du 07/11 — en-tête et fenêtres plus larges que l'écran (MOB-05)

Signalé par Kayan sur son iPhone le 07/11, avec deux captures, puis **reproduit** dans Chromium (iPhone SE, 13 et 15 Pro Max émulés, compte connecté) :

- **En-tête trop large sur téléphone.** Logo + sac (Poké Balls, Super Balls, ₽) + Paramètres + compte : 433 px pour 358 px disponibles à 390 px de large. **Le bouton du compte (avatar et menu) sortait de l'écran à droite**, sur toutes les largeurs de téléphone. Sur Safari, ce débordement laisse aussi la page glisser de côté, ce qui coupe les fenêtres (première capture).
- **Lignes de défis trop serrées.** Dans « Du nouveau dans tes défis » et « Mes défis », le texte, « 👀 Ses essais » et « ⚔️ Redéfier » étaient sur une seule ligne : le 2e bouton sortait de la fenêtre, et le texte s'écrasait à un mot par ligne.

Correctif (action **MOB-05**) :
- sous 480 px, le logo garde la Poké Ball sans le mot « Pokédle » et le sac se resserre ;
- sous 360 px, quand on est connecté, « Paramètres » quitte l'en-tête : il reste dans le menu du compte ;
- les boutons d'une ligne de défi passent sous le texte.

Il reste à confirmer sur un iPhone physique, comme pour BUG-MOB-01 : la reproduction dans Chromium ne vaut pas recette Safari.

## 4. Fiabilité et fluidité des jeux : points concrets

| Référence | Constat | Risque et action |
| --- | --- | --- |
| LOG-01 | [code corrigé] Recliquer sur 5/10/20 pouvait remettre une série à zéro | **Terminé** dans PR #261, CI verte ; ne pas refaire |
| LOG-02 | [code] Dans « Qui est-ce ? », 0 est traité comme absence de record | Corriger et tester aussi la fusion de profils et les badges de record |
| LOG-03 | [code] Filtre de difficulté solo conservé en passant « Entre amis » | PR #264 **ouverte**, ne pas déclarer terminé avant fusion |
| LOG-04 | [code à vérifier en recette] Une même mauvaise combinaison Connections peut coûter plusieurs tentatives | Refuser une seconde pénalité pour une combinaison déjà rejetée |
| SAVE-01 | [code / conception] Les séries d'identifications ne sont pas intégralement reprises après rechargement | Sauvegarder index, tirage/secret, manches et état par compte **sans fabriquer un score** |
| MEDIA-01 | [hypothèse] Échec de lecture audio du Cri | Faire réessayer l'écoute, sans consommer une tentative si aucun son n'a été délivré |
| FX-02 | [hypothèse] Plusieurs modales consécutives peuvent interrompre le rythme | Prioriser un résultat compact, puis récompenser sans emprisonner le joueur |

Les sources principales sont [script.10xm.guess-series.js](../../App/src/script.10xm.guess-series.js), [script.10u.qui-est-ce.js](../../App/src/script.10u.qui-est-ce.js), [script.08.catalog.js](../../App/src/script.08.catalog.js), [script.03.minijeux.js](../../App/src/script.03.minijeux.js) et [script.07a.profile-merge.js](../../App/src/script.07a.profile-merge.js).

**Attention :** les contrôles de longueur du nom dans le Wordle quotidien existent déjà. Le générateur de Connections et ses tests anti-ambiguïté ont déjà fait l'objet de corrections antérieures. La grille multijoueur à première réponse valable a déjà été développée. La révélation de la première lettre après cinq tentatives dans Stat Mystère existe également. **Ne pas les vendre comme nouvelles fonctionnalités à développer.**

## 5. Difficulté, rejouabilité et progression

**Stat Mystère [stat] :** seulement 5 victoires parmi 50 résultats de fin déclarés. Ce signal mérite un examen du chemin de compréhension du mode plutôt qu'une baisse globale de difficulté. Tester une introduction facultative, un exemple concret et un meilleur libellé des indices déjà disponibles ; conserver la révélation de lettre existante et mesurer les résultats par difficulté et configuration.

**Pixelisé, Cri, Zoom, Description :** les séries 5/10/20 sont déjà en place. La correction anti-redémarrage involontaire est fusionnée ; **la reprise après rechargement** reste distincte. Départager des records à résultats égaux par le nombre d'essais est une piste à simuler sans écraser les records historiques.

**Découverte :** l'accueil présente déjà un ensemble de modes et le catalogue fait déjà tourner certains contenus hebdomadaires. Faire apparaître **une** proposition secondaire tournante est préférable à un nouveau tunnel, sans modifier ni déplacer systématiquement les favoris.

## 6. Collection et aide à la progression

La présentation du Pokédex doit exposer de façon non équivoque :

- **Vu / découvert** : Pokémon enregistré via un jeu, une mission ou une autre voie de découverte.
- **Capturé au moins une fois** : la capture réelle a eu lieu, y compris si un exemplaire a été échangé ou relâché depuis.
- **Possédé maintenant** : l'inventaire courant effectivement disponible.

Ne jamais incrémenter le nombre « capturés » avec une découverte de mission. L'information **voie d'obtention** doit refléter le catalogue serveur courant : sauvage, mission de découverte, expédition, prestige, secret ou route encore absente ; pour les énigmes, ne pas divulguer la solution. Le détail de l'inventaire des **1 025 espèces** et des **62 sans route dédiée** figure dans [PLAN_RARETE_1025.md](../PLAN_RARETE_1025.md).

Suggestions non livrées : suivre jusqu'à trois espèces souhaitées **sans hausse cachée du taux**, et une vitrine facultative de six Pokémon possédés partageable sans données personnelles.

## 7. Invitations et croissance naturelle

**Point d'entrée conseillé : Dessine-le.** C'est le jeu le plus représenté dans les manches Party observées. Créer un lien donnant accès au salon et au bon jeu, avec pseudo simple et sans obligation d'inscription pour l'entrée initiale ; lien expiré = explication et alternative, pas écran mort.

Mettre en place trois boucles :

1. **Rendez-vous :** un quotidien clair, avec prochain mode proposé si la session est finie.
2. **Collection :** objectif personnel explicite, étapes de Pokédex et captures rares réellement méritées.
3. **Invitation / revanche :** partage volontaire d'un salon, défi comparable avec règles identiques côté serveur, possibilité de rejouer avec l'ami.

Une jolie carte partageable (équipe ou capture importante) peut aider, mais **ce n'est pas une campagne publicitaire en soi**. Préférer un pilote qualitatif avec quelques vrais joueurs externes puis des retours structurés, et mesurer les parties commencées / retours plutôt que les clics seuls. Ne pas imposer de création de compte au premier clic et ne pas envoyer de notifications insistantes.

## 8. Ordre de mise en œuvre recommandé

1. Terminer la PR #264 si la CI est verte et traiter LOG-02 puis LOG-04 dans leurs propres PR.
2. Étudier SAVE-01 avec migration non destructive et contrôles multi-comptes ; son impact est supérieur aux animations.
3. Reproduire BUG-MOB-01 sur **vrai téléphone** ; conserver le test automatisé comme garde-fou et corriger uniquement la cause démontrée.
4. Stat Mystère, UX des résultats, feedback Cri, lisibilité Pokédex ; mesurer de façon cohérente avant de changer la difficulté.
5. Captures / expédition / Drattak : simulation et validation des choix économiques avant toute modification serveur.
6. Invitations Dessine-le et instrumentation activation / retour ; seulement ensuite expérimentation des gestes et des animations supplémentaires.

L'ordre pourra être ajusté selon les dépendances et les retours, mais les états de tâche ne changent **qu'après fusion et vérifications**.

## 9. Références et contexte historique

- [Plan permanent et décisions](../PLAN_AMELIORATION_POKEDLE.md) ; [progrès vérifié](../ETAT_AVANCEMENT_POKEDLE.md) ; [guide de reprise](../REPRISE_NOUVEAU_CHAT.md).
- [Audit économie, rencontres et rareté du 05/11](AUDIT_ECONOMIE_CAPTURE_POKEDLE_2026-11-05.md).
- [Audit technique historique du 10/06](AUDIT_Pokedle_2026-06-10.md), [recette gameplay du 07/09](GAMEPLAY_QA_2026-09-07.md), [corrections mobiles du 07/09](MOBILE_2026-09-07.md) : **documents datés** ; leurs constats peuvent être corrigés depuis et ne doivent pas être réappliqués aveuglément.
- Code de référence au 05/11 : [catalogue des modes](../../App/src/script.08.catalog.js), [Qui est-ce ?](../../App/src/script.10u.qui-est-ce.js), [séries](../../App/src/script.10xm.guess-series.js), [profil](../../App/src/script.07a.profile-merge.js), [Game Shell](../../App/src/script.10j.game-shell.js).
- Source des chiffres de cette photographie : tableaux et export anonyme **transmis dans la conversation du 05/11** ; le dépôt ne contient pas les fichiers source bruts. Pour une nouvelle analyse quantitative, obtenir un **nouvel export agrégé** et vérifier sa fenêtre et sa version de règles.
