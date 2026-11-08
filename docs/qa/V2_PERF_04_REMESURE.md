# V2-PERF-04 — Remesure après le plan V2, et silhouettes de l'Expédition (8/11/2026, 2 h heure de Paris)

## Remesure du site déployé (version `41667f3acd`, `App/tools/prod-measure.js`, lecture seule)

| Appareil, à froid | Avant (version `9340737699`) | Après | Écart |
|---|---:|---:|---:|
| Téléphone 4G : reçu | 3,8 Mo | **1,4 Mo** | −63 % |
| Téléphone 4G : page chargée | 4,5 s | 4,1 s | −0,4 s |
| Téléphone 4G : plus grand affichage (LCP) | 2,4 s | 2,2 s | −0,2 s |
| PC : reçu | 6,2 Mo | **1,9 Mo** | −69 % |

Aucune erreur JavaScript. Avec le cache, inchangé (< 0,5 s).

## Ce qui pèse encore (téléphone, à froid, ≈ 1,25 Mo)
- `dist/script.min.js` 461 Ko et `dist/app.min.css` 228 Ko (compressés) : le code de tout le site est chargé d'un coup. Les découper est un gros chantier (à proposer à part, après mesure).
- **1 artwork PNG de 145 Ko** : le légendaire de l'Expédition de la semaine, affiché en silhouette. **Corrigé ici** : les 6 légendaires de l'Expédition passent en WebP 256 px (comme les tuiles, `tools/tile-art.py`).
- Polices (Inter, Nunito, Fredoka) ≈ 117 Ko.

## Preuves
- `App/test/v2-perf03-tile-art.test.js` (V2-PERF-04) ; `npm test` avec PostgreSQL : 1046/1046.
