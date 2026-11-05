# Pokédle — mesure anonyme des modes (lot produit)

## Objectif
Aider à décider **quels modes améliorer** sur la base des usages plutôt que d'un classement supposé « populaire ».

## Périmètre
- L'API existante `POST /api/track` garde son filtrage d'événements et sa limite de requêtes.
- Les lancements de modes déjà instrumentés restent `solo:<mode>`.
- Lorsqu'un mode enregistre une manche dans l'historique via `recordMatchHistory`, le navigateur émet seulement `complete:<mode>:win|loss`.
- Les événements inconnus, les manches de Party Room et les abandons non finalisés ne doivent pas être comptés comme des parties terminées.
- Le serveur agrège les **nombres de signalements** par jour UTC et par événement dans `usage_event_daily(day,event,hits)`, sans compte, identité, navigateur, IP ni réponse de jeu.
- L'agrégat est retenu **90 jours maximum** ; nettoyage au démarrage et quotidien.
- Les statistiques continuent à être consultables uniquement sur `/admin/stats?key=...`, avec la variable Render `ADMIN_STATS_KEY`.

## Interprétation et limites
Le tableau « Modes joués » affiche les **lancements**, **fins déclarées**, **victoires** et **défaites** des 14 derniers jours. Le suivi des lancements est déjà inégal entre les différents mini-jeux ; une manche peut recommencer sans nouvel événement de lancement. Ces totaux **ne constituent pas des utilisateurs uniques, un taux de conversion ni une mesure de rétention**. Les signalements venant des navigateurs sont indicatifs et ne constituent pas des résultats de score vérifiés par le serveur.

La page indique un tiret lorsqu'un mode n'émet pas encore d'événement de fin. Les événements saisis avant le déploiement ne sont pas reconstitués : les séries commencent au moment de la mise en production.

## Confidentialité
Seuls les **totaux journaliers** sont ajoutés en base. Les compteurs existants « visiteurs uniques » utilisant un identifiant navigateur restent en mémoire, ne sont pas recopiés dans `usage_event_daily`. Aucun identifiant n'est envoyé par les nouveaux événements `complete:...`.

## Qualité
- `App/test/usage-metrics.test.js` : validation de la liste des événements, regroupement des modes, calendrier UTC, concurrence des incréments PostgreSQL et purge.
- La CI GitHub utilise une base de test isolée `QA_DATABASE_URL` ; ne jamais exécuter la suite sur la base de production.
- Après fusion validée et publication Render, contrôler dans la console `/admin/stats` que les chiffres apparaissent en jouant des manches fictives (sans comptes réels) et que les autres modes restent fonctionnels.

## Export du bilan économique anonymisé

- Depuis `/admin/stats`, bouton **Exporter le bilan anonymisé (JSON)** : génère dans le navigateur un fichier `pokdle-economie-AAAA-MM-JJ.json` à partir des seuls **agrégats déjà calculés et visibles** sur la page.
- Le rapport contient la période Europe/Paris, les totaux Pokédollars/Balls/captures, leur ventilation par catégories et les limites d'interprétation. Un champ manquant reste `null`, jamais converti en faux zéro.
- Liste blanche de propriétés : **aucune clé `ADMIN_STATS_KEY`, identifiant de joueur, cookie, action ID, nom de Pokémon, transaction brute ou réponse serveur brute** n'est exporté. Aucun nouvel appel de réseau ni stockage de données.
- Pour demander une analyse des usages réels, partager le JSON, idéalement pour les vues **3 / 7 / 30 jours**. Attention : les jours partiels et les périodes très courtes ont des effectifs parfois insuffisants ; les catégories « Autres » peuvent contenir des attributions administratives.
- L'export n'établit pas des probabilités de capture officielles, un taux de churn ni des soldes individuels ; ces inférences restent hors périmètre.

## Économie et captures — agrégats dans Admin Stats

