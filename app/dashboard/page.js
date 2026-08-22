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
      <main className="redesign-content">
        <header className="page-head dashboard-page-head">
          <div>
            <p className="eyebrow">Financial command center</p>
            <h1>Dashboard</h1>
            <p className="lede">Track monthly spending, bill reduction progress, rolling cash, and current financial goals in one place.</p>
          </div>
        </header>
        {loadError && <p className="alert" role="alert">Dashboard bills could not be loaded: {loadError}</p>}
        <GoalsCard rows={rows} activity={activity} selectedMonth={normalizeLedgerMonth(selectedMonth)} />
      </main>
    </div>
  );
}
