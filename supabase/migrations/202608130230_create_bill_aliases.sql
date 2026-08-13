-- Additive merchant-alias memory for statement reconciliation.
-- Production already contains ledger_bill_aliases with alias/normalized_alias.
-- Preserve that schema while adding compatibility columns and amount-learning
-- fields used by the strengthened matcher.

create table if not exists public.ledger_bill_aliases (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.ledger_bills(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  unique(bill_id, normalized_alias)
);

alter table public.ledger_bill_aliases
  add column if not exists alias_raw text,
  add column if not exists alias_normalized text,
  add column if not exists amount_hint numeric(12,2),
  add column if not exists last_seen_at timestamptz not null default now();

update public.ledger_bill_aliases
set alias_raw = coalesce(alias_raw, alias),
    alias_normalized = coalesce(alias_normalized, normalized_alias)
where alias_raw is null or alias_normalized is null;

create index if not exists ledger_bill_aliases_bill_idx
  on public.ledger_bill_aliases(bill_id);

create index if not exists ledger_bill_aliases_normalized_idx
  on public.ledger_bill_aliases(normalized_alias);

create unique index if not exists ledger_bill_aliases_alias_normalized_bill_key
  on public.ledger_bill_aliases(alias_normalized, bill_id)
  where alias_normalized is not null;

create index if not exists ledger_bill_aliases_alias_normalized_idx
  on public.ledger_bill_aliases(alias_normalized);

alter table public.ledger_bill_aliases enable row level security;

comment on table public.ledger_bill_aliases is
  'Learned bank-statement merchant descriptors mapped to Master Bills for future reconciliation.';
comment on column public.ledger_bill_aliases.amount_hint is
  'Most recently confirmed statement amount; used as a tie-breaker when one descriptor maps to multiple bills.';
