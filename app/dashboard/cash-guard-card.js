import { calculateCashGuard, getCashGuardInputs } from '../../src/cash-guard.js';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function dateLabel(value) {
  if (!value) return 'Not synced';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not synced' : shortDate.format(date);
}

export default async function CashGuardCard({ rows = [], selectedMonth = '' }) {
  let inputs = null;
  let error = null;
  try {
    inputs = await getCashGuardInputs(selectedMonth);
  } catch (caught) {
    error = caught.message;
  }

  if (error) {
    return <article className="widget glance-card"><header><strong>Cash Guard</strong></header><p className="alert">Cash Guard could not be loaded: {error}</p></article>;
  }

  const summary = calculateCashGuard(rows, inputs, new Date());
  const lockLabel = summary.locked && summary.discretionaryLockUntil
    ? `Locked through ${shortDate.format(new Date(`${summary.discretionaryLockUntil}T00:00:00`))}`
    : 'Open';
  const freedDetail = summary.freedCashItems.length
    ? summary.freedCashItems.map((item) => `${item.sourceName} ${money.format(item.monthlyAmount)}`).join(' · ')
    : 'No recurring closed-bill payments identified yet';

  return (
    <article className="widget glance-card" aria-label="Cash Guard safe to spend">
      <header><strong>Cash Guard</strong><span className={summary.locked ? 'goal-live' : 'muted'}>{lockLabel}</span></header>
      <div className="rolling-cash-card">
        <span className="target-icon" aria-hidden="true">◎</span>
        <span><small>Safe to Spend</small><strong>{money.format(summary.safeToSpend)}</strong></span>
        <span className="rolling-divider" aria-hidden="true" />
        <span><small>Available cash snapshot</small><b>{money.format(summary.availableCash)}</b><small>as of {dateLabel(summary.cashAsOf)}</small></span>
      </div>
      <div className="glance-grid">
        <div className="glance-item green"><small>Bills Reserved</small><strong>{money.format(summary.billsReserved)}</strong><span>{money.format(summary.currentBillsRemaining)} current + {money.format(summary.overdueBillsRemaining)} overdue</span></div>
        <div className="glance-item blue"><small>Household Funding Received</small><strong>{money.format(summary.fundingReceived)}</strong><span>Payroll + approved notary support</span></div>
        <div className="glance-item orange"><small>Variable Essentials Reserve</small><strong>{money.format(summary.variableEssentialsReserve)}</strong><span>Gas, medical, groceries, household</span></div>
        <div className="glance-item purple"><small>Planned One-Offs</small><strong>{money.format(summary.plannedOneOffsReserve)}</strong><span>Gifts, tickets, repairs, annual items</span></div>
        <div className="glance-item green"><small>Monthly Cash Freed</small><strong>{money.format(summary.freedUpCashFlow)}</strong><span>{freedDetail}</span></div>
      </div>
      <div className="timeline-note">
        <span aria-hidden="true">◉</span>
        <span><b>{summary.fundingGap > 0 ? `${money.format(summary.fundingGap)} funding gap before reserves are fully covered` : `${money.format(summary.cashFloor)} protected cash floor`}</b><small>{summary.notes || 'Safe to Spend equals available cash less unpaid bills, reserves, planned one-offs, and the protected cash floor. Monthly Cash Freed is tracked separately so eliminated recurring payments can be reassigned deliberately.'}</small></span>
      </div>
    </article>
  );
}
