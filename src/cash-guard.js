import { supabaseRequest } from './supabase-server.js';
import { normalizeLedgerMonth } from './ledger-bills-data.js';
import { listIncomeEntries, summarizeIncome } from './monthly-finances.js';

const number = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function getLatestCashSnapshot() {
  const rows = await supabaseRequest('ledger_cash_guard?select=available_cash,cash_as_of,month&order=month.desc&limit=1');
  const row = rows?.[0] ?? {};
  return {
    availableCash: number(row.available_cash),
    cashAsOf: row.cash_as_of ?? null,
    month: row.month ?? null,
  };
}

export async function getCashGuardInputs(selectedMonth) {
  const normalized = normalizeLedgerMonth(selectedMonth);
  const month = `${normalized}-01`;
  const [guardRows, payPeriods, rollovers, sourceBills, monthlyRows, incomeEntries] = await Promise.all([
    supabaseRequest(`ledger_cash_guard?select=available_cash,variable_essentials_reserve,planned_one_offs_reserve,cash_floor,discretionary_lock_until,cash_as_of,notes&month=eq.${month}`),
    supabaseRequest(`ledger_pay_period_finances?select=period,regular_income,notary_income,ahead_contribution,target_month&month=eq.${month}&order=period.asc`),
    supabaseRequest(`ledger_goal_rollovers?select=source_bill_id,source_name,target_name,monthly_amount,status,closed_month&closed_month=lte.${month}&order=closed_month.asc`),
    supabaseRequest('ledger_bills?select=id,frequency'),
    supabaseRequest(`ledger_monthly_finances?select=income&month=eq.${month}`),
    listIncomeEntries(normalized),
  ]);

  const sourceFrequency = new Map((sourceBills ?? []).map((bill) => [bill.id, String(bill.frequency ?? '').trim().toLowerCase()]));
  const freedCashItems = (rollovers ?? [])
    .filter((row) => sourceFrequency.get(row.source_bill_id) !== 'one-time')
    .map((row) => ({
      sourceBillId: row.source_bill_id,
      sourceName: row.source_name,
      targetName: row.target_name ?? null,
      monthlyAmount: number(row.monthly_amount),
      status: row.status,
      closedMonth: row.closed_month,
    }));

  const guard = guardRows?.[0] ?? {};
  return {
    availableCash: number(guard.available_cash),
    variableEssentialsReserve: number(guard.variable_essentials_reserve),
    plannedOneOffsReserve: number(guard.planned_one_offs_reserve),
    cashFloor: number(guard.cash_floor),
    discretionaryLockUntil: guard.discretionary_lock_until ?? null,
    cashAsOf: guard.cash_as_of ?? null,
    notes: guard.notes ?? null,
    freedCashItems,
    recordedMonthlyIncome: number(monthlyRows?.[0]?.income),
    incomeEntries,
    payPeriods: (payPeriods ?? []).map((row) => ({
      period: Number(row.period),
      regularIncome: number(row.regular_income),
      notaryIncome: number(row.notary_income),
      aheadContribution: number(row.ahead_contribution),
      targetMonth: row.target_month ?? null,
    })),
  };
}

export function calculateCashGuard(rows = [], inputs = {}, asOf = new Date()) {
  const currentBillsRemaining = rows.reduce((sum, row) => sum + Math.max(0, number(row.remaining)), 0);
  const overdueByBill = new Map();
  for (const row of rows) {
    const outstanding = Math.max(0, number(row.overdueOutstanding));
    if (!outstanding) continue;
    overdueByBill.set(row.id, Math.max(overdueByBill.get(row.id) ?? 0, outstanding));
  }
  const overdueBillsRemaining = [...overdueByBill.values()].reduce((sum, value) => sum + value, 0);
  const billsReserved = currentBillsRemaining + overdueBillsRemaining;
  const periods = inputs.payPeriods ?? [];
  // Same one income figure the Income tab shows: paychecks + notary income.
  const fundingReceived = summarizeIncome({
    entries: inputs.incomeEntries,
    postedPayroll: periods.reduce((sum, period) => sum + number(period.regularIncome), 0),
    recordedMonthlyIncome: inputs.recordedMonthlyIncome,
    notarySupport: periods.reduce((sum, period) => sum + number(period.notaryIncome), 0),
  }).totalIncome;
  const freedUpCashFlow = (inputs.freedCashItems ?? []).reduce((sum, item) => sum + number(item.monthlyAmount), 0);
  const reserves = number(inputs.variableEssentialsReserve)
    + number(inputs.plannedOneOffsReserve)
    + number(inputs.cashFloor);
  const rawSafeToSpend = number(inputs.availableCash) - billsReserved - reserves;
  const today = asOf.toISOString().slice(0, 10);
  const locked = Boolean(inputs.discretionaryLockUntil && today <= inputs.discretionaryLockUntil);

  return {
    availableCash: number(inputs.availableCash),
    fundingReceived,
    freedUpCashFlow,
    freedCashItems: inputs.freedCashItems ?? [],
    billsReserved,
    currentBillsRemaining,
    overdueBillsRemaining,
    variableEssentialsReserve: number(inputs.variableEssentialsReserve),
    plannedOneOffsReserve: number(inputs.plannedOneOffsReserve),
    cashFloor: number(inputs.cashFloor),
    rawSafeToSpend,
    safeToSpend: locked ? 0 : Math.max(0, rawSafeToSpend),
    fundingGap: Math.max(0, -rawSafeToSpend),
    locked,
    discretionaryLockUntil: inputs.discretionaryLockUntil ?? null,
    cashAsOf: inputs.cashAsOf ?? null,
    notes: inputs.notes ?? null,
  };
}
