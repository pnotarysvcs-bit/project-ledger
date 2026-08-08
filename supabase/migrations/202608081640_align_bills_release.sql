-- Align the live Bills schema with the persisted payment framework.
-- Budget remains the recurring planning amount; actual_amount is the confirmed
-- bill amount when known. Existing rows remain valid because actual_amount is nullable.

alter table public.ledger_bills
  add column if not exists actual_amount numeric(12,2)
  check (actual_amount is null or actual_amount >= 0);

-- Payment mutations are always scoped by bill and reporting month in the app.
-- This composite index keeps those checks efficient without changing legacy rows.
create index if not exists ledger_bill_payments_bill_month_id_idx
  on public.ledger_bill_payments (bill_id, payment_month, id);

-- Archive history lookups are used when rendering historical reporting periods.
create index if not exists ledger_bills_archive_history_idx
  on public.ledger_bills (start_month, archived_at, is_active);
