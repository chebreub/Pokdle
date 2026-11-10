# Pokédle — Arène des Captures (bêta d’entraînement solo)

Date : 10 novembre 2026.

## Objectif produit

Donner un premier usage ludique aux **Pokémon réellement possédés**, distinct de leur simple découverte dans le Pokédex, sans construire tout de suite un simulateur officiel de combat Pokémon.

Parcours : `Pokédex > Ma collection > Arène des Captures > choisir 1 à 3 Pokémon > duel tactique > résultat > recomposer/capturer`.

## Périmètre livré

- Capture vérifiée à chaque ouverture par `GET /api/wild/collection`. Le joueur ne peut pas utiliser un Pokémon seulement découvert, mission ou secret compris.
- Sélection dans l’ordre de 1 à 3 Pokémon possédés ; une seule manche par Pokémon.
- Un adversaire de type différent est choisi dans une liste tournante de Pokémon du jeu ; pas d’usage de collection concurrente.
- Le joueur sélectionne l’un des types de son Pokémon comme attaque ; le CPU prend le type de son Pokémon ayant la meilleure efficacité contre lui.
- Calcul transparent : `round(10 × coefficient des types)`, borné de 0 à 40. Les coefficients proviennent de `attackMultiplier()`, le tableau déjà utilisé par Pokédle.
- Gagne la manche celui dont le score d’attaque est supérieur ; cumul des manches gagnées, perdues ou à égalité.
- Affichage d’un écran entre les manches pour éviter qu’un double clic joue deux tours.
- Interface mobile/PC, clavier, mode sombre, aide aux règles.
- Aucun gain d’XP, de Ball, de monnaie, de Pokémon, ni classement. Aucun appel API d’écriture.
- Aucune sauvegarde ni mutation des Pokémon ; le jeu ne modifie pas les collections.

## Ce que cette bêta ne prétend pas être

Ce n’est **pas** un combat Pokémon complet : il n’y a ni PV, ni talents, ni objets, ni attaques de puissance variable, ni équipes adverses réelles. Ce n’est pas encore du PvP. Les règles de l’arène ne remplacent pas les règles des jeux de génération.

## Contrôles et risques de qualité

- Vérifier sur iPhone et ordinateur que l’entrée apparaît dans Ma collection, que l’overlay se ferme correctement et que les sprites restent lisibles.
- Vérifier le cas **zéro capture** (proposition d’aller dans les hautes herbes), **une capture** (duel une manche), **trois captures** (trois manches), **échec API** (aucune collection déduite du profil).
- Vérifier les doubles pressions et les ouvertures successives de l’arène.
- Vérifier les types à double faiblesse, immunités, et cas d’égalité.
- Après une nouvelle capture, la réouverture relit la collection serveur. Un échange entre deux ouvertures n’est pas automatiquement reflété pendant un entraînement déjà commencé, mais il n’y a aucun enjeu ou effet serveur.
- Ne pas lier cette bêta aux récompenses avant une validation produit.

## Suite éventuelle : PvP asynchrone, pas tout de suite

1. Valider l’intérêt de l’entraînement : joueurs qui l’ouvrent, proportion qui lancent un duel, satisfaction et rejouabilité, sans instrumentation intrusive.
2. Fixer des règles équilibrées communes aux neuf générations, indépendantes du shiny/de la rareté/de la Ball achetée.
3. Définir un modèle serveur d’équipe **vérifiée**, lié à l’identité réelle de la collection, et un tour calculé côté serveur avec idempotence et anti-triche.
4. Permettre un défi asynchrone entre amis, le joueur attaquant en premier, puis une réponse différée. Aucun besoin de deux joueurs en ligne simultanément.
5. Introduire des récompenses non compétitives (cosmétiques / badge) seulement après simulations et vérification qu’elles ne perturbent pas l’économie.

Le combat synchrone avec matchmaking public n’est pas recommandé tant que la communauté active est réduite.
