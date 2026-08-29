import { supabaseRequest } from './supabase-server.js';
import { normalizeLedgerMonth } from './ledger-bills-data.js';

const number = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function getMonthlyIncome(selectedMonth) {
  const month = `${normalizeLedgerMonth(selectedMonth)}-01`;
  const rows = await supabaseRequest(`ledger_monthly_finances?select=income&month=eq.${month}`);
  if (!rows?.length) return null;
  return Number(rows[0].income);
}

export function deriveIncomeBreakdown(payPeriods = [], legacyMonthlyIncome = 0) {
  const periods = (payPeriods ?? []).map((row) => ({
    period: Number(row.period),
    regularIncome: number(row.regularIncome ?? row.regular_income),
    notaryIncome: number(row.notaryIncome ?? row.notary_income),
    aheadContribution: number(row.aheadContribution ?? row.ahead_contribution),
    targetMonth: row.targetMonth ?? row.target_month ?? null,
  }));
  const payrollIncome = periods.reduce((sum, row) => sum + row.regularIncome, 0);
  const notarySupport = periods.reduce((sum, row) => sum + row.notaryIncome, 0);
  const otherFunding = Math.max(0, number(legacyMonthlyIncome) - payrollIncome);

  return {
    payrollIncome,
    notarySupport,
    otherFunding,
    householdFunding: payrollIncome + notarySupport + otherFunding,
    legacyMonthlyIncome: number(legacyMonthlyIncome),
    periods,
  };
}

export async function getIncomeBreakdown(selectedMonth) {
  const month = `${normalizeLedgerMonth(selectedMonth)}-01`;
  const [monthlyRows, payPeriods] = await Promise.all([
    supabaseRequest(`ledger_monthly_finances?select=income&month=eq.${month}`),
    supabaseRequest(`ledger_pay_period_finances?select=period,regular_income,notary_income,ahead_contribution,target_month&month=eq.${month}&order=period.asc`),
  ]);

  return deriveIncomeBreakdown(payPeriods, number(monthlyRows?.[0]?.income));
}

export async function getPayPeriodIncome(selectedMonth, period) {
  const month = `${normalizeLedgerMonth(selectedMonth)}-01`;
  const rows = await supabaseRequest(
    `ledger_pay_period_finances?select=period,regular_income,notary_income,ahead_contribution,target_month&month=eq.${month}&period=eq.${Number(period)}&limit=1`,
  );
  const row = rows?.[0] ?? {};
  return {
    period: Number(period),
    regularIncome: number(row.regular_income),
    notaryIncome: number(row.notary_income),
    aheadContribution: number(row.ahead_contribution),
    targetMonth: row.target_month ?? null,
  };
}

export async function saveMonthlyIncome(selectedMonth, income) {
  const month = `${normalizeLedgerMonth(selectedMonth)}-01`;
  const amount = Number(income);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Monthly income must be zero or greater.');

  const rows = await supabaseRequest('ledger_monthly_finances?on_conflict=month', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: { month, income: amount, updated_at: new Date().toISOString() },
  });

  return Number(rows?.[0]?.income ?? amount);
}

export async function addMonthlyIncome(selectedMonth, addition) {
  const amount = Number(addition);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Income addition must be zero or greater.');

  const current = await getMonthlyIncome(selectedMonth);
  const total = Number(current ?? 0) + amount;
  return saveMonthlyIncome(selectedMonth, total);
}
