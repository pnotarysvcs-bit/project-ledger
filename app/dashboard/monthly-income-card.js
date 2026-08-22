import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { addMonthlyIncome, getIncomeBreakdown } from '../../src/monthly-finances.js';
import { normalizeLedgerMonth } from '../../src/ledger-bills-data.js';
import { labelForDashboardMonth } from '../../src/dashboard-months.js';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

async function saveOtherFunding(data) {
  'use server';
  const month = normalizeLedgerMonth(String(data.get('month') ?? ''));
  const raw = String(data.get('income') ?? '').trim();
  if (raw === '') throw new Error('Enter an amount to add.');
  const income = Number(raw);
  if (!Number.isFinite(income) || income < 0) throw new Error('Funding amount must be zero or greater.');

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
      <header><strong>Household Funding · {monthLabel}</strong></header>
      <div className="rows">
        <FundingRow label="Payroll income" amount={income.payrollIncome} detail="Posted regular payroll recorded by pay period" />
        <FundingRow label="Notary household support" amount={income.notarySupport} detail="Premier Notary funds moved into household cash flow" />
        <FundingRow label="Other / unclassified funding" amount={income.otherFunding} detail="Manual or other household funding not already classified as payroll" />
        <div className="income-summary">
          <span><b>Total household funding</b><small className="muted">Payroll + notary support + other confirmed funding</small></span>
          <strong className="green">{money.format(income.householdFunding)}</strong>
        </div>

        <form action={saveOtherFunding} className="income-form">
          <input type="hidden" name="month" value={selectedMonth} />
          <label>
            <span>Add other / unclassified funding</span>
            <input name="income" type="number" min="0" step="0.01" defaultValue={0} placeholder="0.00" required />
          </label>
          <div className="income-actions"><button type="submit">Add Funding</button></div>
        </form>
      </div>
      <footer className="muted">Payroll and notary support are read from Pay Period funding. Manual additions stay in Other / unclassified funding so they are not double-counted.</footer>
    </article>
  );
}
