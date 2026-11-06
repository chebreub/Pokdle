# ECO-08 — Implémentation retenue : légendaire hebdomadaire conservé 72 h

**Décision propriétaire :** le 06/11/2026, 72 heures réelles à compter de l'ouverture, y compris si la rencontre traverse le lundi. Exclusion explicite de Drattak et des hautes herbes. Une ancienne rencontre encore ouverte bloque une nouvelle rencontre, qui n'est disponible qu'une fois l'ancienne terminée ou expirée et si les conditions de la nouvelle semaine sont remplies.

## Garde-fous métier et base de données

- Ajout **non destructif** de `wild_encounters.expires_at TIMESTAMPTZ NULL` via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. **Ne pas modifier les anciennes lignes**. Un légendaire déjà créé avec `expires_at=NULL` expire comme avant au minuit de Paris. Une rencontre terminée (`caught`, `fled`, `skipped`) ne peut pas être réouverte.
- **Seules les nouvelles rencontres `kind='legend'`** portent une échéance `clock() + 72 heures`. L'identifiant, le Pokémon et le shiny sont stockés une seule fois lors de la création. Le serveur garde les trois lancers **au total**, sans réinitialiser les tentatives après minuit. Les Balls ne sont consommées qu'au lancer.
- L'expiration est contrôlée dans la transaction serveur avant lecture ou action, avec comparaison absolue `expires_at <= now`. Les anciennes rencontres et tous les `wild` / `prestige` restent soumis à la date Paris, sans prolongation. Les requêtes de lancer, de saut et la validation `encounterId + expectedThrows` acceptent l'ancienne date uniquement pour un légendaire dont l'échéance est encore future.
- `expedition()` indique les rencontres encore ouvertes (`legend.pending`) afin de bloquer l'ouverture d'un deuxième Pokémon, même après la rotation hebdomadaire. Aucun tirage de shiny ni de Pokémon n'a lieu lors d'une reprise. Les conditions des expéditions et des coffres sont inchangées.
- Le client montre **« Reprendre ma rencontre »** pour la ligne déjà ouverte et l'échéance en fuseau `Europe/Paris`. La reprise passe par une **lecture de `/api/balls`**, pas un nouveau POST d'ouverture. L'écran de capture affiche le délai. Fermer l'écran ne dépense pas de Ball.
- Le taux shiny `1/500`, la formule de capture, les 3 lancers, les prix, les récompenses et les inventaires sont inchangés. **Aucune migration destructive, aucun cadeau et aucune rencontre supplémentaire.**

## Scénarios de recette

`App/test/eco08-legendary-hold.test.js` exécute, sur une base PostgreSQL **isolée**, les vérifications suivantes :

1. Ancien `legend` et rencontres `wild` / `prestige` ouverts la veille : expirent à minuit comme auparavant ; aucun `expires_at` rétroactif.
2. Légendaire débloqué le dimanche 08/11 à 21 h Paris : expire précisément le mercredi 11/11 à 21 h. Son ID, espèce, shiny, compteur de lancers et stock de Balls restent identiques après le lundi.
3. L'expédition de la nouvelle semaine peut être débloquée mais **ne peut pas ouvrir une seconde rencontre** tant que l'ancienne est ouverte ; une fois expirée, la nouvelle rencontre peut être créée selon les conditions normales.
4. Double requête de création : **une seule nouvelle rencontre** et un seul tirage shiny ; rejeu de lancer avec le même `actionId` ne débite pas deux fois.
5. Saut volontaire le lendemain et rendu UI depuis la ligne conservée ; aucune reprise de Drattak ou d'un autre mode par ce mécanisme.

```sh
cd App
npm test
npm run build
# CI navigateur/base : exécute aussi eco08-legendary-hold.test.js avec QA_DATABASE_URL sur PostgreSQL isolé
```

**Conditions de clôture :** CI Node + PostgreSQL + navigateur vertes sur le commit de PR, fusion `main` et mise à jour du registre des 43 actions. Une CI verte n'est pas une recette sur un téléphone physique ni une confirmation du déploiement Render.

**Hors périmètre :** nouvelle deuxième chance ECO-01, extension à Drattak, changement de rareté, réintégration d'une rencontre terminée, changement des taux shiny ou des prix. La PR documentaire [#303](https://github.com/chebreub/Pokdle/pull/303) reste la référence de comparaison des politiques et de l'évaluation du calendrier.
