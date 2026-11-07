# ECO-03 — La meilleure partie du jour compte (7/11/2026, option B choisie par Kayan)

## Règle
- Avant : seule la **1re** partie du jour de chaque jeu vérifié payait (30 ₽ perdue, 60 ₽ gagnée, 90 ₽ belle partie).
- Maintenant : c'est la **meilleure** partie du jour qui compte. Une partie meilleure que les précédentes verse la
  différence (30 → 60 : +30 ; 60 → 90 : +30). Jamais plus de 90 ₽ par jeu et par jour.
- Inchangés : barème 30 / 60 / 90 ₽, plafond de 2 000 ₽ par jour pour les parties, Ball du jour (toujours à la
  1re partie), jeux du jour, Party Room, prix de la boutique, taux de capture.

## Technique
- `coinPlay` (`App/lib/poke-balls.js`) : une ligne `coin_ledger` par palier atteint (`play:<mode>`, puis
  `play:<mode>:60`, `play:<mode>:90`). L'index unique (identité, jour, source) empêche un double paiement en cas de
  reprise réseau. Les anciennes lignes `play:<mode>` restent valables.
- L'état renvoie `coins.byMode` (₽ gagnés aujourd'hui par jeu) : la ligne en haut du jeu dit
  « ✓ Ball du jour gagnée · 60 / 90 ₽ : ta meilleure partie compte, tu peux encore faire mieux ».
- Boutique › Gagner : « Ta meilleure partie du jour … (une partie meilleure verse la différence, 90 ₽ au plus par jeu) ».

## Tests
- `App/test/eco03-best-game.test.js` (PostgreSQL) : perdue 30 → gagnée +30 → belle partie +30 = 90 ; même palier rejoué = 0 ;
  au-delà de 90 = 0 ; plafond de 2 000 ₽ respecté ; textes.
- `npm test` avec `QA_DATABASE_URL` local : 1023/1023.

## À vérifier en ligne
1. Duel de poids : perdre la 1re partie (+30 ₽), puis gagner (+30 ₽ de plus), puis une série de 10 (+30 ₽).
2. La ligne en haut du jeu affiche « 60 / 90 ₽ » entre les deux.
