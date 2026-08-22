import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFinancialGoals,
  EMERGENCY_FUND_TARGET,
  MONTHLY_ACTUAL_EXPENSE_TARGET,
  summarizeActualExpenses,
} from '../src/goals.js';

test('actual expense summary uses actuals only and never substitutes budget', () => {
  const summary = summarizeActualExpenses([
    { budget: 900, actualAmount: 825 },
    { budget: 500, actualAmount: null },
    { budget: 75, actualAmount: 60 },
  ]);

  assert.equal(summary.actual, 885);
  assert.equal(summary.actualCount, 2);
  assert.equal(summary.missingActualCount, 1);
});

test('missing actuals block the runway from declaring the expense target complete', () => {
  const goals = buildFinancialGoals({
    rows: [
      { budget: 5000, actualAmount: 5000 },
      { budget: 500, actualAmount: null },
    ],
  });

  assert.equal(goals.currentPriority.id, 'complete-actuals');
  assert.equal(goals.actualExpenses.missingActualCount, 1);
});

test('expense reduction remains first priority when actuals exceed 5800', () => {
  const goals = buildFinancialGoals({
    rows: [
      { actualAmount: 4000 },
      { actualAmount: 2250 },
    ],
  });

  assert.equal(MONTHLY_ACTUAL_EXPENSE_TARGET, 5800);
  assert.equal(goals.actualExpenses.current, 6250);
  assert.equal(goals.actualExpenses.remainingToCut, 450);
  assert.equal(goals.currentPriority.id, 'expense-target');
});

test('emergency fund becomes priority after actual expenses meet target', () => {
  const goals = buildFinancialGoals({
    rows: [{ actualAmount: 5600 }],
    emergencyFundSaved: 250,
  });

  assert.equal(EMERGENCY_FUND_TARGET, 1000);
  assert.equal(goals.emergencyFund.remaining, 750);
  assert.equal(goals.currentPriority.id, 'emergency-fund');
});

test('one month ahead follows the funded emergency milestone', () => {
  const goals = buildFinancialGoals({
    rows: [{ actualAmount: 5600 }],
    emergencyFundSaved: 1000,
    oneMonthAheadSaved: 800,
  });

  assert.equal(goals.currentPriority.id, 'one-month-ahead');
  assert.equal(goals.oneMonthAhead.target, 5800);
  assert.equal(goals.oneMonthAhead.remaining, 5000);
});
