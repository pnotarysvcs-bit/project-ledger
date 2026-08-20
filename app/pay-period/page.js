import Link from 'next/link';
import { getPayPeriodBudget, normalizePayPeriodOffset } from '../../src/pay-period-data.js';

export const dynamic = 'force-dynamic';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const date = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
const displayDate = (value) => date.format(new Date(`${value}T00:00:00Z`));

function BudgetPanel({ title, bills, empty }) {
  const total = bills.reduce((sum, bill) => sum + Number(bill.effectiveAmount ?? 0), 0);
  return <section className="pp-panel"><header><h2>{title}</h2><strong>{money.format(total)}</strong></header>{bills.length === 0 ? <p className="pp-empty">{empty}</p> : <div className="table-wrap"><table className="pp-table"><thead><tr><th>Bill</th><th>Category</th><th>Account</th><th>Budget</th><th>Paid this period</th></tr></thead><tbody>{bills.map((bill) => <tr key={bill.rowKey}><td><b>{bill.payee}</b></td><td>{bill.category || 'Needs category'}</td><td>{bill.account || '—'}</td><td>{bill.effectiveAmount === null ? '—' : money.format(bill.effectiveAmount)}</td><td>{money.format(bill.periodTransactions.reduce((sum, payment) => sum + payment.amount, 0))}</td></tr>)}</tbody></table></div>}</section>;
}

function IncomePanel({ amount }) {
  return <section className="pp-panel"><header><h2>Income</h2><strong>{money.format(amount)}</strong></header><p className="pp-empty">Pulled from the Income field maintained in Bills.</p></section>;
}

export default async function PayPeriodPage({ searchParams }) {
  const params = await searchParams;
  const offset = normalizePayPeriodOffset(params?.pp);
  let budget;
  let loadError;
  try { budget = await getPayPeriodBudget({ offset }); } catch (error) { loadError = error.message; }

  return <div className="pay-period-page"><header className="pp-heading"><div><p className="eyebrow">Bi-weekly budget</p><h1>Pay Period</h1><p className="lede">A read-only view of bills and income maintained in the Bills tab.</p></div><nav className="pp-nav" aria-label="Pay period"><Link href={`/pay-period?pp=${offset - 1}`}>← Previous</Link><Link href="/pay-period?pp=0">Current</Link><Link href={`/pay-period?pp=${offset + 1}`}>Next →</Link></nav></header>{loadError ? <p className="alert" role="alert">Pay period data could not be loaded: {loadError}</p> : <><div className="pp-range"><strong>{displayDate(budget.period.start)} – {displayDate(budget.period.end)}</strong><span>{offset === 0 ? 'Current pay period' : offset < 0 ? `${Math.abs(offset)} period${offset === -1 ? '' : 's'} ago` : `${offset} period${offset === 1 ? '' : 's'} ahead`}</span></div><section className="pp-summary" aria-label="Pay period summary"><article><span>Expected income</span><strong>{money.format(budget.totals.income)}</strong></article><article><span>Planned expenses</span><strong>{money.format(budget.totals.expenses)}</strong></article><article><span>Paid this period</span><strong>{money.format(budget.totals.paid)}</strong></article><article className={budget.totals.available < 0 ? 'negative' : ''}><span>Available after bills</span><strong>{money.format(budget.totals.available)}</strong></article></section><IncomePanel amount={budget.income} /><div className="pp-columns"><BudgetPanel title="Personal · TCU" bills={budget.personal} empty="No personal bills are due." /><BudgetPanel title="Business · TCUB" bills={budget.business} empty="No business bills are due." /></div>{budget.uncategorized.length > 0 && <BudgetPanel title="Other accounts" bills={budget.uncategorized} empty="" />}</>}</div>;
}
