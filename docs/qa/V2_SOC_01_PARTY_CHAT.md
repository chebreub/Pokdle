# V2-SOC-01 — Chat de la Party Room aligné sur la discussion entre amis (8/11/2026, audit GPT)

## Constat
Le gestionnaire Socket.IO `party:chat` (server.js) n'ajoute qu'une limite de débit ; le filtre de `lib/party-chat.js` ne bloquait que les liens. La discussion entre amis refuse en plus les adresses e-mail, les @pseudos, les numéros (6 chiffres ou plus, même espacés) et les noms d'autres applis (Snap, Insta, WhatsApp, Discord, TikTok…), avec les variantes « point fr », espaces ou caractères invisibles. Beaucoup de joueurs sont des enfants.

## Correction
- Le garde-fou de la discussion entre amis est partagé (`hasContact` dans `lib/friend-chat.js`) et appliqué au chat de la Party Room : message refusé côté serveur avec « 🔒 Pas de liens ni de numéros ici. », jamais relayé aux autres joueurs.
- Rien d'autre ne change : pas de chat public, rien n'est gardé, 120 caractères, réactions, message qui donne la réponse caché pendant la manche. Pas de bouton « Signaler » (il faudrait garder les messages).

## Preuves
- `App/test/v2-soc01-party-chat.test.js` : les mêmes textes sont refusés des deux côtés ; **aucun des 1 025 noms de Pokémon ni des 216 formes** n'est refusé (ni seul, ni dans une phrase) ; « gg wp », « Mr. Mime ou M. Mime ? », « Type:0 », scores passent.
- QA navigateur (`tools/mobile_chat_quality.py`, deux joueurs, Chromium/WebKit, téléphone/PC) : numéro, adresse et « snap » refusés chez celui qui écrit et jamais reçus par l'autre ; « C'est Ho-Oh ou Porygon-Z ? » arrive.
- `npm test` avec PostgreSQL : 1036/1036.
