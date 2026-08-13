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

create or replace function public.sync_ledger_bill_alias_columns()
returns trigger
language plpgsql
as $$
begin
  new.alias_raw := coalesce(new.alias_raw, new.alias);
  new.alias_normalized := coalesce(new.alias_normalized, new.normalized_alias);
  new.alias := coalesce(new.alias, new.alias_raw);
  new.normalized_alias := coalesce(new.normalized_alias, new.alias_normalized);
  return new;
end;
$$;

drop trigger if exists ledger_bill_aliases_sync_columns on public.ledger_bill_aliases;
create trigger ledger_bill_aliases_sync_columns
before insert or update on public.ledger_bill_aliases
for each row execute function public.sync_ledger_bill_alias_columns();

create index if not exists ledger_bill_aliases_bill_idx
  on public.ledger_bill_aliases(bill_id);

create index if not exists ledger_bill_aliases_normalized_idx
  on public.ledger_bill_aliases(normalized_alias);

drop index if exists public.ledger_bill_aliases_alias_normalized_bill_key;
create unique index ledger_bill_aliases_alias_normalized_bill_key
  on public.ledger_bill_aliases(alias_normalized, bill_id);

create index if not exists ledger_bill_aliases_alias_normalized_idx
  on public.ledger_bill_aliases(alias_normalized);

alter table public.ledger_bill_aliases enable row level security;

comment on table public.ledger_bill_aliases is
  'Learned bank-statement merchant descriptors mapped to Master Bills for future reconciliation.';
comment on column public.ledger_bill_aliases.amount_hint is
  'Most recently confirmed statement amount; used as a tie-breaker when one descriptor maps to multiple bills.';
