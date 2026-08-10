alter table public.ledger_bill_payments
  add column if not exists statement_transaction_id uuid references public.ledger_statement_transactions(id);

create unique index if not exists ledger_bill_payments_statement_transaction_uidx
  on public.ledger_bill_payments(statement_transaction_id)
  where statement_transaction_id is not null;
