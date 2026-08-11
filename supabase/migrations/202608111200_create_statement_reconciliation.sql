-- Additive persistence for Issue #42 statement reconciliation.
create table if not exists public.ledger_statement_imports (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_hash text not null unique,
  period_start date,
  period_end date,
  detected_month date,
  override_month date,
  effective_month date not null,
  status text not null default 'review' check (status in ('review','completed')),
  warning_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ledger_statement_transactions (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.ledger_statement_imports(id) on delete cascade,
  source_identity text not null,
  transaction_date date not null,
  raw_description text not null,
  normalized_payee text not null,
  amount numeric(12,2) not null check (amount >= 0),
  expected_amount numeric(12,2),
  match_status text not null check (match_status in ('Matched','Amount Variance','NEW','Unmatched','Duplicate','Dismissed')),
  bill_id uuid references public.ledger_bills(id),
  occurrence_id uuid references public.ledger_bill_months(id),
  payment_id uuid references public.ledger_bill_payments(id),
  confidence numeric(6,4),
  decision_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(import_id, source_identity)
);

create index if not exists ledger_statement_transactions_import_idx on public.ledger_statement_transactions(import_id);
alter table public.ledger_statement_imports enable row level security;
alter table public.ledger_statement_transactions enable row level security;

comment on table public.ledger_statement_imports is 'Auditable, idempotent source statements for Bills reconciliation.';
comment on column public.ledger_statement_imports.override_month is 'User-confirmed reporting-month override; detected_month is retained.';
