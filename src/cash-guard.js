import { supabaseRequest } from './supabase-server.js';
import { normalizeLedgerMonth } from './ledger-bills-data.js';

const number = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function getCashGuardInputs(selectedMonth) {
  const normalized = normalizeLedgerMonth(selectedMonth);
  const month = `${normalized}-01`;
  const [guardRows, payPeriods] = await Promise.all([
    supabaseRequest(`ledger_cash_guard?select=available_cash,variable_essentials_reserve,planned_one_offs_reserve,cash_floor,discretionary_lock_until,cash_as_of,notes&month=eq.${month}`),
    supabaseRequest(`ledger_pay_period_finances?select=period,regular_income,notary_income,ahead_contribution,target_month&month=eq.${month}&order=period.asc`),
  ]);

  const guard = guardRows?.[0] ?? {};
  return {
    availableCash: number(guard.available_cash),
    variableEssentialsReserve: number(guard.variable_essentials_reserve),
    plannedOneOffsReserve: number(guard.planned_one_offs_reserve),
    cashFloor: number(guard.cash_floor),
    discretionaryLockUntil: guard.discretionary_lock_until ?? null,
    cashAsOf: guard.cash_as_of ?? null,
    notes: guard.notes ?? null,
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
  const fundingReceived = (inputs.payPeriods ?? []).reduce(
    (sum, period) => sum + number(period.regularIncome) + number(period.notaryIncome),
    0,
  );
  const reserves = number(inputs.variableEssentialsReserve)
    + number(inputs.plannedOneOffsReserve)
    + number(inputs.cashFloor);
  const rawSafeToSpend = number(inputs.availableCash) - billsReserved - reserves;
  const today = asOf.toISOString().slice(0, 10);
  const locked = Boolean(inputs.discretionaryLockUntil && today <= inputs.discretionaryLockUntil);

  return {
    availableCash: number(inputs.availableCash),
    fundingReceived,
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
