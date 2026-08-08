import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getLedgerBills, groupLedgerBills, normalizeLedgerMonth, summarizeLedgerBills } from '../src/ledger-bills-data.js';
import { supabaseRequest } from '../src/supabase-server.js';
import ConfirmButton from './confirm-button.js';

export const dynamic = 'force-dynamic';
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const today = () => new Date().toISOString().slice(0, 10);
const displayDate = (date) => date ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)) : '-';
function monthName(value) { return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${value}-01T00:00:00Z`)); }
function returnTo(month, message) { revalidatePath('/'); revalidatePath('/dashboard'); redirect(`/?month=${month}${message ? `&notice=${encodeURIComponent(message)}` : ''}`); }
function monthOptions(selectedMonth) { const cursor = new Date('2026-04-01T00:00:00Z'); const end = new Date(); end.setUTCMonth(Math.max(end.getUTCMonth() + 6, 11)); const options = []; while (cursor <= end || cursor.toISOString().slice(0, 7) <= selectedMonth) { const value = cursor.toISOString().slice(0, 7); options.push({ value, label: monthName(value) }); cursor.setUTCMonth(cursor.getUTCMonth() + 1); } return options; }
async function paymentsFor(id, month) { return supabaseRequest(`ledger_bill_payments?select=id,amount,payment_date&bill_id=eq.${encodeURIComponent(id)}&payment_month=eq.${month}-01`); }
async function ensureOccurrence(id, month) {
  const existing = await supabaseRequest(`ledger_bill_months?select=id,bill_id,occurrence_budget_amount,actual_amount,due_date,migration_incomplete&bill_id=eq.${encodeURIComponent(id)}&month=eq.${month}-01`);
  if (existing[0]) return existing[0];
  const [bill] = await supabaseRequest(`ledger_bills?select=id,budget,due_day&id=eq.${encodeURIComponent(id)}`);
  if (!bill) throw new Error('Bill was not found.');
  const last = new Date(`${month}-01T00:00:00Z`); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
  const dueDate = `${month}-${String(Math.min(Number(bill.due_day), last.getUTCDate())).padStart(2, '0')}`;
  const created = await supabaseRequest('ledger_bill_months?select=id,bill_id,occurrence_budget_amount,actual_amount,due_date,migration_incomplete', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { bill_id: id, month: `${month}-01`, status: null, occurrence_budget_amount: bill.budget, actual_amount: null, due_date: dueDate, migration_incomplete: false } });
  return created[0];
}

async function archiveBill(data) { 'use server'; const id = String(data.get('id') ?? ''); const month = normalizeLedgerMonth(String(data.get('month'))); if (!id) throw new Error('Bill id is required.'); await supabaseRequest(`ledger_bills?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: { is_active: false, archived_at: new Date().toISOString() } }); returnTo(month, 'Bill archived.'); }
async function addPayment(data) {
  'use server';
  const id = String(data.get('id') ?? ''); const month = normalizeLedgerMonth(String(data.get('month'))); const amount = Number(data.get('amount')); const paymentDate = String(data.get('paymentDate') ?? ''); const fundingAccount = String(data.get('fundingAccount') ?? '').trim();
  if (!id || !Number.isFinite(amount) || amount <= 0) throw new Error('A positive payment amount is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) throw new Error('A valid payment date is required.');
  if (!fundingAccount) throw new Error('Funding account is required.');
  await ensureOccurrence(id, month);
  await supabaseRequest('ledger_bill_payments', { method: 'POST', body: { bill_id: id, amount, payment_month: `${month}-01`, payment_date: paymentDate, funding_account: fundingAccount, notes: String(data.get('notes') || '') || null } });
  returnTo(month, 'Payment recorded.');
}
async function submitBill(data) {
  'use server'; const id = String(data.get('id') ?? ''); const month = normalizeLedgerMonth(String(data.get('month'))); await ensureOccurrence(id, month); const rows = await getLedgerBills({ selectedMonth: month }); const bill = rows.find((row) => row.id === id); if (!bill || bill.effectiveAmount === null || bill.remaining <= 0) throw new Error('This bill is already submitted or has no amount.'); await supabaseRequest('ledger_bill_payments', { method: 'POST', body: { bill_id: id, amount: bill.remaining, payment_month: `${month}-01`, payment_date: today(), funding_account: bill.account, notes: 'Full payment submitted' } }); returnTo(month, 'Bill submitted.');
}
async function removePayment(data) {
  'use server'; const id = String(data.get('id') ?? ''); const month = normalizeLedgerMonth(String(data.get('month'))); const paymentId = String(data.get('paymentId') ?? ''); if (!id || !paymentId) throw new Error('Payment and bill identifiers are required.'); await supabaseRequest(`ledger_bill_payments?id=eq.${encodeURIComponent(paymentId)}&bill_id=eq.${encodeURIComponent(id)}&payment_month=eq.${month}-01`, { method: 'DELETE' }); returnTo(month, 'Payment removed.');
}
async function updatePayment(data) {
  'use server'; const month = normalizeLedgerMonth(String(data.get('month'))); const paymentId = String(data.get('paymentId') ?? ''); const amount = Number(data.get('amount')); const id = String(data.get('id') ?? ''); const paymentDate = String(data.get('paymentDate') ?? ''); if (!paymentId || !id) throw new Error('Payment id and bill id are required.'); if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment must be positive.'); if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) throw new Error('A valid payment date is required.'); await supabaseRequest(`ledger_bill_payments?id=eq.${encodeURIComponent(paymentId)}&bill_id=eq.${encodeURIComponent(id)}&payment_month=eq.${month}-01`, { method: 'PATCH', body: { amount, payment_date: paymentDate } }); returnTo(month, 'Payment updated.');
}
async function editBill(data) {
  'use server';
  const id = String(data.get('id') ?? '');
  const month = normalizeLedgerMonth(String(data.get('month')));
  const budget = Number(data.get('budget'));
  const actualRaw = String(data.get('actualAmount') ?? '').trim();
  const actualAmount = actualRaw === '' ? null : Number(actualRaw);
  if (!id || !Number.isFinite(budget) || budget < 0) throw new Error('Budget must be zero or greater.');
  if (actualAmount !== null && (!Number.isFinite(actualAmount) || actualAmount < 0)) throw new Error('Actual Bill Amount must be zero or greater.');
  const account = String(data.get('account')).trim().toUpperCase();
  const billType = account === 'TCUB' ? 'Business' : account === 'TCU' ? 'Personal' : String(data.get('type'));
  const dueDate = String(data.get('nextDue') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error('A valid Next Due date is required.');
  await supabaseRequest(`ledger_bills?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: { bill_name: String(data.get('name')).trim(), bill_type: billType, category: String(data.get('category')).trim(), account, frequency: String(data.get('frequency')) } });
  const occurrence = await ensureOccurrence(id, month);
  await supabaseRequest(`ledger_bill_months?id=eq.${encodeURIComponent(occurrence.id)}&bill_id=eq.${encodeURIComponent(id)}&month=eq.${month}-01`, { method: 'PATCH', body: { occurrence_budget_amount: budget, actual_amount: actualAmount, due_date: dueDate, migration_incomplete: false } });
  returnTo(month, 'Bill updated for selected month.');
}
async function bulkSubmit(data) { 'use server'; const month = normalizeLedgerMonth(String(data.get('month'))); if (month >= today().slice(0, 7)) throw new Error('Bulk Submit is available only for previous months.'); const rows = await getLedgerBills({ selectedMonth: month }); const eligible = rows.filter((bill) => bill.effectiveAmount !== null && bill.remaining > 0); for (const bill of eligible) await ensureOccurrence(bill.id, month); if (eligible.length) await supabaseRequest('ledger_bill_payments', { method: 'POST', body: eligible.map((bill) => ({ bill_id: bill.id, amount: bill.remaining, payment_month: `${month}-01`, payment_date: bill.nextDue, funding_account: bill.account, notes: 'Bulk payment submitted' })) }); returnTo(month, `${eligible.length} bills submitted.`); }

export default async function BillsPage({ searchParams }) {
  const params = await searchParams; const selectedMonth = normalizeLedgerMonth(params?.month); let rows = []; let loadError = null;
  try { rows = await getLedgerBills({ selectedMonth }); } catch (error) { loadError = error.message; }
  const summary = summarizeLedgerBills(rows); const selected = rows.find((bill) => bill.id === (params?.partial || params?.edit));
  return <>
    <p className="eyebrow">Bill management</p><div className="page-heading-row"><div><h1>{monthName(selectedMonth)} Bills</h1><p className="lede">Review active personal, streaming, and business bills from the persisted Bills Master.</p></div><div className="head-actions"><form method="get" className="month-selector"><label htmlFor="bills-month">Month</label><select id="bills-month" name="month" defaultValue={selectedMonth}>{monthOptions(selectedMonth).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button type="submit">View</button></form>{selectedMonth < today().slice(0, 7) && <form action={bulkSubmit}><input type="hidden" name="month" value={selectedMonth}/><ConfirmButton message={`Submit all eligible bills for ${monthName(selectedMonth)}?`}>Bulk Submit</ConfirmButton></form>}</div></div>
    {params?.notice && <p className="success" role="status">{params.notice}</p>}{loadError && <p className="alert" role="alert">Bills could not be loaded: {loadError}</p>}
    <section className="summary" aria-label="Bill summary"><article><span>Total Budget</span><strong>{money.format(summary.total)}</strong><small>{summary.activeCount} active bills</small></article><article><span>Submitted</span><strong>{money.format(summary.submitted)}</strong><small>{summary.submittedCount} submitted</small></article><article><span>Partial</span><strong className="amber">{money.format(summary.partial)}</strong><small>{summary.partialCount} partial</small></article><article><span>Remaining</span><strong className="blue">{money.format(summary.remaining)}</strong><small>outstanding</small></article><article><span>Credits</span><strong>{money.format(summary.credit)}</strong><small>overpayments</small></article></section>
    {summary.overdueCount > 0 && <p className="alert" role="status">{summary.overdueCount} overdue &middot; {money.format(summary.overdue)}</p>}{summary.incompleteCount > 0 && <p className="alert">{summary.incompleteCount} incomplete bill amount excluded from financial totals.</p>}
    {selected && params?.partial && <section className="panel action-panel"><header><strong>Payments for {selected.payee}</strong><Link href={`/?month=${selectedMonth}`}>Close</Link></header><form action={addPayment} className="inline-form"><input type="hidden" name="id" value={selected.id}/><input type="hidden" name="month" value={selectedMonth}/><label>Payment amount<input name="amount" type="number" min="0.01" step="0.01" required/></label><label>Payment date<input name="paymentDate" type="date" defaultValue={today()} required/></label><label>Funding account<input name="fundingAccount" defaultValue={selected.account} required/></label><label>Notes<input name="notes"/></label><button type="submit">Add Payment</button></form>{selected.transactions.map((payment) => <form action={updatePayment} className="payment-row" key={payment.id}><input type="hidden" name="id" value={selected.id}/><input type="hidden" name="month" value={selectedMonth}/><input type="hidden" name="paymentId" value={payment.id}/><input aria-label="Payment amount" name="amount" type="number" step="0.01" defaultValue={payment.amount}/><input aria-label="Payment date" name="paymentDate" type="date" defaultValue={payment.paymentDate}/><button type="submit">Update</button><button formAction={removePayment} className="ghost danger">Remove</button></form>)}</section>}
    {selected && params?.edit && <section className="panel action-panel"><header><strong>Edit {selected.payee}</strong><Link href={`/?month=${selectedMonth}`}>Close</Link></header><form action={editBill} className="inline-form"><input type="hidden" name="id" value={selected.id}/><input type="hidden" name="month" value={selectedMonth}/>{[['name','Bill name',selected.payee],['type','Type',selected.type],['category','Category',selected.category],['account','Account',selected.account]].map(([name,label,value]) => <label key={name}>{label}<input name={name} defaultValue={value} required/></label>)}<label>Budget Amount<input name="budget" type="number" min="0" step="0.01" defaultValue={selected.budget ?? ''} required/></label><label>Actual Bill Amount<input name="actualAmount" type="number" min="0" step="0.01" defaultValue={selected.actualAmount ?? ''} placeholder="Leave blank until known"/></label><label>Frequency<select name="frequency" defaultValue={selected.frequency}>{['monthly','bi-weekly','quarterly','annual','one-time'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Next due date<input name="nextDue" type="date" defaultValue={selected.nextDue} required/></label><small className="muted">Budget and due date changes apply only to {monthName(selectedMonth)}.</small><button type="submit">Save</button></form></section>}
    {groupLedgerBills(rows).map(({ type, bills }) => <section className="panel" key={type}><header><strong>{type} Bills</strong><span>{bills.length} {bills.length === 1 ? 'bill' : 'bills'}</span></header><div className="table-wrap"><table><thead><tr><th>Bill</th><th>Type</th><th>Category</th><th>Account</th><th>Budget</th><th>Actual</th><th>Next Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>{bills.map((bill) => <tr key={bill.id}><td><b>{bill.payee}</b>{bill.submitted > 0 && <small>Paid {money.format(bill.submitted)} · Remaining {money.format(bill.remaining ?? 0)}{bill.credit > 0 ? ` · Credit ${money.format(bill.credit)}` : ''}</small>}</td><td>{bill.type}</td><td>{bill.category}</td><td>{bill.account}</td><td>{bill.budget === null ? 'Enter amount' : money.format(bill.budget)}</td><td>{bill.actualAmount === null ? '—' : money.format(bill.actualAmount)}</td><td>{displayDate(bill.nextDue)}</td><td><span className={`status ${bill.status}`}>{bill.status}</span></td><td><div className="row-actions"><form action={submitBill}><input type="hidden" name="id" value={bill.id}/><input type="hidden" name="month" value={selectedMonth}/><button type="submit" disabled={bill.status === 'submitted' || bill.effectiveAmount === null}>Submit</button></form><Link className={`button partial ${bill.effectiveAmount === null ? 'disabled' : ''}`} aria-disabled={bill.effectiveAmount === null} href={bill.effectiveAmount === null ? `/?month=${selectedMonth}` : `/?month=${selectedMonth}&partial=${bill.id}`}>Partial</Link><Link className="button ghost" href={`/?month=${selectedMonth}&edit=${bill.id}`}>Edit</Link><form action={archiveBill}><input type="hidden" name="id" value={bill.id}/><input type="hidden" name="month" value={selectedMonth}/><ConfirmButton className="ghost danger" message={`Archive ${bill.payee}?`}>Archive</ConfirmButton></form></div></td></tr>)}</tbody></table></div></section>)}
  </>;
}
