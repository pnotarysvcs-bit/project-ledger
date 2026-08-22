create table if not exists public.ledger_goal_rollovers (
  id uuid primary key default gen_random_uuid(),
  source_bill_id uuid not null references public.ledger_bills(id) on delete restrict,
  source_name text not null,
  target_bill_id uuid references public.ledger_bills(id) on delete set null,
  target_name text,
  closed_month date not null,
  monthly_amount numeric(14,2) not null check (monthly_amount > 0),
  status text not null default 'allocated' check (status in ('allocated', 'unallocated', 'completed')),
  created_at timestamptz not null default now(),
  constraint ledger_goal_rollovers_closed_month_first_day check (date_part('day', closed_month) = 1)
);

create index if not exists ledger_goal_rollovers_source_idx on public.ledger_goal_rollovers(source_bill_id);
create index if not exists ledger_goal_rollovers_target_idx on public.ledger_goal_rollovers(target_bill_id);

alter table public.ledger_goal_rollovers enable row level security;

comment on table public.ledger_goal_rollovers is 'Tracks recurring cash freed when a bill is closed and the next payoff target that cash is redirected toward.';
