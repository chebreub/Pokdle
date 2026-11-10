# Supabase — protection des tables applicatives (10 novembre 2026)

## Architecture

Le serveur Node.js (App/server.js) se connecte directement a PostgreSQL via pg.Pool / DATABASE_URL. Les controles applicatifs passent par Express. Aucun usage direct de supabase-js ou de PostgREST n'a ete trouve dans les sources examinees.

Les tables applicatives de public sont privees. Ne pas creer de politiques publiques ouvertes pour effacer les messages informatifs du Security Advisor.

## Intervention appliquee en production

Migration Supabase : secure_server_only_tables_rls_and_grants_20261110.

- Activation de RLS sur les tables existantes du schema public.
- Revocation de tous les privileges sur les tables et sequences pour anon et authenticated.
- Revocation des privileges par defaut attribues par postgres a ces roles sur les futures tables, sequences et fonctions de public.
- Conservation de l'acces de postgres, role avec BYPASSRLS, ainsi que des privileges du service_role.
- Aucune suppression de donnees ou modification de progression des joueurs.

## Verification du 10/11/2026

| Verification | Resultat |
| --- | --- |
| Tables avec RLS activee | 60 / 60 |
| Tables avec RLS desactivee | 0 |
| Tables avec acces direct anon | 0 |
| Tables avec acces direct authenticated | 0 |
| Tables accessibles par postgres | 60 |
| Sequences exposees a anon / authenticated | 0 / 15 |
| Grants par defaut postgres vers anon / authenticated | 0 |
| Security Advisor, alertes ERROR | 0 |
| Security Advisor, messages INFO rls_enabled_no_policy | 60 (attendu) |

Requetes SELECT LIMIT 0 reussies sur public.users et public.scores sous postgres, sans lecture de donnees personnelles.

Une recette utilisateur du site reste necessaire : le navigateur externe utilise pour la verification ne pouvait pas acceder a pokdle.fr. Les controles SQL ne constituent pas un test complet du serveur Render.

## Preventif

- Toute nouvelle table doit activer RLS au moment de sa creation. La revocation des grants par defaut ne remplace pas RLS.
- Ne pas exposer de cle service_role au navigateur ni publier DATABASE_URL.
- Revoir les fonctions SQL ajoutees dans public : PostgreSQL peut donner EXECUTE a PUBLIC par defaut, et RLS ne protege pas les fonctions.
- Avant chaque evolution : sauvegarde, migration atomique, verification des grants et advisors, recette du site.
- Les 60 messages INFO actuels ne justifient aucune politique permissive.

Documentation : https://supabase.com/docs/guides/api/securing-your-api