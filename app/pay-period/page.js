import Link from 'next/link';
import { getPayPeriodBudget, normalizePayPeriodOffset } from '../../src/pay-period-data.js';

export const dynamic = 'force-dynamic';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const displayDate = (value) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`));

function ArchitectureInfo() {
  return (
    <span className="pp-info">
      <button type="button" className="pp-info-icon" aria-label="How Project Ledger is organized" aria-describedby="pp-info-tip">i</button>
      <span className="pp-info-tip" id="pp-info-tip" role="tooltip">
        <strong>How Project Ledger is organized</strong>
        <span><b>Pay Period view</b> = cash-flow allocation. It shows which remaining bills the next paycheck needs to cover and helps you reach the “one month ahead” position.</span>
        <span><b>Bills tab</b> = monthly financial picture. It shows monthly income, bills, actual spending, remaining cash, and the existing Emergency Fund tracker.</span>
        <span><b>Savings layer</b> = intentional funding. Your four savings accounts should eventually be represented as named savings goals with current balance, target, monthly contribution, and progress.</span>
      </span>
    </span>
  );
}

function BudgetPanel({ title, bills, empty }) {
  const total = bills.reduce((sum, bill) => sum + Number(bill.plannedAmount ?? 0), 0);
  return <section className="pp-panel"><header><h2>{title}</h2><strong>{money.format(total)}</strong></header>{bills.length === 0 ? <p className="pp-empty">{empty}</p> : <div className="table-wrap"><table className="pp-table"><thead><tr><th>Bill</th><th>Category</th><th>Account</th><th>Remaining</th><th>Status</th></tr></thead><tbody>{bills.map((bill) => <tr key={bill.rowKey}><td><b>{bill.payee}</b></td><td>{bill.category || 'Needs category'}</td><td>{bill.account || '—'}</td><td>{money.format(bill.plannedAmount ?? 0)}</td><td>{bill.status}</td></tr>)}</tbody></table></div>}</section>;
}

export default async function PayPeriodPage({ searchParams }) {
  const params = await searchParams;
  const offset = normalizePayPeriodOffset(params?.pp);
  let budget;
  let loadError;
  try { budget = await getPayPeriodBudget({ offset }); } catch (error) { loadError = error.message; }

  return (
    <div className="pay-period-redesign">
      <div className="pay-period-content">
        <div className="pay-period-page">
          <header className="pp-heading">
            <div>
              <p className="eyebrow">Bi-weekly cash-flow planning</p>
              <div className="pp-title-row"><h1>Pay Period</h1><ArchitectureInfo /></div>
              <p className="lede">Read-only planning view of the remaining bills that must be covered before the following paycheck. Bill maintenance stays in Bills.</p>
            </div>
            <nav className="pp-nav" aria-label="Pay period">
              <Link href={`/pay-period?pp=${offset - 1}`}>← Previous</Link>
              <Link aria-current={offset === 0 ? 'page' : undefined} href="/pay-period?pp=0">Current</Link>
              <Link href={`/pay-period?pp=${offset + 1}`}>Next →</Link>
            </nav>
          </header>

          {loadError ? <p className="alert" role="alert">Pay period data could not be loaded: {loadError}</p> : <>
            <div className="pp-range">
              <strong>Paycheck {displayDate(budget.period.paycheckDate)}</strong>
              <span>Covers bills through {displayDate(budget.period.coverageEnd)} · next paycheck {displayDate(budget.period.nextPaycheckDate)}</span>
            </div>
            <section className="pp-summary" aria-label="Pay period summary">
              <article><span>Expected paycheck</span><strong>{money.format(budget.totals.regularPaycheck)}</strong></article>
              <article><span>Remaining bills to cover</span><strong>{money.format(budget.totals.planned)}</strong></article>
              <article><span>Monthly income recorded in Bills</span><strong>{money.format(budget.totals.monthlyIncome)}</strong></article>
              <article className={budget.totals.available < 0 ? 'negative' : ''}><span>Available after remaining bills</span><strong>{money.format(budget.totals.available)}</strong></article>
            </section>
            <p className="pp-note">Monthly income is displayed for reference from Bills. The paycheck plan uses the $2,992 average regular paycheck, so recorded monthly income is not counted twice.</p>
            <div className="pp-columns">
              <BudgetPanel title="Personal · TCU" bills={budget.personal} empty="No remaining personal bills need to be covered before the next paycheck."/>
              <BudgetPanel title="Business · TCUB" bills={budget.business} empty="No remaining business bills need to be covered before the next paycheck."/>
            </div>
            {budget.uncategorized.length > 0 && <BudgetPanel title="Other accounts" bills={budget.uncategorized} empty=""/>}
          </>}
        </div>
      </div>
    </div>
  );
}
