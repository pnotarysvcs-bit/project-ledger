-- Legacy statement reconciliation columns remain for historical audit compatibility,
-- but the stabilized workflow writes the canonical source_* and match columns.
-- These legacy columns must therefore no longer block canonical inserts.
-- Guarded: file_name/statement_hash/transaction_key only exist on databases that predate
-- this migration tracking; a fresh database (e.g. a preview branch) never has them.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ledger_statement_imports' and column_name = 'statement_hash'
  ) then
    alter table public.ledger_statement_imports alter column statement_hash drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ledger_statement_imports' and column_name = 'file_name'
  ) then
    alter table public.ledger_statement_imports alter column file_name drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ledger_statement_transactions' and column_name = 'transaction_key'
  ) then
    alter table public.ledger_statement_transactions alter column transaction_key drop not null;
  end if;
end $$;
