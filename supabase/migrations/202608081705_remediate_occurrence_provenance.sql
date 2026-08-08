-- Remediate environments that already ran the earlier 202608081640 migration,
-- which copied the current recurring master Budget into every existing monthly
-- occurrence. Production running the corrected migration above will already
-- have migration_incomplete and therefore skips the destructive remediation.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ledger_bill_months'
      and column_name = 'migration_incomplete'
  ) then
    alter table public.ledger_bill_months
      add column migration_incomplete boolean not null default false;

    -- All rows present in this environment were populated by the earlier
    -- compatibility backfill because occurrence_budget_amount did not exist
    -- before that migration. Remove the inferred value rather than preserve
    -- an unaudited historical amount.
    update public.ledger_bill_months
    set occurrence_budget_amount = null,
        migration_incomplete = true;
  end if;
end
$$;
