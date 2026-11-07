# V2-PERF-01 et V2-ACC-01 — Correctifs du contrôle Osytools (8/11/2026)

## Fait
- **Images de l'accueil** : les 4 artworks officiels de la bande « À plusieurs » (n° 235, 132, 201, 479) étaient des PNG 475 px servis par jsDelivr (≈ 460 Ko). Ils sont maintenant des **WebP 192 px servis par le site** (≈ 30 Ko en tout), même cadrage, même taille affichée (96 px, 76 px sur téléphone), sprite de secours inchangé. Fabriqués par `App/tools/home-art.py` depuis l'artwork officiel PokéAPI (aucune image IA).
- **Contact** : lien « Contact » en bas de l'accueil vers `/a-propos#contact` (section déjà existante : « Donne ton avis » et l'adresse déjà publiée sur la page de confidentialité).

## Vérifié, pas changé
- **Polices** : Inter est encore utilisé (barre du bas, dates du Défi du jour, « BRAVO ! ») : le retirer changerait le style. Press Start 2P n'est plus affiché ; le navigateur ne télécharge que les polices utilisées, donc le gain serait nul.
- **Réponse du serveur (≈ 0,6 s)** : l'accueil est déjà envoyé directement et compressé ; le délai vient surtout de la distance (serveur en Oregon). Changer de région Render / Supabase coûte : **à décider par Kayan** (V2-PERF-02).
- Une image PNG reste sur l'accueil : la tuile du mini-jeu Description (Motisma). À revoir après un nouveau contrôle Osytools.

## Preuves
- `App/test/v2-perf01-osytools.test.js` ; tests de l'accueil et de « À propos » mis à jour. `npm test` avec PostgreSQL : 1035/1035.
- Chromium (iPhone 13) : les 4 vignettes WebP se chargent (10,7 / 4,8 / 6,2 / 8,0 Ko), lien Contact présent, aucune erreur.
