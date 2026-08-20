import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayPeriodBudget, getPayPeriod, normalizePayPeriodOffset, PAY_PERIOD_LABELS } from '../src/pay-period-data.js';

test('pay periods follow the 13th and 27th semi-monthly paycheck cycle', () => {
  assert.deepEqual(getPayPeriod(0, new Date('2026-08-10T18:00:00Z')), {
    month: '2026-08', period: 1, label: PAY_PERIOD_LABELS[1], paycheckDate: '2026-08-13', offset: 0,
  });
  assert.deepEqual(getPayPeriod(0, new Date('2026-08-20T18:00:00Z')), {
    month: '2026-08', period: 2, label: PAY_PERIOD_LABELS[2], paycheckDate: '2026-08-27', offset: 0,
  });
  assert.equal(getPayPeriod(1, new Date('2026-08-20T18:00:00Z')).month, '2026-09');
  assert.equal(getPayPeriod(1, new Date('2026-08-20T18:00:00Z')).period, 1);
  assert.equal(normalizePayPeriodOffset('not-a-number'), 0);
});

test('budget uses paycheck assignments independent of due date and includes notary income', () => {
  const rows = [
    { id: 'a', rowKey: 'a', category: 'Utilities', type: 'Personal', account: 'TCU Checking', effectiveAmount: 100, submitted: 40 },
    { id: 'b', rowKey: 'b', category: 'Shipping', type: 'Business', account: 'TCUB Operating', effectiveAmount: 200, submitted: 0 },
    { id: 'c', rowKey: 'c', category: 'Housing', type: 'Personal', account: 'TCU Checking', effectiveAmount: 300, submitted: 0 },
  ];
  const assignments = new Map([
    ['a', PAY_PERIOD_LABELS[2]],
    ['b', PAY_PERIOD_LABELS[2]],
    ['c', PAY_PERIOD_LABELS[1]],
  ]);
  const result = buildPayPeriodBudget(rows, assignments, { label: PAY_PERIOD_LABELS[2] }, {
    regularIncome: 2992,
    notaryIncome: 500,
    aheadContribution: 250,
  });
  assert.deepEqual([result.personal.length, result.business.length, result.other.length, result.unassigned.length], [1, 1, 1, 0]);
  assert.deepEqual(result.totals, { income: 3492, expenses: 300, paid: 40, aheadContribution: 250, available: 2942 });
});

test('unassigned bills remain visible so every monthly bill can be allocated', () => {
  const rows = [{ id: 'a', rowKey: 'a', category: 'Utilities', type: 'Personal', account: 'TCU', effectiveAmount: 50, submitted: 0 }];
  const result = buildPayPeriodBudget(rows, new Map(), { label: PAY_PERIOD_LABELS[1] }, {});
  assert.equal(result.unassigned.length, 1);
  assert.equal(result.totals.expenses, 0);
});
