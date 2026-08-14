-- Complete the audited historical payment correction workflow promised by the
-- closed-period protection trigger. Reversals preserve the original payment
-- snapshot and may only run through the service-role RPC.

create table if not exists public.ledger_payment_correction_audit (
  id uuid primary key default gen_random_uuid(),
  original_payment_id uuid not null,
  bill_id uuid not null references public.ledger_bills(id) on delete restrict,
  occurrence_id uuid,
  payment_month date not null,
  payment_date date not null,
  amount numeric(12,2) not null,
  funding_account text,
  notes text,
  statement_transaction_id uuid,
  correction_type text not null check (correction_type in ('reversal')),
  correction_reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists ledger_payment_correction_audit_lookup_idx
  on public.ledger_payment_correction_audit (bill_id, payment_month, created_at desc);

alter table public.ledger_payment_correction_audit enable row level security;

create or replace function public.project_ledger_protect_historical_payments()
returns trigger
language plpgsql
as $$
declare
  current_month date := date_trunc('month', current_date)::date;
  only_statement_provenance_changed boolean;
  audited_correction boolean := coalesce(current_setting('project_ledger.audited_payment_correction', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    if old.payment_month < current_month and not audited_correction then
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

create or replace function public.project_ledger_reverse_payment(
  p_payment_id uuid,
  p_bill_id uuid,
  p_payment_month date,
  p_occurrence_id uuid default null,
  p_reason text default 'Undo Submitted'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.ledger_bill_payments%rowtype;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A correction reason is required.' using errcode = '22023';
  end if;

  select * into target
  from public.ledger_bill_payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found.' using errcode = 'P0002';
  end if;

  if target.bill_id <> p_bill_id or target.payment_month <> p_payment_month then
    raise exception 'Payment does not match the requested bill and month.' using errcode = '22023';
  end if;

  if p_occurrence_id is not null and target.occurrence_id is distinct from p_occurrence_id then
    raise exception 'Payment does not match the requested occurrence.' using errcode = '22023';
  end if;

  insert into public.ledger_payment_correction_audit (
    original_payment_id,
    bill_id,
    occurrence_id,
    payment_month,
    payment_date,
    amount,
    funding_account,
    notes,
    statement_transaction_id,
    correction_type,
    correction_reason
  ) values (
    target.id,
    target.bill_id,
    target.occurrence_id,
    target.payment_month,
    target.payment_date,
    target.amount,
    target.funding_account,
    target.notes,
    target.statement_transaction_id,
    'reversal',
    btrim(p_reason)
  );

  perform set_config('project_ledger.audited_payment_correction', 'on', true);
  delete from public.ledger_bill_payments where id = target.id;
end;
$$;

revoke all on function public.project_ledger_reverse_payment(uuid, uuid, date, uuid, text) from public, anon, authenticated;
grant execute on function public.project_ledger_reverse_payment(uuid, uuid, date, uuid, text) to service_role;

comment on table public.ledger_payment_correction_audit is
  'Immutable snapshot audit for reversed Project Ledger payments.';

comment on function public.project_ledger_reverse_payment(uuid, uuid, date, uuid, text) is
  'Service-role-only audited reversal for an exact bill payment. Supports historical payments protected from ordinary update/delete.';
