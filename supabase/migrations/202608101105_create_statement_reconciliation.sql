create table if not exists public.ledger_statement_imports (
  id uuid primary key default gen_random_uuid(),
  statement_hash text not null unique,
  file_name text not null,
  detected_period_start date,
  detected_period_end date,
  detected_month date,
  confirmed_month date,
  status text not null default 'review' check (status in ('review','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ledger_statement_transactions (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.ledger_statement_imports(id) on delete cascade,
  transaction_key text not null,
  transaction_date date not null,
  raw_description text not null,
  normalized_payee text,
  amount numeric(12,2) not null check (amount >= 0),
  match_status text not null check (match_status in ('matched','amount_variance','new','unmatched','excluded','duplicate')),
  matched_bill_id uuid references public.ledger_bills(id),
  matched_occurrence_id uuid references public.ledger_bill_months(id),
  expected_amount numeric(12,2),
  decision text,
  payment_id uuid references public.ledger_bill_payments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(import_id, transaction_key)
);

create table if not exists public.ledger_bill_aliases (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.ledger_bills(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  unique(bill_id, normalized_alias)
);

create index if not exists ledger_statement_transactions_import_idx
  on public.ledger_statement_transactions(import_id);
create index if not exists ledger_statement_transactions_match_idx
  on public.ledger_statement_transactions(matched_bill_id, matched_occurrence_id);
create index if not exists ledger_bill_aliases_normalized_idx
  on public.ledger_bill_aliases(normalized_alias);

alter table public.ledger_statement_imports enable row level security;
alter table public.ledger_statement_transactions enable row level security;
alter table public.ledger_bill_aliases enable row level security;

comment on table public.ledger_statement_imports is 'Auditable bank statement imports used for monthly bill reconciliation.';
comment on table public.ledger_statement_transactions is 'Parsed statement debits and their reconciliation decisions.';
comment on table public.ledger_bill_aliases is 'Persisted statement merchant/payee aliases for deterministic bill matching.';
