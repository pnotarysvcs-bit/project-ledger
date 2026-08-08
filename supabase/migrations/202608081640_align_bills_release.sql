-- Align the live Bills schema with the persisted monthly-occurrence framework.
-- Bills Master budget remains the recurring planning amount. Each month can
-- preserve its own Budget snapshot, Actual Bill Amount, and due date.

alter table public.ledger_bill_months
  add column if not exists occurrence_budget_amount numeric(12,2),
  add column if not exists actual_amount numeric(12,2),
  add column if not exists due_date date;

alter table public.ledger_bill_months
  drop constraint if exists ledger_bill_months_occurrence_budget_nonnegative;
alter table public.ledger_bill_months
  add constraint ledger_bill_months_occurrence_budget_nonnegative
  check (occurrence_budget_amount is null or occurrence_budget_amount >= 0);

alter table public.ledger_bill_months
  drop constraint if exists ledger_bill_months_actual_nonnegative;
alter table public.ledger_bill_months
  add constraint ledger_bill_months_actual_nonnegative
  check (actual_amount is null or actual_amount >= 0);

-- Backfill only currently unset occurrence fields. The master Budget is used
-- as the compatibility snapshot for existing open rows; no payment rows are changed.
update public.ledger_bill_months m
set occurrence_budget_amount = b.budget
from public.ledger_bills b
where m.bill_id = b.id
  and m.occurrence_budget_amount is null;

update public.ledger_bill_months m
set due_date = make_date(
  extract(year from m.month)::int,
  extract(month from m.month)::int,
  least(
    b.due_day::int,
    extract(day from (date_trunc('month', m.month) + interval '1 month - 1 day'))::int
  )
)
from public.ledger_bills b
where m.bill_id = b.id
  and m.due_date is null;

-- Payment mutations are scoped by bill and reporting month in the app.
create index if not exists ledger_bill_payments_bill_month_id_idx
  on public.ledger_bill_payments (bill_id, payment_month, id);

create index if not exists ledger_bill_months_bill_month_idx
  on public.ledger_bill_months (bill_id, month);

create index if not exists ledger_bills_archive_history_idx
  on public.ledger_bills (start_month, archived_at, is_active);
