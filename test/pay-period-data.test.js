import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayPeriodBudget, getFundingKeyForPeriod, getPayPeriod, normalizePayPeriodOffset } from '../src/pay-period-data.js';

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

test('funding rows follow the calendar-side two-week window', () => {
  assert.deepEqual(getFundingKeyForPeriod(getPayPeriod(-1, new Date('2026-08-20T18:00:00Z'))), {
    fundingMonth: '2026-08',
    periodNumber: 2,
  });
  assert.deepEqual(getFundingKeyForPeriod(getPayPeriod(0, new Date('2026-08-20T18:00:00Z'))), {
    fundingMonth: '2026-09',
    periodNumber: 1,
  });
  assert.deepEqual(getFundingKeyForPeriod(getPayPeriod(1, new Date('2026-08-20T18:00:00Z'))), {
    fundingMonth: '2026-09',
    periodNumber: 2,
  });
});

test('August 28 view uses only funding posted in its own two-week window', () => {
  const period = getPayPeriod(0, new Date('2026-08-20T18:00:00Z'));
  const rows = [
    { id: 'before', rowKey: 'before', nextDue: '2026-08-27', category: 'Utilities', type: 'Personal', account: 'TCU', effectiveAmount: 100, remaining: 0, status: 'Submitted' },
    { id: 'start-paid', rowKey: 'start-paid', nextDue: '2026-08-28', category: 'Insurance', type: 'Business', account: 'TCUB', effectiveAmount: 80, remaining: 0, submitted: 80, status: 'Submitted' },
    { id: 'partial', rowKey: 'partial', nextDue: '2026-09-03', category: 'Credit Card', type: 'Personal', account: 'TCU', effectiveAmount: 300, remaining: 125, submitted: 175, status: 'Partial' },
    { id: 'open', rowKey: 'open', nextDue: '2026-09-10', category: 'Housing', type: 'Personal', account: 'TCU', effectiveAmount: 400, remaining: 400, status: 'Open' },
    { id: 'later', rowKey: 'later', nextDue: '2026-09-11', category: 'Phone', type: 'Personal', account: 'TCU', effectiveAmount: 90, remaining: 90, status: 'Open' },
  ];
  const result = buildPayPeriodBudget(rows, period, { regularIncome: 0, notaryIncome: 0 });
  assert.deepEqual(result.bills.map((bill) => bill.id), ['start-paid', 'partial', 'open']);
  assert.equal(result.bills[0].planningStatus, 'Paid');
  assert.equal(result.bills[1].planningStatus, 'Partially Paid');
  assert.equal(result.bills[2].planningStatus, 'Due This Period');
  assert.equal(result.totals.planned, 525);
  assert.equal(result.totals.regularIncome, 0);
  assert.equal(result.totals.notaryIncome, 0);
  assert.equal(result.totals.householdFunding, 0);
  assert.equal(result.totals.available, -525);
  assert.equal(result.totals.fundingGap, 525);
});

test('overdue obligations are pulled into the current funding plan', () => {
  const period = getPayPeriod(0, new Date('2026-08-20T18:00:00Z'));
  const rows = [
    { id: 'late', rowKey: 'late', nextDue: '2026-08-10', category: 'Insurance', type: 'Personal', account: 'TCU', effectiveAmount: 100, remaining: 0, overdueOutstanding: 75, status: 'Overdue' },
  ];
  const result = buildPayPeriodBudget(rows, period, { regularIncome: 100, notaryIncome: 0 });
  assert.equal(result.bills.length, 1);
  assert.equal(result.bills[0].planningStatus, 'Overdue');
  assert.equal(result.bills[0].plannedAmount, 75);
  assert.equal(result.totals.available, 25);
});
