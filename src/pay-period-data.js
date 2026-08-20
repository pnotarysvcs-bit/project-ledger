import { getLedgerBills } from './ledger-bills-data.js';
import { supabaseRequest } from './supabase-server.js';

export const DEFAULT_REGULAR_PAYCHECK = 2992;
export const PAY_PERIOD_LABELS = {
  1: 'Pay Period 1 — 13th',
  2: 'Pay Period 2 — 27th',
};

export function normalizePayPeriodOffset(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

function addMonths(month, amount) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return monthKey(date);
}

export function getPayPeriod(offset = 0, now = new Date()) {
  const normalizedOffset = normalizePayPeriodOffset(offset);
  const basePeriod = now.getUTCDate() <= 13 ? 1 : 2;
  const baseMonthIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const absoluteIndex = baseMonthIndex * 2 + (basePeriod - 1) + normalizedOffset;
  const monthIndex = Math.floor(absoluteIndex / 2);
  const period = ((absoluteIndex % 2) + 2) % 2 + 1;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex % 12;
  const normalizedMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
  const payday = period === 1 ? 13 : 27;
  return {
    month: normalizedMonth,
    period,
    label: PAY_PERIOD_LABELS[period],
    paycheckDate: `${normalizedMonth}-${payday}`,
    offset: normalizedOffset,
  };
}

const normalized = (value) => String(value ?? '').trim().toUpperCase();
const isIncome = (bill) => [bill.category, bill.type].some((value) => normalized(value) === 'INCOME');
const total = (items, field) => items.reduce((sum, item) => sum + Number(item[field] ?? 0), 0);

function routeBills(items) {
  const personal = items.filter((bill) => normalized(bill.account).startsWith('TCU') && !normalized(bill.account).startsWith('TCUB'));
  const business = items.filter((bill) => normalized(bill.account).startsWith('TCUB'));
  const uncategorized = items.filter((bill) => !personal.includes(bill) && !business.includes(bill));
  return { personal, business, uncategorized };
}

export function buildPayPeriodBudget(rows, assignments, period, finances = {}) {
  const expenseRows = rows.filter((bill) => !isIncome(bill));
  const withAssignments = expenseRows.map((bill) => ({
    ...bill,
    payPeriod: assignments.get(bill.id) ?? null,
  }));
  const selected = withAssignments.filter((bill) => bill.payPeriod === period.label);
  const other = withAssignments.filter((bill) => bill.payPeriod && bill.payPeriod !== period.label);
  const unassigned = withAssignments.filter((bill) => !bill.payPeriod);
  const income = Number(finances.regularIncome ?? DEFAULT_REGULAR_PAYCHECK) + Number(finances.notaryIncome ?? 0);
  const expenses = total(selected, 'effectiveAmount');
  const paid = selected.reduce((sum, bill) => sum + Number(bill.submitted ?? 0), 0);
  const aheadContribution = Number(finances.aheadContribution ?? 0);

  return {
    ...routeBills(selected),
    other,
    unassigned,
    totals: {
      income,
      expenses,
      paid,
      aheadContribution,
      available: income - expenses - aheadContribution,
    },
  };
}

async function getAssignments(rows) {
  const ids = [...new Set(rows.map((row) => row.id).filter(Boolean))];
  if (!ids.length) return new Map();
  const records = await supabaseRequest(`ledger_bills?select=id,pay_period&id=in.(${ids.join(',')})`);
  return new Map(records.map((record) => [record.id, record.pay_period ?? null]));
}

async function getPeriodFinances(period) {
  const month = `${period.month}-01`;
  const rows = await supabaseRequest(`ledger_pay_period_finances?select=regular_income,notary_income,ahead_contribution,target_month&month=eq.${month}&period=eq.${period.period}`);
  const row = rows?.[0];
  return {
    regularIncome: Number(row?.regular_income ?? DEFAULT_REGULAR_PAYCHECK),
    notaryIncome: Number(row?.notary_income ?? 0),
    aheadContribution: Number(row?.ahead_contribution ?? 0),
    targetMonth: row?.target_month ? String(row.target_month).slice(0, 7) : addMonths(period.month, 1),
  };
}

async function getAheadProgress(targetMonth, now) {
  const targetDate = `${targetMonth}-01`;
  const [rows, contributions] = await Promise.all([
    getLedgerBills({ selectedMonth: targetMonth, asOf: now }),
    supabaseRequest(`ledger_pay_period_finances?select=ahead_contribution&target_month=eq.${targetDate}`),
  ]);
  const target = rows.filter((bill) => !isIncome(bill)).reduce((sum, bill) => sum + Number(bill.effectiveAmount ?? 0), 0);
  const funded = contributions.reduce((sum, row) => sum + Number(row.ahead_contribution ?? 0), 0);
  return {
    targetMonth,
    target,
    funded,
    percent: target > 0 ? Math.min(100, Math.round((funded / target) * 100)) : 0,
  };
}

export async function getPayPeriodBudget({ offset = 0, now = new Date() } = {}) {
  const period = getPayPeriod(offset, now);
  const [rows, finances] = await Promise.all([
    getLedgerBills({ selectedMonth: period.month, asOf: now }),
    getPeriodFinances(period),
  ]);
  const assignments = await getAssignments(rows);
  const ahead = await getAheadProgress(finances.targetMonth, now);
  return {
    period,
    finances,
    ahead,
    ...buildPayPeriodBudget(rows, assignments, period, finances),
  };
}
