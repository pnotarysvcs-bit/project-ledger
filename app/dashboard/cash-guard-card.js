import { revalidatePath } from 'next/cache';
import { calculateCashGuard, estimateReserveRecalculation, getCashGuardInputs, saveCashGuardReserves } from '../../src/cash-guard.js';
import { deriveIncomeBreakdown, getMonthlyIncome } from '../../src/monthly-finances.js';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function dateLabel(value) {
  if (!value) return 'Not synced';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not synced' : shortDate.format(date);
}

async function adjustVariableEssentials(data) {
  'use server';
  const month = String(data.get('month') ?? '');
  const variableEssentialsReserve = Number(data.get('variableEssentialsReserve'));
  const plannedOneOffsReserve = Number(data.get('plannedOneOffsReserve'));
  const plannedOneOffsSource = data.get('plannedOneOffsSource') === 'manual' ? 'manual' : 'estimate';
  if (!Number.isFinite(variableEssentialsReserve) || !Number.isFinite(plannedOneOffsReserve)) {
    throw new Error('Reserve amounts must be valid numbers.');
  }

  await saveCashGuardReserves(month, {
    variableEssentialsReserve,
    variableEssentialsSource: 'manual',
    plannedOneOffsReserve,
    plannedOneOffsSource,
  });
  revalidatePath('/dashboard');
}

async function adjustPlannedOneOffs(data) {
  'use server';
  const month = String(data.get('month') ?? '');
  const variableEssentialsReserve = Number(data.get('variableEssentialsReserve'));
  const variableEssentialsSource = data.get('variableEssentialsSource') === 'manual' ? 'manual' : 'estimate';
  const plannedOneOffsReserve = Number(data.get('plannedOneOffsReserve'));
  if (!Number.isFinite(variableEssentialsReserve) || !Number.isFinite(plannedOneOffsReserve)) {
    throw new Error('Reserve amounts must be valid numbers.');
  }

  await saveCashGuardReserves(month, {
    variableEssentialsReserve,
    variableEssentialsSource,
    plannedOneOffsReserve,
    plannedOneOffsSource: 'manual',
  });
  revalidatePath('/dashboard');
}

async function recalculateCashGuard(data) {
  'use server';
  const month = String(data.get('month') ?? '');
  const payPeriods = JSON.parse(String(data.get('payPeriods') ?? '[]'));
  const estimate = estimateReserveRecalculation({ payPeriods });

  await saveCashGuardReserves(month, {
    variableEssentialsReserve: estimate.variableEssentialsReserve,
    variableEssentialsSource: 'estimate',
    plannedOneOffsReserve: estimate.plannedOneOffsReserve,
    plannedOneOffsSource: 'estimate',
  });
  revalidatePath('/dashboard');
}

