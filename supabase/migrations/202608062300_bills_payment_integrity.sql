-- Preserve archived bills in reporting months that ended before retirement.
create index if not exists ledger_bills_archive_history_idx
  on public.ledger_bills (archived_at, start_month);

comment on column public.ledger_bills.archived_at is
  'Retirement timestamp; reporting months ending before this timestamp retain the bill historically.';
