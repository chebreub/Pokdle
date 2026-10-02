# Pokédle — suivi du plan de consolidation

État vérifié le 2 octobre 2026 sur `main` après les PR #48, #49, #50, #52, #53, #55, #56, #57 et #59.
Révision applicative de référence : `c2f473da285db76ec9918058f6c0c7a89425f52e`.

Ce document suit la fin de consolidation issue des audits précédents. Il ne sert pas de prétexte à relancer un audit général ni une refonte du produit.

## Décisions conservées

Pokédle reste un jeu clair bleu/blanc. Accueil, Jouer, Entre amis, Pokédex et Profil restent les destinations principales. L'Encyclopédie est l'entrée normale du Pokédex ; Ma collection reste accessible explicitement. Aucun nouveau système monétaire ni refonte globale n'est requis pour clôturer la consolidation principale.

R8 et les nouveaux modes restent facultatifs. Ils ne bloquent pas la reprise du développement produit une fois les derniers contrôles de production effectués.

## État par lot

| Lot | État estimé | Livré / vérifié | Reste réel |
| --- | ---: | --- | --- |
| R0 — Référence / production | ~85 % | QA Chromium reproductible à cinq largeurs, captures, tests Node/PostgreSQL et parcours multijoueur automatisés | Recette de la version réellement déployée sur Render, OAuth Discord réel, iPhone/Safari et autres appareils/réseaux réels |
| R1 — Fiabilité / frontière de confiance | ~95 % | États classement vide/erreur séparés ; timeouts/retries ; réponses tardives neutralisées ; transaction PostgreSQL + `result_key` ; retrait de l'import legacy `/api/scores` (#55) ; Daily authentifié observé par le serveur et écriture atomique du résultat (#56) ; synchronisation profil isolée par propriétaire avec garde-fou serveur et migration conservatrice (#57) ; reprise autoritative après réponse Daily perdue, snapshots de session, rejet compte/jour obsolètes et rollback lors du passage UTC (#59) | Le secret du Daily reste dérivable côté navigateur ; les autres métriques compétitives clientes restent contrôlées par bornes mais ne prouvent pas à elles seules qu'une partie a été jouée |
| R2 — Présentation | ~90 % | Barres audio, miniatures, icônes, navigation tablette, conflits CSS ciblés et contrôles de débordement | Dette CSS, contraste et clavier uniquement sur défaut reproduit ou revue dédiée |
| R3 — Accueil / catalogue | ~90 % | Daily compact, accès aux autres jeux, recherche/filtres, distinction Solo/Entre amis, recommandations et catalogue clarifiés | Regroupements Standard/PRO uniquement s'ils conservent liens, historique et records |
| R4 — Jeu / résultats / Pokédex | ~95 % | Passe résultats #49 : actions principales cohérentes, Daily vers illimité, progression Pokédex repliable, fin de partie et mobile harmonisés sans modifier les règles métier | Familles/variantes/animations uniquement sur défaut concret ou chantier produit distinct |
| R5 — Multijoueur | ~98 % | Reconnexion Party (#50), reprise sécurisée Duel/Stat Clash/Auction (#52), huit clients Chromium, Numéro mystère, transfert d'hôte et continuation (#53) | Validation réelle en production et sur appareils/réseaux variés |
| R6 — Missions / réglages / Builder | ~90 % | Systèmes existants préservés et couverts par la suite de non-régression | Ne modifier qu'après défaut reproduit ; pas de réorganisation gratuite |
| R7 — QA / performance | ~95 % | Tests Node, PostgreSQL, Chromium cinq largeurs, sombre/tablette, parcours multijoueur, audit de dépendances, contrôles de non-écriture du dépôt | Safari/Firefox, LCP/INP/CLS terrain et monitoring production |
| R8 — Extension facultative | ~20 % | Prototypes et briques expérimentales présents dans le dépôt selon les chantiers | Nouveau mode grille et autres extensions à traiter comme développement produit, pas comme dette bloquant la consolidation |

## Lecture des pourcentages

Les pourcentages restent des estimations de couverture des lots du plan, pas une métrique automatique.

- Consolidation principale **R0 à R7 : ~92 %** en moyenne.
- Si R8 est artificiellement inclus au même poids : **~84 %**.
- R8 étant explicitement facultatif, le second chiffre ne doit pas être utilisé pour décider si la base est assez stable pour reprendre les fonctionnalités.

## R1 — décisions de sécurité retenues

### Classements

L'ancien chemin `POST /api/scores`, alimenté par des données locales contrôlées par le navigateur, est retiré et répond désormais `410 legacy_score_sync_retired`.

Le flux moderne reste événementiel via `/api/leaderboard/result` et `recordLeaderboardResult(...)`, avec transaction PostgreSQL et déduplication par `result_key`.

Le mode Daily ne peut plus être déclaré directement par le navigateur via l'API générique. Pour un joueur authentifié, les propositions passent par `/api/daily/guess`, les essais sont comptés sous verrou transactionnel et la victoire Daily est enregistrée dans la même transaction que l'état de session. Depuis #59, `/api/daily/session`, `duplicate_guess` et `daily_finished` renvoient aussi l'historique autoritatif permettant de reconstruire proprement une partie après réponse réseau perdue ou reprise sur un autre appareil. Les requêtes portent le jour UTC et le compte attendus ; une requête obsolète est rejetée et un passage UTC avant commit provoque un rollback.

### Identité des sauvegardes

Les données synchronisées `profile`, `stats`, `achievements` et `teamBuilder` sont maintenant associées explicitement au compte Discord actif.

Un changement A → B :

1. met en cache l'état actif de A sous l'identité de A ;
2. n'autorise jamais cet état à être envoyé à B ;
3. restaure le cache ou l'état serveur de B ;
4. conserve séparément les données anonymes ;
5. sauvegarde un ancien état pré-migration ambigu au lieu de l'attribuer automatiquement au nouveau compte.

Le serveur refuse également une écriture `/api/profile` dont `_accountId` ne correspond pas à la session authentifiée.

### Limite volontaire du Daily

Le Daily n'est **pas encore entièrement server-authoritative** : le navigateur possède toujours assez de logique pour reproduire la cible quotidienne.

Ce risque n'est pas masqué par un HMAC client, un nonce ou un simple ticket. Une vraie fermeture demanderait de déplacer aussi la cible et le calcul de comparaison côté serveur, puis d'adapter :

- les retours de comparaison et les flèches ;
- la sauvegarde/reprise d'une manche ;
- la révélation après victoire ou abandon ;
- le Daily invité/non connecté ;
- les tests navigateur qui utilisent aujourd'hui `secretPokemon`.

Cette migration est classée **hardening compétitif futur**, pas correctif à introduire brutalement dans la fin de consolidation. Le score Daily public est déjà beaucoup plus fiable depuis #56, mais il ne faut pas présenter cela comme un anti-cheat complet.

## Validation et garde-fous

Voir `docs/qa/README.md` pour le protocole et ses limites.

Avant fusion d'un changement sensible :

1. comprendre le flux complet et la frontière de confiance ;
2. modifier le minimum nécessaire ;
3. ajouter ou adapter les tests de non-régression ;
4. exiger les workflows verts ;
5. vérifier `main` après fusion.

Les contrôles automatisés ne valent pas recette réelle de production. En particulier, Chromium CI ne prouve pas le comportement d'un iPhone/Safari réel ni d'un OAuth Discord réel sur Render.

## Ordre de fermeture

1. Vérifier que Render sert bien la révision attendue et faire les contrôles publics disponibles.
2. Effectuer une recette réelle Discord/iPhone lorsque ces moyens sont disponibles.
3. Corriger uniquement les défauts réellement reproduits.
4. Clôturer l'audit principal et reprendre les nouvelles fonctionnalités.
5. Garder le Daily entièrement server-authoritative, les métriques terrain et R8 comme chantiers distincts sauf incident concret ou besoin compétitif prioritaire.

## Critère de clôture

La consolidation principale peut être considérée comme terminée lorsque la recette production disponible ne révèle pas de régression critique :

> L'audit approfondi est terminé, les problèmes importants identifiés ont été corrigés et testés, et la base est suffisamment fiable pour reprendre le développement de nouvelles fonctionnalités.

Cette conclusion ne signifie ni « zéro bug » ni « anti-cheat parfait » ; elle signifie que les risques importants connus sont soit corrigés, soit explicitement bornés et classés dans un chantier ultérieur.
