-- Second attempt at guaranteeing the Cash Guard reserve-source columns are
-- visible on the Supabase preview/UAT database. The Supabase branch bot
-- confirmed the prior migration (202609011320) applied successfully at the
-- database layer, but the app still saw
-- "column ledger_cash_guard.variable_essentials_source does not exist"
-- (PostgreSQL error 42703) via the Supabase REST API. That is because the
-- app talks to PostgREST, not to Postgres directly (see
-- src/cash-guard.js's supabaseRequest calls), and PostgREST keeps an
-- in-memory cache of the database schema that is only refreshed when it
-- receives a `NOTIFY pgrst, 'reload schema'` (or is restarted). A DDL change
-- applied via the SQL migration runner does not by itself guarantee that
-- notification is sent on every preview-branch rebuild.
--
-- This migration is intentionally idempotent and safe to run any number of
-- times, on any environment (fresh preview branch or production):
--   1. Re-assert the two columns with `add column if not exists`, keeping
--      the approved default ('estimate') and allowed-values constraint
--      ('estimate', 'manual') identical to the original migration.
--   2. Explicitly notify PostgREST to reload its schema cache so the REST
--      API immediately recognizes the columns without requiring a manual
--      restart or an additional close/reopen of the pull request.
alter table public.ledger_cash_guard
  add column if not exists variable_essentials_source text not null default 'estimate'
    check (variable_essentials_source in ('estimate', 'manual')),
  add column if not exists planned_one_offs_source text not null default 'estimate'
    check (planned_one_offs_source in ('estimate', 'manual'));

notify pgrst, 'reload schema';
