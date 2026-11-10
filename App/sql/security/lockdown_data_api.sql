-- Pokdle / Supabase : verrouillage de la Data API (APPLICATION MANUELLE UNIQUEMENT).
-- 2026-11-10. Ne pas lancer par CI, migration automatique ou deploiement Render.
-- AVANT : suivre docs/security/SUPABASE_API_LOCKDOWN.md, confirmer le role
-- utilise par DATABASE_URL (backend Node/pg), faire un backup et prevoir un rollback.
-- L'application Node utilise une connexion PostgreSQL directe. Les roles
-- Supabase anon/authenticated ne doivent pas avoir d'acces direct aux tables.
--
-- IMPORTANT : le role du backend doit rester postgres (proprietaire, BYPASSRLS)
-- ou posseder des droits adaptes ; sinon RLS peut interrompre les jeux.
-- Le script refuse toute table public non detenue par postgres.
BEGIN;

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relowner <> 'postgres'::regrole
  ) THEN
    RAISE EXCEPTION
      'Abandon : au moins une table public ne depend pas du role postgres. Revoir les roles backend et les proprietaires.';
  END IF;
END
$preflight$;

-- Interdire la lecture et les mutations depuis la Data API avec ces deux roles.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Ne plus exposer par defaut les futures tables creees par postgres.
-- Ces commandes ne touchent pas aux objets existants.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM anon, authenticated;

-- Defense en profondeur : aucune politique ouverte. postgres est proprietaire
-- des 60 tables observees et dispose de BYPASSRLS dans le projet controle.
DO $lockdown$
DECLARE rec record;
BEGIN
  FOR rec IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      rec.schema_name, rec.table_name);
  END LOOP;
END
$lockdown$;

COMMIT;

-- Verification en lecture seule :
-- SELECT count(*) FILTER (WHERE NOT c.relrowsecurity) AS sans_rls,
--   count(*) FILTER (WHERE has_table_privilege('anon', c.oid, 'SELECT')
--     OR has_table_privilege('anon', c.oid, 'INSERT')
--     OR has_table_privilege('anon', c.oid, 'UPDATE')
--     OR has_table_privilege('anon', c.oid, 'DELETE')) AS acces_anon
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname='public' AND c.relkind IN ('r','p');
-- Les deux resultats doivent etre a zero.
