import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayPeriodBudget, getPayPeriod, normalizePayPeriodOffset } from '../src/pay-period-data.js';

test('pay periods follow the corrected biweekly paycheck cycle anchored on August 14', () => {
  assert.deepEqual(getPayPeriod(0, new Date('2026-08-20T18:00:00Z')), {
    paycheckDate: '2026-08-28',
    nextPaycheckDate: '2026-09-11',
    coverageStart: '2026-08-28',
    coverageEnd: '2026-09-10',
    offset: 0,
  });
  assert.equal(getPayPeriod(-1, new Date('2026-08-20T18:00:00Z')).paycheckDate, '2026-08-14');
  assert.equal(getPayPeriod(1, new Date('2026-08-20T18:00:00Z')).paycheckDate, '2026-09-11');
  assert.equal(normalizePayPeriodOffset('not-a-number'), 0);
});

test('August 28 paycheck view shows every bill due through September 10 regardless of status', () => {
  const period = getPayPeriod(0, new Date('2026-08-20T18:00:00Z'));
  const rows = [
    { id: 'before', rowKey: 'before', nextDue: '2026-08-27', category: 'Utilities', type: 'Personal', account: 'TCU', effectiveAmount: 100, remaining: 0, status: 'Submitted' },
    { id: 'start-paid', rowKey: 'start-paid', nextDue: '2026-08-28', category: 'Insurance', type: 'Business', account: 'TCUB', effectiveAmount: 80, remaining: 0, status: 'Submitted' },
    { id: 'partial', rowKey: 'partial', nextDue: '2026-09-03', category: 'Credit Card', type: 'Personal', account: 'TCU', effectiveAmount: 300, remaining: 125, status: 'Partial' },
    { id: 'open', rowKey: 'open', nextDue: '2026-09-10', category: 'Housing', type: 'Personal', account: 'TCU', effectiveAmount: 400, remaining: 400, status: 'Open' },
    { id: 'later', rowKey: 'later', nextDue: '2026-09-11', category: 'Phone', type: 'Personal', account: 'TCU', effectiveAmount: 90, remaining: 90, status: 'Open' },
  ];
  const result = buildPayPeriodBudget(rows, period, 5139);
  assert.deepEqual(result.bills.map((bill) => bill.id), ['start-paid', 'partial', 'open']);
  assert.equal(result.totals.planned, 525);
  assert.equal(result.totals.regularPaycheck, 2992);
  assert.equal(result.totals.recordedMonthlyIncome, 5139);
  assert.equal(result.totals.projectedMonthlyIncomeAfterPaycheck, 8131);
  assert.equal(result.totals.available, 2467);
});

test('submitted bills inside the coverage window remain visible with zero remaining amount', () => {
  const period = getPayPeriod(0, new Date('2026-08-20T18:00:00Z'));
  const rows = [{ id: 'a', rowKey: 'a', nextDue: '2026-09-01', category: 'Utilities', type: 'Personal', account: 'TCU', effectiveAmount: 50, remaining: 0, status: 'Submitted' }];
  const result = buildPayPeriodBudget(rows, period, 2992);
  assert.equal(result.bills.length, 1);
  assert.equal(result.bills[0].plannedAmount, 0);
  assert.equal(result.bills[0].status, 'Submitted');
  assert.equal(result.totals.planned, 0);
});
