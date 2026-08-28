import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { addIncomeEntry, deleteIncomeEntry, getIncomeBreakdown } from '../../src/monthly-finances.js';
import { normalizeLedgerMonth } from '../../src/ledger-bills-data.js';
import { labelForDashboardMonth } from '../../src/dashboard-months.js';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const entryDate = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
const asDate = (value) => new Date(`${value}T00:00:00Z`);
const ENTRY_LABELS = { paycheck: 'Paycheck', notary: 'Notary income', other: 'Other income' };

async function saveIncome(data) {
  'use server';
  const month = normalizeLedgerMonth(String(data.get('month') ?? ''));
  const raw = String(data.get('income') ?? '').trim();
  if (raw === '') throw new Error('Enter an income amount to add.');

  await addIncomeEntry(month, {
    amount: Number(raw),
    receivedOn: String(data.get('receivedOn') ?? '').trim(),
    kind: String(data.get('kind') ?? 'paycheck'),
  });
  revalidatePath('/income');
  revalidatePath('/dashboard');
  redirect(`/income?month=${month}&incomeSaved=1`);
}

async function removeIncome(data) {
  'use server';
  const month = normalizeLedgerMonth(String(data.get('month') ?? ''));
  await deleteIncomeEntry(String(data.get('id') ?? ''));
  revalidatePath('/income');
  revalidatePath('/dashboard');
  redirect(`/income?month=${month}&incomeRemoved=1`);
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
  const defaultDate = `${normalizeLedgerMonth(selectedMonth)}-01`;

  return (
    <article className="widget">
      <header><strong>Income · {monthLabel}</strong></header>
      <div className="rows">
        {income.usesEntries ? (
          <ul className="income-entries">
            {income.entries.length === 0 && <li className="muted">No income recorded for {monthLabel} yet.</li>}
            {income.entries.map((entry) => (
              <li key={entry.id}>
                <span className="entry-date">{entryDate.format(asDate(entry.receivedOn))}</span>
                <span className="entry-label">{ENTRY_LABELS[entry.kind] ?? 'Income'}{entry.source === 'migrated' ? ' · carried over' : ''}</span>
                <strong>{money.format(entry.amount)}</strong>
                <form action={removeIncome}>
                  <input type="hidden" name="month" value={selectedMonth} />
                  <input type="hidden" name="id" value={entry.id} />
                  <button type="submit" className="entry-remove" aria-label={`Remove the ${money.format(entry.amount)} ${(ENTRY_LABELS[entry.kind] ?? 'income').toLowerCase()} received ${entry.receivedOn}`}>Remove</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <FundingRow label="Paychecks" amount={income.paychecks} detail="Recorded as a single monthly total" />
            <FundingRow label="Notary income" amount={income.notarySupport} detail="Read from Pay Period until income entries exist" />
          </>
        )}

        <div className="income-summary">
          <span><b>Total income</b><small className="muted">Paychecks + notary income</small></span>
          <strong className="green">{money.format(income.totalIncome)}</strong>
        </div>

        <form action={saveIncome} className="income-form">
          <input type="hidden" name="month" value={selectedMonth} />
          <label>
            <span>Date received</span>
            <input name="receivedOn" type="date" defaultValue={defaultDate} required />
          </label>
          <label>
            <span>Type</span>
            <select name="kind" defaultValue="paycheck">
              <option value="paycheck">Paycheck</option>
              <option value="notary">Notary income</option>
              <option value="other">Other income</option>
            </select>
          </label>
          <label>
            <span>Add income</span>
            <input name="income" type="number" min="0.01" step="0.01" placeholder="0.00" required />
          </label>
          <div className="income-actions"><button type="submit">Add Income</button></div>
        </form>
      </div>
      <footer className="muted">This tab is the source of truth for income. Every paycheck and notary deposit is its own entry, so two of the same amount both count and one never counts twice. Nothing here is read from Pay Period.</footer>
    </article>
  );
}
