# Plan de rareté et voies d'obtention — 1 025 Pokémon

**Statut :** pondération des rencontres livrée ; première voie de prestige dédiée ajoutée pour Drattak (#373). Les 62 autres voies manquantes restent un **backlog**, sans déblocage implicite.

## Source de vérité au 4 novembre 2026

Classement construit à partir des données existantes dans `App/lib/poke-balls.js`, `App/capture-rates.json`, `App/src/script.10b.album-missions.js`, `App/src/script.11.secrets.js` et `App/lib/daily-grid.js`.

| Route d'obtention | Nombre d'espèces | Règle |
| --- | ---: | --- |
| Hautes herbes ordinaires | 845 | Les espèces autorisées, **sans Drattak**, désormais réservé à sa mission |

| Récompenses de missions d'album | 109 | Les 108 missions d'origine et la quête supplémentaire Drattak |
| Légendaires d'expédition hebdomadaire | 6 | Garder l'éligibilité, les lancers, les taux et la fréquence actuels |
| Récompenses secrètes **hors autres routes** | 3 | Mew, Celebi, Jirachi (les 12 secrets restent inchangés) |
| Aucune voie d'obtention dédiée à ce jour | **62** | Réserver à des quêtes/événements/épreuves ultérieurs |
| **Total national** | **1 025** | Chaque numéro est compté une fois |

Attention : « Vus » dans le Pokédex n'est pas équivalent à « capturés » ni à « gagnés par une mission ». Ne pas afficher `1025/1025 attrapés` tant que les routes ci-dessus sont différentes.

## Rareté sauvage pondérée

Le tirage auparavant uniforme dans `WILD_POOL` et dans chacune des six zones est désormais pondéré **côté serveur**. Les taux de capture restent ceux de PokéAPI : les nombres suivants sont des poids d'**apparition inventés pour Pokédle**, pas des taux officiels.

| Classe de rencontre | Critère sur le taux de capture officiel* | Poids | Espèces du pool sauvage |
| --- | --- | ---: | ---: |
| Commun | ≥ 190 | 36 | 223 |
| Peu commun | 100–189 | 18 | 131 |
| Rare | 60–99 | 8 | 186 |
| Très rare | 25–59 | 3 | 301 |
| Fuyant (capture difficile) | 1–24 | 16 | 4 |

| **Total** | | **12 841 unités** (toutes espèces) | **845** |

*Le taux de capture officiel n'est qu'un indicateur imparfait de rareté d'apparition. Les starters, évolutions et espèces populaires devront être revus manuellement. Exception volontaire : les quatre espèces ayant un taux officiel de 3 (Terhal, Métang, Pondralugon et Pomdorochi) ont un poids d'apparition compensateur de 16 : leur capture est déjà extrêmement difficile, il ne faut pas cumuler deux barrières excessives. Les chances de réussir un lancer de Ball restent strictement inchangées.*

Exemple : une espèce commune (poids 36) apparaît 12 fois plus souvent qu'une espèce très rare (poids 3), à pool et zone identiques. Drattak ne fait plus partie des tirages sauvages : il nécessite sa quête de prestige, sans altérer les captures historiques. **Ces fréquences ne sont pas des garanties de rencontre.**

Invariant : l'ensemble des espèces autorisées **ne change pas** ; seuls leurs poids changent. Un légendaire exclu, une mission ou un Pokémon réservé ne peut pas entrer dans une zone via ce mécanisme.

## Pseudo-légendaires (neuf générations, dix espèces)

- Dracolosse #149 : mission
- Tyranocif #248 : mission
- Drattak #373 : **mission de prestige Hoenn** après obtention de Métalosse, 42 découvertes Hoenn, 12 Dragon et Draft Hoenn ≥ 520
- Métalosse #376 : mission
- Carchacrok #445 : mission
- Trioxhydre #635 : mission
- Muplodocus #706 : mission
- Ékaïser #784 : mission
- Lanssorien #887 : mission
- Glaivodo #998 : mission

Ne pas ajouter ces Pokémon aux rencontres sauvages communes. Drattak possède désormais une voie permanente ; les joueurs qui l'avaient capturé avant ce changement gardent leur exemplaire.

## 62 espèces sans voie dédiée : backlog par génération

### Hoenn — 4
Regirock #377, Regice #378, Registeel #379, Latios #381.

### Sinnoh — 7
Créhelf #480, Créfollet #481, Créfadet #482, Regigigas #486, Phione #489, Manaphy #490, Shaymin #492.

### Unys — 7
Cobaltium #638, Viridium #640, Boréas #641, Fulguris #642, Démétéros #645, Keldeo #647, Meloetta #648.

### Kalos — 1
Volcanion #721.

### Alola — 21
Type:0 #772, Tokopiyon #786, Tokotoro #787, Tokopisco #788, Cosmog #789, Cosmovum #790, Zéroïd #793, Mouscoto #794, Cancrelove #795, Câblifère #796, Bamboiselle #797, Katagami #798, Engloutyran #799, Magearna #801, Vémini #803, Mandrillon #804, Ama-Ama #805, Pierroteknik #806, Zeraora #807, Meltan #808, Melmetal #809.

### Galar — 8
Wushours #891, Shifours #892, Zarude #893, Regidrago #895, Blizzeval #896, Spectreval #897, Sylveroy #898, Amovénus #905.

### Paldea — 14
Baojian #1002, Dinglu #1003, Yuyu #1004, Serpente-Eau #1009, Vert-de-Fer #1010, Félicanis #1014, Fortusimia #1015, Favianos #1016, Ogerpon #1017, Feu-Perçant #1020, Ire-Foudre #1021, Roc-de-Fer #1022, Chef-de-Fer #1023, Pêchaminus #1025.

## Pistes de voies futures (non implémentées)

1. **Quêtes régionales permanentes** pour les trios de gardiens, génies et oiseaux, sans date limite définitive.
2. **Expéditions de prestige** pour les légendaires exclus de la rotation actuelle : participation sur plusieurs semaines, rencontre conditionnelle, sans capture automatique.
3. **Exploration des Ultra-Brèches** pour les Ultra-Chimères : épreuves d'Alola avec fréquence limitée.
4. **Filières légendaires spécialisées** (Wushours/Shifours, Cosmog/Cosmovum, Paradoxes) plutôt qu'un tirage sauvage indifférencié.
5. **Événements récurrents** pour les fabuleux, avec occasion de retour pour un joueur qui manque un événement.
6. **Quête dédiée Drattak : livrée**, avec objectifs de prestige hérités du moteur d'album. Ne pas accorder de cadeau automatique aux joueurs n'ayant pas accompli sa mission.

## Garde-fous / non-régression

- Ne pas modifier `captureChance`, les taux officiels, les trois lancers, le shiny à 1/150, ni les 24 rencontres disponibles par jour.
- Conserver les six zones et la totalité des 108 missions d'album d'origine, plus la nouvelle mission de Drattak, sans migrations/destructions de sauvegarde.
- Le tirage côté serveur utilise un seul entier aléatoire sur la somme des poids, puis une recherche cumulative.
- Vérifier les tailles des pools et les bornes (tirage premier et dernier ticket), et préserver les rencontres ouvertes pendant les transitions de version.
- Tant que les 62 espèces n'ont pas de route, ne pas promettre que la collection des 1 025 est **déjà** complétable.
- La progression « Vus / Capturés / Obtenus » est livrée. Depuis la quête Drattak : **851 espèces actuellement capturables** (845 sauvages + 6 expéditions) ; les anciennes captures de Drattak restent dans « Obtenus » et une ligne historique, mais ne rendent pas la cible « Capturés » impossible.
