# Vidéos TikTok / Shorts de Pokédle

Outil qui monte les vidéos verticales (1080 × 1920, 20 à 30 s) à partir du **vrai site** filmé en local. Rangé ici le 30/10 pour ne plus le refaire à chaque session.

**Règles de Kayan :** pas de musique, pas de voix IA, pas de bruitages gratuits (seulement les sons doux de `synth.py` et les vrais cris du jeu) ; pas que des Pokémon faciles ni que de la Gen 1 ; fin de vidéo « Joue / Entraîne-toi sur pokdle.fr » et « 🔔 Abonne-toi pour le prochain défi ». Donner à chaque fois le fichier, un titre, une description et un commentaire à épingler.

## Étapes

Depuis `tools/video/`, avec `ffmpeg`, Node et Playwright (déjà installés dans les sessions cloud) :

1. **Sons :** `python3 synth.py` crée `assets/sfx/*.wav` (sons d'interface faits maison, sans mélodie).
2. **Images et cris :** `./fetch-assets.sh 25 448 571` télécharge les artworks officiels, les cris et leur courbe de volume.
3. **Site local :** dans `App/`, `npm run build` puis lancer le serveur sur le port 4173 (voir `common.js`). Une base Postgres locale jetable suffit.
4. **Captures du vrai site :** `node cap-<nom>.js`. Les `cap-*.js` des modes filment le site dans `raw/<nom>/` ; `cap-quiz5*.js` prend les images pixelisées dans `assets/`.
5. **Servir ce dossier :** `python3 -m http.server 4180 --bind 127.0.0.1` (dans un autre terminal).
6. **Vérifier quelques images :** `PAGE=pro.html node render.js <nom> --stills 2,10,25` → `out/<nom>-stills.png`.
7. **Rendu complet + son :** `./render-all.sh <nom>` → `out/Pokedle-<nom>.mp4` (environ 5 à 10 min).

## Scènes (`pro-<nom>.js`)

| Nom | Vidéo |
|---|---|
| `pixel`, `cri`, `daily`, `hl`, `bac`, `statclash`, `combo`, `race` | un mode filmé sur le site (capture `raw/<nom>/`) |
| `quiz5` | « Trouve les 5 Pokémon » pixelisés, Gen 1 (publiée) |
| `quiz5b` | la même, version mélangée : Ectoplasma, Lucario, Amphinobi, Mimiqui, Ninjask (publiée le 29/10) |
| `cri5` | « 5 cris » : Pikachu, Lucario, Zoroark, Ho-Oh, Wailord, barres qui suivent le vrai cri |

Pour un nouveau défi « 5 Pokémon » : copier `pro-quiz5b.js` (ou `pro-cri5.js`), changer la liste `Q`, lancer `fetch-assets.sh` avec les numéros, et pour le pixel, adapter `cap-quiz5b.js`.
