# Pokédle — récupération de la base Neon historique (octobre 2026)

**Priorité absolue : ne jamais perdre les parties jouées sur la nouvelle base PostgreSQL.**

## Déploiement sûr

Le code ne tente **aucun import Neon** tant que la variable serveur `LEGACY_IMPORT_BACKUP_VERIFIED` n'est pas exactement égale à `yes`. La présence de `OLD_DATABASE_URL` ne suffit plus. Ne configure pas le commutateur avant d'avoir vérifié une **sauvegarde indépendante et restaurable** de la **base PostgreSQL actuelle**.

Cette PR peut être déployée sans importer automatiquement d'anciens profils **si ce commutateur est absent**. Aucun profil historique ne sera alors restauré, même si Neon répond.

## Avant toute activation

1. Identifier dans Render quelle instance PostgreSQL sert réellement `DATABASE_URL`, sans recopier ni publier les identifiants.
2. Vérifier que les profils, scores et autres données actuelles sont intacts. Éviter de manipuler des comptes réels pendant les essais.
3. Créer une sauvegarde PostgreSQL indépendante de l'instance en service. Une exportation `pg_dump -Fc` est possible depuis un poste ou un environnement sécurisé, si le client PostgreSQL est disponible :
   
   ```sh
   pg_dump -Fc "$DATABASE_URL" -f current-before-legacy-import.dump
   pg_restore -l current-before-legacy-import.dump
   ```
   
   **Important :** `pg_restore -l` valide la lisibilité de l'archive, **pas** sa restaurabilité ; faire au minimum un essai de restauration sur une base isolée, sans écraser la production. Ne jamais committer l'archive ni les mots de passe dans GitHub.
4. Lire le marqueur de l'ancien import sans le modifier :
   
   ```sql
   SELECT name, done_at, report
   FROM data_imports
   WHERE name = 'legacy-neon-2026-10';
   ```
   
   La requête peut échouer si la table n'existe pas encore. Si le marqueur existe, l'ancien import est déjà réputé terminé et **ne se rejouera pas**. Le correctif ne reconstitue pas rétroactivement des profils déjà écrasés.
5. Vérifier la disponibilité de l'ancienne base Neon séparément, avec un accès limité ; ne jamais remplacer `DATABASE_URL` par `OLD_DATABASE_URL`.
6. Seulement après sauvegarde **et** vérification, autoriser la récupération en ajoutant dans l'environnement serveur Render :
   
   ```text
   LEGACY_IMPORT_BACKUP_VERIFIED=yes
   ```
   
   Puis redémarrer le service. En cas d'incertitude, **laisser la variable absente**.

## Ce que fait le code après activation

- Respecte `deleted_accounts` et le marqueur unique `data_imports`.
- Préserve toujours le JSON actuel des comptes déjà utilisés ; la taille d'un ancien JSON ne constitue jamais une preuve qu'il est plus récent.
- Restaure un ancien JSON uniquement dans un profil courant sans données utiles et avec un propriétaire concordant.
- Conserve dans `legacy_profile_backups` les deux versions conflictuelles en vue d'une récupération manuelle. Cette table se trouve **dans la même base** : ce n'est **pas** une sauvegarde indépendante.
- Exclut les anciens JSON explicitement estampillés pour un autre compte.
- Importe les autres tables selon les règles de réconciliation existantes (classements, sessions quotidiennes, œufs mystère), sous transaction PostgreSQL.

L'import peut attendre et réessayer si Neon est inaccessible. Une fois terminé, le marqueur `data_imports` empêche sa répétition. Retirer `LEGACY_IMPORT_BACKUP_VERIFIED` après l'opération pour ne pas laisser le mode récupération activé.

## Recette

- Contrôler dans Render les logs `[import]` et le rapport `data_imports` sans exposer de secrets.
- Vérifier le profil et l'historique de plusieurs comptes de test (nouveau / actif / vide / supprimé).
- Contrôler que l'historique de la nouvelle base reste intact après le redémarrage.
- Ne jamais utiliser un `DELETE`, `DROP` ou une restauration complète sur la base en service pour la simple recette.

## Tests GitHub

`App/test/db-import-profile-guard.test.js` : préservation des profils et import désactivé par défaut.

`App/test/db-import.test.js` : rapprochement Neon/actuel dans **deux schémas PostgreSQL de test** (jamais la base de production), restaurations autorisées, profils conflictuels archivés, comptes supprimés, marqueur d'import unique.
