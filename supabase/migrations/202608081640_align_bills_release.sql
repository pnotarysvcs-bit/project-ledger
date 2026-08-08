-- Align the live Bills schema with the persisted monthly-occurrence framework.
-- Bills Master budget remains the recurring planning amount. Each month can
-- preserve its own Budget snapshot, Actual Bill Amount, and due date.

alter table public.ledger_bill_months
  add column if not exists occurrence_budget_amount numeric(12,2),
  add column if not exists actual_amount numeric(12,2),
  add column if not exists due_date date,
  add column if not exists migration_incomplete boolean not null default false;

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

-- Existing occurrence rows predate the monthly Budget/Actual fields. Do not
-- infer historical values from today's recurring master. A null snapshot is
-- explicitly marked incomplete until traceable source evidence is supplied.
update public.ledger_bill_months
set migration_incomplete = true
where occurrence_budget_amount is null;

-- Payment mutations are scoped by bill and reporting month in the app.
create index if not exists ledger_bill_payments_bill_month_id_idx
  on public.ledger_bill_payments (bill_id, payment_month, id);

create index if not exists ledger_bill_months_bill_month_idx
  on public.ledger_bill_months (bill_id, month);

create index if not exists ledger_bills_archive_history_idx
  on public.ledger_bills (start_month, archived_at, is_active);
