-- Legacy statement reconciliation columns remain for historical audit compatibility,
-- but the stabilized workflow writes the canonical source_* and match columns.
-- These legacy columns must therefore no longer block canonical inserts.

alter table public.ledger_statement_imports alter column statement_hash drop not null;
alter table public.ledger_statement_imports alter column file_name drop not null;
alter table public.ledger_statement_transactions alter column transaction_key drop not null;
