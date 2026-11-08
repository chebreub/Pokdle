# V2-PERF-03 — Images des tuiles de mini-jeux allégées (8/11/2026)

Suite de la mesure OBS-01 : à la première visite, les tuiles de mini-jeux et la carte « À découvrir » de l'accueil chargeaient des artworks officiels en PNG 475 px via jsDelivr (≈ 140 Ko chacun).

- Les **40 artworks** des tuiles (`MODE_TILE_THEME`) sont maintenant des **WebP 256 px servis par le site** (`App/img/art/`, ≈ 12 Ko chacun, 497 Ko pour les 40), faits par `App/tools/tile-art.py` depuis l'artwork officiel PokéAPI. Même image, même cadrage ; le petit sprite reste en secours.
- La carte « À découvrir aujourd'hui » utilise la même image.
- Mesure locale (iPhone 13) : les 10 images des tuiles de l'accueil pèsent 137 Ko au lieu d'environ 1,4 Mo ; rendu identique (capture vérifiée), aucune image cassée.
- Avec #347 (bande « À plusieurs »), l'accueil ne charge plus aucun artwork PNG de jsDelivr à la première visite.
- `App/test/v2-perf03-tile-art.test.js` ; `npm test` avec PostgreSQL : 1040/1040.
