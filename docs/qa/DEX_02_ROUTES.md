# DEX-02 — voies d'obtention affichées, sans promesse de capture

## Source de vérité

- L'API existante `GET /api/wild/collection` transmet maintenant `captureRoutes` depuis les listes réellement exploitées par `App/lib/poke-balls.js` : `WILD_POOL` (845), `EXPEDITIONS` (6) et `SALAMENCE.pokemonId` (Drattak, 1).
- Total unique : **852 espèces avec une voie de capture par Ball** sur **1 025** ; les **173 restantes** n'ont actuellement pas de voie de capture par Ball. Les voies *mission d'album* et *secret* sont des **découvertes**, pas des captures. Les échanges peuvent transmettre un exemplaire existant, sans attester une capture personnelle.
- Les 6 Pokémon d'expédition sont soumis à rotation et éligibilité. L'épreuve de Drattak a ses conditions serveur ; aucune chance de capture n'est promise.
- Aucun mécanisme serveur, formule, coût, tirage, taux, prix, shiny, inventaire ou sauvegarde modifié. La réponse n'expose ni l'identité de la manche du jour ni le contenu de la piste secrète.

## Affichage

- Les fiches de *Ma collection*, verrouillées et enregistrées, distinguent la **voie de capture** (hautes herbes, expédition, Drattak, aucune) de la **voie de découverte** (mission, secret ou jeu).
- `captureRoutes` absent ou inaccessible : « Informations indisponibles » ; ne **jamais** en déduire « aucune voie ». Le statut découvert / déjà capturé / possédé (DEX-01) reste indépendant.
- Responsive et thème sombre : seul le bloc informatif est stylisé, sans refonte des écrans.

## Vérification

- `App/test/pokedex-acquisition-routes.test.js` : bornage exhaustif 852/1 025, cas sauvage / expédition / prestige / mission / secret / sans voie et données indisponibles.
- `tools/pokedex_routes_quality.py` : Chromium + WebKit 390 et 1 366 px, fiches, variantes, non-divulgation d'identité secrète, absence de débordement, erreur de données. La réponse de collection est simulée pour le test navigateur ; la correspondance au catalogue réel est vérifiée séparément dans Node.
- CI Node et navigateur/base complètes **à vérifier sur le head final avant fusion**.
- Aucune recette Safari physique, téléphone de Jade ou déploiement Render revendiquée.
