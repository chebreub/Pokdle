# Planning des vidéos TikTok / Shorts (à partir du 11/11/2026)

3 vidéos par jour : **12 h 30 · 18 h 30 · 21 h** (Paris). Format court : 30-35 s, ~3 s par question,
pokdle.fr affiché tout du long, fin dessinée « Joue en entier sur le site », la dernière
question reste en mystère (« ta réponse en commentaire », réponse épinglée le lendemain).

Règles : plus dur (pièges, valeurs serrées, pas que Gen 1), artworks officiels, jamais de voix ni de visage.
Musique : bibliothèque `assets/audio/pokemon-oras/` sur `main` (ne pas modifier les fichiers).
Maquette des fonds : `out/maquette-fonds.png` (page `pub/fonds.html`).

## Les modes (moteur `pub/q6.html` + `pub/q6.js`, contenu `pub/q6-content.json` fait par `node pub/q6-gen.js`)

Réponses calculées avec les vraies données (`assets/q5data.json`, tiré de `App/pokemon.js` et `App/base-stats.json`).
Fin dessinée « Joue en entier sur le site » + le nom du jeu + 3 artworks (plus de capture du site : affichage bancal).
**Pas de vidéo « L'intrus » ni « Évolutions »** (Kayan, 10/11 : ça ne percera pas).

| Mode | Fond | Musique (ORAS) | Jeu nommé à la fin |
|------|------|----------------|--------------------|
| zoom : Quel est ce Pokémon ? (noir et blanc, zoom ×12 → ×6, 4 réponses de même couleur, `pub/q6-zoom.js`) | décor de zone en pixel art | 13 Verdanturf Town | Zoom progressif |
| pixel : Qui se cache dans le Pokédex ? | coque du Pokédex | 22 Mt Pyre | Pokémon pixelisé |
| silh : À qui est cette ombre ? | projecteur sombre | 24 Dive | Zoom progressif |
| type : Quel est son type ? | biais neutre → les vrais types | 03 Route 101 | Combo de types |
| vf : Vrai ou faux ? | biais neutre → vert / rouge | 21 Poke Mart | Quiz Pokémon |
| plus / moins : Qui a le plus / moins de… ? | une couleur par stat | 16 Surf / 23 Mt Pyre Exterior | Clash de stats |
| legend : Légendaires, qui a le plus ? | nuit étoilée | 17 Southern Island | Clash de stats |
| pom : Plus ou moins ? (écart ≤ 15) | crème du site | 12 Cycling | Higher or Lower |
| premier : Lequel vient en premier ? | nuit étoilée | 27 Soaring Dreams | Ordre Pokédex |
| grand : Qui est le plus grand ? | ciel + règle | 10 Dewford Town | Pokédex |
| lourd : Qui est le plus lourd ? | soir + balance | 08 Rustboro City | Duel de poids |

Rendu : `PAGE=pub/q6.html node render.js <nom>` puis `./mixm.sh <nom> "assets/music/oras/<titre>.mp3" out/Q6-<nom>.mp4`.
Les 36 vidéos du 11 au 22/11 sont sur la branche `videos` (`q-MMJJ-HHhMM-<nom>.mp4`) et programmées dans Metricool
(TikTok + YouTube Shorts, 12 h 30 · 18 h 30 · 21 h).

## Idées pour la suite

- **Stat Clash à faire jouer** (idée de Kayan) : « Construis le meilleur Pokémon » : pour chaque stat, 2 Pokémon au choix
  (PV : Leuphorie ou Ronflex ?…), le viewer note ses 6 lettres en commentaire (« ABBAAB »), le total de chaque choix
  s'affiche à la fin : « 600+ : Maître ». Chacun compare son score en commentaire.
- **Projet futur** : l'appli Google Play de PokeQuizz (https://play.google.com/store/apps/details?id=com.pokequizz.app),
  à regarder pour une appli Pokédle (rappel : TWA abandonnée le 31/10 pour le coût).

## Suivi (à remplir après chaque publication)

