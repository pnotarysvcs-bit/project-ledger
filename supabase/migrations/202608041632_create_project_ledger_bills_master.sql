create table if not exists public.ledger_bills (
  id uuid primary key default gen_random_uuid(),
  bill_name text not null,
  bill_type text not null check (bill_type in ('Personal','Streaming','Business')),
  category text not null,
  account text not null,
  budget numeric(12,2),
  source_annual_budget numeric(12,2),
  frequency text not null check (frequency in ('monthly','bi-weekly','quarterly','annual','one-time')),
  due_day smallint not null check (due_day between 1 and 31),
  pay_period text,
  start_month date not null default date '2026-04-01',
  is_active boolean not null default true,
  archived_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ledger_bills_archive_state check (
    (is_active = true and archived_at is null)
    or (is_active = false)
  ),
  constraint ledger_bills_name_start_unique unique (bill_name, start_month)
);

create table if not exists public.ledger_bill_months (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.ledger_bills(id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  status text check (status in ('due-soon','overdue','partial','submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ledger_bill_months_unique unique (bill_id, month)
);

create table if not exists public.ledger_bill_payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.ledger_bills(id) on delete cascade,
  payment_month date not null check (payment_month = date_trunc('month', payment_month)::date),
  payment_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  funding_account text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ledger_bills_active_name_idx
  on public.ledger_bills (is_active, lower(bill_name));
create index if not exists ledger_bill_months_month_idx
  on public.ledger_bill_months (month, bill_id);
create index if not exists ledger_bill_payments_month_idx
  on public.ledger_bill_payments (payment_month, bill_id, payment_date);

create or replace function public.project_ledger_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ledger_bills_set_updated_at on public.ledger_bills;
create trigger ledger_bills_set_updated_at
before update on public.ledger_bills
for each row execute function public.project_ledger_set_updated_at();

drop trigger if exists ledger_bill_months_set_updated_at on public.ledger_bill_months;
create trigger ledger_bill_months_set_updated_at
before update on public.ledger_bill_months
for each row execute function public.project_ledger_set_updated_at();

drop trigger if exists ledger_bill_payments_set_updated_at on public.ledger_bill_payments;
create trigger ledger_bill_payments_set_updated_at
before update on public.ledger_bill_payments
for each row execute function public.project_ledger_set_updated_at();

alter table public.ledger_bills enable row level security;
alter table public.ledger_bill_months enable row level security;
alter table public.ledger_bill_payments enable row level security;
