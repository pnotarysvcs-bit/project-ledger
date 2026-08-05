import { getLedgerBills } from '../../src/ledger-bills-data.js';
import {
  getDueSoon,
  getMonthSummary,
  getRecentActivity,
  getStatusBreakdown,
  toRingSegments,
} from '../../src/dashboard.js';
import {
  dateForDashboardMonth,
  labelForDashboardMonth,
  resolveDashboardMonth,
} from '../../src/dashboard-months.js';
import { greetingForCentralTime } from '../../src/time-greeting.js';
import { SAMPLE_CASH_FLOW, SAMPLE_SAVINGS_GOALS, SAMPLE_TIP } from '../../src/sample-data.js';
import AccountsSummary from './accounts-summary.js';
import MonthSelector from './month-selector.js';

// Every figure is relative to the selected reporting month, so the page is rendered per request.
export const dynamic = 'force-dynamic';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dayLabel = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', weekday: 'short' });
const shortDate = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

const asDate = (value) => new Date(`${value}T00:00:00Z`);
const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Marks a widget whose numbers are placeholders rather than ledger data. */
function SampleBadge() {
  return <span className="badge-sample" title="Placeholder data — not from the ledger">Sample</span>;
}

export default async function DashboardPage({ searchParams }) {
  const params = await searchParams;
  const now = new Date();
  const selectedMonth = resolveDashboardMonth(params?.month, now);
  const reportingDate = dateForDashboardMonth(selectedMonth);
  const rows = (await getLedgerBills({ selectedMonth, asOf: reportingDate }))
    .map((bill) => ({
      ...bill,
      amount: bill.budget ?? 0,
      lastPaid: null,
    }));
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const currentRows = (selectedMonth === currentMonth ? rows : await getLedgerBills({ selectedMonth: currentMonth, asOf: now }))
    .map((bill) => ({
      ...bill,
      amount: bill.budget ?? 0,
      lastPaid: null,
    }));

  const summary = getMonthSummary(rows, { asOf: reportingDate });
  const dueSoon = getDueSoon(currentRows, { asOf: now, days: 7 });
  const breakdown = getStatusBreakdown(rows, { asOf: reportingDate });
  const activity = getRecentActivity(rows);
  const segments = toRingSegments(breakdown, RING_CIRCUMFERENCE);
  const month = labelForDashboardMonth(selectedMonth);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{greetingForCentralTime(now)}, Kim! <span aria-hidden="true">👋</span></h1>
          <p className="lede">Here&rsquo;s what needs your attention today.</p>
        </div>
        <div className="head-actions">
          <MonthSelector selectedMonth={selectedMonth} />
        </div>
      </header>

      <section className="stat-row" aria-label="Monthly figures">
        <article className="stat">
          <span className="bubble purple" aria-hidden="true" />
          <span>Total Monthly Budget</span>
          <strong>{money.format(summary.budget)}</strong>
          <small>for {month}</small>
        </article>
        <article className="stat">
          <span className="bubble green" aria-hidden="true" />
          <span>Total Paid (Matched)</span>
          <strong className="green">{money.format(summary.paid)}</strong>
          <small className="green">{summary.percentOfBudget}% of budget</small>
        </article>
        <article className="stat">
          <span className="bubble amber" aria-hidden="true" />
          <span>Remaining to Pay</span>
          <strong className="amber">{money.format(summary.remaining)}</strong>
          <small className="amber">{plural(summary.remainingCount, 'bill')} remaining</small>
        </article>
        <article className="stat">
          <span className="bubble red" aria-hidden="true" />
          <span>Overdue</span>
          <strong className="red">{money.format(summary.overdue)}</strong>
          <small className="red">{plural(summary.overdueCount, 'bill')} overdue</small>
        </article>
        <article className="stat">
          <span className="bubble blue" aria-hidden="true" />
          <span>Active Bills</span>
          <strong className="blue">{summary.activeCount}</strong>
          <small>tracked for {month}</small>
        </article>
      </section>

      <section className="widget-row">
        <article className="widget">
          <header>
            <strong>Bills Due in the Next 7 Days</strong>
            <a href="/">View All Bills</a>
          </header>
          {dueSoon.length === 0 ? (
            <p className="muted">Nothing due in the next 7 days.</p>
          ) : (
            <table className="mini">
              <thead><tr><th>Due Date</th><th>Vendor</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {dueSoon.map((bill) => (
                  <tr key={bill.id}>
                    <td>{dayLabel.format(asDate(bill.nextDue))}</td>
                    <td>{bill.payee}</td>
                    <td>{money.format(bill.amount)}</td>
                    <td><span className={`status ${bill.status}`}>{bill.status.replace('-', ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <footer className="muted">{plural(dueSoon.length, 'bill')} due in the next 7 days</footer>
        </article>

        <article className="widget">
          <header>
            <strong>This Month Overview ({month})</strong>
            <a href="/">View Bills</a>
          </header>
          <div className="overview">
            <ul className="legend">
              {breakdown.map(({ key, label, count, amount }) => (
                <li key={key}>
                  <span className={`dot ${key}`} aria-hidden="true" />
                  <span className="legend-label">{label}</span>
                  <span className="legend-value"><b>{count}</b><small>{money.format(amount)}</small></span>
                </li>
              ))}
            </ul>
            <div className="ring-wrap">
              <svg viewBox="0 0 130 130" className="ring" role="img" aria-label={`${summary.percentOfBudget}% of ${month}'s budget paid`}>
                <circle cx="65" cy="65" r={RING_RADIUS} className="ring-track" />
                {segments.filter(({ length }) => length > 0).map(({ key, length, offset }) => (
                  <circle
                    key={key}
                    cx="65"
                    cy="65"
                    r={RING_RADIUS}
                    className={`ring-seg ${key}`}
                    strokeDasharray={`${length} ${RING_CIRCUMFERENCE - length}`}
                    strokeDashoffset={-offset}
                  />
                ))}
                <text x="65" y="62" className="ring-value">{summary.percentOfBudget}%</text>
                <text x="65" y="80" className="ring-caption">Complete</text>
              </svg>
            </div>
          </div>
          <footer>
            <span className="muted">{summary.paidCount} of {plural(summary.paidCount + summary.remainingCount, 'bill')} paid</span>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${summary.percentOfBudget}%` }} /></div>
          </footer>
        </article>

        <article className="widget">
          <header>
            <strong>Cash Flow Snapshot</strong>
            <SampleBadge />
          </header>
          <ul className="rows">
            <li><span>Income (MTD)</span><b className="green">{money.format(SAMPLE_CASH_FLOW.income)}</b></li>
            <li><span>Expenses (MTD)</span><b className="red">{money.format(SAMPLE_CASH_FLOW.expenses)}</b></li>
            <li className="ruled"><span>Net Cash Flow</span><b className="green">{money.format(SAMPLE_CASH_FLOW.netCashFlow)}</b></li>
            <li><span>Available to Allocate</span><b>{money.format(SAMPLE_CASH_FLOW.availableToAllocate)}</b></li>
          </ul>
          <footer className="muted">Awaiting an income feed — figures are placeholders.</footer>
        </article>
      </section>

      <section className="widget-row">
        <article className="widget">
          <header><strong>Recent Activity</strong><a href="/">View All</a></header>
          {activity.length === 0 ? (
            <p className="muted">No payments recorded yet.</p>
          ) : (
            <ul className="activity">
              {activity.map((entry) => (
                <li key={entry.id}>
                  <span className={`bubble ${entry.tone}`} aria-hidden="true" />
                  <span className="activity-body">
                    <b>{entry.label}</b>
                    <small>{entry.payee}</small>
                  </span>
                  <span className="activity-meta">
                    <small>{shortDate.format(asDate(entry.date))}</small>
                    <b className={entry.tone === 'good' ? 'green' : (entry.tone === 'bad' ? 'red' : 'amber')}>
                      {money.format(entry.amount)}
                    </b>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <AccountsSummary />

        <article className="widget">
          <header>
            <strong>Savings Goals</strong>
            <SampleBadge />
          </header>
          <ul className="goals">
            {SAMPLE_SAVINGS_GOALS.map((goal) => {
              const percent = Math.round((goal.saved / goal.target) * 100);
              return (
                <li key={goal.id}>
                  <span className="goal-head">
                    <b>{goal.name}</b>
                    <small>{money.format(goal.saved)} / {money.format(goal.target)}</small>
                  </span>
                  <span className="goal-bar">
                    <span className="progress-track">
                      <span className={`progress-fill ${goal.tone}`} style={{ width: `${percent}%` }} />
                    </span>
                    <small>{percent}%</small>
                  </span>
                </li>
              );
            })}
          </ul>
          <footer className="muted">{SAMPLE_TIP}</footer>
        </article>
      </section>
    </>
  );
}
