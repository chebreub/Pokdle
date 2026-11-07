# V2-TRA-01 — Échanges : expiration et quota fiables (7/11/2026, audit GPT)

## Problèmes (reproduits avec l'ancien code)
1. **Expiration** : une proposition de plus de 7 jours pouvait être acceptée depuis un ancien écran, car l'expiration n'était appliquée qu'à la lecture de la liste.
2. **Quota** : 4 propositions envoyées en même temps à partir de 0 donnaient **4** offres au lieu de 3 maximum (comptage puis insertion sans verrou).
3. Double acceptation : **déjà sûre** (ligne verrouillée), un seul échange — gardé par un test.

## Correction (`App/lib/wild-trades.js`)
- À l'acceptation, sous le verrou de la proposition : plus de 7 jours → statut `expired`, rien ne bouge, message « Cette proposition a expiré : plus de 7 jours sans réponse. »
- Avant le transfert, l'amitié **et l'absence de blocage** sont revérifiées.
- Proposer : quota du jour, propositions en attente, doublon de proposition et inscription dans une seule transaction, sous un verrou par joueur.

Inchangés : 3 propositions par jour (une annulée compte toujours), 10 en attente, 7 jours pour répondre, shiny contre shiny, jamais le dernier exemplaire, aucune deuxième confirmation pour l'auteur.

## Preuves
- `App/test/v2-tra01-trades-safe.test.js` (PostgreSQL) : proposition de 8 jours refusée sans transfert ; 4 propositions simultanées → 3 offres et 1 `trade_limit` ; même échange envoyé deux fois en même temps → 1 offre ; triple acceptation → 1 échange. Les deux premiers tests échouent sur l'ancien code.
- `npm test` avec PostgreSQL : 1036/1036.
