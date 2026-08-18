import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getMonthlyIncome, saveMonthlyIncome } from '../../src/monthly-finances.js';
import { normalizeLedgerMonth } from '../../src/ledger-bills-data.js';
import { labelForDashboardMonth } from '../../src/dashboard-months.js';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

async function saveIncome(data) {
  'use server';
  const month = normalizeLedgerMonth(String(data.get('month') ?? ''));
  const raw = String(data.get('income') ?? '').trim();
  if (raw === '') throw new Error('Enter the monthly income amount.');
  const income = Number(raw);
  if (!Number.isFinite(income) || income < 0) throw new Error('Monthly income must be zero or greater.');

  await saveMonthlyIncome(month, income);
  revalidatePath('/dashboard');
  redirect(`/dashboard?month=${month}&incomeSaved=1`);
}

export default async function MonthlyIncomeCard({ selectedMonth, searchParams }) {
  const income = await getMonthlyIncome(selectedMonth);
  const monthLabel = labelForDashboardMonth(selectedMonth);

  return (
    <article className="widget">
      <header><strong>Monthly Income</strong></header>
      <div className="rows">
        <div className="income-summary">
          <span className="muted">Income for {monthLabel}</span>
          <strong className="green">{income === null ? 'Not entered' : money.format(income)}</strong>
        </div>
        <form action={saveIncome} className="income-form">
          <input type="hidden" name="month" value={selectedMonth} />
          <label>
            <span>Income amount</span>
            <input
              name="income"
              type="number"
              min="0"
              step="0.01"
              defaultValue={income ?? 0}
              placeholder="0.00"
              required
            />
          </label>
          <div className="income-actions">
            <button type="submit">Save</button>
          </div>
        </form>
      </div>
      <footer className="muted">Saved only for {monthLabel}; it does not change Bills, Payments, Budget, or Credits.</footer>
    </article>
  );
}
