-- Model every bi-weekly due date as its own persisted installment occurrence.
-- The recurrence anchor is durable master data; occurrence due dates are derived
-- in 14-day increments from that anchor and payments are occurrence-scoped.
--
-- The historical-payment guard is temporarily removed inside this migration
-- because legacy occurrence allocation necessarily updates historical payment
-- rows. The guard is recreated before the migration commits, so ordinary
-- application writes remain protected.

drop trigger if exists ledger_bill_payments_protect_history on public.ledger_bill_payments;

alter table public.ledger_bills
  add column if not exists recurrence_anchor date;

update public.ledger_bills b
set recurrence_anchor = make_date(
  extract(year from b.start_month)::int,
  extract(month from b.start_month)::int,
  least(
    b.due_day::int,
    extract(day from (date_trunc('month', b.start_month) + interval '1 month - 1 day'))::int
  )
)
where b.frequency = 'bi-weekly'
  and b.recurrence_anchor is null;

alter table public.ledger_bill_months
  add column if not exists installment_key text;

update public.ledger_bill_months
set installment_key = coalesce(installment_key, due_date::text, id::text)
where installment_key is null;

alter table public.ledger_bill_months
  drop constraint if exists ledger_bill_months_unique;

create unique index if not exists ledger_bill_months_bill_due_unique
  on public.ledger_bill_months (bill_id, due_date)
  where due_date is not null;

create index if not exists ledger_bill_months_bill_month_due_idx
  on public.ledger_bill_months (bill_id, month, due_date);

alter table public.ledger_bill_payments
  add column if not exists occurrence_id uuid references public.ledger_bill_months(id) on delete restrict,
  add column if not exists allocation_provenance text;

update public.ledger_bill_payments p
set occurrence_id = m.id,
    allocation_provenance = coalesce(p.allocation_provenance, 'legacy-single-occurrence')
from public.ledger_bills b
join public.ledger_bill_months m on m.bill_id = b.id
where p.bill_id = b.id
  and p.payment_month = m.month
  and p.occurrence_id is null
  and b.frequency <> 'bi-weekly';

with bounds as (
  select b.id as bill_id,
         b.budget,
         b.recurrence_anchor,
         least(
           b.recurrence_anchor,
           coalesce((select min(m.month) from public.ledger_bill_months m where m.bill_id = b.id), b.recurrence_anchor),
           coalesce((select min(p.payment_month) from public.ledger_bill_payments p where p.bill_id = b.id), b.recurrence_anchor)
         ) as from_date,
         (date_trunc('month', current_date) + interval '13 months - 1 day')::date as through_date
  from public.ledger_bills b
  where b.frequency = 'bi-weekly'
    and b.recurrence_anchor is not null
), installments as (
  select bounds.bill_id,
         bounds.budget,
         gs::date as due_date,
         date_trunc('month', gs)::date as month
  from bounds
  cross join lateral generate_series(
    bounds.recurrence_anchor::timestamp,
    bounds.through_date::timestamp,
    interval '14 days'
  ) gs
  where gs::date >= bounds.from_date
)
insert into public.ledger_bill_months
  (bill_id, month, status, occurrence_budget_amount, actual_amount, due_date, installment_key, migration_incomplete)
select i.bill_id,
       i.month,
       null,
       i.budget,
       null,
       i.due_date,
       i.due_date::text,
       false
from installments i
where not exists (
  select 1
  from public.ledger_bill_months m
  where m.bill_id = i.bill_id
    and m.due_date = i.due_date
);

update public.ledger_bill_payments p
set occurrence_id = (
      select m.id
      from public.ledger_bill_months m
      where m.bill_id = p.bill_id
        and m.month = p.payment_month
      order by
        case when m.due_date <= p.payment_date then 0 else 1 end,
        case when m.due_date <= p.payment_date then m.due_date end desc,
        m.due_date asc
      limit 1
    ),
    allocation_provenance = coalesce(p.allocation_provenance, 'legacy-due-date-ordering')
where p.occurrence_id is null
  and exists (
    select 1
    from public.ledger_bills b
    where b.id = p.bill_id
      and b.frequency = 'bi-weekly'
  )
  and exists (
    select 1
    from public.ledger_bill_months m
    where m.bill_id = p.bill_id
      and m.month = p.payment_month
  );

create index if not exists ledger_bill_payments_occurrence_idx
  on public.ledger_bill_payments (occurrence_id, payment_date, id);

-- Restore the closed-period protection before this migration commits.
drop trigger if exists ledger_bill_payments_protect_history on public.ledger_bill_payments;
create trigger ledger_bill_payments_protect_history
before update or delete on public.ledger_bill_payments
for each row execute function public.project_ledger_protect_historical_payments();
