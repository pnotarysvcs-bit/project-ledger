import { getLedgerBills, getLedgerOverview, normalizeLedgerMonth, summarizeLedgerBills } from '../../src/ledger-bills-data.js';
import { toRingSegments } from '../../src/dashboard.js';
import { labelForDashboardMonth, resolveDashboardMonth } from '../../src/dashboard-months.js';
import { greetingForCentralTime } from '../../src/time-greeting.js';
import PersistedAccountsSummary from './persisted-accounts-summary.js';
import MonthSelector from './month-selector.js';
import MonthlyIncomeCard from './monthly-income-card.js';
import GoalsCard from './goals-card.js';

export const dynamic = 'force-dynamic';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dayLabel = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', weekday: 'short' });
const shortDate = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
const asDate = (value) => new Date(`${value}T00:00:00Z`);
const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default async function DashboardPage({ searchParams }) {
  const params = await searchParams;
  const now = new Date();
  const selectedMonth = resolveDashboardMonth(params?.month, now);
  const currentMonth = normalizeLedgerMonth(undefined, now);
  let rows = [];
  let currentRows = [];
  let loadError = null;

  try {
    [rows, currentRows] = await Promise.all([
      getLedgerBills({ selectedMonth, asOf: now }),
      selectedMonth === currentMonth ? Promise.resolve(null) : getLedgerBills({ selectedMonth: currentMonth, asOf: now }),
    ]);
    if (!currentRows) currentRows = rows;
  } catch (error) {
    loadError = error.message;
    rows = [];
    currentRows = [];
  }

  const summary = summarizeLedgerBills(rows, now);
  const currentSummary = summarizeLedgerBills(currentRows, now);
  const dueSoon = currentRows
    .filter((bill) => {
      const days = (asDate(bill.nextDue) - asDate(now.toISOString().slice(0, 10))) / 86400000;
      return !['submitted', 'overdue'].includes(bill.status) && (bill.remaining ?? 0) > 0 && days >= 0 && days <= 7;
    })
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  const breakdown = getLedgerOverview(rows);
  const activity = rows
    .flatMap((bill) => bill.transactions.map((payment) => ({
      id: payment.id,
      label: bill.status === 'submitted' ? 'Payment Submitted' : 'Partial Payment',
      tone: 'good',
      payee: bill.payee,
      date: payment.paymentDate,
      amount: payment.amount,
    })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  const segments = toRingSegments(breakdown, RING_CIRCUMFERENCE);
  const month = labelForDashboardMonth(selectedMonth);

  return (
    <>
      <header className="page-head">
        <div><h1>{greetingForCentralTime(now)}, Kim! <span aria-hidden="true">👋</span></h1><p className="lede">Here&rsquo;s what needs your attention today.</p></div>
        <div className="head-actions"><MonthSelector selectedMonth={selectedMonth} /></div>
      </header>

      {loadError && <p className="alert" role="alert">Dashboard bills could not be loaded: {loadError}</p>}
      {params?.incomeSaved === '1' && <p className="notice" role="status">Monthly income saved.</p>}

      <section className="stat-row" aria-label="Monthly figures">
        <article className="stat"><span className="bubble purple" aria-hidden="true" /><span>Total Monthly Budget</span><strong>{money.format(summary.total)}</strong><small>for {month}</small></article>
        <article className="stat"><span className="bubble green" aria-hidden="true" /><span>Total Paid</span><strong className="green">{money.format(summary.totalPaid)}</strong><small className="green">all recorded payments</small></article>
        <article className="stat"><span className="bubble amber" aria-hidden="true" /><span>Partial</span><strong className="amber">{money.format(summary.partial)}</strong><small className="amber">{plural(summary.partialCount, 'bill')} partial</small></article>
        <article className="stat"><span className="bubble red" aria-hidden="true" /><span>Overdue</span><strong className="red">{money.format(summary.overdue)}</strong><small className="red">{plural(summary.overdueCount, 'bill')} overdue</small></article>
        <article className="stat"><span className="bubble blue" aria-hidden="true" /><span>Active Bills</span><strong className="blue">{summary.activeCount}</strong><small>tracked occurrences for {month}</small></article>
      </section>

      <section className="widget-row">
        <article className="widget">
          <header><strong>Bills Due in the Next 7 Days</strong><a href={`/?month=${currentMonth}`}>View All Bills</a></header>
          <div className="muted">{currentSummary.activeCount} active bill occurrences in the current month</div>
          {dueSoon.length === 0 ? <p className="muted">Nothing due in the next 7 days.</p> : <table className="mini"><thead><tr><th>Due Date</th><th>Vendor</th><th>Amount</th><th>Status</th></tr></thead><tbody>{dueSoon.map((bill) => <tr key={bill.rowKey}><td>{dayLabel.format(asDate(bill.nextDue))}</td><td>{bill.payee}</td><td>{money.format(bill.remaining)}</td><td><span className={`status ${bill.status}`}>{bill.status.replace('-', ' ')}</span></td></tr>)}</tbody></table>}
          <footer className="muted">{plural(dueSoon.length, 'bill occurrence')} due in the next 7 days</footer>
        </article>

        <article className="widget">
          <header><strong>This Month Overview ({month})</strong><a href={`/?month=${selectedMonth}`}>View Bills</a></header>
          <div className="overview"><ul className="legend">{breakdown.map(({ key, label, count, amount }) => <li key={key}><span className={`dot ${key}`} aria-hidden="true" /><span className="legend-label">{label}</span><span className="legend-value"><b>{count}</b><small>{money.format(amount)}</small></span></li>)}</ul><div className="ring-wrap"><svg viewBox="0 0 130 130" className="ring" role="img" aria-label={`${summary.submittedCount} bill occurrences submitted for ${month}`}><circle cx="65" cy="65" r={RING_RADIUS} className="ring-track" />{segments.filter(({ length }) => length > 0).map(({ key, length, offset }) => <circle key={key} cx="65" cy="65" r={RING_RADIUS} className={`ring-seg ${key}`} strokeDasharray={`${length} ${RING_CIRCUMFERENCE - length}`} strokeDashoffset={-offset} />)}<text x="65" y="62" className="ring-value">{summary.activeCount ? Math.round(summary.submittedCount / summary.activeCount * 100) : 0}%</text><text x="65" y="80" className="ring-caption">Complete</text></svg></div></div>
          <footer><span className="muted">{summary.submittedCount} of {plural(summary.activeCount, 'bill occurrence')} submitted</span><div className="progress-track"><div className="progress-fill" style={{ width: `${summary.activeCount ? summary.submittedCount / summary.activeCount * 100 : 0}%` }} /></div></footer>
        </article>

        <MonthlyIncomeCard selectedMonth={selectedMonth} searchParams={params} />
      </section>

      <section className="widget-row">
        <article className="widget"><header><strong>Recent Activity</strong><a href={`/?month=${selectedMonth}`}>View All</a></header>{activity.length === 0 ? <p className="muted">No payments recorded yet.</p> : <ul className="activity">{activity.map((entry) => <li key={entry.id}><span className={`bubble ${entry.tone}`} aria-hidden="true" /><span className="activity-body"><b>{entry.label}</b><small>{entry.payee}</small></span><span className="activity-meta"><small>{shortDate.format(asDate(entry.date))}</small><b className="green">{money.format(entry.amount)}</b></span></li>)}</ul>}</article>
        <PersistedAccountsSummary />
        <GoalsCard rows={rows} />
      </section>
    </>
  );
}
