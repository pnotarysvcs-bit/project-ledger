import { getLedgerBills } from './ledger-bills-data.js';
import { getPayPeriodIncome } from './monthly-finances.js';

const DAY = 86400000;
const PAY_PERIOD_DAYS = 14;
export const PAYCHECK_ANCHOR = '2026-08-14';

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

export function payPeriodNumberForDate(paycheckDate) {
  const target = utcDate(paycheckDate);
  const month = monthKey(paycheckDate);
  const anchor = utcDate(PAYCHECK_ANCHOR);
  const diff = Math.round((target - anchor) / (PAY_PERIOD_DAYS * DAY));
  let cursor = shiftDate(anchor, diff * PAY_PERIOD_DAYS);
  while (monthKey(dateKey(shiftDate(cursor, -PAY_PERIOD_DAYS))) === month) cursor = shiftDate(cursor, -PAY_PERIOD_DAYS);
  let period = 1;
  while (dateKey(cursor) < paycheckDate) {
    cursor = shiftDate(cursor, PAY_PERIOD_DAYS);
    period += 1;
  }
  return period;
}

const normalized = (value) => String(value ?? '').trim().toUpperCase();
const isIncome = (bill) => [bill.category, bill.type].some((value) => normalized(value) === 'INCOME');

function routeBills(items) {
  const personal = items.filter((bill) => normalized(bill.account).startsWith('TCU') && !normalized(bill.account).startsWith('TCUB'));
  const business = items.filter((bill) => normalized(bill.account).startsWith('TCUB'));
  const uncategorized = items.filter((bill) => !personal.includes(bill) && !business.includes(bill));
  return { personal, business, uncategorized };
}

function planningStatus(bill, period) {
  if (Number(bill.overdueOutstanding ?? 0) > 0) return 'Overdue';
  if (Number(bill.remaining ?? 0) <= 0) return 'Paid';
  if (Number(bill.submitted ?? 0) > 0) return 'Partially Paid';
  if (bill.nextDue >= period.coverageStart && bill.nextDue <= period.coverageEnd) return 'Due This Period';
  return 'Upcoming';
}

export function buildPayPeriodBudget(rows, period, funding = {}) {
  const seen = new Set();
  const selected = rows
    .filter((bill) => !isIncome(bill))
    .filter((bill) => {
      if (!bill.rowKey || seen.has(bill.rowKey)) return false;
      const dueThisPeriod = bill.nextDue && bill.nextDue >= period.coverageStart && bill.nextDue <= period.coverageEnd;
      const overdue = Number(bill.overdueOutstanding ?? 0) > 0;
      if (!dueThisPeriod && !overdue) return false;
      seen.add(bill.rowKey);
      return true;
    })
    .map((bill) => {
      const currentRemaining = Math.max(0, Number(bill.remaining ?? bill.effectiveAmount ?? 0));
      const overdueRemaining = Math.max(0, Number(bill.overdueOutstanding ?? 0));
      return {
        ...bill,
        plannedAmount: currentRemaining + overdueRemaining,
        planningStatus: planningStatus(bill, period),
      };
    })
    .sort((a, b) => {
      if (a.planningStatus === 'Overdue' && b.planningStatus !== 'Overdue') return -1;
      if (b.planningStatus === 'Overdue' && a.planningStatus !== 'Overdue') return 1;
      return String(a.nextDue ?? '').localeCompare(String(b.nextDue ?? '')) || String(a.payee).localeCompare(String(b.payee));
    });

  const planned = selected.reduce((sum, bill) => sum + bill.plannedAmount, 0);
  const regularIncome = Number(funding.regularIncome ?? 0);
  const notaryIncome = Number(funding.notaryIncome ?? 0);
  const householdFunding = regularIncome + notaryIncome;

  return {
    ...routeBills(selected),
    bills: selected,
    totals: {
      regularIncome,
      notaryIncome,
      householdFunding,
      planned,
      available: householdFunding - planned,
      fundingGap: Math.max(0, planned - householdFunding),
    },
  };
}

export async function getPayPeriodBudget({ offset = 0, now = new Date() } = {}) {
  const period = getPayPeriod(offset, now);
  const paycheckMonth = monthKey(period.paycheckDate);
  const coverageMonth = monthKey(period.coverageEnd);
  const periodNumber = payPeriodNumberForDate(period.paycheckDate);
  const months = [...new Set([addMonths(paycheckMonth, -1), paycheckMonth, coverageMonth])];
  const [monthRows, funding] = await Promise.all([
    Promise.all(months.map((selectedMonth) => getLedgerBills({ selectedMonth, asOf: now }))),
    getPayPeriodIncome(paycheckMonth, periodNumber),
  ]);
  return {
    period: { ...period, periodNumber },
    ...buildPayPeriodBudget(monthRows.flat(), period, funding),
  };
}
