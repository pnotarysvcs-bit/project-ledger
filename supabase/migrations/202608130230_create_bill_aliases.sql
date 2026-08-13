-- Additive merchant-alias memory for statement reconciliation.
-- A normalized descriptor may map to more than one Master Bill (for example,
-- multiple Affirm accounts). Amount hints help disambiguate those cases.

create table if not exists public.ledger_bill_aliases (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.ledger_bills(id) on delete cascade,
  alias_raw text not null,
  alias_normalized text not null,
  amount_hint numeric(12,2),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(alias_normalized, bill_id)
);

create index if not exists ledger_bill_aliases_bill_idx
  on public.ledger_bill_aliases(bill_id);

create index if not exists ledger_bill_aliases_normalized_idx
  on public.ledger_bill_aliases(alias_normalized);

alter table public.ledger_bill_aliases enable row level security;

comment on table public.ledger_bill_aliases is
  'Learned bank-statement merchant descriptors mapped to Master Bills for future reconciliation.';
comment on column public.ledger_bill_aliases.amount_hint is
  'Most recently confirmed statement amount; used as a tie-breaker when one descriptor maps to multiple bills.';
