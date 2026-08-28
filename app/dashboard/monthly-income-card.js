import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { addMonthlyIncome, getIncomeBreakdown } from '../../src/monthly-finances.js';
import { normalizeLedgerMonth } from '../../src/ledger-bills-data.js';
import { labelForDashboardMonth } from '../../src/dashboard-months.js';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

async function savePaycheck(data) {
  'use server';
  const month = normalizeLedgerMonth(String(data.get('month') ?? ''));
  const raw = String(data.get('income') ?? '').trim();
  if (raw === '') throw new Error('Enter a paycheck amount to add.');
  const income = Number(raw);
  if (!Number.isFinite(income) || income < 0) throw new Error('Paycheck amount must be zero or greater.');

  await addMonthlyIncome(month, income);
  revalidatePath('/income');
  revalidatePath('/dashboard');
  redirect(`/income?month=${month}&incomeSaved=1`);
}

function FundingRow({ label, amount, detail }) {
  return (
    <div className="income-summary">
      <span><b>{label}</b>{detail ? <small className="muted">{detail}</small> : null}</span>
      <strong>{money.format(amount)}</strong>
    </div>
  );
}

export default async function MonthlyIncomeCard({ selectedMonth }) {
  const income = await getIncomeBreakdown(selectedMonth);
  const monthLabel = labelForDashboardMonth(selectedMonth);

  return (
    <article className="widget">
      <header><strong>Income · {monthLabel}</strong></header>
      <div className="rows">
        <FundingRow label="Paychecks" amount={income.paychecks} detail="Every paycheck received this month" />
        <FundingRow label="Notary income" amount={income.notarySupport} detail="Premier Notary income moved into household cash flow" />
        <div className="income-summary">
          <span><b>Total income</b><small className="muted">Paychecks + notary income</small></span>
          <strong className="green">{money.format(income.totalIncome)}</strong>
        </div>

        <form action={savePaycheck} className="income-form">
          <input type="hidden" name="month" value={selectedMonth} />
          <label>
            <span>Add a paycheck</span>
            <input name="income" type="number" min="0" step="0.01" defaultValue={0} placeholder="0.00" required />
          </label>
          <div className="income-actions"><button type="submit">Add Paycheck</button></div>
        </form>
      </div>
      <footer className="muted">A paycheck counts once whether it is added here or posted on the Pay Period page. Notary income is read from Pay Period.</footer>
    </article>
  );
}
