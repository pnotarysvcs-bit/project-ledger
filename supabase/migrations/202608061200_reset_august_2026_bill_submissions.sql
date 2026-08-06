-- Reverse the accidental bulk submission for August 2026. Payment rows are
-- the source of truth for Submitted/Partial, so removing the August batch
-- restores every August bill to its unpaid, actionable state. Earlier months
-- are intentionally outside both predicates and remain unchanged.
delete from public.ledger_bill_payments
where payment_month = date '2026-08-01';

-- Remove any matching cached month state as well. Current application status
-- is derived from payments, but cleaning this up prevents stale August state
-- from affecting older clients or future maintenance tools.
delete from public.ledger_bill_months
where month = date '2026-08-01'
  and status in ('partial', 'submitted');
