import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayPeriodBudget, getPayPeriod, normalizePayPeriodOffset } from '../src/pay-period-data.js';

test('pay periods use the bi-weekly anchor and relative offsets', () => {
  assert.deepEqual(getPayPeriod(0, new Date('2026-08-25T18:00:00Z')), { start: '2026-08-24', end: '2026-09-06', index: 0, offset: 0 });
  assert.equal(getPayPeriod(-1, new Date('2026-08-25T18:00:00Z')).start, '2026-08-10');
  assert.equal(normalizePayPeriodOffset('not-a-number'), 0);
});

test('budget uses the maintained income field, routes TCU and TCUB, and filters period payments', () => {
  const base = { nextDue: '2026-08-25', effectiveAmount: 100, transactions: [] };
  const rows = [
    { ...base, rowKey: 'income-row', category: 'Income', type: 'Personal', account: 'TCU', transactions: [{ amount: 100, paymentDate: '2026-08-25' }] },
    { ...base, rowKey: 'personal', category: 'Utilities', type: 'Personal', account: 'TCU Checking', transactions: [{ amount: 20, paymentDate: '2026-08-25' }, { amount: 50, paymentDate: '2026-08-01' }] },
    { ...base, rowKey: 'business', category: 'Shipping', type: 'Business', account: 'TCUB Operating' },
  ];
  const result = buildPayPeriodBudget(rows, { start: '2026-08-24', end: '2026-09-06' }, 500);
  assert.deepEqual([result.personal.length, result.business.length], [1, 1]);
  assert.equal(result.income, 500);
  assert.deepEqual(result.totals, { income: 500, expenses: 200, paid: 20, available: 300 });
});
