-- Align the legacy statement-reconciliation tables with the stabilized Issue #42 contract.
-- This migration is additive and preserves the earlier June reconciliation data.

alter table public.ledger_statement_imports add column if not exists source_name text;
alter table public.ledger_statement_imports add column if not exists source_hash text;
alter table public.ledger_statement_imports add column if not exists period_start date;
alter table public.ledger_statement_imports add column if not exists period_end date;
alter table public.ledger_statement_imports add column if not exists override_month date;
alter table public.ledger_statement_imports add column if not exists effective_month date;
alter table public.ledger_statement_imports add column if not exists warning_confirmed boolean not null default false;

update public.ledger_statement_imports
set source_name = coalesce(source_name, file_name),
    source_hash = coalesce(source_hash, statement_hash),
    period_start = coalesce(period_start, detected_period_start),
    period_end = coalesce(period_end, detected_period_end),
    effective_month = coalesce(effective_month, confirmed_month, detected_month, date_trunc('month', created_at)::date)
where source_name is null
   or source_hash is null
   or period_start is null
   or period_end is null
   or effective_month is null;

alter table public.ledger_statement_imports alter column source_name set not null;
alter table public.ledger_statement_imports alter column source_hash set not null;
alter table public.ledger_statement_imports alter column effective_month set not null;
create unique index if not exists ledger_statement_imports_source_hash_key on public.ledger_statement_imports(source_hash);

alter table public.ledger_statement_transactions add column if not exists source_identity text;
alter table public.ledger_statement_transactions add column if not exists bill_id uuid;
alter table public.ledger_statement_transactions add column if not exists occurrence_id uuid;
alter table public.ledger_statement_transactions add column if not exists confidence numeric(6,4);
alter table public.ledger_statement_transactions add column if not exists decision_note text;
alter table public.ledger_statement_transactions add column if not exists resolved_at timestamptz;

update public.ledger_statement_transactions
set source_identity = coalesce(source_identity, transaction_key),
    bill_id = coalesce(bill_id, matched_bill_id),
    occurrence_id = coalesce(occurrence_id, matched_occurrence_id),
    decision_note = coalesce(decision_note, decision)
where source_identity is null
   or bill_id is null
   or occurrence_id is null
   or decision_note is null;

alter table public.ledger_statement_transactions alter column source_identity set not null;
create unique index if not exists ledger_statement_transactions_source_identity_key on public.ledger_statement_transactions(import_id, source_identity);
create index if not exists ledger_statement_transactions_import_idx on public.ledger_statement_transactions(import_id);

alter table public.ledger_statement_transactions drop constraint if exists ledger_statement_transactions_match_status_check;
update public.ledger_statement_transactions set match_status = case match_status
  when 'matched' then 'Matched'
  when 'amount_variance' then 'Amount Variance'
  when 'new' then 'NEW'
  when 'unmatched' then 'Unmatched'
  when 'excluded' then 'Dismissed'
  when 'duplicate' then 'Duplicate'
  else match_status
end;
alter table public.ledger_statement_transactions add constraint ledger_statement_transactions_match_status_check
  check (match_status in ('Matched','Amount Variance','NEW','Unmatched','Duplicate','Dismissed'));

do $$ begin
  if not exists (select 1 from pg_constraint where conname='ledger_statement_transactions_bill_id_fkey') then
    alter table public.ledger_statement_transactions
      add constraint ledger_statement_transactions_bill_id_fkey
      foreign key (bill_id) references public.ledger_bills(id);
  end if;
  if not exists (select 1 from pg_constraint where conname='ledger_statement_transactions_occurrence_id_fkey') then
    alter table public.ledger_statement_transactions
      add constraint ledger_statement_transactions_occurrence_id_fkey
      foreign key (occurrence_id) references public.ledger_bill_months(id);
  end if;
end $$;

alter table public.ledger_statement_imports enable row level security;
alter table public.ledger_statement_transactions enable row level security;
