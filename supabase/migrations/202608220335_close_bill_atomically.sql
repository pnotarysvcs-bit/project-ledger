create unique index if not exists ledger_goal_rollovers_source_bill_unique
  on public.ledger_goal_rollovers(source_bill_id);

create or replace function public.close_ledger_bill_with_rollover(
  p_source_bill_id uuid,
  p_source_name text,
  p_target_bill_id uuid,
  p_target_name text,
  p_closed_month date,
  p_monthly_amount numeric
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rollover_id uuid;
begin
  update public.ledger_bills
  set is_active = false,
      archived_at = now()
  where id = p_source_bill_id
    and is_active = true;

  if not found then
    raise exception 'Bill was not found or is already closed.';
  end if;

  if p_monthly_amount > 0 then
    insert into public.ledger_goal_rollovers (
      source_bill_id,
      source_name,
      target_bill_id,
      target_name,
      closed_month,
      monthly_amount,
      status
    ) values (
      p_source_bill_id,
      p_source_name,
      p_target_bill_id,
      p_target_name,
      p_closed_month,
      p_monthly_amount,
      case when p_target_bill_id is null then 'unallocated' else 'allocated' end
    )
    returning id into v_rollover_id;
  end if;

  return v_rollover_id;
end;
$$;

revoke all on function public.close_ledger_bill_with_rollover(uuid, text, uuid, text, date, numeric) from public;
revoke all on function public.close_ledger_bill_with_rollover(uuid, text, uuid, text, date, numeric) from anon;
revoke all on function public.close_ledger_bill_with_rollover(uuid, text, uuid, text, date, numeric) from authenticated;
grant execute on function public.close_ledger_bill_with_rollover(uuid, text, uuid, text, date, numeric) to service_role;
