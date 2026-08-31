alter table public.ledger_cash_guard
  add column if not exists variable_essentials_source text not null default 'estimate'
    check (variable_essentials_source in ('estimate', 'manual')),
  add column if not exists planned_one_offs_source text not null default 'estimate'
    check (planned_one_offs_source in ('estimate', 'manual'));
