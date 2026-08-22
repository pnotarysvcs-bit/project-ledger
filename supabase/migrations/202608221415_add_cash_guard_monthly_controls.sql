create table if not exists public.ledger_cash_guard (
  month date primary key,
  available_cash numeric not null default 0 check (available_cash >= 0),
  variable_essentials_reserve numeric not null default 0 check (variable_essentials_reserve >= 0),
  planned_one_offs_reserve numeric not null default 0 check (planned_one_offs_reserve >= 0),
  cash_floor numeric not null default 0 check (cash_floor >= 0),
  discretionary_lock_until date,
  cash_as_of timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ledger_cash_guard enable row level security;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ledger_cash_guard'
      and policyname = 'ledger_cash_guard_service_read'
  ) then
    create policy ledger_cash_guard_service_read
      on public.ledger_cash_guard
      for select
      using (true);
  end if;
end $$;
