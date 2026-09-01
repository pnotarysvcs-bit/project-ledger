-- Supabase preview branches only apply migration files that have not been
-- seen before; edits to the content of an already-tracked migration file
-- (such as the earlier legacy-schema fix that unblocked this migration
-- chain) are not replayed until the branch is rebuilt. This new, uniquely
-- named migration re-asserts the Cash Guard reserve-source columns so the
-- preview/UAT database is guaranteed to have them without requiring the PR
-- to be closed and reopened. It is fully idempotent and a no-op wherever
-- the columns already exist (including production).
alter table public.ledger_cash_guard
  add column if not exists variable_essentials_source text not null default 'estimate'
    check (variable_essentials_source in ('estimate', 'manual')),
  add column if not exists planned_one_offs_source text not null default 'estimate'
    check (planned_one_offs_source in ('estimate', 'manual'));
