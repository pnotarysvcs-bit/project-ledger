import { getIncomeBreakdown } from '../../src/monthly-finances.js';
import { calculateMonthlyNet } from '../../src/monthly-net.js';
import { labelForDashboardMonth } from '../../src/dashboard-months.js';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default async function IncomeExpensesCard({ summary = null, selectedMonth = '' }) {
  if (!summary) {
    return <article className="widget glance-card"><header><strong>Income vs. Expenses</strong></header><p className="alert">Bills could not be loaded, so income minus expenses cannot be shown for this month.</p></article>;
  }

  let income = null;
  let error = null;
  try {
    income = await getIncomeBreakdown(selectedMonth);
  } catch (caught) {
    error = caught.message;
  }

  if (error) {
    return <article className="widget glance-card"><header><strong>Income vs. Expenses</strong></header><p className="alert">Income could not be loaded: {error}</p></article>;
  }

  const net = calculateMonthlyNet(income, summary);
  const monthLabel = labelForDashboardMonth(selectedMonth);

  return (
    <article className="widget glance-card" aria-label="Monthly income versus expenses">
      <header><strong>Income vs. Expenses · {monthLabel}</strong><a href={`/income?month=${selectedMonth}`}>Income</a></header>
      <div className="rolling-cash-card">
        <span className="target-icon" aria-hidden="true">=</span>
        <span><small>Income minus expenses</small><strong className={net.covered ? 'net-positive' : 'net-negative'}>{money.format(net.net)}</strong></span>
        <span className="rolling-divider" aria-hidden="true" />
        <span><small>{net.covered ? "Income covers this month's bills" : 'Bills exceed income this month'}</small><b>{net.covered ? `${money.format(net.net)} left over` : `${money.format(net.shortfall)} short`}</b></span>
      </div>
      <div className="glance-grid">
        <div className="glance-item blue"><small>Income</small><strong>{money.format(net.income)}</strong><span>Paychecks {money.format(net.paychecks)} · notary {money.format(net.notarySupport)}{net.otherIncome ? ` · other ${money.format(net.otherIncome)}` : ''}</span></div>
        <div className="glance-item purple"><small>Monthly Expenses</small><strong>{money.format(net.expenses)}</strong><span>All tracked bills for {monthLabel}</span></div>
        <div className="glance-item green"><small>Paid So Far</small><strong>{money.format(net.paid)}</strong><span>{money.format(net.leftAfterBillsPaid)} of income not yet spent on bills</span></div>
        <div className="glance-item orange"><small>Still To Pay</small><strong>{money.format(net.stillToPay)}</strong><span>Remaining plus overdue bills</span></div>
      </div>
      {net.incompleteCount > 0 && <footer className="muted">{net.incompleteCount} bill{net.incompleteCount === 1 ? '' : 's'} still missing an amount, so expenses may rise.</footer>}
    </article>
  );
}
