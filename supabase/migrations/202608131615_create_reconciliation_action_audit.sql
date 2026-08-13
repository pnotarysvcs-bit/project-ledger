-- Auditable one-level undo support for statement reconciliation review actions.
create table if not exists public.ledger_reconciliation_actions (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.ledger_statement_imports(id) on delete cascade,
  transaction_id uuid not null references public.ledger_statement_transactions(id) on delete cascade,
  action_type text not null check (action_type in ('dismiss','edit-review','match-existing')),
  before_state jsonb not null,
  created_at timestamptz not null default now(),
  reversed_at timestamptz
);

create index if not exists ledger_reconciliation_actions_import_created_idx
  on public.ledger_reconciliation_actions(import_id, created_at desc);

alter table public.ledger_reconciliation_actions enable row level security;

comment on table public.ledger_reconciliation_actions is
  'Audit history for reversible pre-completion statement reconciliation review actions.';