| Date | Heure | Vidéo | Réponse à épingler | Vues J+1 | Comms |
|------|-------|-------|--------------------|----------|-------|
| 10/11 | 13 h 36 | Plus ou moins (hl3) | MOINS (Mackogneur 505 < Ronflex 540) | | |
| 10/11 | 19 h 45 | Qui a le plus de… pièges (stat3) | C Monaflèmit (Atq 160) ; avant : C, D, B | | |
| 10/11 | 21 h | Plus ou moins pièges (hl4) | MOINS (Mimiqui 476 < Wailord 500) | | |
| 11/11 | 12 h 30 | type1 | B Spectre / Fée (Mimiqui) ; avant : B, D, A, D | | |
| 11/11 | 18 h 30 | pom1 | MOINS (Mentali 525 contre Amphinobi 530) ; avant : M, P, M, P | | |
| 11/11 | 21 h | lourd1 | B Dracolosse (210 kg contre 206,5 kg) ; avant : A, B, A, B | | |
| 12/11 | 12 h 30 | zoom1 | C Lugia ; avant : C, D, B, A | | |
| 12/11 | 18 h 30 | plus1 | D Élekable (95 en Vitesse) ; avant : D, B, D, B | | |
| 12/11 | 21 h | pixel1 | C Celebi ; avant : C, D, D, B | | |
| 13/11 | 12 h 30 | type4 | B Psy / Vol (Lugia) ; avant : D, C, D, B | | |
| 13/11 | 18 h 30 | premier1 | B Mew (n° 151 contre 157) ; avant : A, B, B, B | | |
| 13/11 | 21 h | silh1 | B Zoroark ; avant : A, D, D, D | | |
| 14/11 | 12 h 30 | vf1 | VRAI (Ectoplasma est de type Poison) ; avant : F, V, V, F | | |
| 14/11 | 18 h 30 | pom2 | PLUS (Pingoléon 86 contre Oratoria 74) ; avant : P, P, M, M | | |
| 14/11 | 21 h | zoom2 | B Smogogo ; avant : A, D, A, C | | |
| 15/11 | 12 h 30 | type2 | D Eau / Combat (Palmaval) ; avant : C, B, A, C | | |
| 15/11 | 18 h 30 | moins1 | A Braségali (80 en PV) ; avant : B, D, A, D | | |
| 15/11 | 21 h | grand1 | A Tartard (1,3 m contre 1,2 m) ; avant : B, B, A, A | | |
| 16/11 | 12 h 30 | legend1 | C Regigigas (110 en PV) ; avant : A, C, D, C | | |
| 16/11 | 18 h 30 | pixel2 | B Archéduc ; avant : D, B, B, A | | |
| 16/11 | 21 h | zoom3 | D Darkrai ; avant : B, A, D, A | | |
| 17/11 | 12 h 30 | plus2 | D Félinferno (95 en PV) ; avant : B, D, A, A | | |
| 17/11 | 18 h 30 | silh2 | B Cresselia ; avant : D, B, D, C | | |
| 17/11 | 21 h | pixel5 | D Deoxys ; avant : D, B, D, C | | |
| 18/11 | 12 h 30 | premier2 | A Rhinastoc (n° 464 contre 497) ; avant : A, B, B, A | | |
| 18/11 | 18 h 30 | vf2 | VRAI (Carchacrok est de type Sol) ; avant : F, V, F, F | | |
| 18/11 | 21 h | pixel3 | B Lanssorien ; avant : A, C, A, B | | |
| 19/11 | 12 h 30 | type3 | A Plante / Spectre (Archéduc) ; avant : B, C, A, B | | |
| 19/11 | 18 h 30 | pom3 | PLUS (Dracolosse 80 contre Nidoqueen 76) ; avant : M, M, P, P | | |
| 19/11 | 21 h | zoom4 | A Mammochon ; avant : B, D, A, C | | |
| 20/11 | 12 h 30 | moins2 | D Crocorible (117 en Attaque) ; avant : D, A, A, B | | |
| 20/11 | 18 h 30 | lourd2 | A Absol (47 kg contre 45,2 kg) ; avant : A, A, B, B | | |
| 20/11 | 21 h | silh3 | A Solgaleo ; avant : A, B, A, D | | |
| 21/11 | 12 h 30 | plus3 | C Scorvol (75 en Déf. Spé.) ; avant : D, C, D, C | | |
| 21/11 | 18 h 30 | legend2 | C Tokorico (95 en Atq. Spé.) ; avant : B, B, D, C | | |
| 21/11 | 21 h | pixel4 | B Ho-Oh ; avant : D, C, D, B | | |
| 22/11 | 12 h 30 | pom4 | MOINS (Nidoqueen 505 contre Dimoret 510) ; avant : M, P, M, M | | |
| 22/11 | 18 h 30 | grand2 | A Latios (2 m contre 1,5 m) ; avant : A, B, B, B | | |
| 22/11 | 21 h | zoom5 | C Élekable ; avant : B, D, D, C | | |
