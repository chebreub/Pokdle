# DEX-03 — trois cibles personnelles facultatives

## Fonctionnement

- Jusqu'à trois Pokémon suivis depuis leur fiche de l'encyclopédie ou une fiche de collection déjà visible. Les cibles sont affichées dans un panneau « Mes cibles », avec les voies connues et le statut de possession si l'inventaire serveur est disponible.
- Les entrées secrètes non révélées ne peuvent pas être suivies. Un Pokémon non découvert explicitement ciblé dans l'encyclopédie est masqué dans le panneau « Ma collection » jusqu'à sa découverte ; les informations sur les missions cachées ne sont pas révélées.
- Les cibles sont **personnelles et facultatives**. Elles n'augmentent ni les chances d'apparition ni les chances de capture ; elles ne donnent aucune récompense, nouveau Pokémon, indice de manche, piste d'expédition ni action automatique.

## Persistance

- Réutilisation du profil `playerProfile` avec les champs bornés `pokedexTrackedTargets` (maximum trois IDs nationaux distincts) et `pokedexTrackedUpdatedAt`.
- `saveProfile` et la synchronisation de compte existante ; fusion multi-appareils sur modification explicite la plus récente, **y compris la suppression**. Ne jamais fusionner ces choix comme des découvertes (union) : cela ressusciterait des cibles supprimées.
- L'ancien profil sans ces champs reste valide. Aucune migration de base, aucune remise à zéro, aucune modification du Pokédex, de la collection, des récompenses ou de l'économie.
- Le conflit de deux modifications simultanées de même horodatage est départagé en faveur de la copie principale, comme les préférences de profil ordinaires ; il ne crée pas plus de trois cibles.

## Validation

- `App/test/pokedex-targets.test.js` : ajout/retrait, refus de quatrième cible sans écriture, validation des IDs, secrets masqués, profil et synchronisation, fusion plus récente y compris liste vidée.
- `tools/pokedex_targets_quality.py` : Chromium/WebKit, 390 et 1366 px, clic réel des commandes, plafond, statut affiché, absence de dévoilement des secrets, persistance après rechargement, absence de débordement.
- [CI Node verte](https://github.com/chebreub/Pokdle/actions/runs/42250700271) et [CI navigateur/base complète verte](https://github.com/chebreub/Pokdle/actions/runs/42251003537) sur le head `0e02036b5b13daa88aa17996b45483ec32297824` ; [PR #295](https://github.com/chebreub/Pokdle/pull/295) fusionnée au commit `967b9c8d91977be6b38af7317e7e047121394efe`. La preuve navigateur ne couvre pas un iPhone physique, le téléphone de Jade ni le déploiement Render.
