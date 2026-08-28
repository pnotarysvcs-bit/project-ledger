-- Each paycheck (and any other income) is its own dated entry.
--
-- Income was previously kept as one running monthly total per month in
-- ledger_monthly_finances, which made two paychecks of the same amount
-- indistinguishable from one paycheck recorded twice. Individual entries
-- remove that ambiguity: a paycheck is counted once because it exists once.

create table if not exists public.ledger_income_entries (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  received_on date not null,
  amount numeric(14,2) not null check (amount > 0),
  kind text not null default 'paycheck' check (kind in ('paycheck', 'notary', 'other')),
  source text not null default 'manual' check (source in ('manual', 'migrated', 'pay_period')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ledger_income_entries_month_first_day check (date_part('day', month) = 1)
);

create index if not exists ledger_income_entries_month_idx on public.ledger_income_entries(month);
create index if not exists ledger_income_entries_received_idx on public.ledger_income_entries(received_on);

alter table public.ledger_income_entries enable row level security;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ledger_income_entries'
      and policyname = 'ledger_income_entries_service_read'
  ) then
    create policy ledger_income_entries_service_read
      on public.ledger_income_entries
      for select
      using (true);
  end if;
end $$;

comment on table public.ledger_income_entries is 'One row per received paycheck or other income. Replaces the single running monthly total in ledger_monthly_finances.';
comment on column public.ledger_income_entries.month is 'First day of the month the income belongs to.';
comment on column public.ledger_income_entries.received_on is 'Date the money was actually received.';
comment on column public.ledger_income_entries.source is 'manual = entered on the Income tab; migrated = carried over from the old monthly total; pay_period = posted against a pay period.';

-- Backfill: carry every existing monthly total over as a single migrated entry
-- so no recorded income is lost. Dated the first of its month because the old
-- format kept no received-on date. Guarded so re-running changes nothing.
insert into public.ledger_income_entries (month, received_on, amount, kind, source, notes)
select
  f.month,
  f.month,
  f.income,
  'paycheck',
  'migrated',
  'Carried over from the previous single monthly income total.'
from public.ledger_monthly_finances f
where f.income > 0
  and not exists (
    select 1
    from public.ledger_income_entries e
    where e.month = f.month
      and e.source = 'migrated'
      and e.kind = 'paycheck'
  );

-- Backfill notary income the same way. It previously lived only on the pay
-- period rows; the Income tab is now the single source of truth for income, so
-- it has to exist as an entry or the monthly total would drop by this amount.
insert into public.ledger_income_entries (month, received_on, amount, kind, source, notes)
select
  p.month,
  p.month,
  sum(p.notary_income),
  'notary',
  'migrated',
  'Carried over from notary income recorded on the pay period rows.'
from public.ledger_pay_period_finances p
group by p.month
having sum(p.notary_income) > 0
  and not exists (
    select 1
    from public.ledger_income_entries e
    where e.month = p.month
      and e.source = 'migrated'
      and e.kind = 'notary'
  );
