create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  institution text not null,
  kind text not null check (kind in ('checking','savings')),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ledger_accounts_archive_state check (
    (is_active = true and archived_at is null)
    or (is_active = false)
  )
);

create unique index if not exists ledger_accounts_active_unique
  on public.ledger_accounts (lower(institution), kind)
  where is_active = true;

create index if not exists ledger_accounts_active_name_idx
  on public.ledger_accounts (is_active, lower(institution));

drop trigger if exists ledger_accounts_set_updated_at on public.ledger_accounts;
create trigger ledger_accounts_set_updated_at
before update on public.ledger_accounts
for each row execute function public.project_ledger_set_updated_at();

alter table public.ledger_accounts enable row level security;
