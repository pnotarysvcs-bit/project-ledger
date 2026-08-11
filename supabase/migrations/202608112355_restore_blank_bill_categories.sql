-- Restore only blank/null durable categories using the approved April 2026 seed baseline.
-- Do not overwrite populated categories or invent categories for user-created bills.
with baseline(bill_name, category) as (
  values
    ('Home Rent', 'Home'),
    ('American Water', 'Home'),
    ('Ameren UE (Electric)', 'Home'),
    ('Spire (Gas)', 'Home'),
    ('Waste Connections', 'Home'),
    ('T-Mobile', 'Other'),
    ('Liberty Mutual (Auto)', 'Auto'),
    ('Car Note #1', 'Auto'),
    ('Car Note #2', 'Auto'),
    ('IRS Installment', 'Other'),
    ('Missouri Dept of Rev', 'Other'),
    ('Capital One Card', 'Credit Card'),
    ('Mission Lane Card', 'Credit Card'),
    ('Mercury Card', 'Credit Card'),
    ('AfterPay', 'Online Credit'),
    ('Affirm', 'Online Credit'),
    ('Upgrade', 'Credit Card'),
    ('Fidelity Life Ins.', 'Other'),
    ('Product Compass', 'Other'),
    ('SiriusXM', 'Other'),
    ('Car Taxes (STL Cty)', 'Other'),
    ('Cloaked', 'Other'),
    ('Savings #1', 'Savings'),
    ('Savings #2', 'Savings'),
    ('TikTok Shop (4/4)', 'Online Credit'),
    ('Netflix', 'Streaming'),
    ('YouTube Premium', 'Streaming'),
    ('Apple TV', 'Streaming'),
    ('Amazon Prime', 'Streaming'),
    ('Roku Channel', 'Streaming'),
    ('Amazon (clarify svc)', 'Streaming'),
    ('Google One', 'Other')
)
update public.ledger_bills b
set category = baseline.category
from baseline
where b.bill_name = baseline.bill_name
  and (b.category is null or btrim(b.category) = '');
