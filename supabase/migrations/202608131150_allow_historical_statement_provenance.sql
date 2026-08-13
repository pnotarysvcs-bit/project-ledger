-- Allow statement reconciliation to attach provenance to an existing historical payment
-- without weakening closed-period financial immutability.
--
-- A prior-month payment may be updated only when:
--   * statement_transaction_id is being attached for the first time, and
--   * every financial/business field remains unchanged.
-- All other UPDATE/DELETE operations against prior-month payments remain blocked.

create or replace function public.project_ledger_protect_historical_payments()
returns trigger
language plpgsql
as $$
declare
  current_month date := date_trunc('month', current_date)::date;
  provenance_only boolean := false;
begin
  if tg_op = 'DELETE' then
    if old.payment_month < current_month then
      raise exception 'Historical payment corrections require the audited correction workflow.'
        using errcode = 'P0001';
    end if;
    return old;
  end if;

  if old.payment_month < current_month or new.payment_month < current_month then
    provenance_only :=
      old.statement_transaction_id is null
      and new.statement_transaction_id is not null
      and new.id is not distinct from old.id
      and new.bill_id is not distinct from old.bill_id
      and new.occurrence_id is not distinct from old.occurrence_id
      and new.payment_month is not distinct from old.payment_month
      and new.payment_date is not distinct from old.payment_date
      and new.amount is not distinct from old.amount
      and new.funding_account is not distinct from old.funding_account
      and new.notes is not distinct from old.notes
      and new.created_at is not distinct from old.created_at
      and new.allocation_provenance is not distinct from old.allocation_provenance;

    if provenance_only then
      return new;
    end if;

    raise exception 'Historical payment corrections require the audited correction workflow.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.project_ledger_protect_historical_payments() is
  'Rejects prior-month payment mutations except first-time attachment of statement_transaction_id when all financial and business fields are unchanged.';
