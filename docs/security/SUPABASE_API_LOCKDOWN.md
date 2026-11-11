# Pokdle — verrouillage de l'API de donnees Supabase

**Etat : procedure PREPAREE, NON APPLIQUEE en production.**
**Date : 10 novembre 2026.**

## Constat verifie en lecture seule

Projet Supabase Pokdle (`abpvbueljxngdfpagihk`) :
- 60 tables applicatives dans `public`, toutes possedees par `postgres` ;
- RLS desactivee sur ces 60 tables ;
- roles `anon` et `authenticated` beneficiaires des droits de lecture et de modification sur les 60 tables ;
- 15 sequences possedees par `postgres` et aucune fonction dans `public` ;
- le role `postgres` du projet dispose de `BYPASSRLS`.

**Impact :** si la Data API est active et expose `public`, un client disposant d'une cle publiee peut potentiellement lire ou modifier les donnees par les endpoints generes. Cette analyse ne prouve pas qu'une exploitation a eu lieu.

## Architecture et choix

Le code applicatif utilise `pg.Pool` et `DATABASE_URL` dans `App/server.js`. Il ne depend pas de `supabase-js` ni des endpoints REST/GraphQL Supabase pour le gameplay.

**Solution privilegiee :** dans Supabase > Integrations > Data API > Overview, desactiver **Enable Data API** si aucun service externe n'en depend. Cela bloque les endpoints generes sans changer les tables ni les roles utilises par le serveur Node.

**Defense complementaire :** le script `App/sql/security/lockdown_data_api.sql` supprime les privileges des roles `anon` et `authenticated`, empeche les futures attributions automatiques pour les objets `postgres` dans `public`, et active RLS sans politique ouverte sur les tables existantes.

Aucune de ces actions n'est automatique lors d'un merge ou d'un deploiement.

## Prevol obligatoire avant execution du SQL

1. Dans Render, verifier **sans copier ici** la valeur du NOM D'UTILISATEUR de `DATABASE_URL`. Confirmer explicitement que le backend utilise `postgres` ou un role avec droits verifies sous RLS. Le role observe dans l'outil Supabase n'est pas une preuve du role employe par Render.
2. Inventorier les integrations externes : Data API REST, GraphQL, Supabase client, fonctions RPC et tableaux de bord. Ne pas supprimer des droits necessaires sans alternative testee.
3. Creer une sauvegarde ou un point de restauration et enregistrer les droits precedents. Planifier la verification du fonctionnement de la connexion, des scores, des captures, des comptes et des echanges.
4. Sur une base de test issue de la meme structure, appliquer le SQL puis verifier le gameplay et les controles `postgres`. **Ne pas utiliser le projet de production comme environnement de test.**
5. Seulement apres ces controles, desactiver l'API dans les reglages si possible, et appliquer le script avec un administrateur DB en fenetre de maintenance. Ne jamais l'executer automatiquement au demarrage du serveur.

## Verification SQL (lecture seule)

```sql
SELECT
  count(*)::int AS tables_public,
  count(*) FILTER (WHERE NOT c.relrowsecurity)::int AS tables_sans_rls,
  count(*) FILTER (WHERE
    has_table_privilege('anon', c.oid, 'SELECT') OR
    has_table_privilege('anon', c.oid, 'INSERT') OR
    has_table_privilege('anon', c.oid, 'UPDATE') OR
    has_table_privilege('anon', c.oid, 'DELETE')
  )::int AS tables_accessibles_anon,
  count(*) FILTER (WHERE
    has_table_privilege('authenticated', c.oid, 'SELECT') OR
    has_table_privilege('authenticated', c.oid, 'INSERT') OR
    has_table_privilege('authenticated', c.oid, 'UPDATE') OR
    has_table_privilege('authenticated', c.oid, 'DELETE')
  )::int AS tables_accessibles_authenticated
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p');
```

Attendu apres le script : `tables_sans_rls=0`, `tables_accessibles_anon=0`, `tables_accessibles_authenticated=0`. Refaire les *Security Advisors* Supabase et les smoke-tests de l'application. Les chiffres de la base pourront evoluer (nouvelles tables).

Si une API publique est necessaire plus tard, creer une surface explicite avec `GRANT` minimum et politiques RLS propres aux identites et operations. Ne jamais retablir globalement `GRANT ALL` ou une politique `USING (true)`.

**Rollback d'incident :** ne pas restaurer aveuglement tous les privileges `anon`/`authenticated`. Recuperer le snapshot des privileges avant modification et ne restaurer que ce dont un service legitime a besoin, avec des politiques RLS appropriees ; en cas de panne, verifier d'abord le role de connexion du serveur et les journaux SQL.

## Sources

- [Supabase — Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — Default privileges (novembre 2026)](https://supabase.com/kb/troubleshooting/cant-change-the-default-privileges-of-supabase_admin-in-the-public-schema-448af9)

**Limite :** le script ne change pas les privileges du role interne `supabase_admin` et ne regle pas a lui seul la visibilite d'autres schemas. Les futures fonctions SQL doivent faire l'objet d'une revue distincte, car le droit global `EXECUTE` du role `PUBLIC` peut s'appliquer par defaut.
