# V2-FX-01 — Rencontres et captures plus « wow » (7/11/2026)

Maquette du 7/11 (styles A, B, C) ; choix de Kayan : **A · Cinéma** à chaque rencontre + **carte holo C** pour une 1re capture.

## Ce qui change (mise en scène seulement)
- **Apparition** : pénombre et herbes qui bougent, silhouette noire qui se dresse, éclair qui révèle le Pokémon, bandeau « Un … sauvage apparaît ! ». Les boutons restent utilisables pendant l'apparition ; un lancer l'arrête.
- **Lancer** : traînée lumineuse derrière la Ball, étincelles aspirées avec le Pokémon.
- **Secousses** : la caméra se resserre sur la Ball et les bords de l'écran s'assombrissent.
- **Capture** : onde dorée, éclair et « Attrapé ! » par-dessus les étoiles d'avant.
- **1re capture** : rayons qui tournent derrière la carte « Nouvelle entrée » et reflet holographique (doré pour un shiny).

## Ce qui ne change pas
Résultat décidé par le serveur, taux, Balls, sons (dont les sons Pokémon GO gardés par Kayan), « Passer › », durée totale de la capture (l'effet est calé sur l'animation existante, aucune attente ajoutée), aucun appel serveur ajouté. **Réduites** : aucun de ces effets. **Rapides** : deux fois plus vite.

## Fichiers
`App/src/script.10xzx.wow-capture.js`, fin de `App/balls.css`, `App/test/v2-fx01-wow-captures.test.js`.

## Preuves
- Rencontre puis capture simulées dans Chromium (iPhone 13), en Normales, Rapides et Réduites : effets présents / accélérés / absents, aucune erreur de page. Planche : `V2_FX_01_wow-captures.webp`.
- `npm test` avec PostgreSQL : 1030/1030.

## À vérifier sur iPhone
Une rencontre puis une capture en Normales : l'apparition, la traînée, la caméra serrée et « Attrapé ! » sont fluides ; une 1re capture montre les rayons et le reflet sur la carte.
