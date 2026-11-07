# V2-REL-01 — Relâcher un doublon en sécurité (7/11/2026, audit GPT)

## Problème
Relâcher partait au premier appui, sans confirmation. Le serveur choisissait un exemplaire encore possédé : avec 3 exemplaires, deux appels identiques (double appui, réponse perdue puis nouvel appui) pouvaient en retirer deux. La route ne vérifiait pas non plus que le compte n'avait pas changé dans un autre onglet.

## Correction
- **Confirmation** : « Relâcher 1 doublon » ouvre « Relâcher 1 Lucario shiny ? · Tu en gardes 2 (×3 → ×2) · +1 500 ₽ » avec « 🌿 Oui, relâcher » et « Annuler ». Annuler n'envoie rien.
- **Une intention = une exécution** : l'action part avec un identifiant gardé par le navigateur (`ballPaidAction`, comme les achats et les lancers). Le serveur garde un reçu (`ball_actions`) : un rejeu renvoie le même résultat sans retirer ni payer une 2e fois.
- **État attendu** : la page envoie le nombre d'exemplaires qu'elle voit (`expectedCount`) ; s'il a changé, rien n'est relâché (`release_changed`) et la fiche se met à jour.
- **Compte** : `actionScope` obligatoire ; un compte changé dans un autre onglet est refusé (`account_changed`). Une ancienne page sans identifiant reçoit « Recharge la page ».

Inchangés : 15 ₽ par doublon, 1 500 ₽ par shiny (avec un compte), +20 XP sans compte, 10 par jour, jamais le dernier exemplaire.

## Preuves
- `App/test/v2-rel01-release-safe.test.js` (PostgreSQL) : 10 rejeux simultanés de la même action → 1 shiny relâché, 1 500 ₽ une seule fois ; ancien écran (×3 après relâchement) refusé ; même identifiant avec un autre contenu → conflit ; dernier exemplaire gardé ; HTTP : ancienne page, nombre manquant et compte changé refusés.
- `npm test` avec PostgreSQL : 1031/1031.
- Capture téléphone : `V2_REL_01_confirmation.webp`.
