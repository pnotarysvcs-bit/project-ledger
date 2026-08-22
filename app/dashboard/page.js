import { getLedgerBills, normalizeLedgerMonth } from '../../src/ledger-bills-data.js';
import { resolveDashboardMonth } from '../../src/dashboard-months.js';
import GoalsCard from './goals-card.js';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ searchParams }) {
  const params = await searchParams;
  const now = new Date();
  const selectedMonth = resolveDashboardMonth(params?.month, now);
  let rows = [];
  let loadError = null;

  try {
    rows = await getLedgerBills({ selectedMonth, asOf: now });
  } catch (error) {
    loadError = error.message;
  }

  const activity = rows
    .flatMap((bill) => bill.transactions.map((payment) => ({
      id: payment.id,
      label: bill.status === 'submitted' ? 'Payment Submitted' : 'Partial Payment',
      payee: bill.payee,
      date: payment.paymentDate,
      amount: payment.amount,
    })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  return (
    <div className="dashboard-redesign">
      <header className="ledger-topbar">
        <a className="ledger-brand" href="/dashboard">
          <span className="ledger-mark" aria-hidden="true">$</span>
          <strong>PROJECT LEDGER</strong>
        </a>
        <nav aria-label="Dashboard sections">
          <a className="active" href="/dashboard">Dashboard</a>
          <a href="/pay-period">Pay Period</a>
          <a href="/">Bills</a>
          <a href="#income">Income</a>
          <a href="#goals">Goals</a>
          <a href="/reconcile">Reports</a>
        </nav>
        <div className="ledger-user"><span aria-hidden="true">♧</span><span className="user-avatar">KF</span><span>Kim</span><span aria-hidden="true">⌄</span></div>
      </header>

      <main className="redesign-content">
        {loadError && <p className="alert" role="alert">Dashboard bills could not be loaded: {loadError}</p>}
        <GoalsCard rows={rows} activity={activity} selectedMonth={normalizeLedgerMonth(selectedMonth)} />
      </main>
    </div>
  );
}
