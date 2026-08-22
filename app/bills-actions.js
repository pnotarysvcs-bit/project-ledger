'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getLedgerBills, normalizeLedgerMonth } from '../src/ledger-bills-data.js';
import { applyBillFilters, billFilterQuery, getBillFilters } from '../src/bills/filters.js';
import { monthlyEquivalent, recommendNextPayoff } from '../src/goals.js';
import { closeBillWithRollover } from '../src/goals-store.js';
import {
  changePayment,
  createBill,
  deletePayment,
  recordBulkActuals,
  recordBulkPayments,
  recordPayment,
  updateBill,
} from '../src/bills/service.js';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const displayDate = (date) => date ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)) : '-';
const displayCategory = (category) => !category || ['business', 'personal'].includes(String(category).trim().toLowerCase()) ? 'Needs category' : category;

function value(data, key) { return String(data.get(key) ?? ''); }
function commonInput(data) {
  return {
    id: value(data, 'id'),
    occurrenceId: value(data, 'occurrenceId'),
    month: normalizeLedgerMonth(value(data, 'month')),
    rowKey: value(data, 'rowKey'),
    returnQuery: value(data, 'returnQuery'),
  };
}

function redirectToBills({ month, message, rowKey = '', returnQuery = '' }) {
  revalidatePath('/');
  revalidatePath('/dashboard');
  const query = new URLSearchParams({ month });
  if (returnQuery) {
    const filters = new URLSearchParams(returnQuery);
    for (const [key, filterValue] of filters) if (key.startsWith('f_') && filterValue) query.set(key, filterValue);
  }
  if (message) query.set('notice', message);
  const anchor = rowKey ? `#bill-${rowKey.replace(/[^a-zA-Z0-9_-]/g, '-')}` : '';
  redirect(`/?${query.toString()}${anchor}`);
}

export async function addBillAction(data) {
  const common = commonInput(data);
  const created = await createBill({ ...common, name: value(data, 'name'), type: value(data, 'type'), category: value(data, 'category'), account: value(data, 'account'), frequency: value(data, 'frequency'), budget: value(data, 'budget'), actualAmount: value(data, 'actualAmount'), nextDue: value(data, 'nextDue'), notes: value(data, 'notes') });
  redirectToBills({ ...common, month: created.month, message: 'Bill added.' });
}

export async function editBillAction(data) {
  const common = commonInput(data);
  await updateBill({ ...common, name: value(data, 'name'), type: value(data, 'type'), category: value(data, 'category'), account: value(data, 'account'), frequency: value(data, 'frequency'), budget: value(data, 'budget'), actualAmount: value(data, 'actualAmount'), nextDue: value(data, 'nextDue') });
  redirectToBills({ ...common, message: 'Bill updated.' });
}

export async function addPaymentAction(data) {
  const common = commonInput(data);
  await recordPayment({ ...common, dueDate: value(data, 'dueDate'), amount: value(data, 'amount'), paymentDate: value(data, 'paymentDate'), fundingAccount: value(data, 'fundingAccount'), notes: value(data, 'notes') });
  redirectToBills({ ...common, message: 'Payment recorded.' });
}

export async function submitBillAction(data) {
  const common = commonInput(data);
  const dueDate = value(data, 'dueDate');
  const rows = await getLedgerBills({ selectedMonth: common.month });
  const bill = rows.find((row) => row.id === common.id && (row.occurrenceId === common.occurrenceId || (!common.occurrenceId && row.nextDue === dueDate)));
  if (!bill || bill.effectiveAmount === null || bill.remaining <= 0) throw new Error('This bill is already submitted or has no amount.');
  await recordPayment({ ...common, dueDate, amount: bill.remaining, paymentDate: new Date().toISOString().slice(0, 10), fundingAccount: bill.account, notes: 'Full payment submitted' });
  redirectToBills({ ...common, message: 'Bill submitted.' });
}

export async function bulkSubmitAction(data) {
  const month = normalizeLedgerMonth(value(data, 'month'));
  const rows = await getLedgerBills({ selectedMonth: month });
  const result = await recordBulkPayments({ month, currentMonth: new Date().toISOString().slice(0, 7), bills: rows });
  redirectToBills({ month, message: `${result.count} bills submitted.` });
}

export async function bulkSubmitActualsAction(data) {
  const month = normalizeLedgerMonth(value(data, 'month'));
  const filters = getBillFilters(Object.fromEntries(data.entries()));
  const returnQuery = billFilterQuery(filters);
  if (!returnQuery) throw new Error('Apply at least one bill filter before using Bulk Submit Actuals.');
  const rows = await getLedgerBills({ selectedMonth: month });
  const filteredRows = applyBillFilters(rows, filters, { moneyFormatter: money, displayDate, displayCategory });
  const result = await recordBulkActuals({ month, bills: filteredRows });
  redirectToBills({ month, returnQuery, message: result.count ? `${result.count} filtered bill${result.count === 1 ? '' : 's'} updated: Actual equals Budget and status is Submitted.` : 'No filtered bills were eligible. Existing Actual amounts were preserved.' });
}

export async function updatePaymentAction(data) {
  const common = commonInput(data);
  await changePayment({ ...common, paymentId: value(data, 'paymentId'), amount: value(data, 'amount'), paymentDate: value(data, 'paymentDate'), fundingAccount: value(data, 'fundingAccount'), notes: value(data, 'notes') });
  redirectToBills({ ...common, message: 'Payment updated.' });
}

export async function removePaymentAction(data) {
  const common = commonInput(data);
  await deletePayment({ ...common, paymentId: value(data, 'paymentId') });
  redirectToBills({ ...common, message: 'Payment removed.' });
}

export async function archiveBillAction(data) {
  const common = commonInput(data);
  const rows = await getLedgerBills({ selectedMonth: common.month });
  const sourceRows = rows.filter((row) => row.id === common.id);
  const sourceBill = sourceRows.find((row) => row.rowKey === common.rowKey) ?? sourceRows[0];
  if (!sourceBill) throw new Error('The bill could not be found before closing. Refresh and try again.');
  if (sourceBill.actualAmount === null) throw new Error('Enter the Actual amount before marking a bill Closed.');

  const freedMonthlyCash = sourceRows.length > 1 && sourceBill.frequency === 'bi-weekly'
    ? sourceRows.reduce((sum, row) => sum + Number(row.actualAmount ?? 0), 0)
    : monthlyEquivalent(sourceBill);
  const recommendation = recommendNextPayoff(rows, common.id);

  await closeBillWithRollover({ sourceBill, targetBill: recommendation, closedMonth: common.month, monthlyAmount: freedMonthlyCash });

  const allocation = freedMonthlyCash > 0 ? `${money.format(freedMonthlyCash)}/month freed.` : 'Closed with no recurring monthly rollover.';
  const next = recommendation ? ` Suggested next payoff: ${recommendation.payee}.` : ' No automatic payoff candidate was identified; choose the next target manually.';
  redirectToBills({ ...common, rowKey: '', message: `${sourceBill.payee} closed. ${allocation}${next}` });
}
