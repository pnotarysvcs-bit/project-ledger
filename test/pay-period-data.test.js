import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayPeriodBudget, getPayPeriod, normalizePayPeriodOffset } from '../src/pay-period-data.js';

test('pay periods follow the actual biweekly paycheck cycle anchored on August 7', () => {
  assert.deepEqual(getPayPeriod(0, new Date('2026-08-20T18:00:00Z')), {
    paycheckDate: '2026-08-21',
    nextPaycheckDate: '2026-09-04',
    coverageStart: '2026-08-21',
    coverageEnd: '2026-09-03',
    offset: 0,
  });
  assert.equal(getPayPeriod(-1, new Date('2026-08-20T18:00:00Z')).paycheckDate, '2026-08-07');
  assert.equal(getPayPeriod(1, new Date('2026-08-20T18:00:00Z')).paycheckDate, '2026-09-04');
  assert.equal(normalizePayPeriodOffset('not-a-number'), 0);
});

test('August 21 paycheck covers remaining bills through September 3 and projects monthly income', () => {
  const period = getPayPeriod(0, new Date('2026-08-20T18:00:00Z'));
  const rows = [
    { id: 'paid', rowKey: 'paid', nextDue: '2026-08-10', category: 'Utilities', type: 'Personal', account: 'TCU', effectiveAmount: 100, remaining: 0, status: 'Submitted' },
    { id: 'carry', rowKey: 'carry', nextDue: '2026-08-15', category: 'Credit Card', type: 'Personal', account: 'TCU', effectiveAmount: 300, remaining: 125, status: 'Partial' },
    { id: 'aug', rowKey: 'aug', nextDue: '2026-08-28', category: 'Insurance', type: 'Business', account: 'TCUB', effectiveAmount: 200, remaining: 200, status: 'Open' },
    { id: 'sep', rowKey: 'sep', nextDue: '2026-09-03', category: 'Housing', type: 'Personal', account: 'TCU', effectiveAmount: 400, remaining: 400, status: 'Open' },
    { id: 'later', rowKey: 'later', nextDue: '2026-09-04', category: 'Phone', type: 'Personal', account: 'TCU', effectiveAmount: 90, remaining: 90, status: 'Open' },
  ];
  const result = buildPayPeriodBudget(rows, period, 5139);
  assert.deepEqual(result.bills.map((bill) => bill.id), ['carry', 'aug', 'sep']);
  assert.equal(result.totals.planned, 725);
  assert.equal(result.totals.regularPaycheck, 2992);
  assert.equal(result.totals.recordedMonthlyIncome, 5139);
  assert.equal(result.totals.projectedMonthlyIncomeAfterPaycheck, 8131);
  assert.equal(result.totals.available, 2267);
});

test('paid bills from earlier in the month are not re-budgeted', () => {
  const period = getPayPeriod(0, new Date('2026-08-20T18:00:00Z'));
  const rows = [{ id: 'a', rowKey: 'a', nextDue: '2026-08-13', category: 'Utilities', type: 'Personal', account: 'TCU', effectiveAmount: 50, remaining: 0, status: 'Submitted' }];
  const result = buildPayPeriodBudget(rows, period, 2992);
  assert.equal(result.bills.length, 0);
  assert.equal(result.totals.planned, 0);
});
