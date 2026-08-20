import Link from 'next/link';
import { getPayPeriodBudget, normalizePayPeriodOffset, PAY_PERIOD_LABELS } from '../../src/pay-period-data.js';
import { assignBillPayPeriodAction, savePayPeriodFinancesAction } from './actions.js';

export const dynamic = 'force-dynamic';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const monthName = (month) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00Z`));

function ArchitectureInfo() {
  return (
    <span className="pp-info">
      <button type="button" className="pp-info-icon" aria-label="How Project Ledger is organized" aria-describedby="pp-info-tip">i</button>
      <span className="pp-info-tip" id="pp-info-tip" role="tooltip">
        <strong>How Project Ledger is organized</strong>
        <span><b>Pay Period view</b> = cash-flow allocation. It determines which paycheck/notary income funds which bills and helps you reach the “one month ahead” position.</span>
        <span><b>Bills tab</b> = monthly financial picture. It shows monthly income, bills, actual spending, remaining cash, and the existing Emergency Fund tracker.</span>
        <span><b>Savings layer</b> = intentional funding. Your four savings accounts should eventually be represented as named savings goals with current balance, target, monthly contribution, and progress.</span>
      </span>
    </span>
  );
}

function AssignmentControl({ bill, offset }) {
  return <form action={assignBillPayPeriodAction} className="pp-assignment-form">
    <input type="hidden" name="billId" value={bill.id}/>
    <input type="hidden" name="offset" value={offset}/>
    <select name="assignment" defaultValue={bill.payPeriod ?? ''} aria-label={`Paycheck assignment for ${bill.payee}`}>
      <option value="">Unassigned</option>
      <option value={PAY_PERIOD_LABELS[1]}>Paycheck 1 · 13th</option>
      <option value={PAY_PERIOD_LABELS[2]}>Paycheck 2 · 27th</option>
    </select>
    <button type="submit">Move</button>
  </form>;
}

function BudgetPanel({ title, bills, empty, offset }) {
  const total = bills.reduce((sum, bill) => sum + Number(bill.effectiveAmount ?? 0), 0);
  return <section className="pp-panel"><header><h2>{title}</h2><strong>{money.format(total)}</strong></header>{bills.length === 0 ? <p className="pp-empty">{empty}</p> : <div className="table-wrap"><table className="pp-table"><thead><tr><th>Bill</th><th>Category</th><th>Account</th><th>Budget</th><th>Paid</th><th>Paycheck</th></tr></thead><tbody>{bills.map((bill) => <tr key={bill.rowKey}><td><b>{bill.payee}</b></td><td>{bill.category || 'Needs category'}</td><td>{bill.account || '—'}</td><td>{bill.effectiveAmount === null ? '—' : money.format(bill.effectiveAmount)}</td><td>{money.format(bill.submitted ?? 0)}</td><td><AssignmentControl bill={bill} offset={offset}/></td></tr>)}</tbody></table></div>}</section>;
}

function CashPlan({ budget, offset }) {
  const f = budget.finances;
  return <section className="pp-panel pp-cash-plan"><header><h2>Cash plan</h2><strong>{money.format(budget.totals.income)}</strong></header><form action={savePayPeriodFinancesAction} className="pp-cash-form">
    <input type="hidden" name="month" value={budget.period.month}/><input type="hidden" name="period" value={budget.period.period}/><input type="hidden" name="offset" value={offset}/><input type="hidden" name="targetMonth" value={budget.ahead.targetMonth}/>
    <label><span>Regular paycheck</span><input name="regularIncome" type="number" min="0" step="0.01" defaultValue={f.regularIncome}/></label>
    <label><span>Notary income</span><input name="notaryIncome" type="number" min="0" step="0.01" defaultValue={f.notaryIncome}/></label>
    <label><span>Fund {monthName(budget.ahead.targetMonth)} ahead</span><input name="aheadContribution" type="number" min="0" step="0.01" defaultValue={f.aheadContribution}/></label>
    <div className="pp-cash-actions"><button type="submit">Save cash plan</button><span>Regular paycheck defaults to $2,992 and remains editable.</span></div>
  </form></section>;
}

function AheadProgress({ ahead }) {
  return <section className="pp-ahead" aria-label="One month ahead progress"><div><span>One Month Ahead · {monthName(ahead.targetMonth)}</span><strong>{money.format(ahead.funded)} of {money.format(ahead.target)}</strong></div><div className="pp-progress" aria-hidden="true"><span style={{ width: `${ahead.percent}%` }}/></div><b>{ahead.percent}% funded</b></section>;
}

export default async function PayPeriodPage({ searchParams }) {
  const params = await searchParams;
  const offset = normalizePayPeriodOffset(params?.pp);
  let budget;
  let loadError;
  try { budget = await getPayPeriodBudget({ offset }); } catch (error) { loadError = error.message; }

  return <div className="pay-period-page"><header className="pp-heading"><div><p className="eyebrow">Semi-monthly cash-flow planning</p><div className="pp-title-row"><h1>Pay Period</h1><ArchitectureInfo /></div><p className="lede">Assign each monthly bill to the paycheck that will fund it. Moving a bill here does not change its actual due date in Bills.</p></div><nav className="pp-nav" aria-label="Pay period"><Link href={`/pay-period?pp=${offset - 1}`}>← Previous</Link><Link href="/pay-period?pp=0">Current</Link><Link href={`/pay-period?pp=${offset + 1}`}>Next →</Link></nav></header>{loadError ? <p className="alert" role="alert">Pay period data could not be loaded: {loadError}</p> : <><div className="pp-range"><strong>{monthName(budget.period.month)} · {budget.period.period === 1 ? 'Paycheck 1 · 13th' : 'Paycheck 2 · 27th'}</strong><span>{params?.saved === '1' ? 'Cash plan saved' : offset === 0 ? 'Current paycheck plan' : offset < 0 ? `${Math.abs(offset)} paycheck${offset === -1 ? '' : 's'} back` : `${offset} paycheck${offset === 1 ? '' : 's'} ahead`}</span></div><section className="pp-summary" aria-label="Pay period summary"><article><span>Total available income</span><strong>{money.format(budget.totals.income)}</strong></article><article><span>Planned expenses</span><strong>{money.format(budget.totals.expenses)}</strong></article><article><span>Paid toward assigned bills</span><strong>{money.format(budget.totals.paid)}</strong></article><article className={budget.totals.available < 0 ? 'negative' : ''}><span>Available after plan</span><strong>{money.format(budget.totals.available)}</strong></article></section><AheadProgress ahead={budget.ahead}/><CashPlan budget={budget} offset={offset}/><div className="pp-columns"><BudgetPanel title="Personal · TCU" bills={budget.personal} empty="No personal bills are assigned to this paycheck." offset={offset}/><BudgetPanel title="Business · TCUB" bills={budget.business} empty="No business bills are assigned to this paycheck." offset={offset}/></div>{budget.uncategorized.length > 0 && <BudgetPanel title="Other accounts · this paycheck" bills={budget.uncategorized} empty="" offset={offset}/>}<BudgetPanel title="Bills assigned to the other paycheck" bills={budget.other} empty="No bills are assigned to the other paycheck." offset={offset}/><BudgetPanel title={`Unassigned bills (${budget.unassigned.length})`} bills={budget.unassigned} empty="All monthly bills are assigned to a paycheck." offset={offset}/></>}</div>;
}
