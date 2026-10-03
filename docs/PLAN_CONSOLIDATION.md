# Pokédle — suivi du plan de consolidation

**Statut : consolidation principale R0–R7 clôturée le 3 octobre 2026.**

État vérifié sur `main` après les PR #48, #49, #50, #52, #53, #55, #56, #57, #59, #61 et #62.
Révision applicative de clôture : `eb6448efb2ac81e3c775eae9c89aa449c5d3abda`.

Ce document suit la fin de consolidation issue des audits précédents. Il ne sert pas de prétexte à relancer un audit général ni une refonte du produit.

## Décisions conservées

Pokédle reste un jeu clair bleu/blanc. Accueil, Jouer, Entre amis, Pokédex et Profil restent les destinations principales. L'Encyclopédie est l'entrée normale du Pokédex ; Ma collection reste accessible explicitement. Aucun nouveau système monétaire ni refonte globale n'est requis pour clôturer la consolidation principale.

R8 et les nouveaux modes restent facultatifs. Ils ne bloquent pas la reprise du développement produit.

## État par lot

| Lot | État estimé | Livré / vérifié | Reste réel |
| --- | ---: | --- | --- |
| R0 — Référence / production | ~95 % | QA Chromium reproductible à cinq largeurs, captures, tests Node/PostgreSQL, parcours multijoueur automatisés ; recette réelle Render sur iPhone/Safari avec OAuth Discord, Daily, profil et Party Room | Étendre seulement si utile à d'autres appareils/réseaux réels et navigateurs |
| R1 — Fiabilité / frontière de confiance | ~97 % | États classement vide/erreur séparés ; timeouts/retries ; réponses tardives neutralisées ; transaction PostgreSQL + `result_key` ; retrait de l'import legacy `/api/scores` (#55) ; Daily authentifié observé par le serveur et écriture atomique (#56) ; synchronisation profil isolée par propriétaire (#57) ; reprise autoritative Daily et rollback UTC (#59) ; arrêt de la boucle de rechargement profil et neutralisation des écritures `pagehide` pendant restauration (#61) | Le secret du Daily reste dérivable côté navigateur ; scénario réel A → B → A non exécuté faute de deuxième compte Discord, mais couvert automatiquement |
| R2 — Présentation | ~90 % | Barres audio, miniatures, icônes, navigation tablette, conflits CSS ciblés et contrôles de débordement | Dette CSS, contraste et clavier uniquement sur défaut reproduit ou revue dédiée |
| R3 — Accueil / catalogue | ~90 % | Daily compact, accès aux autres jeux, recherche/filtres, distinction Solo/Entre amis, recommandations et catalogue clarifiés | Regroupements Standard/PRO uniquement s'ils conservent liens, historique et records |
| R4 — Jeu / résultats / Pokédex | ~95 % | Passe résultats #49 : actions principales cohérentes, Daily vers illimité, progression Pokédex repliable, fin de partie et mobile harmonisés ; HUD classement remis en cohérence avec le mode et le compteur courant/final (#61) | Familles/variantes/animations uniquement sur défaut concret ou chantier produit distinct |
| R5 — Multijoueur | ~99 % | Reconnexion Party (#50), reprise sécurisée Duel/Stat Clash/Auction (#52), huit clients Chromium, Numéro mystère, transfert d'hôte et continuation (#53) ; reprise Party atomique lors de la course entre ancien/nouveau socket et récupération via ancien lien après fermeture d'onglet (#62) ; recette réelle Party réussie en production | Variété supplémentaire d'appareils/réseaux uniquement si un incident concret apparaît |
| R6 — Missions / réglages / Builder | ~90 % | Systèmes existants préservés et couverts par la suite de non-régression | Ne modifier qu'après défaut reproduit ; pas de réorganisation gratuite |
| R7 — QA / performance | ~96 % | Tests Node, PostgreSQL, Chromium cinq largeurs, sombre/tablette, parcours multijoueur, audit de dépendances, contrôles de non-écriture du dépôt ; recette iPhone/Safari réelle | Firefox, LCP/INP/CLS terrain et monitoring production restent des chantiers dédiés |
| R8 — Extension facultative | ~20 % | Prototypes et briques expérimentales présents dans le dépôt selon les chantiers | Nouveau mode grille et autres extensions à traiter comme développement produit, pas comme dette bloquant la consolidation |

## Lecture des pourcentages

Les pourcentages restent des estimations de couverture des lots du plan, pas une métrique automatique.

- Consolidation principale **R0 à R7 : ~94 %** en moyenne.
- Si R8 est artificiellement inclus au même poids : **~86 %**.
- R8 étant explicitement facultatif, le second chiffre ne doit pas être utilisé pour décider si la base est assez stable pour reprendre les fonctionnalités.

La clôture ne dépend pas d'un objectif artificiel de 100 %. Elle dépend de l'absence de régression critique connue dans la recette disponible et du classement explicite des risques résiduels.

## R1 — décisions de sécurité retenues

### Classements

L'ancien chemin `POST /api/scores`, alimenté par des données locales contrôlées par le navigateur, est retiré et répond désormais `410 legacy_score_sync_retired`.

Le flux moderne reste événementiel via `/api/leaderboard/result` et `recordLeaderboardResult(...)`, avec transaction PostgreSQL et déduplication par `result_key`.

Le mode Daily ne peut plus être déclaré directement par le navigateur via l'API générique. Pour un joueur authentifié, les propositions passent par `/api/daily/guess`, les essais sont comptés sous verrou transactionnel et la victoire Daily est enregistrée dans la même transaction que l'état de session. Depuis #59, `/api/daily/session`, `duplicate_guess` et `daily_finished` renvoient aussi l'historique autoritatif permettant de reconstruire proprement une partie après réponse réseau perdue ou reprise. Les requêtes portent le jour UTC et le compte attendus ; une requête obsolète est rejetée et un passage UTC avant commit provoque un rollback.

La recette réelle du 3 octobre a confirmé la conservation d'une partie Daily terminée, la cohérence entre résultat et nombre d'essais, ainsi que l'affichage final du classement sur iPhone/Safari.

### Identité des sauvegardes

Les données synchronisées `profile`, `stats`, `achievements` et `teamBuilder` sont associées explicitement au compte Discord actif.

Un changement A → B :

1. met en cache l'état actif de A sous l'identité de A ;
2. n'autorise jamais cet état à être envoyé à B ;
3. restaure le cache ou l'état serveur de B ;
4. conserve séparément les données anonymes ;
5. sauvegarde un ancien état pré-migration ambigu au lieu de l'attribuer automatiquement au nouveau compte.

Le serveur refuse une écriture `/api/profile` dont `_accountId` ne correspond pas à la session authentifiée.

#61 a également supprimé la boucle de restauration observée en production : une navigation déclenchée par la restauration désactive les écritures de synchronisation avant que `pagehide` puisse renvoyer le blob restauré avec un timestamp plus récent. La recette réelle a confirmé une connexion Discord stable et une sauvegarde de profil conservée.

Le scénario réel A → B → A n'a pas été exécuté, faute de deuxième compte Discord disponible pendant la recette. Il reste couvert par les tests automatisés et ne bloque pas la clôture.

### Limite volontaire du Daily

Le Daily n'est **pas encore entièrement server-authoritative** : le navigateur possède toujours assez de logique pour reproduire la cible quotidienne.

Ce risque n'est pas masqué par un HMAC client, un nonce ou un simple ticket. Une vraie fermeture demanderait de déplacer aussi la cible et le calcul de comparaison côté serveur, puis d'adapter :

- les retours de comparaison et les flèches ;
- la sauvegarde/reprise d'une manche ;
- la révélation après victoire ou abandon ;
- le Daily invité/non connecté ;
- les tests navigateur qui utilisent aujourd'hui `secretPokemon`.

Cette migration est classée **hardening compétitif futur**, pas dette bloquant la consolidation clôturée.

## R5 — décision de reprise Party

La recette réelle a révélé après #61 une course spécifique Safari : après actualisation d'un invité, le nouveau socket pouvait se connecter avant que l'ancien soit marqué déconnecté. `party:resume` rejetait alors la reprise comme « session déjà active », puis le client effaçait le jeton.

#62 corrige ce flux :

- le jeton opaque possède la place et permet le transfert atomique vers le socket de remplacement ;
- le score, la manche, le roster, les données privées concernées et le rôle d'hôte sont conservés ;
- l'ancien socket est détaché après transfert ;
- une copie locale persistante du jeton permet de fermer l'onglet puis de rouvrir l'ancien lien pendant la fenêtre de reprise ;
- les erreurs transitoires ne détruisent plus le jeton ; les erreurs terminales/expirations le nettoient.

La recette production après déploiement a confirmé : invité → actualisation → même room, créateur toujours présent, puis fermeture de l'onglet → réouverture de l'ancien lien → récupération de la même Party Room.

## Validation et garde-fous

Voir `docs/qa/README.md` pour le protocole et ses limites.

Avant fusion d'un changement sensible :

1. comprendre le flux complet et la frontière de confiance ;
2. modifier le minimum nécessaire ;
3. ajouter ou adapter les tests de non-régression ;
4. exiger les workflows verts ;
5. vérifier `main` après fusion.

La fin de consolidation a combiné revue de code, tests automatisés et recette réelle. Ces niveaux restent distincts : un test Chromium CI ne remplace pas un iPhone/Safari réel, et une recette réelle ponctuelle ne garantit pas tous les appareils et réseaux.

## Recette de clôture — 3 octobre 2026

Validé en production réelle :

- OAuth Discord : connexion stable, sans boucle de rechargement après #61 ;
- sauvegarde profil : état conservé après fermeture/réouverture ;
- Daily : partie restaurée, historique/résultat conservés, compteur final cohérent avec le classement ;
- Party Room : invité et créateur présents, actualisation de l'invité sans destruction de la room après #62 ;
- Party Room : fermeture de l'onglet invité puis réouverture par l'ancien lien avec récupération réussie de la place.

Non exécuté en recette réelle faute de moyen disponible : changement de compte Discord A → B → A. Ce point ne bloque pas la clôture car l'isolation est couverte par la logique serveur/client et les tests automatisés.

## Clôture

La consolidation principale **R0–R7 est clôturée** à la révision `eb6448efb2ac81e3c775eae9c89aa449c5d3abda`.

Le critère de clôture est satisfait :

> L'audit approfondi est terminé, les problèmes importants identifiés ont été corrigés et testés, et la base est suffisamment fiable pour reprendre le développement de nouvelles fonctionnalités.

Cette conclusion ne signifie ni « zéro bug » ni « anti-cheat parfait ». Les éléments suivants restent volontairement hors clôture et doivent être traités comme des chantiers séparés : Daily entièrement server-authoritative, métriques terrain LCP/INP/CLS, monitoring production, couverture Firefox/appareils supplémentaires et R8/nouveau mode grille.
