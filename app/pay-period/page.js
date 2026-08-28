import Link from 'next/link';
import { getPayPeriodBudget, normalizePayPeriodOffset } from '../../src/pay-period-data.js';
import { getLatestCashSnapshot } from '../../src/cash-guard.js';
import { getLedgerBills, summarizeLedgerBills } from '../../src/ledger-bills-data.js';
import IncomeExpensesCard from '../dashboard/income-expenses-card.js';

export const dynamic = 'force-dynamic';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const displayDate = (value) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`));
const displaySnapshotDate = (value) => {
  if (!value) return 'snapshot date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'snapshot date unavailable';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

function ArchitectureInfo() {
  return (
    <span className="pp-info">
      <button type="button" className="pp-info-icon" aria-label="How Project Ledger is organized" aria-describedby="pp-info-tip">i</button>
      <span className="pp-info-tip" id="pp-info-tip" role="tooltip">
        <strong>How Project Ledger is organized</strong>
        <span><b>Pay Period</b> = biweekly funding. It shows only funding posted inside the selected two-week window and the obligations that window must cover.</span>
        <span><b>Bills</b> = recurring obligation authority. Bill setup and payment maintenance stay there.</span>
        <span><b>Cash Guard</b> = current household control layer. It combines the cash snapshot, bills, reserves, planned one-offs, and cash floor.</span>
      </span>
    </span>
  );
}

function BudgetPanel({ title, bills, empty }) {
  const total = bills.reduce((sum, bill) => sum + Number(bill.plannedAmount ?? 0), 0);
  return <section className="pp-panel"><header><h2>{title}</h2><strong>{money.format(total)}</strong></header>{bills.length === 0 ? <p className="pp-empty">{empty}</p> : <div className="table-wrap"><table className="pp-table"><thead><tr><th>Bill</th><th>Due</th><th>Category</th><th>Account</th><th>Amount to Fund</th><th>Planning Status</th></tr></thead><tbody>{bills.map((bill) => <tr key={bill.rowKey}><td><b>{bill.payee}</b></td><td>{bill.nextDue ? displayDate(bill.nextDue) : '—'}</td><td>{bill.category || 'Needs category'}</td><td>{bill.account || '—'}</td><td>{money.format(bill.plannedAmount ?? 0)}</td><td>{bill.planningStatus}</td></tr>)}</tbody></table></div>}</section>;
}

export default async function PayPeriodPage({ searchParams }) {
  const params = await searchParams;
  const offset = normalizePayPeriodOffset(params?.pp);
  let budget;
  let cashSnapshot;
  let loadError;
  try {
    [budget, cashSnapshot] = await Promise.all([
      getPayPeriodBudget({ offset }),
      getLatestCashSnapshot(),
    ]);
  } catch (error) {
    loadError = error.message;
  }

  // The funding month the paycheck lands in, so the income card matches the
  // period being viewed rather than always showing the current month.
  const fundingMonth = budget?.period?.paycheckDate?.slice(0, 7) ?? null;
  // null, not an empty summary: unavailable bills would otherwise render as a
  // zero-expense month with the whole income left over.
  let billSummary = null;
  if (fundingMonth) {
    try {
      billSummary = summarizeLedgerBills(await getLedgerBills({ selectedMonth: fundingMonth }));
    } catch {
      billSummary = null;
    }
  }

  return (
    <div className="pay-period-redesign">
      <div className="pay-period-content">
        <div className="pay-period-page">
          <header className="pp-heading">
            <div>
              <p className="eyebrow">Bi-weekly cash-flow planning</p>
              <div className="pp-title-row"><h1>Pay Period</h1><ArchitectureInfo /></div>
              <p className="lede">What this two-week funding window has received, what it must cover, and how that differs from the cash currently available in checking.</p>
            </div>
            <nav className="pp-nav" aria-label="Pay period">
              <Link href={`/pay-period?pp=${offset - 1}`}>← Previous</Link>
              <Link aria-current={offset === 0 ? 'page' : undefined} href="/pay-period?pp=0">Current</Link>
              <Link href={`/pay-period?pp=${offset + 1}`}>Next →</Link>
            </nav>
          </header>

          {loadError ? <p className="alert" role="alert">Pay period data could not be loaded: {loadError}</p> : <>
            <div className="pp-range">
              <strong>Paycheck {displayDate(budget.period.paycheckDate)} · {budget.period.fundingMonth} Period {budget.period.periodNumber}</strong>
              <span>Covers obligations through {displayDate(budget.period.coverageEnd)} · next paycheck {displayDate(budget.period.nextPaycheckDate)}</span>
            </div>
            <section className="pp-summary" aria-label="Pay period summary">
              <article><span>Payroll posted in this period</span><strong>{money.format(budget.totals.regularIncome)}</strong></article>
              <article><span>Notary support posted in this period</span><strong>{money.format(budget.totals.notaryIncome)}</strong></article>
              <article><span>Obligations to fund</span><strong>{money.format(budget.totals.planned)}</strong></article>
              <article className={budget.totals.available < 0 ? 'negative' : ''}><span>{budget.totals.available < 0 ? 'Pay-period funding gap' : 'Pay-period funding surplus'}</span><strong>{money.format(budget.totals.available < 0 ? budget.totals.fundingGap : budget.totals.available)}</strong></article>
              <article><span>Current checking available</span><strong>{money.format(cashSnapshot?.availableCash ?? 0)}</strong><small>snapshot as of {displaySnapshotDate(cashSnapshot?.cashAsOf)}</small></article>
            </section>
            <IncomeExpensesCard summary={billSummary} selectedMonth={fundingMonth} />
            <p className="pp-note">The first four figures are strictly biweekly. Current checking available is shown separately because it can include money received before this pay period and money already committed elsewhere.</p>
            <div className="pp-columns">
              <BudgetPanel title="Personal · TCU" bills={budget.personal} empty="No remaining personal obligations need funding before the next paycheck."/>
              <BudgetPanel title="Business · TCUB" bills={budget.business} empty="No remaining business obligations need funding before the next paycheck."/>
            </div>
            {budget.uncategorized.length > 0 && <BudgetPanel title="Other / cross-account obligations" bills={budget.uncategorized} empty=""/>}
          </>}
        </div>
      </div>
    </div>
  );
}
