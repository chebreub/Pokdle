# SER-01 — Record Pixelisé : priorité aux trouvailles, puis aux essais

**Pilote du 6 novembre 2026 — PR [#280](https://github.com/chebreub/Pokdle/pull/280).** Cette modification porte sur les **records personnels** des séries Pixelisé, sans modifier les classements serveur ni les récompenses.

## Périmètre exact

- Séries de **5, 10 ou 20** images, avec records distincts selon la longueur comme avant.
- Critère primaire : **nombre de Pokémon trouvés**, le plus grand gagne.
- À nombre de trouvailles égal pour **deux performances disposant d'essais connus**, le meilleur est celui ayant le plus petit total d'essais effectués sur les Pokémon trouvés.
- Les manches abandonnées/perdues ne sont pas ajoutées au total d'essais du départage : le critère retenu est `attemptsWon`, déjà calculé dans le flux existant. Ne pas lui attribuer la signification « essais joués toutes manches confondues ».
- Pas de nouvelle difficulté, limite d'essais, bonus ni monnaie. Les modes Cri, Silhouette et Description restent régis par leurs records historiques.

## Compatibilité historique — absence d'invention

`playerProfile.guessSeriesBest.pixel[5|10|20]` conserve le **nombre trouvé** qui existait avant la PR. Les anciennes séries ne conservaient **pas** le nombre d'essais de leur meilleure performance.

Les nouvelles références sont stockées **séparément** :

```json
{
  "guessSeriesBest": { "pixel": { "10": 7 } },
  "guessSeriesPrecision": {
    "pixel": { "10": { "found": 7, "attemptsWon": 16 } }
  }
}
```

Un 7/10 avec 16 essais contre un **ancien** 7/10 dont on ignore les essais n'est **pas déclaré meilleur record**. Le récapitulatif indique « record égalé ; 1re référence d’essais ». Une nouvelle performance 7/10 avec 14 essais améliorera ensuite le **départage suivi** sans annoncer un nouveau record de trouvailles. Un 8/10 reste un nouveau record, même s'il demande davantage d'essais.

Les séries non terminées, à zéro trouvaille ou dont les tentatives ne sont pas exploitables ne reçoivent pas de nouvelle référence. Aucun historique ancien n'est réécrit ni effacé.

## Fusion d'appareils

- Le champ historique `guessSeriesBest` est un objet et ne doit jamais être transformé en `0` par la règle générique des records numériques. Désormais il est fusionné par maximum pour chaque mode et chaque longueur.
- Pour `guessSeriesPrecision.pixel`, seuls les objets valides (`found` entier positif ≤ taille, `attemptsWon` entier ≥ `found`) sont fusionnés. Plus de trouvailles gagne, puis moins d'essais en cas d'égalité.
- Ne pas copier la précision d'une ancienne série à partir d'une moyenne ou d'une estimation.

## Limite explicite des classements publics

Le serveur reçoit toujours `pixel10` avec **le nombre de Pokémon trouvés seulement** pour les défis entre joueurs. Aucun essai client n'est utilisé comme départage public « vérifié » ; cela nécessiterait un suivi serveur fiable de l'ensemble de la série, hors de ce pilote. Le récapitulatif personnel est distinct d'un classement interjoueurs autoritatif.

## QA et prérequis à la fusion

- Tests `App/test/pixel-series-record-2026-11-06.test.js` : ancien record sans nombre d'essais, premier score suivi, moins de tentatives à égalité, plus de trouvailles, mauvaise mesure et zéro victoire, indépendance des séries et des modes, profil réenregistré et score public inchangé.
- Tests de fusion de profil dans les deux sens (PC ↔ téléphone), anciens objets conservés, valeurs invalides ignorées.
- Régressions existantes de séries, sauvegardes, duels et profils ; CI Node + navigateur/base vertes sur le même head que celui fusionné.
- **Pas de recette sur iPhone réel ni de validation Render réelle annoncée** tant qu'elle n'a pas été faite.
- **Prochaine action autonome après fusion : MEDIA-01**, améliorer la gestion d'une panne de lecture du Cri sans imposer une défaite. `BUG-MOB-01` demeure un problème tactile à vérifier sur appareil réel.
