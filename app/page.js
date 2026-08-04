import { groupByType, summarizeBills } from '../src/bills-master.js';
import { calculateMonthlyProgress } from '../src/bills/monthly-progress.js';
import { fetchBills } from '../src/db/bills.js';
import { missingEnvVars } from '../src/db/client.js';

// Bill status is relative to "today", and the rows come from the database, so
// the page must be rendered per request rather than frozen at build time.
export const dynamic = 'force-dynamic';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const monthLabel = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const displayDate = (date) => date
  ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
  : '-';

function Unavailable({ error }) {
  const missing = missingEnvVars();

  return (
    <section className="panel">
      <header><strong>Bills unavailable</strong></header>
      <div className="account-form">
        {error === 'not-configured' ? (
          <>
            <p className="muted">The ledger database is not configured for this deployment.</p>
            <p className="muted">Set {missing.map((name) => <code key={name}>{name}</code>).reduce((all, item) => (all.length ? [...all, ' and ', item] : [item]), [])} in the hosting environment, then redeploy.</p>
          </>
        ) : (
          <p className="muted">The ledger database could not be read: {error}</p>
        )}
      </div>
    </section>
  );
}

export default async function BillsPage() {
  const asOf = new Date();
  const { rows, error } = await fetchBills({ asOf });

  if (error) {
    return (
      <>
        <p className="eyebrow">Bill management</p>
        <h1>{monthLabel.format(asOf)} Master Bills</h1>
        <Unavailable error={error} />
      </>
    );
  }

  const summary = summarizeBills(rows);
  const progress = calculateMonthlyProgress(rows, { asOf });

  return (
    <>
      <p className="eyebrow">Bill management</p>
      <h1>{monthLabel.format(asOf)} Master Bills</h1>
      <p className="lede">Every personal, streaming, and business bill in one place. Due dates are projected from each bill&rsquo;s cadence.</p>

      <section className="summary" aria-label="Bill summary">
        <article><span>Total</span><strong>{money.format(summary.total)}</strong><small>{summary.activeCount} active bills</small></article>
        <article><span>Paid</span><strong>{money.format(summary.paid)}</strong><small>{summary.paidCount} settled</small></article>
        <article><span>Remaining</span><strong className="blue">{money.format(summary.remaining)}</strong><small>{summary.remainingCount} outstanding</small></article>
        <article><span>Due soon</span><strong className="amber">{money.format(summary.dueSoon)}</strong><small>{summary.dueSoonCount} within 7 days</small></article>
      </section>

      <section className="progress-card" aria-label="Monthly progress">
        <header>
          <strong>This month</strong>
          <span>{money.format(progress.paid)} of {money.format(progress.total)} paid &middot; {progress.paidCount}/{progress.billCount} bills</span>
        </header>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Current month bills paid"
        >
          <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
        </div>
        <small>{progress.percent}% complete &middot; {money.format(progress.remaining)} remaining</small>
      </section>

      {summary.overdueCount > 0 && (
        <p className="alert" role="status">
          {summary.overdueCount} overdue &middot; {money.format(summary.overdue)}
        </p>
      )}

      {groupByType(rows).map(({ type, bills }) => (
        <section className="panel" key={type}>
          <header><strong>{type} <small>{bills.length}</small></strong><button type="button">+ Add Bill</button></header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Bill</th><th>Category</th><th>Account</th><th>Budget</th><th>Frequency</th><th>Next due</th><th>Status</th></tr></thead>
              <tbody>{bills.map((bill) => (
                <tr key={bill.id}>
                  <td><b>{bill.payee}</b>{bill.notes && <small>{bill.notes}</small>}</td>
                  <td>{bill.category ?? '-'}</td>
                  <td>{bill.account ?? '-'}</td>
                  <td>{money.format(bill.amount)}</td>
                  <td>{bill.frequency}</td>
                  <td>{displayDate(bill.nextDue)}</td>
                  <td><span className={`status ${bill.status}`}>{bill.status.replace('-', ' ')}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
