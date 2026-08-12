import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getLedgerBills, groupLedgerBills, normalizeLedgerMonth, summarizeLedgerBills } from '../src/ledger-bills-data.js';
import { supabaseRequest } from '../src/supabase-server.js';
import {
  addBillAction,
  addPaymentAction,
  archiveBillAction,
  editBillAction,
  removePaymentAction,
  submitBillAction,
  updatePaymentAction,
} from './bills-actions.js';
import ConfirmButton from './confirm-button.js';

export const dynamic = 'force-dynamic';
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const today = () => new Date().toISOString().slice(0, 10);
const displayDate = (date) => date ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)) : '-';
const invalidCategory = (value) => ['business', 'personal'].includes(String(value ?? '').trim().toLowerCase());
const displayCategory = (value) => !value || invalidCategory(value) ? 'Needs category' : value;
const anchorId = (value) => `bill-${String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '-')}`;
function monthName(value) { return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${value}-01T00:00:00Z`)); }
function monthOptions(selectedMonth) { const cursor = new Date('2026-04-01T00:00:00Z'); const end = new Date(); end.setUTCMonth(Math.max(end.getUTCMonth() + 6, 11)); const options = []; while (cursor <= end || cursor.toISOString().slice(0, 7) <= selectedMonth) { const value = cursor.toISOString().slice(0, 7); options.push({ value, label: monthName(value) }); cursor.setUTCMonth(cursor.getUTCMonth() + 1); } return options; }
function returnTo(month, message) {
  revalidatePath('/');
  revalidatePath('/dashboard');
  const query = new URLSearchParams({ month });
  if (message) query.set('notice', message);
  redirect(`/?${query.toString()}`);
}
function getFilters(params) {
  return {
    bill: String(params?.f_bill ?? '').trim(),
    type: String(params?.f_type ?? '').trim(),
    category: String(params?.f_category ?? '').trim(),
    account: String(params?.f_account ?? '').trim(),
    budget: String(params?.f_budget ?? '').trim(),
    actual: String(params?.f_actual ?? '').trim(),
    due: String(params?.f_due ?? '').trim(),
    status: String(params?.f_status ?? '').trim(),
  };
}
function filterQuery(filters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(`f_${key}`, value);
  return query.toString();
}
function includes(value, needle) { return !needle || String(value ?? '').toLowerCase().includes(needle.toLowerCase()); }
function exact(value, needle) { return !needle || String(value ?? '').trim().toLowerCase() === needle.trim().toLowerCase(); }
function moneyIncludes(value, needle, emptyLabel) {
  if (!needle) return true;
  if (value === null || value === undefined) return includes(emptyLabel, needle);
  return includes(value, needle) || includes(money.format(value), needle);
}
function applyFilters(rows, filters) {
  return rows.filter((bill) => includes(bill.payee, filters.bill)
    && exact(bill.type, filters.type)
    && includes(displayCategory(bill.category), filters.category)
    && exact(bill.account, filters.account)
    && moneyIncludes(bill.budget, filters.budget, 'Enter amount')
    && moneyIncludes(bill.actualAmount, filters.actual, 'Blank')
    && (includes(bill.nextDue, filters.due) || includes(displayDate(bill.nextDue), filters.due))
    && exact(bill.status, filters.status));
}

async function bulkSubmit(data) {
  'use server';
  const month = normalizeLedgerMonth(String(data.get('month')));
  if (month >= today().slice(0, 7)) throw new Error('Bulk Submit is available only for previous months.');
  const rows = await getLedgerBills({ selectedMonth: month });
  const eligible = rows.filter((bill) => bill.occurrenceId && bill.effectiveAmount !== null && bill.remaining > 0);
  if (eligible.length) {
    await supabaseRequest('ledger_bill_payments', { method: 'POST', body: eligible.map((bill) => ({ bill_id: bill.id, occurrence_id: bill.occurrenceId, amount: bill.remaining, payment_month: `${month}-01`, payment_date: bill.nextDue, funding_account: bill.account, notes: 'Bulk payment submitted' })) });
  }
  returnTo(month, `${eligible.length} bills submitted.`);
}

export default async function BillsPage({ searchParams }) {
  const params = await searchParams;
  const selectedMonth = normalizeLedgerMonth(params?.month);
  let rows = [];
  let loadError = null;
  try { rows = await getLedgerBills({ selectedMonth }); } catch (error) { loadError = error.message; }
  const summary = summarizeLedgerBills(rows);
  const filters = getFilters(params);
  const returnQuery = filterQuery(filters);
  const filterSuffix = returnQuery ? `&${returnQuery}` : '';
  const filteredRows = applyFilters(rows, filters);
  const selectedKey = params?.partial || params?.edit;
  const selected = rows.find((bill) => bill.rowKey === selectedKey || bill.occurrenceId === selectedKey);

  return <>
    <p className="eyebrow">Bill management</p><div className="page-heading-row"><div><h1>{monthName(selectedMonth)}</h1><p className="lede">Review active personal, streaming, and business bills from the persisted Bills Master.</p></div><div className="head-actions"><form method="get" className="month-selector"><label htmlFor="bills-month">Month</label><select id="bills-month" name="month" defaultValue={selectedMonth}>{monthOptions(selectedMonth).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button type="submit">View</button></form><Link className="button" href={`/?month=${selectedMonth}${filterSuffix}&add=1#add-bill`}>Add Bill</Link>{selectedMonth < today().slice(0, 7) && <form action={bulkSubmit}><input type="hidden" name="month" value={selectedMonth}/><ConfirmButton message={`Submit all eligible bills for ${monthName(selectedMonth)}?`}>Bulk Submit</ConfirmButton></form>}</div></div>
    {params?.notice && <p className="success" role="status">{params.notice}</p>}{loadError && <p className="alert" role="alert">Bills could not be loaded: {loadError}</p>}
    {params?.add === '1' && <section className="panel add-bill-panel" id="add-bill"><header><strong>Add Bill</strong><Link href={`/?month=${selectedMonth}${filterSuffix}`}>Cancel</Link></header><form action={addBillAction} className="add-bill-form"><input type="hidden" name="month" value={selectedMonth}/><label>Bill Name<input name="name" required/></label><label>Type<select name="type" defaultValue="Personal"><option>Personal</option><option>Streaming</option><option>Business</option></select></label><label>Category<input name="category" required placeholder="e.g. Utilities"/></label><label>Account<input name="account" required placeholder="TCU / TCUB / other"/></label><label>Budget Amount<input name="budget" type="number" min="0" step="0.01"/></label><label>Actual Bill Amount<input name="actualAmount" type="number" min="0" step="0.01"/></label><label>Frequency<select name="frequency" defaultValue="monthly">{['monthly','bi-weekly','quarterly','annual','one-time'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Next Due<input name="nextDue" type="date" required/></label><label className="add-bill-notes">Notes<input name="notes"/></label><div className="add-bill-actions"><button type="submit">Save Bill</button><Link className="button ghost" href={`/?month=${selectedMonth}${filterSuffix}`}>Cancel</Link></div></form></section>}
    <section className="summary" aria-label="Bill summary"><article><span>Total Budget</span><strong>{money.format(summary.total)}</strong><small>{summary.activeCount} active bill occurrences</small></article><article><span>Submitted</span><strong>{money.format(summary.submitted)}</strong><small>{summary.submittedCount} submitted</small></article><article><span>Partial</span><strong className="amber">{money.format(summary.partial)}</strong><small>{summary.partialCount} partial</small></article><article><span>Remaining</span><strong className="blue">{money.format(summary.remaining)}</strong><small>outstanding</small></article><article><span>Credits</span><strong>{money.format(summary.credit)}</strong><small>overpayments</small></article></section>
    {summary.overdueCount > 0 && <p className="alert" role="status">{summary.overdueCount} overdue &middot; {money.format(summary.overdue)}</p>}
    {summary.incompleteCount > 0 && <p className="alert missing-amount" role="status">{summary.incompleteCount} {summary.incompleteCount === 1 ? 'bill needs' : 'bills need'} an amount.</p>}
    {summary.dataQualityCount > 0 && <p className="data-quality" role="status">{summary.dataQualityCount} {summary.dataQualityCount === 1 ? 'occurrence has' : 'occurrences have'} a migration or data-quality flag requiring review.</p>}

    <form method="get" className="bill-filters" aria-label="Bill column filters">
      <input type="hidden" name="month" value={selectedMonth}/>
      <label>Bill<input name="f_bill" defaultValue={filters.bill}/></label>
      <label>Type<input name="f_type" defaultValue={filters.type}/></label>
      <label>Category<input name="f_category" defaultValue={filters.category}/></label>
      <label>Account<input name="f_account" defaultValue={filters.account}/></label>
      <label>Budget<input name="f_budget" defaultValue={filters.budget}/></label>
      <label>Actual<input name="f_actual" defaultValue={filters.actual}/></label>
      <label>Next Due<input name="f_due" defaultValue={filters.due}/></label>
      <label>Status<input name="f_status" defaultValue={filters.status}/></label>
      <div className="filter-actions"><button type="submit">Apply Filters</button><Link className="button ghost" href={`/?month=${selectedMonth}`}>Clear</Link></div>
    </form>

    {groupLedgerBills(filteredRows).map(({ type, bills }) => <section className="panel" key={type}><header><strong>{type} Bills</strong><span>{bills.length} {bills.length === 1 ? 'occurrence' : 'occurrences'}</span></header><div className="table-wrap"><table><thead><tr><th>Bill</th><th>Type</th><th>Category</th><th>Account</th><th>Budget</th><th>Actual</th><th>Next Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>{bills.flatMap((bill) => {
      const editing = params?.edit === bill.rowKey || params?.edit === bill.occurrenceId;
      const partial = params?.partial === bill.rowKey || params?.partial === bill.occurrenceId;
      const rowAnchor = anchorId(bill.rowKey);
      const editFormId = `edit-${rowAnchor}`;
      const categoryValue = invalidCategory(bill.category) ? '' : (bill.category ?? '');
      const row = editing ? <tr key={bill.rowKey} id={rowAnchor} className="editing-row">
        <td><form id={editFormId} action={editBillAction}><input type="hidden" name="id" value={bill.id}/><input type="hidden" name="occurrenceId" value={bill.occurrenceId ?? ''}/><input type="hidden" name="month" value={selectedMonth}/><input type="hidden" name="rowKey" value={bill.rowKey}/><input type="hidden" name="returnQuery" value={returnQuery}/></form><input form={editFormId} aria-label="Bill name" name="name" defaultValue={bill.payee} required/><select form={editFormId} aria-label="Frequency" name="frequency" defaultValue={bill.frequency}>{['monthly','bi-weekly','quarterly','annual','one-time'].map((value) => <option key={value}>{value}</option>)}</select></td>
        <td><input form={editFormId} aria-label="Type" name="type" defaultValue={bill.type} readOnly={bill.account?.startsWith('TCU')}/></td>
        <td><input form={editFormId} aria-label="Category" name="category" defaultValue={categoryValue} placeholder="Enter category"/></td>
        <td><input form={editFormId} aria-label="Account" name="account" defaultValue={bill.account} required/></td>
        <td><input form={editFormId} aria-label="Budget Amount" name="budget" type="number" min="0" step="0.01" defaultValue={bill.budget ?? ''} placeholder="Optional if Actual is known"/></td>
        <td><input form={editFormId} aria-label="Actual Bill Amount" name="actualAmount" type="number" min="0" step="0.01" defaultValue={bill.actualAmount ?? ''} placeholder="Enter from statement"/></td>
        <td><input form={editFormId} aria-label="Next Due" name="nextDue" type="date" defaultValue={bill.nextDue} required/></td>
        <td><span className={`status ${bill.status}`}>{bill.status}</span></td>
        <td><div className="row-actions"><button form={editFormId} type="submit">Save</button><Link className="button ghost" href={`/?month=${selectedMonth}${filterSuffix}#${rowAnchor}`}>Cancel</Link></div></td>
      </tr> : <tr key={bill.rowKey} id={rowAnchor}><td><b>{bill.payee}</b>{bill.frequency === 'bi-weekly' && <small>Bi-weekly installment</small>}{bill.submitted > 0 && <small>Paid {money.format(bill.submitted)} · Remaining {money.format(bill.remaining ?? 0)}{bill.credit > 0 ? ` · Credit ${money.format(bill.credit)}` : ''}</small>}</td><td>{bill.type}</td><td>{displayCategory(bill.category)}</td><td>{bill.account}</td><td>{bill.budget === null ? 'Enter amount' : money.format(bill.budget)}</td><td>{bill.actualAmount === null ? '—' : money.format(bill.actualAmount)}</td><td>{displayDate(bill.nextDue)}</td><td><span className={`status ${bill.status}`}>{bill.status}</span></td><td><div className="row-actions"><form action={submitBillAction}><input type="hidden" name="id" value={bill.id}/><input type="hidden" name="occurrenceId" value={bill.occurrenceId ?? ''}/><input type="hidden" name="dueDate" value={bill.nextDue}/><input type="hidden" name="month" value={selectedMonth}/><input type="hidden" name="rowKey" value={bill.rowKey}/><input type="hidden" name="returnQuery" value={returnQuery}/><button type="submit" disabled={bill.status === 'submitted' || bill.effectiveAmount === null || !bill.occurrenceId}>Submit</button></form><Link className={`button partial ${bill.effectiveAmount === null || !bill.occurrenceId ? 'disabled' : ''}`} aria-disabled={bill.effectiveAmount === null || !bill.occurrenceId} href={bill.effectiveAmount === null || !bill.occurrenceId ? `/?month=${selectedMonth}${filterSuffix}#${rowAnchor}` : `/?month=${selectedMonth}${filterSuffix}&partial=${encodeURIComponent(bill.rowKey)}#${rowAnchor}`}>Partial</Link><Link className="button ghost" href={`/?month=${selectedMonth}${filterSuffix}&edit=${encodeURIComponent(bill.rowKey)}#${rowAnchor}`}>Edit</Link><form action={archiveBillAction}><input type="hidden" name="id" value={bill.id}/><input type="hidden" name="month" value={selectedMonth}/><input type="hidden" name="rowKey" value={bill.rowKey}/><input type="hidden" name="returnQuery" value={returnQuery}/><ConfirmButton className="ghost danger" message={`Archive ${bill.payee}?`}>Archive</ConfirmButton></form></div></td></tr>;
      const detail = partial && selected ? <tr key={`${bill.rowKey}-partial`} className="inline-detail"><td colSpan="9"><div className="inline-payment"><div className="inline-payment-head"><strong>Payments for {selected.payee} · {displayDate(selected.nextDue)}</strong><Link href={`/?month=${selectedMonth}${filterSuffix}#${rowAnchor}`}>Close</Link></div><form action={addPaymentAction} className="inline-form"><input type="hidden" name="id" value={selected.id}/><input type="hidden" name="occurrenceId" value={selected.occurrenceId ?? ''}/><input type="hidden" name="dueDate" value={selected.nextDue}/><input type="hidden" name="month" value={selectedMonth}/><input type="hidden" name="rowKey" value={selected.rowKey}/><input type="hidden" name="returnQuery" value={returnQuery}/><label>Payment amount<input name="amount" type="number" min="0.01" step="0.01" required/></label><label>Payment date<input name="paymentDate" type="date" defaultValue={today()} required/></label><label>Funding account<input name="fundingAccount" defaultValue={selected.account} required/></label><label>Notes<input name="notes"/></label><button type="submit">Add Payment</button></form>{selected.transactions.map((payment) => <form action={updatePaymentAction} className="payment-row" key={payment.id}><input type="hidden" name="id" value={selected.id}/><input type="hidden" name="occurrenceId" value={selected.occurrenceId ?? ''}/><input type="hidden" name="month" value={selectedMonth}/><input type="hidden" name="rowKey" value={selected.rowKey}/><input type="hidden" name="returnQuery" value={returnQuery}/><input type="hidden" name="paymentId" value={payment.id}/><input aria-label="Payment amount" name="amount" type="number" step="0.01" defaultValue={payment.amount}/><input aria-label="Payment date" name="paymentDate" type="date" defaultValue={payment.paymentDate}/><input aria-label="Funding account" name="fundingAccount" defaultValue={payment.fundingAccount ?? selected.account} required/><input aria-label="Payment notes" name="notes" defaultValue={payment.notes ?? ''}/><button type="submit">Update</button><button formAction={removePaymentAction} className="ghost danger">Remove</button></form>)}</div></td></tr> : null;
      return detail ? [row, detail] : [row];
    })}</tbody></table></div></section>)}
    {!loadError && filteredRows.length === 0 && <p className="empty">No bill occurrences match the current filters.</p>}
  </>;
}
