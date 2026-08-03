import { enrichBills } from '../src/bills.js';

const bills = [
  { id: 'wci', payee: 'WCI of Missouri', frequency: 'Quarterly', type: 'Personal', account: 'TCU', amount: 101.76, lastPaid: '2026-06-07', nextDue: '2026-08-07', status: 'new' },
  { id: 'affirm', payee: 'Affirm', frequency: 'Monthly', type: 'Personal', account: 'TCU', amount: 64.52, lastPaid: '2026-06-06', nextDue: '2026-07-06', status: 'new' },
  { id: 'irs', payee: 'IRS installment', frequency: 'Monthly', type: 'Personal', account: 'TCU', amount: 238, nextDue: '2026-07-15', status: 'new' },
  { id: 'dor', payee: 'Missouri Dept of Rev', frequency: 'Monthly', type: 'Personal', account: 'TCU', amount: 147.13, nextDue: '2026-07-26', status: 'new' },
];

const payments = [
  // Affirm was completed in July. It becomes the last-paid payment in August.
  { billId: 'affirm', date: '2026-07-06', postOn: '2026-08-01', amount: 64.52 },
];

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const displayDate = (date) => date
  ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
  : '-';

export default function BillsPage() {
  const rows = enrichBills(bills, payments, { asOf: '2026-07-31' });
  const overdue = rows.filter(({ status }) => status === 'overdue');

  return (
    <main>
      <p className="eyebrow">Bill management</p>
      <h1>July 2026 Master Bills</h1>
      <p className="lede">Review every personal and business bill in one place. Amounts and due dates are projected from bill payments found in imported statements.</p>

      <section className="summary" aria-label="Bill summary">
        <article><span>Active bills</span><strong>{rows.length}</strong><small>All active</small></article>
        <article><span>Due in 30 days</span><strong className="blue">{money.format(rows.reduce((sum, bill) => sum + bill.amount, 0))}</strong><small>{rows.length} projected bills</small></article>
        <article><span>Due this week</span><strong className="amber">0</strong><small>Based on statement history</small></article>
        <article><span>Overdue</span><strong className="red">{overdue.length}</strong><small>{money.format(overdue.reduce((sum, bill) => sum + bill.amount, 0))}</small></article>
      </section>

      <section className="panel">
        <header><strong>Personal <small>{rows.length}</small></strong><button type="button">+ Add Bill</button></header>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Bill</th><th>Type</th><th>Account</th><th>Amount</th><th>Last paid</th><th>Next due</th><th>Status</th></tr></thead>
            <tbody>{rows.map((bill) => (
              <tr key={bill.id}>
                <td><b>{bill.payee}</b><small>{bill.frequency}</small></td>
                <td>{bill.type}</td><td>{bill.account}</td><td>{money.format(bill.amount)}</td>
                <td>{displayDate(bill.lastPaid)}</td><td>{displayDate(bill.nextDue)}</td>
                <td><span className={`status ${bill.status}`}>{bill.status.replace('-', ' ')}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
