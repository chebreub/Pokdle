# Validation de la consolidation Pokédle

## Vérification reproductible

Le workflow `Browser and database quality` compile l'application, exécute les tests Node avec une base PostgreSQL de test isolée, puis ouvre Chromium à 360, 390, 768, 1366 et 1920 px. Un deuxième scénario joue une manche Party Room avec deux navigateurs invités.

Les tests navigateur s'exécutent sans `--record-only` : un contrôle en échec fait échouer le job. Les sources ne sont pas modifiées par ce workflow. Le token ne possède que `contents: read` ; aucun commit ni push n'est effectué par la CI.

L'artefact `browser-quality-<run>-<attempt>` contient les captures PNG en taille réelle, les rapports JSON, les logs et `revision.txt` identifiant exactement le code exécuté. La durée de conservation est de 14 jours.

## Reproduction locale

Depuis la racine, avec Node 22, Python et Playwright installés :

```sh
cd App
npm ci
npm run build
npm test
cd ..
python -m pip install playwright==1.55.0
python -m playwright install chromium
python tools/browser_quality.py --output quality-artifacts/browser
python tools/multiplayer_quality.py --output quality-artifacts/multiplayer
```

Pour le test d'intégration PostgreSQL, définir uniquement `QA_DATABASE_URL` vers une base de test dédiée. Ce test crée et détruit un schéma `qa_*`. Ne jamais utiliser une base de production. Les parcours navigateur utilisent des données synthétiques et ne nécessitent aucun identifiant Discord.

## Archives de l'atelier initial

`summary.json`, `workbench.json` et les trois fichiers `.b64` proviennent de l'atelier temporaire exécuté avant la finalisation. Les libellés `before` / `after` désignent les états avant/après la dernière retouche de cet atelier : ils ne constituent PAS une comparaison de la branche main initiale avec toute la livraison. Le champ `commit` de ces archives est le commit déclencheur ; l'atelier modifiait ensuite certains fichiers. Ne pas les présenter comme des preuves de validation d'une révision immuable.

Les `.b64` sont des aperçus JPEG fortement réduits, pas des captures de référence pour juger la typographie. Les captures définitives doivent être prises dans les artefacts de la nouvelle CI, qui teste sans modifier le code.

## Limites

Ces vérifications couvrent Chromium et les parcours nommés dans les scripts. Elles ne certifient ni Safari iOS, ni Firefox, ni tous les modes multijoueurs à huit personnes. L'authentification et les classements sont testés avec des données synthétiques et PostgreSQL isolé, pas avec le compte Discord réel du propriétaire. Les Core Web Vitals terrain et le déploiement Render doivent être vérifiés séparément. Un test vert ne remplace pas la revue des captures ni une recette sur appareil réel.
