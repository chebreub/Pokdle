# Quêtes de prestige — plan d'accès aux 62 Pokémon restants

État : **conception uniquement**. Ce fichier n'active **aucune** espèce supplémentaire et ne constitue pas une promesse de date ou de taux de capture.
Sources de vérité : `App/lib/poke-balls.js`, `App/lib/wild-rarity.js`, `App/src/script.10b.album-missions.js`, `App/src/script.11.secrets.js`, `docs/PLAN_RARETE_1025.md`.

## Objectif et invariants

- Tous les 1 025 Pokémon doivent être **obtenables à terme**. Un Pokémon légendaire ou fabuleux ne doit pas apparaître dans le tirage ordinaire des six zones.
- Préserver les **108 missions d'album historiques**, les 12 secrets et les six légendaires d'expédition. Une mission supplémentaire est introduite pour Drattak (#373) dans un lot distinct ; il passe du sauvage à la récompense de prestige.
- Les rencontres spéciales réutilisent les **taux de capture PokéAPI** et le nombre de lancers actuellement prévu. Une victoire de quête débloque une rencontre, **pas la capture garantie**, lorsqu'il s'agit d'un légendaire.
- Toutes les captures existantes, même celles d'une espèce retirée du tirage sauvage, restent possédées et consultables. La progression « Capturés » ne doit jamais atteindre un objectif impossible ; « Obtenus » garde toutes les récompenses et captures historiques.
- Les événements reviennent dans des rotations récurrentes. Une absence temporaire du joueur ne ferme pas définitivement l'accès aux 1 025 espèces.
- Les missions historiques sont fondées sur les statistiques du profil navigateur. Pour les futurs légendaires très convoités, la validation finale d'éligibilité doit être **côté serveur** ; un simple champ `localStorage` ou `POST` non vérifié ne peut pas ouvrir une capture rare.

## Première étape livrée dans le lot Drattak

**Drattak #373 (Hoenn) — Mission permanente « L'envol du dernier dragon »**

- Avoir **réclamé Métalosse #376** via sa mission de prestige `g3_metagross` ; l'avoir simplement deviné ne suffit pas.
- Avoir **42 espèces de Hoenn découvertes**.
- Avoir **12 espèces Dragon découvertes**, toutes générations.
- Avoir atteint **520 points en Draft Hoenn**.
- Après validation, le joueur réclame Drattak depuis la section des missions : il est noté comme **obtenu**, pas « capturé avec une Ball ».
- Le joueur qui possédait déjà un Drattak sauvage conserve son exemplaire et sa provenance (y compris shiny et date), même s'il réclame ensuite la mission.
- La zone Volcan et le tirage aléatoire n'incluent plus Drattak. Une rencontre déjà ouverte avant mise à jour reste résoluble.

## Les 62 autres espèces, regroupées par famille

| Famille et génération | IDs des espèces réservées | Nbre | Piste recommandée (non développée) |
| --- | --- | ---: | --- |
| **Golems, Hoenn** | 377 Regirock, 378 Regice, 379 Registeel | 3 | Trois épreuves Roche/Glace/Acier, progressives, compte identifié, éligibilité serveur |
| **Dragon Éon, Hoenn** | 381 Latios | 1 | Expédition Éon distincte de Latias #380, après exploration Hoenn et plusieurs participations |
| **Gardiens des lacs, Sinnoh** | 480 Créhelf, 481 Créfollet, 482 Créfadet | 3 | Trois quêtes Savoir/Émotion/Volonté, rotation récurrente |
| **Regigigas, Sinnoh** | 486 Regigigas | 1 | Verrouillage après acquisition des trois golems d'Hoenn |
| **Océan et jardin, Sinnoh** | 489 Phione, 490 Manaphy, 492 Shaymin | 3 | Quêtes mythiques saisonnières récurrentes, sans loot de zone |
| **Lames sacrées, Unys** | 638 Cobaltium, 640 Viridium, 647 Keldeo | 3 | Épreuves accompagnant Terrakium #639 (expédition existante), maîtrise Combat et Acier |
| **Génies, Unys** | 641 Boréas, 642 Fulguris, 645 Démétéros | 3 | Rotation des génies puis confrontation finale |
| **Chant ancien, Unys** | 648 Meloetta | 1 | Quête secrète sur plusieurs modes sonores/musicaux, progression permanente |
| **Kalos** | 721 Volcanion | 1 | Quête de maîtrise Eau/Feu exigeante, opportunité périodique |
| **Gardiens, Alola** | 786 Tokopiyon, 787 Tokotoro, 788 Tokopisco | 3 | Épreuves de trois îles distinctes après Tokorico #785 |
| **Origines, Alola** | 772 Type:0, 789 Cosmog, 790 Cosmovum | 3 | Recherche du laboratoire et filière cosmique conditionnant d'autres quêtes |
| **Ultra-Brèches, Alola** | 793-799, 803-806 | 11 | Rotation d'Ultra-Brèches, conditions serveur, capture non garantie |
| **Mythiques, Alola** | 801 Magearna, 807 Zeraora, 808 Meltan, 809 Melmetal | 4 | Quêtes dédiées (Meltan avant Melmetal), retours périodiques |
| **Voie de l'armure, Galar** | 891 Wushours, 892 Shifours | 2 | Deux niveaux de maîtrise, récompenses distinctes, pas d'évolution automatique côté client |
| **Forêts et ruines, Galar** | 893 Zarude, 895 Regidrago | 2 | Zarude : quête forêt ; Regidrago : filière Regi avancée |
| **Couronne, Galar** | 896 Blizzeval, 897 Spectreval, 898 Sylveroy | 3 | Légendaires du Nord, dépendances entre quêtes |
| **Dernier génie, Galar** | 905 Amovénus | 1 | Quête des trois génies d'Unys avant accès |
| **Trésors, Paldea** | 1002 Baojian, 1003 Dinglu, 1004 Yuyu | 3 | Quêtes des sceaux après Chongjian #1001 (expédition existante) |
| **Passé et futur, Paldea** | 1009, 1010, 1020-1023 | 6 | Épreuves Paradoxes à progression durable, non dans les herbes |
| **Trio Loyal, Paldea** | 1014 Félicanis, 1015 Fortusimia, 1016 Favianos | 3 | Trois épreuves complémentaires et répétables |
| **Masque et pêche, Paldea** | 1017 Ogerpon, 1025 Pêchaminus | 2 | Quêtes narratives de fin de progression, sans événement à usage unique |
| **Total** | | **62** | |

Les 62 espèces ci-dessus correspondent aux `unassigned` de `ACQUISITION_CATALOGUE` au moment du lot Drattak. Aucun Pokémon déjà réservé à une mission/secret ou aux six expéditions n'est ajouté à ces groupes.

## Plan de réalisation proposé (PRs indépendantes)

1. **Drattak** : mission permanente de prestige et retrait du sauvage, historique conservé, tests de régression (lot en cours).
2. **Premier groupe de légendaires** : Regirock, Regice, Registeel. Ajouter la mécanique de preuve serveur pour les quêtes légendaires, puis seulement les trois rencontres conditionnelles ; ne pas lier le déblocage à un résultat navigateur librement modifiable.
3. **Regigigas / Latios** : chaîne Hoenn/Sinnoh et rotation des expéditions avec accès régulier, sans augmenter les récompenses monétaires existantes.
4. **Sinnoh / Unys / Kalos** : familles thématiques, progression multi-semaine, rareté stable.
5. **Alola, Galar, Paldea** : Ultra-Brèches et Paradoxes (probablement des interfaces dédiées) et quêtes récurrentes.
6. **Bouclage à 1 025** : audit d'exhaustivité automatique par ID, QA mobile, anti-abus, taux d'accès et simulations de durée de complétion.

### Garde-fous sur le futur serveur

- Éligibilité mesurée par des événements authentifiés, datés et persistés ; pas de `score`, `completed: true` ou `pokemonId` librement accepté pour attribuer une espèce réservée.
- Un seul ticket par compte/période et par famille, rejouabilité prévue sans duplication gratuite. Transactions atomiques, contrainte d'unicité et idempotence.
- Si le taux de capture est officiel, le serveur garde l'aléatoire et dépense réellement la Ball (3 lancers maximum), sans Master Ball ni probabilité artificiellement élevée.
- La capture n'est **jamais** attribuée automatiquement lorsqu'une requête d'animation échoue : l'API doit permettre une lecture/reprise d'état sans double gain.
- Mesurer les durées réelles et corriger la difficulté **avant** d'ouvrir une nouvelle famille. Ne pas rendre la collection impossible pour un joueur ayant manqué une rotation.
