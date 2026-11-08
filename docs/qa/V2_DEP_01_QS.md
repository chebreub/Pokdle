# V2-DEP-01 — Dépendance `qs` corrigée (8/11/2026, audit GPT)

- **Avis** : GHSA-6pq8-jhm2-2vcw (modéré) : `qs.stringify` avec `arrayFormat: 'comma'` peut planter sur des objets piégés. Il apparaissait 3 fois dans `npm audit` (qs, body-parser, express), mais c'est un seul avis.
- **Applicabilité** : Pokédle n'appelle jamais `qs.stringify` ni `arrayFormat: 'comma'` (Express n'utilise `qs` que pour lire les paramètres). Aucun chemin exploitable démontré ; on corrige quand même.
- **Correction** : l'override de `package.json` passe de `qs 6.16.0` à `6.16.1` (version corrigée, même branche, pas de mise à jour majeure). `npm audit --omit=dev` : 0 vulnérabilité.
- **Preuves** : `npm test` avec PostgreSQL : 1033/1033 (routes, formulaires et paramètres d'URL compris).
