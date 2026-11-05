# Pokédle — Plan d’amélioration et registre de reprise

> **Référence opérationnelle** pour poursuivre ce chantier dans un autre chat, sans réaudit ni perte des décisions.  
> Créé le **5 novembre 2026** depuis `main` `714b41d13cd905936f257b0e59497f2a30b23d4c` (PR #259).  
> **Statut de suivi au 05/11/2026 : LOG-02 en PR, CI à vérifier. LOT 0 — infrastructure de diagnostic intégrée (#260) ; anomalie tactile NON reproduite sur téléphone réel. LOT 1 — LOG-01 (#261) et LOG-03 (#264) intégrés avec CI vertes.**

**Progression vérifiée : 2 tâches terminées / 43 actives = 4,7 %.** Deux actions en cours (BUG-MOB-01, LOG-02), 39 non commencées ; NIV-01 est stationné et exclu du total. Voir [état d'avancement](ETAT_AVANCEMENT_POKEDLE.md). Les 43 tâches n'ont pas le même poids : ce ratio compte des cases clôturées, pas des heures ou la maturité globale du site.

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
- Toute modification économique ou de progression serveur doit être examinée séparément et faire l'objet de simulations/tests ; les propositions chiffrées ci-dessous ne sont **pas des décisions de mise en production**.
- Un geste iPhone est facultatif et ne remplace jamais les boutons accessibles, ni ne valide une dépense, une fuite, un abandon ou un relâchement caché.
- On vise un **partage lié à une activité** (Dessine-le, défi comparable, collection), pas des sollicitations répétitives.

## Prochaine action (une seule prioritaire)

**BUG-MOB-01 — Identifier le blocage tactile en bas d'écran avant de toucher aux couches CSS.**

Ce P0 dépend d'une **reproduction sur appareil réel**, encore absente. **Prochaine action de développement pouvant avancer sans cette preuve : terminer LOG-02 puis traiter LOG-04** dans une PR séparée. Ne pas bloquer les autres lots à cause d'une hypothèse tactile ni marquer le P0 résolu.

Signalement du 04/11/2026, écran « Qui est-ce ? » et possiblement d'autres jeux : sur téléphone, des cibles en bas ne répondent pas, mais deviennent cliquables lorsqu'on les fait remonter en défilant. Navigateur et modèle **non connus**. Cause **non reproduite et non identifiée**.

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
- [~] **BUG-MOB-01 · P0** : diagnostiquer zone basse non cliquable sur téléphone. Source réelle à confirmer.
- [ ] **MOB-02 · P0** : nettoyer les calques invisibles/effets *uniquement si identifiés comme cause* ; éviter tout patch global de `pointer-events` ou `z-index`.
- [ ] **DATA-01 · P0** : documenter grain des événements ouverture/partie/manche/fin et date de début du suivi ; ne pas reconstruire l'historique fictivement.
- [ ] **MOB-03 · P1** : rendre l'action principale accessible au pouce, sans empilement clavier + dock + chat + récompense.
- [ ] **MOB-04 · P1** : contrôle de focus et scroll dans les jeux rapides, Safari réel.
- [ ] **PC-01 · P1** : jeu et panneau secondaire à 1366×768 ; Course au Pokédex sur une grille desktop sans scroll de jeu.
- [ ] **PC-02 · P1** : Entrée, flèches, Échap dans le contexte du jeu, sans intercepter les messages du chat.

### Lot 1 — Logique, reprise, données
- [x] **LOG-01 · P1** : choix 5/10/20 sans réinitialisation si valeur identique ; confirmation et conservation de l'état/préférence si changement refusé. PR [#261](https://github.com/chebreub/Pokdle/pull/261), **CI Node et navigateurs vertes**, fusionnée au commit `646d83c`.
- [~] **LOG-02 · P1** : record « Qui est-ce ? » à 0 question distingué de l'absence de record via indicateur explicite, fusion multi-appareils et affichage. Correctif en PR, **tests CI / fusion à vérifier**.
- [x] **LOG-03 · P1** : filtre solo du catalogue ne masque pas la Party Room lors du passage « Entre amis ». [PR #264](https://github.com/chebreub/Pokdle/pull/264), CI Node et navigateur **vertes**, fusionnée au commit `cfa0d021`.
- [ ] **LOG-04 · P1** : une combinaison erronée Connections déjà soumise ne coûte pas une deuxième erreur.
- [ ] **SAVE-01 · P1** : conserver série entière (ex. relance à la manche 6) sans mélange entre comptes.
- [ ] **FX-02 · P1** : éviter la succession de modales gain/capture/niveau et vérifier que leurs animations ne capturent pas les clics.
- [ ] **DATA-02 · P1** : séparer test/admin et vraie activité produit sans effacer les journaux.
- [ ] **DATA-04 · P1** : rétention J1/J7 sur cohortes matures ; « retour Pokémon du jour » ≠ rétention globale.

### Lot 2 — Gameplay, maîtrise et découverte
- [ ] **NIV-02 · P1** : aide pédagogique facultative pour Stat mystère ; conserver la 1re lettre déjà révélée après 5 essais. Signal 5/50 victoires parmi fins déclarées.
- [ ] **SER-01 · P1** : pilote Pixelisé : records départagés par trouvés puis essais, sans falsifier les anciens scores, avec passes définies.
- [ ] **MEDIA-01 · P1** : panne de lecture du Cri ne cause pas de défaite imposée.
- [ ] **DISC-01 · P2** : une carte de découverte tournante, sans déplacer les favoris ni refaire l'accueil.
- [ ] **DISC-02 · P2** : mieux varier les missions existantes, sans nouveaux gains ni liste quotidienne obligatoire.
- [ ] **NIV-01 · STATIONNÉ** : proposition initiale de « mes générations » dans Qui est-ce non motivée par un vrai retour ; **ne pas programmer à partir de la plaisanterie Kokiyas**.

### Lot 3 — Pokédex et collection
- [ ] **DEX-01 · P1** : vu/découvert, déjà capturé, possédé actuellement clairement distingués.
- [ ] **DEX-02 · P1** : montrer les voies d'obtention vraies ; document actuel `docs/PLAN_RARETE_1025.md` = 852 espèces capturables, 173 non capturables maintenant.
- [ ] **DEX-03 · P1** : suivre jusqu'à 3 cibles personnelles, sans changer les probabilités ni divulguer les secrets.
- [ ] **DEX-04 · P2** : vitrine optionnelle de 6 Pokémon détenus et objectif proche ; partage volontaire.

### Lot 4 — Économie et rencontres **à simuler avant approbation**
- [ ] **ECO-01 · P1 · PROPOSITION** : nouvelle occasion limitée pour l'expédition légendaire, sans capture garantie, contrôlée serveur.
- [ ] **ECO-02 · P1 · PROPOSITION** : après fuite de Drattak, conserver une partie du travail et proposer une reprise contrôlée plutôt que remise à zéro intégrale.
- [ ] **ECO-07 · P1 · PROPOSITION** : préparation explicite des rencontres de prestige (au moins 3 Balls avant ouverture, chances visibles, annulation sans perdre la piste).
- [ ] **ECO-08 · P1 · PROPOSITION** : rencontre spéciale ouverte conservée 72 h, sans nouveau tirage ni nouveau stock gratuit.
- [ ] **ECO-05 · P1** : instrumenter la version des règles (`shiny 1/150` vs `1/500`), cible, Ball, ordre du lancer et type de rencontre, en agrégats.
- [ ] **ECO-03 · P2 · PROPOSITION** : 30/60/90 ₽ = meilleur palier journalier complété par différence, plafond 90/mode, idempotence.
- [ ] **ECO-04 · P2 · PROPOSITION** : coffres d'expédition acquis crédités une seule fois même si pas ouverts immédiatement.
- [ ] **ECO-06 · P2** : vérifier la réelle autorité serveur des récompenses pour chaque mode prioritaire.

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
- Pour reprendre : **vérifier le dernier `main` et la PR #264**, puis attaquer LOG-02 (record zéro « Qui est-ce ? ») ou SAVE-01 en lot isolé, après lecture des fichiers et tests existants. BUG-MOB-01 demeure en attente d'une reproduction sur iPhone réel ; ne pas le « réparer » au jugé.

## Journal d'avancement (à mettre à jour dans les PR)

| Date | Lot | Fait | Vérification | PR |
|---|---|---|---|---|
| 2026-11-05 | 0 | Plan permanent, protocole et tests Chromium/WebKit des coordonnées tactiles ; **aucun correctif CSS** | Node + suite navigateur **vertes**, PR fusionnée ; aucune reproduction Safari iPhone réel ; bug toujours ouvert | [#260](https://github.com/chebreub/Pokdle/pull/260), commit `000728c` |
| 2026-11-05 | 1 | Anti-réinitialisation des séries 5/10/20 ; confirmation si changement en cours ; cinq tests Node | **Tests Node et suite navigateur complets verts**, PR fusionnée ; aucune nouvelle règle de capture | [#261](https://github.com/chebreub/Pokdle/pull/261), commit `646d83c` |

## Suivi de la PR #264 (au dernier contrôle du 05/11/2026)

- **LOG-03 est [x]** : [PR #264](https://github.com/chebreub/Pokdle/pull/264) fusionnée (`cfa0d021`), [CI Node](https://github.com/chebreub/Pokdle/actions/runs/42024332274) et [CI navigateur](https://github.com/chebreub/Pokdle/actions/runs/42024332512) vertes. Merge confirmé le 05/11/2026.
- Progression après fusion : **2/43 = 4,7 %** ; prochaine action LOG-02.
- Ce lot documentaire **n'implémente aucune mécanique de jeu** et n'ajoute pas de tâche [x] au décompte.

### En cours — LOG-02

- [PR #266](https://github.com/chebreub/Pokdle/pull/266) : record zéro, fusion multi-appareils, affichage et tests ciblés. CI et fusion à vérifier sur le dernier commit ; **progression inchangée à 2/43 = 4,7 %** tant que non fusionnée.
- Prochaine action après clôture : LOG-04 ; BUG-MOB-01 nécessite toujours une reproduction réelle.

## Prompt minimal pour un nouveau chat

> **Prompt complet et directement copiable : [REPRISE_NOUVEAU_CHAT.md](REPRISE_NOUVEAU_CHAT.md).** Pour une reprise autonome, lire les deux audits et l'état d'avancement avant d'ouvrir une PR.
>
> Reprends `chebreub/Pokdle` depuis le dernier `main`, lis `docs/PLAN_AMELIORATION_POKEDLE.md` et `docs/qa/MOBILE_TACTILE.md`, puis compare les PR fusionnées depuis le dernier journal. Continue la prochaine tâche ouverte avec changements minimaux, tests et PR. Ne réaudite pas tout. Respecte les statuts et les décisions, notamment la correction de l'anecdote Kokiyas, les sauvegardes et l'autorité serveur. Termine par la mise à jour du plan et un bilan « fait / testé / non vérifié en production / prochaine action ».
