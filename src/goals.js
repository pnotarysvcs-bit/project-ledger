export const MONTHLY_ACTUAL_EXPENSE_TARGET = 5800;
export const EMERGENCY_FUND_TARGET = 1000;

function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function summarizeActualExpenses(rows = []) {
  return rows.reduce((summary, bill) => {
    if (bill.actualAmount === null || bill.actualAmount === undefined || bill.actualAmount === '') {
      summary.missingActualCount += 1;
      return summary;
    }
    const actual = Number(bill.actualAmount);
    if (Number.isFinite(actual) && actual >= 0) {
      summary.actual += actual;
      summary.actualCount += 1;
    } else summary.missingActualCount += 1;
    return summary;
  }, { actual: 0, actualCount: 0, missingActualCount: 0 });
}

export function monthlyEquivalent(bill) {
  const actual = nonNegative(bill?.actualAmount);
  if (!actual) return 0;
  if (bill?.frequency === 'bi-weekly') return actual * 26 / 12;
  if (bill?.frequency === 'quarterly') return actual / 3;
  if (bill?.frequency === 'annual') return actual / 12;
  if (bill?.frequency === 'one-time') return actual;
  return actual;
}

const PAYOFF_WORDS = ['loan', 'debt', 'credit', 'card', 'finance', 'financing', 'furniture', 'affirm', 'afterpay', 'klarna', 'upgrade', 'mercury', 'mission lane', 'auto'];
const ESSENTIAL_WORDS = ['rent', 'mortgage', 'utility', 'utilities', 'electric', 'gas', 'water', 'phone', 'insurance', 'tax', 'internet'];

export function recommendNextPayoff(rows = [], closedBillId = '') {
  const candidates = rows.filter((bill) => {
    if (!bill || bill.id === closedBillId) return false;
    const text = `${bill.payee ?? ''} ${bill.category ?? ''}`.toLowerCase();
    if (ESSENTIAL_WORDS.some((word) => text.includes(word))) return false;
    return PAYOFF_WORDS.some((word) => text.includes(word));
  }).map((bill) => ({ ...bill, monthlyEquivalent: monthlyEquivalent(bill) }))
    .filter((bill) => bill.monthlyEquivalent > 0)
    .sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent || String(a.payee).localeCompare(String(b.payee)));
  return candidates[0] ?? null;
}

export function buildFinancialGoals({ rows = [], emergencyFundSaved = 0, oneMonthAheadSaved = 0, freedMonthlyCash = 0 } = {}) {
  const actuals = summarizeActualExpenses(rows);
  const emergencySaved = nonNegative(emergencyFundSaved);
  const monthAheadSaved = nonNegative(oneMonthAheadSaved);
  const freedCash = nonNegative(freedMonthlyCash);
  const expenseGap = Math.max(0, actuals.actual - MONTHLY_ACTUAL_EXPENSE_TARGET);
  const emergencyRemaining = Math.max(0, EMERGENCY_FUND_TARGET - emergencySaved);
  const monthAheadRemaining = Math.max(0, MONTHLY_ACTUAL_EXPENSE_TARGET - monthAheadSaved);
  let currentPriority;
  if (actuals.missingActualCount > 0) currentPriority = { id: 'complete-actuals', name: 'Complete Actual Expenses', status: 'needs-data', remaining: null, detail: `${actuals.missingActualCount} bill${actuals.missingActualCount === 1 ? '' : 's'} still need actual amounts.` };
  else if (expenseGap > 0) currentPriority = { id: 'expense-target', name: 'Reduce Actual Monthly Expenses', status: 'active', remaining: expenseGap, detail: 'Bring actual monthly expenses down to the operating target.' };
  else if (emergencyRemaining > 0) currentPriority = { id: 'emergency-fund', name: 'Build Emergency Fund', status: 'active', remaining: emergencyRemaining, detail: 'First cash-reserve milestone before building the one-month-ahead buffer.' };
  else if (monthAheadRemaining > 0) currentPriority = { id: 'one-month-ahead', name: 'Get One Month Ahead', status: 'active', remaining: monthAheadRemaining, detail: 'Build one full month of operating expenses in advance.' };
  else currentPriority = { id: 'next-payoff', name: 'Choose Next Payoff Target', status: 'ready', remaining: null, detail: 'The runway milestones are funded; redirect the rolling cash to the next obligation.' };
  return {
    actualExpenses: { current: actuals.actual, target: MONTHLY_ACTUAL_EXPENSE_TARGET, remainingToCut: expenseGap, complete: actuals.missingActualCount === 0 && expenseGap === 0, actualCount: actuals.actualCount, missingActualCount: actuals.missingActualCount },
    emergencyFund: { current: emergencySaved, target: EMERGENCY_FUND_TARGET, remaining: emergencyRemaining, complete: emergencyRemaining === 0 },
    oneMonthAhead: { current: monthAheadSaved, target: MONTHLY_ACTUAL_EXPENSE_TARGET, remaining: monthAheadRemaining, complete: monthAheadRemaining === 0 },
    freedMonthlyCash: freedCash,
    currentPriority,
  };
}
