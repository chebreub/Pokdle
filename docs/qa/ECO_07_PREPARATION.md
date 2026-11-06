# ECO-07 — Préparer les rencontres rares avant ouverture

**Statut : implémentation proposée en PR, pas de changement de règles économiques.**

## État existant vérifié

- Le serveur exige **au moins 3 Balls avant l'ouverture de Drattak**, avec le même compte, les victoires vérifiées, le cooldown et l'énigme (`App/lib/poke-balls.js` : `meetPrestige`).
- Le légendaire d'expédition exige aujourd'hui **au moins 1 Ball** avant son ouverture (`meetLegend`). Le porter à 3 Balls serait un **changement de règle non validé** : ce n'est pas fait.
- Les probabilités de capture de chaque Ball, les trois lancers et le shiny 1/500 restent calculés exclusivement côté serveur. Le frontend dispose des chances reçues de `/api/prestige/drattak` et `/api/expedition`.
- Une fois une rencontre spéciale ouverte, le serveur la conserve jusqu'à sa fin ou jusqu'à l'expiration du jour ; **ECO-07 ne crée pas de conservation 72 h**, qui relève d'ECO-08.

## Fonctionnement proposé

1. Clic sur « Ouvrir le passage vers Drattak » (énigme préalablement renseignée), ou « Rencontrer le légendaire » : aucun POST de rencontre n'est envoyé.
2. Récupération du sac et des conditions actuelles depuis le serveur, puis affichage du stock de Poké, Super et Hyper Balls, avec leurs chances de capture par lancer.
3. Le bouton de confirmation ne s'affiche pas lorsque le minimum **déjà appliqué par le serveur** n'est pas atteint : 3 pour Drattak, 1 pour l'expédition. En dessous de 3 Balls pour le légendaire hebdomadaire, une alerte explique que les 3 lancers ne seraient pas possibles, **sans rendre les 3 Balls obligatoires**.
4. Bouton « Annuler · garder ma progression » : retour à l'expédition, aucune rencontre créée ni Ball dépensée. La fermeture de la fenêtre pendant le chargement n'ouvre pas de popup tardive.
5. Seul le clic « Commencer la rencontre » envoie la demande d'ouverture. L'interface verrouille les doubles clics ; le serveur reste l'autorité sur l'éligibilité, l'identité, les Balls et la création réelle.

**Aucune nouvelle Ball**, nouveau Pokédollar, nouveau taux ou chance, aucune modification de base, de profil ou d'inventaire. La vérification frontend est indicative et ne remplace jamais la transaction serveur : les changements de compte, le stock dépensé depuis un autre appareil ou une rencontre concurrente restent susceptibles de provoquer un refus côté serveur.

## Vérifications

`App/test/expedition-eco07-preflight.test.js` :

- préparation Drattak : stock, probabilités et choix de confirmation ;
- distinction entre minimum réel de trois Balls pour Drattak et d'une Ball pour le légendaire hebdomadaire ;
- annulation et absence de POST avant la confirmation ;
- protection contre un deuxième appui ;
- seule la confirmation peut déclencher `POST /api/prestige/drattak/meet` ou `POST /api/expedition/legend` ;
- fermeture de modal pendant les requêtes d'actualisation.

```sh
cd App
node --test test/expedition-eco07-preflight.test.js test/prestige-drattak.test.js test/expedition.test.js
npm run build
```

La CI Node et navigateur/PostgreSQL doit être verte avant fusion. **Aucune vérification sur iPhone physique ni déploiement Render revendiqués** par cette étude. `BUG-MOB-01` et la conservation 72 h d'ECO-08 restent indépendants.

## Suite du plan

ECO-07 peut être marqué terminé uniquement après fusion et validation. ECO-08 demeure une étude/éventuelle réalisation séparée, soumise à validation de durée, expirations, reprise multi-appareils et idempotence.
