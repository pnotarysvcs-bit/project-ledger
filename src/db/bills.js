import { getSupabase } from './client.js';
import { deriveBillStatus } from '../bills.js';
import { nextDueDate } from '../bills/due-date.js';

/**
 * Reading bills from ledger_bills.
 *
 * The table stores a cadence rather than a due date, so a concrete next-due is
 * computed per row. Payment history lives in ledger_bill_payments, which is
 * empty for now; until it fills, last-paid is null and every bill reads as
 * outstanding. That is accurate rather than optimistic — the ledger genuinely
 * does not know of any payment yet.
 */

export const BILL_COLUMNS = 'id, bill_name, bill_type, category, account, budget, frequency, due_day, start_month, is_active, notes';

/** Map a ledger_bills record onto the shape the pages render. */
export function mapBillRecord(record = {}) {
  return {
    id: record.id,
    payee: record.bill_name,
    type: record.bill_type,
    category: record.category ?? null,
    account: record.account ?? null,
    amount: record.budget == null ? 0 : Number(record.budget),
    frequency: record.frequency,
    due_day: record.due_day,
    start_month: record.start_month,
    active: record.is_active !== false,
    notes: record.notes ?? null,
    lastPaid: null,
  };
}

/**
 * Add the computed due date and status a row needs to render.
 *
 * An inactive bill is marked archived rather than dropped, so counts that
 * exclude it do so deliberately rather than by omission.
 */
export function enrichBill(bill, { asOf = new Date() } = {}) {
  if (!bill.active) return { ...bill, nextDue: null, status: 'archived' };

  const nextDue = nextDueDate(bill, { asOf });

  // A cadence we cannot resolve leaves the bill dateless; say so rather than
  // inventing a due date or silently calling it overdue.
  if (!nextDue) return { ...bill, nextDue: null, status: 'new' };

  const withDue = { ...bill, nextDue };
  return { ...withDue, status: deriveBillStatus(withDue, { asOf }) };
}

export const toLedgerRows = (records = [], options = {}) =>
  records.map(mapBillRecord).map((bill) => enrichBill(bill, options));

/**
 * Fetch every bill, enriched and ready to render.
 *
 * Returns a result rather than throwing so a page can degrade to a clear
 * message instead of a crash when the database is unreachable.
 */
export async function fetchBills({ asOf = new Date() } = {}) {
  const supabase = getSupabase();
  if (!supabase) return { rows: [], error: 'not-configured' };

  const { data, error } = await supabase
    .from('ledger_bills')
    .select(BILL_COLUMNS)
    .order('bill_type', { ascending: true })
    .order('bill_name', { ascending: true });

  if (error) return { rows: [], error: error.message };

  return { rows: toLedgerRows(data ?? [], { asOf }), error: null };
}