- Les périodes économiques suivent le **jour de jeu Europe/Paris** des écritures `coin_ledger.day`, `ball_gains.day` et `wild_encounters.day`, alors que les statistiques de visites historiques restent en **UTC**. En 1j et 3j, la journée de Paris en cours est incluse ; sur les périodes longues, seules les journées closes sont incluses.
- Les chiffres viennent exclusivement des tables serveur existantes, par requêtes `SELECT` paramétrées, sans nouvelles données personnelles : **pas d'identifiant, de compte, de transaction brute ni de Pokémon possédé envoyé dans la page**. Les sources sont classées par catégories générales.
- Pokédollars : somme des **crédits positifs**, **dépenses négatives** et variation nette de la période (ne représente pas les soldes cumulés des comptes) ; la catégorie « Autres » conserve les opérations administratives et non classées, sans les présenter comme des gains de jeu.
- Balls : nombre **attribué** par type et catégorie. Les Balls achetées, bonus, cadeaux, jeux du jour et mini-jeux sont distincts. Ne pas tenter de recalculer un « stock » global par différence des périodes, car les reprises invité/compte possèdent des crédits de fusion.
- Rencontres : n'inclut que les types `wild`, `legend` et `prestige`, pas les Pokémon reçus par échange (`trade`) ni les réinitialisations administrateur. Les captures ensuite relâchées ou échangées restent des **captures ayant réellement réussi**, attribuées au **jour de rencontre**.
- Shinies **croisés** vs **capturés** ; lancers et captures ventilés par Poké/Super/Hyper Ball. « Captures par lancer » = captures réussies / Balls réellement dépensées dans les rencontres de la période. Cela **n'est pas la chance officielle de capture** : les espèces et stratégies diffèrent, et les rencontres ouvertes peuvent biaiser la période partielle.
- Les identités distinctes ayant commencé une rencontre constituent une estimation du volume d'observations, **pas un nombre de personnes uniques** (invité et compte peuvent être deux identités).
- Données indisponibles : le tableau affiche explicitement « Mesures indisponibles », jamais un zéro ou un taux fabriqué. Aucun accès sans l'authentification existante `ADMIN_STATS_KEY`.

## Tableau d'administration V2 — novembre 2026

- Périodes 1 jour (aujourd'hui UTC, **journée en cours**) et 3 jours (aujourd'hui compris) ; les périodes de 7, 14, 30 et 90 jours gardent la comparaison sur **jours UTC entièrement écoulés**.
- Le haut de page distingue sessions, navigateurs uniques **du dernier jour** (ne pas sommer les estimations quotidiennes), ouvertures de modes, fins déclarées, partages et retour des joueurs.
- Le retour du lendemain/D+7 est calculé sur une cohorte distincte de **14 jours complets** du Pokémon du jour pour rester comparable quand le filtre est 1 ou 3 jours.
- Les compteurs d'ouverture du Wordle du jour, du Dossier, de la Grille et du Wordle d'entraînement sont ajoutés progressivement. Les lancements Higher or Lower 60 s et illimité sont distincts **à compter de ce déploiement** ; avant, leurs lancements étaient mélangés. Les fins 60 s sont séparées dans le tableau de bord sans modifier la table de correspondance utilisée par les récompenses.
- Party Room : les parties de Dessine-le ! et les autres modes apparaissent en détail grâce aux événements déjà autorisés et comptés.
- **Zéro observé ≠ absence de mesure** : une valeur « — » correspond à une information indisponible ou non instrumentée ; aucune estimation de « taux d'abandon » n'est déduite du ratio fins / ouvertures.
- La mention « Page générée » indique le moment de consultation, **pas** l'heure du dernier événement en base. Actualiser le navigateur pour lire les agrégats disponibles.
- Les marqueurs restent des compteurs journaliers agrégés. Pas de suivi supplémentaire par compte, navigateur ou IP ; la clé d'administration existante reste obligatoire.

## Suivi ultérieur
Pour estimer honnêtement l'abandon, il faudra compléter les événements de démarrage et de sortie de **chaque mode**, gérer les nouveaux tours en boucle et attribuer des tentatives éphémères sans stockage personnel. Il ne faut pas calculer un « taux de fidélité » avec les compteurs actuels.