export default async function CashGuardCard({ rows = [], selectedMonth = '' }) {
  let inputs = null;
  let error = null;
  let income = null;
  try {
    let legacyMonthlyIncome;
    [inputs, legacyMonthlyIncome] = await Promise.all([
      getCashGuardInputs(selectedMonth),
      getMonthlyIncome(selectedMonth),
    ]);
    income = deriveIncomeBreakdown(inputs.payPeriods, legacyMonthlyIncome);
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
  const payPeriodsJson = JSON.stringify(inputs.payPeriods ?? []);

  const safeToSpendGaugePercent = summary.availableCash > 0
    ? Math.max(0, Math.min(100, Math.round((summary.safeToSpend / summary.availableCash) * 100)))
    : 0;

  return (
    <section className="cash-guard" aria-label="Cash Guard">
      <header><strong>Cash Guard</strong><span className={summary.locked ? 'goal-live' : 'muted'}>{lockLabel}</span></header>
      <div className="cash-guard-banner">
        <div className="cash-guard-banner-item safe-to-spend">
          <span className="cash-guard-banner-icon" aria-hidden="true">◎</span>
          <div>
            <small>Safe to Spend</small>
            <strong>{money.format(summary.safeToSpend)}</strong>
          </div>
        </div>
        <span className="cash-guard-banner-divider" aria-hidden="true" />
        <div className="cash-guard-banner-item available-cash">
          <div>
            <small>Available cash snapshot</small>
            <strong>{money.format(summary.availableCash)}</strong>
            <small>as of {dateLabel(summary.cashAsOf)}</small>
          </div>
        </div>
      </div>
      <div className="cash-guard-grid">
        <article className="cash-guard-item blue">
          <span className="cash-guard-icon" aria-hidden="true">👛</span>
          <div><h2>1. Income</h2><p>Money received this period.</p><small>Payroll · Notary support · Other funding</small></div>
          <div className="cash-guard-lower">
            <strong>{money.format(income.householdFunding)}</strong>
            <span className="cash-guard-lower-divider" aria-hidden="true" />
            <span className="cash-guard-detail">This month<br />{income.periods.length} deposit{income.periods.length === 1 ? '' : 's'}</span>
          </div>
        </article>
        <article className="cash-guard-item green">
          <span className="cash-guard-icon" aria-hidden="true">🧾</span>
          <div><h2>2. Expenses</h2><p>Bills and fixed obligations reserved.</p><small>Must be covered.</small></div>
          <strong>{money.format(summary.billsReserved)}</strong>
          <dl className="cash-guard-detail"><div><dt>Reserved / Current</dt><dd>{money.format(summary.currentBillsRemaining)}</dd></div><div><dt>Overdue</dt><dd>{money.format(summary.overdueBillsRemaining)}</dd></div></dl>
        </article>
        <article className="cash-guard-item orange">
          <span className="cash-guard-icon" aria-hidden="true">🛒</span>
          <div><h2>3. Variable Essentials Reserve</h2><p>Gas, groceries, medical, household.</p><small>{summary.variableEssentialsSource === 'manual' ? 'Manual override' : 'System estimate (not AI-backed)'}</small></div>
          <strong>{money.format(summary.variableEssentialsReserve)}</strong>
          <div className="cash-guard-detail reserve-editor">
            <form action={recalculateCashGuard}>
              <input type="hidden" name="month" value={selectedMonth} />
              <input type="hidden" name="payPeriods" value={payPeriodsJson} />
              <span>Spent so far <b>—</b></span>
              <span>Remaining protected <b>—</b></span>
              <div><button type="submit">Recalculate</button></div>
            </form>
            <form action={adjustVariableEssentials}>
              <input type="hidden" name="month" value={selectedMonth} />
              <input type="hidden" name="plannedOneOffsReserve" value={summary.plannedOneOffsReserve} />
              <input type="hidden" name="plannedOneOffsSource" value={summary.plannedOneOffsSource} />
              <label>System Estimate<input name="variableEssentialsReserve" type="number" min="0" step="0.01" defaultValue={summary.variableEssentialsReserve} /></label>
              <div><button type="submit">Adjust</button></div>
            </form>
          </div>
        </article>
        <article className="cash-guard-item purple">
          <span className="cash-guard-icon" aria-hidden="true">🎁</span>
          <div><h2>4. Planned One-Offs</h2><p>Annual items, gifts, repairs, special expenses.</p><small>{summary.plannedOneOffsSource === 'manual' ? 'Manual override' : 'System estimate (not AI-backed)'}</small></div>
          <strong>{money.format(summary.plannedOneOffsReserve)}</strong>
          <form action={adjustPlannedOneOffs} className="cash-guard-detail reserve-editor">
            <input type="hidden" name="month" value={selectedMonth} />
            <input type="hidden" name="variableEssentialsReserve" value={summary.variableEssentialsReserve} />
            <input type="hidden" name="variableEssentialsSource" value={summary.variableEssentialsSource} />
            <label>Planned<input name="plannedOneOffsReserve" type="number" min="0" step="0.01" defaultValue={summary.plannedOneOffsReserve} /></label>
            <span>Reserved <b>{money.format(summary.plannedOneOffsReserve)}</b></span>
            <button type="submit">Adjust</button>
          </form>
        </article>
      </div>
      <div className="cash-guard-summary-grid">
        <article className="cash-guard-item blue summary">
          <span className="cash-guard-icon" aria-hidden="true">🏦</span>
          <div><h2>Available Cash</h2><p>Total cash on hand across connected accounts.</p></div>
          <div className="cash-guard-lower">
            <strong>{money.format(summary.availableCash)}</strong>
            <span className="cash-guard-lower-divider" aria-hidden="true" />
            <div className="cash-guard-detail cash-guard-summary-side">
              <span>As of {dateLabel(summary.cashAsOf)}</span>
              <a className="cash-guard-summary-button" href="/accounts">View Accounts</a>
            </div>
          </div>
        </article>
        <article className="cash-guard-item teal summary">
          <span className="cash-guard-icon" aria-hidden="true">🛡️</span>
          <div><h2>Safe to Spend</h2><p>{summary.locked ? lockLabel : 'Cash left after bills, reserves, and the protected floor.'}</p></div>
          <div className="cash-guard-lower">
            <strong>{money.format(summary.safeToSpend)}</strong>
            <span className="cash-guard-lower-divider" aria-hidden="true" />
            <div className="cash-guard-detail cash-guard-summary-side">
              <span>{safeToSpendGaugePercent}% of available cash</span>
              <span className="cash-guard-gauge" role="presentation">
                <span className="cash-guard-gauge-fill" style={{ width: `${safeToSpendGaugePercent}%` }} />
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
