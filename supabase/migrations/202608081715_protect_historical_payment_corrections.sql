-- Protect closed-period payment history from ordinary in-place mutation.
-- Prior-month corrections must use a separately designed audited correction workflow.

create or replace function public.project_ledger_protect_historical_payments()
returns trigger
language plpgsql
as $$
declare
  current_month date := date_trunc('month', current_date)::date;
begin
  if tg_op = 'DELETE' then
    if old.payment_month < current_month then
      raise exception 'Historical payment corrections require the audited correction workflow.'
        using errcode = 'P0001';
    end if;
    return old;
  end if;

  if old.payment_month < current_month or new.payment_month < current_month then
    raise exception 'Historical payment corrections require the audited correction workflow.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists ledger_bill_payments_protect_history on public.ledger_bill_payments;
create trigger ledger_bill_payments_protect_history
before update or delete on public.ledger_bill_payments
for each row execute function public.project_ledger_protect_historical_payments();

comment on function public.project_ledger_protect_historical_payments() is
  'Rejects ordinary UPDATE/DELETE operations against prior-month ledger payments so closed-period history cannot be silently rewritten.';
