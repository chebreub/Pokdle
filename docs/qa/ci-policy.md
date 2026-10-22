# Validation GitHub Actions de Pokédle

Objectif : obtenir un retour rapide sur chaque modification sans supprimer la
validation navigateur et PostgreSQL avant fusion. Ne jamais utiliser les
identifiants Render/Neon de production pour la QA.

## Deux niveaux

1. **Chaque commit de PR :**
   - `Game regression tests` exécute `npm ci` (qui compile via `postinstall`)
     puis `npm test`.
   - `Browser and database quality` exécute un smoke conservateur choisi par
     `tools/ci_smoke_scope.py` : modes solo, Daily, Party ou navigation générale.
     Les tests qui exigent réellement PostgreSQL utilisent seulement
     `QA_DATABASE_URL`, pointant sur le conteneur de test isolé.
   - Les simples modifications de tests unitaires n'installent pas de navigateurs
     tant que le diff ne comporte pas de changements applicatifs.
2. **Dernier commit prêt à fusionner :**
   - Une PR **créée non-brouillon** déclenche immédiatement la validation complète.
   - Pour réduire les répétitions, créer les nouvelles PR **en brouillon**, puis
     passer à **Ready for review** seulement quand les modifications sont terminées.
   - Il est possible de redemander une validation complète en ajoutant
     l'étiquette `qa:full` si elle existe dans le dépôt.
   - Le workflow complet se lance aussi après chaque push dans `main`, et
     par déclenchement manuel.
   - La validation complète réexécute tous les parcours pertinents : navigateurs
     mobile/PC, Party, jeux quotidiens, modes solo, et tests PostgreSQL isolés.

**Règle de fusion impérative :** vérifier que `Game regression tests` et
**une exécution complète** de `Browser and database quality` ont réussi
sur **le SHA exact en tête de PR**. Un smoke vert ne suffit pas.

Si un commit arrive **après** la validation complète, celle-ci est périmée.
Repassez la PR en brouillon puis **Ready for review** (ou retirez et
réappliquez `qa:full`) pour tester le **nouveau SHA**. Ne pas fusionner
un commit non entièrement validé.

## Pourquoi ce découpage

- `npm ci` lance déjà `build.mjs` via `postinstall` ; il ne faut pas
  exécuter `npm run build` une seconde fois.
- Les tests Node généraux appartiennent au workflow de régression, les
  véritables tests PostgreSQL au workflow avec conteneur dédié.
- Les binaires Playwright sont mis en cache ; ses dépendances système restent
  vérifiées.
- Les scripts JavaScript et CSS historiques sont partagés entre plusieurs
  jeux. Si le périmètre est ambigu, le smoke retombe sur une vérification
  générale plutôt que de conclure que tout est couvert.
- Les résultats `skipped` ou `cancelled` ne valent **jamais** validation
  complète.

## Vérification rapide du sélecteur

```sh
python -m unittest tools/test_ci_smoke_scope.py
python tools/ci_smoke_scope.py
```

La recette navigateur tourne exclusivement contre l'application locale
démarrée en CI. Aucune vérification du déploiement Render n'est nécessaire.
