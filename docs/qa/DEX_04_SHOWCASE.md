# DEX-04 — vitrine volontaire de six Pokémon possédés

## Périmètre produit

- Vitrine **facultative**, vide par défaut, composée de **six emplacements maximum**, accessible depuis « Ma collection ». Choix et retrait depuis la fiche d'un Pokémon encore **possédé** (inventaire de captures lu sur le serveur). Une entrée uniquement découverte ou anciennement capturée mais cédée ne peut pas être ajoutée.
- La vitrine affiche les Pokémon effectivement détenus avec leur illustration, compte d'exemplaires et actions de retrait. Si un Pokémon sélectionné est cédé, il reste une préférence privée mais est explicitement signalé non possédé, **exclu du partage**.
- « Objectif proche » : un palier **indicatif de cinq espèces** calculé sur les **captures personnelles enregistrées** de DEX-01, non sur les découvertes, les échanges reçus ou les Pokémon de la vitrine. Pas de récompense promise. Historique indisponible = objectif inconnu, jamais un faux zéro.
- Le bouton « Partager volontairement » est le **seul déclencheur** de partage. La vitrine n'est ni publiée sur le profil public ni transmise à des amis automatiquement. Le texte partagé comprend seulement les espèces encore possédées au moment d'une **nouvelle lecture serveur** et, si disponible, le prochain palier personnel. Si le serveur est indisponible, le partage est bloqué. Le partage natif est essayé, puis le presse-papiers ou un texte à copier en repli.
- Les règles de capture, Balls, shiny, prix, expéditions, bonus et inventaires ne sont pas modifiées.

## Sauvegarde et synchronisation

- Deux champs facultatifs dans `playerProfile` : `pokedexShowcaseIds` (jusqu'à six IDs d'espèces nationales distinctes) et `pokedexShowcaseUpdatedAt`. Utilisation de `saveProfile` et `syncProfileNow` existants, sans migration de base.
- En fusion multi-appareils, la dernière sélection explicite remplace l'ancienne, **suppression ou liste vide comprises**. Ne pas traiter ces préférences comme des découvertes à fusionner par union.
- Seul le catalogue permet de déterminer le nom ou le sprite ; **seul l'inventaire serveur** détermine la possession à afficher ou à partager. Les données manquantes restent inconnues.

## Recette

- `App/test/pokedex-showcase.test.js` : sélection 6 maximum, rejet du septième, absence de partage automatique, sélection liée à la possession, cession avant partage, partage sur clic avec nouvelle réponse API, échec réseau, objectifs, validation des profils et synchronisation.
- `tools/pokedex_showcase_quality.py` : Chromium et WebKit, largeur mobile 390 px et PC 1366 px, vrais clics, rechargement, contrôle des six slots, exclusion d'un Pokémon cédé juste avant partage, absence de débordement.
- [CI Node verte](https://github.com/chebreub/Pokdle/actions/runs/42257529258) et [CI navigateur/base complète verte](https://github.com/chebreub/Pokdle/actions/runs/42257529272), sur le head `61e4b5aedd5def44ac94d934749529048dddb0d1` ; [PR #296](https://github.com/chebreub/Pokdle/pull/296) fusionnée au commit `b1704ffbd0b7a5be2406b4476f86c28ecc082428`. Pas de revendication de test sur iPhone physique, sur le téléphone de Jade ou sur Render.
