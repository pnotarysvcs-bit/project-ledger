import { getLedgerBills } from './ledger-bills-data.js';

const DAY = 86400000;
const PERIOD_DAYS = 14;
export const PAY_PERIOD_ANCHOR = '2026-08-24';

const utcDate = (value) => new Date(`${value}T00:00:00Z`);
const dateKey = (value) => value.toISOString().slice(0, 10);

export function normalizePayPeriodOffset(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

export function getPayPeriod(offset = 0, now = new Date()) {
  const anchor = utcDate(PAY_PERIOD_ANCHOR);
  const today = utcDate(dateKey(now));
  const currentIndex = Math.floor((today - anchor) / (PERIOD_DAYS * DAY));
  const index = currentIndex + normalizePayPeriodOffset(offset);
  const startDate = new Date(anchor.getTime() + index * PERIOD_DAYS * DAY);
  const endDate = new Date(startDate.getTime() + (PERIOD_DAYS - 1) * DAY);
  return { start: dateKey(startDate), end: dateKey(endDate), index, offset: normalizePayPeriodOffset(offset) };
}

const normalized = (value) => String(value ?? '').trim().toUpperCase();
const isIncome = (bill) => [bill.category, bill.type].some((value) => normalized(value) === 'INCOME');

export function buildPayPeriodBudget(rows, period) {
  const inWindow = (date) => date >= period.start && date <= period.end;
  const seen = new Set();
  const bills = rows.filter((bill) => {
    if (!inWindow(bill.nextDue) || seen.has(bill.rowKey)) return false;
    seen.add(bill.rowKey);
    return true;
  }).map((bill) => ({
    ...bill,
    periodTransactions: bill.transactions.filter((transaction) => inWindow(transaction.paymentDate)),
  }));

  const income = bills.filter(isIncome);
  const expenses = bills.filter((bill) => !isIncome(bill));
  const personal = expenses.filter((bill) => normalized(bill.account).startsWith('TCU') && !normalized(bill.account).startsWith('TCUB'));
  const business = expenses.filter((bill) => normalized(bill.account).startsWith('TCUB'));
  const uncategorized = expenses.filter((bill) => !personal.includes(bill) && !business.includes(bill));
  const total = (items, field) => items.reduce((sum, item) => sum + Number(item[field] ?? 0), 0);
  const paid = (items) => items.reduce((sum, item) => sum + total(item.periodTransactions, 'amount'), 0);

  return {
    income, personal, business, uncategorized,
    totals: {
      income: total(income, 'effectiveAmount'),
      expenses: total(expenses, 'effectiveAmount'),
      paid: paid(expenses),
      available: total(income, 'effectiveAmount') - total(expenses, 'effectiveAmount'),
    },
  };
}

export async function getPayPeriodBudget({ offset = 0, now = new Date() } = {}) {
  const period = getPayPeriod(offset, now);
  const months = [...new Set([period.start.slice(0, 7), period.end.slice(0, 7)])];
  const rows = (await Promise.all(months.map((selectedMonth) => getLedgerBills({ selectedMonth, asOf: now })))).flat();
  return { period, ...buildPayPeriodBudget(rows, period) };
}
