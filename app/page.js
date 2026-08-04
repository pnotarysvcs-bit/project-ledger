import { getLedgerBills, groupLedgerBills, summarizeLedgerBills } from '../src/ledger-bills-data.js';

export const dynamic = 'force-dynamic';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const displayDate = (date) => date
  ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
  : '-';

function normalizeMonth(value) {
  if (/^\d{4}-\d{2}$/.test(value ?? '')) return value;
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthName(value) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}-01T00:00:00Z`));
}

function monthOptions(selectedMonth) {
  const start = new Date('2026-04-01T00:00:00Z');
  const selected = new Date(`${selectedMonth}-01T00:00:00Z`);
  const now = new Date();
  const end = new Date(Date.UTC(
    Math.max(selected.getUTCFullYear(), now.getUTCFullYear()),
    Math.max(selected.getUTCMonth(), now.getUTCMonth()) + 6,
    1,
  ));
  const options = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    const value = cursor.toISOString().slice(0, 7);
    options.push({ value, label: monthName(value) });
  }
  return options;
}

export default async function BillsPage({ searchParams }) {
  const params = await searchParams;
  const selectedMonth = normalizeMonth(params?.month);

  let rows = [];
  let loadError = null;
  try {
    rows = await getLedgerBills({ selectedMonth, asOf: new Date() });
  } catch (error) {
    loadError = error.message;
  }

  const summary = summarizeLedgerBills(rows);

  return (
    <>
      <p className="eyebrow">Bill management</p>
      <div className="page-heading-row">
        <div>
          <h1>{monthName(selectedMonth)} Bills</h1>
          <p className="lede">Review active personal, streaming, and business bills from the persisted Bills Master.</p>
        </div>
        <form method="get" className="month-selector">
          <label htmlFor="bills-month">Month</label>
          <select id="bills-month" name="month" defaultValue={selectedMonth}>
            {monthOptions(selectedMonth).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button type="submit">View</button>
        </form>
      </div>

      {loadError && <p className="alert" role="alert">Bills could not be loaded: {loadError}</p>}

      <section className="summary" aria-label="Bill summary">
        <article><span>Total Budget</span><strong>{money.format(summary.total)}</strong><small>{summary.activeCount} active bills</small></article>
        <article><span>Submitted</span><strong>{money.format(summary.submitted)}</strong><small>{summary.submittedCount} submitted</small></article>
        <article><span>Remaining</span><strong className="blue">{money.format(summary.remaining)}</strong><small>{summary.partialCount} partial</small></article>
        <article><span>Due Soon</span><strong className="amber">{money.format(summary.dueSoon)}</strong><small>{summary.dueSoonCount} bills</small></article>
      </section>

      {summary.overdueCount > 0 && (
        <p className="alert" role="status">{summary.overdueCount} overdue &middot; {money.format(summary.overdue)}</p>
      )}

      {!loadError && rows.length === 0 && (
        <section className="panel"><p className="empty">No active bills apply to {monthName(selectedMonth)}.</p></section>
      )}

      {groupLedgerBills(rows).map(({ type, bills }) => (
        <section className="panel" key={type}>
          <header>
            <strong>{type} Bills</strong>
            <span>{bills.length} {bills.length === 1 ? 'bill' : 'bills'}</span>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Bill</th><th>Type</th><th>Category</th><th>Account</th><th>Budget</th><th>Frequency</th><th>Next Due</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id}>
                    <td><b>{bill.payee}</b>{bill.notes && <small>{bill.notes}</small>}</td>
                    <td>{bill.type}</td>
                    <td>{bill.category}</td>
                    <td>{bill.account}</td>
                    <td>{bill.budget === null ? 'Enter amount' : money.format(Math.round(bill.budget))}</td>
                    <td>{bill.frequency}</td>
                    <td>{displayDate(bill.nextDue)}</td>
                    <td><span className={`status ${bill.status}`}>{bill.status.replace('-', ' ')}</span></td>
                    <td><span aria-label={`Actions for ${bill.payee}`}>—</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
