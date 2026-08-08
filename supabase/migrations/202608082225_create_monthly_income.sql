create table if not exists public.ledger_monthly_finances (
  month date primary key,
  income numeric(14,2) not null default 0 check (income >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ledger_monthly_finances_month_first_day check (date_part('day', month) = 1)
);

alter table public.ledger_monthly_finances enable row level security;

comment on table public.ledger_monthly_finances is 'Month-scoped financial inputs for Project Ledger. Income is independent of bills and payments.';
comment on column public.ledger_monthly_finances.income is 'User-entered income for the reporting month.';
