import { getLedgerBills } from './ledger-bills-data.js';
import { getMonthlyIncome } from './monthly-finances.js';

const DAY = 86400000;
const PAY_PERIOD_DAYS = 14;
export const PAYCHECK_ANCHOR = '2026-08-07';
export const DEFAULT_REGULAR_PAYCHECK = 2992;

export function normalizePayPeriodOffset(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

const dateKey = (value) => value.toISOString().slice(0, 10);
const utcDate = (value) => new Date(`${value}T00:00:00Z`);
const monthKey = (value) => String(value).slice(0, 7);

function shiftDate(date, days) {
  return new Date(date.getTime() + days * DAY);
}

function addMonths(month, amount) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return dateKey(date).slice(0, 7);
}

export function getPayPeriod(offset = 0, now = new Date()) {
  const normalizedOffset = normalizePayPeriodOffset(offset);
  const anchor = utcDate(PAYCHECK_ANCHOR);
  const today = utcDate(dateKey(now));
  const elapsed = (today - anchor) / (PAY_PERIOD_DAYS * DAY);
  const upcomingIndex = Math.ceil(elapsed);
  const index = upcomingIndex + normalizedOffset;
  const paycheck = shiftDate(anchor, index * PAY_PERIOD_DAYS);
  const nextPaycheck = shiftDate(paycheck, PAY_PERIOD_DAYS);
  return {
    paycheckDate: dateKey(paycheck),
    nextPaycheckDate: dateKey(nextPaycheck),
    coverageStart: dateKey(paycheck),
    coverageEnd: dateKey(shiftDate(nextPaycheck, -1)),
    offset: normalizedOffset,
  };
}

const normalized = (value) => String(value ?? '').trim().toUpperCase();
const isIncome = (bill) => [bill.category, bill.type].some((value) => normalized(value) === 'INCOME');

function routeBills(items) {
  const personal = items.filter((bill) => normalized(bill.account).startsWith('TCU') && !normalized(bill.account).startsWith('TCUB'));
  const business = items.filter((bill) => normalized(bill.account).startsWith('TCUB'));
  const uncategorized = items.filter((bill) => !personal.includes(bill) && !business.includes(bill));
  return { personal, business, uncategorized };
}

export function buildPayPeriodBudget(rows, period, monthlyIncome = 0) {
  const seen = new Set();
  const selected = rows
    .filter((bill) => !isIncome(bill))
    .filter((bill) => {
      if (!bill.nextDue || seen.has(bill.rowKey)) return false;
      seen.add(bill.rowKey);
      const remaining = Number(bill.remaining ?? bill.effectiveAmount ?? 0);
      if (remaining <= 0) return false;
      // Every still-unpaid obligation due before the following paycheck belongs
      // in this paycheck plan. That includes an older unpaid carry-forward and
      // bills from the next calendar month when the coverage window crosses month-end.
      return bill.nextDue < period.nextPaycheckDate;
    })
    .map((bill) => ({ ...bill, plannedAmount: Number(bill.remaining ?? bill.effectiveAmount ?? 0) }))
    .sort((a, b) => String(a.nextDue).localeCompare(String(b.nextDue)) || String(a.payee).localeCompare(String(b.payee)));

  const planned = selected.reduce((sum, bill) => sum + bill.plannedAmount, 0);
  const regularPaycheck = DEFAULT_REGULAR_PAYCHECK;
  const recordedMonthlyIncome = Number(monthlyIncome ?? 0);
  const projectedMonthlyIncomeAfterPaycheck = recordedMonthlyIncome + regularPaycheck;

  return {
    ...routeBills(selected),
    bills: selected,
    totals: {
      regularPaycheck,
      recordedMonthlyIncome,
      projectedMonthlyIncomeAfterPaycheck,
      planned,
      available: regularPaycheck - planned,
    },
  };
}

export async function getPayPeriodBudget({ offset = 0, now = new Date() } = {}) {
  const period = getPayPeriod(offset, now);
  const paycheckMonth = monthKey(period.paycheckDate);
  const coverageMonth = monthKey(period.coverageEnd);
  const months = [...new Set([addMonths(paycheckMonth, -1), paycheckMonth, coverageMonth])];
  const [monthRows, monthlyIncome] = await Promise.all([
    Promise.all(months.map((selectedMonth) => getLedgerBills({ selectedMonth, asOf: now }))),
    getMonthlyIncome(paycheckMonth),
  ]);
  return {
    period,
    ...buildPayPeriodBudget(monthRows.flat(), period, monthlyIncome ?? 0),
  };
}
