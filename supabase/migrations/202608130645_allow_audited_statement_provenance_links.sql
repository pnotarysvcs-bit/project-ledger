-- Allow statement reconciliation to attach provenance to an existing historical payment
-- without weakening the closed-period protection for financial fields.

create table if not exists public.ledger_payment_provenance_audit (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.ledger_bill_payments(id) on delete restrict,
  statement_transaction_id uuid not null references public.ledger_statement_transactions(id) on delete restrict,
  payment_month date not null,
  action text not null default 'statement_provenance_link',
  created_at timestamptz not null default now()
);

create index if not exists ledger_payment_provenance_audit_payment_idx
  on public.ledger_payment_provenance_audit (payment_id, created_at desc);

alter table public.ledger_payment_provenance_audit enable row level security;

create or replace function public.project_ledger_protect_historical_payments()
returns trigger
language plpgsql
as $$
declare
  current_month date := date_trunc('month', current_date)::date;
  only_statement_provenance_changed boolean;
begin
  if tg_op = 'DELETE' then
    if old.payment_month < current_month then
      raise exception 'Historical payment corrections require the audited correction workflow.'
        using errcode = 'P0001';
    end if;
    return old;
  end if;

  if old.payment_month < current_month or new.payment_month < current_month then
    only_statement_provenance_changed :=
      old.statement_transaction_id is null
      and new.statement_transaction_id is not null
      and (to_jsonb(old) - 'statement_transaction_id' - 'updated_at')
          = (to_jsonb(new) - 'statement_transaction_id' - 'updated_at');

    if only_statement_provenance_changed then
      insert into public.ledger_payment_provenance_audit (
        payment_id,
        statement_transaction_id,
        payment_month
      ) values (
        old.id,
        new.statement_transaction_id,
        old.payment_month
      );
      return new;
    end if;

    raise exception 'Historical payment corrections require the audited correction workflow.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on table public.ledger_payment_provenance_audit is
  'Immutable audit trail for statement provenance attached to existing historical payments.';

comment on function public.project_ledger_protect_historical_payments() is
  'Blocks ordinary historical payment updates/deletes while allowing a one-time, audited statement_transaction_id link that changes no financial fields.';
