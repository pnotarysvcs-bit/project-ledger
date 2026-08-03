import test from 'node:test';
import assert from 'node:assert/strict';

import {
  billsForMonth,
  getDueSoon,
  getMonthSummary,
  getRecentActivity,
  getStatusBreakdown,
  toRingSegments,
} from '../src/dashboard.js';

const asOf = '2026-08-03';

const rows = [
  { id: 'a', payee: 'Rent', amount: 1000, nextDue: '2026-08-05', status: 'due-soon', lastPaid: null },
  { id: 'b', payee: 'Water', amount: 100, nextDue: '2026-08-12', status: 'paid', lastPaid: '2026-08-01' },
  { id: 'c', payee: 'Card', amount: 400, nextDue: '2026-08-28', status: 'upcoming', lastPaid: null },
  { id: 'd', payee: 'IRS', amount: 238, nextDue: '2026-07-15', status: 'overdue', lastPaid: null },
  { id: 'e', payee: 'Old', amount: 999, nextDue: '2026-08-09', status: 'inactive', lastPaid: null },
];

test('only active bills due in the asOf month count toward the month', () => {
  const month = billsForMonth(rows, { asOf });

  assert.deepEqual(month.map(({ id }) => id), ['a', 'b', 'c']);
});

test('budget partitions cleanly into paid and remaining', () => {
  const summary = getMonthSummary(rows, { asOf });

  assert.equal(summary.budget, 1500);
  assert.equal(summary.paid, 100);
  assert.equal(summary.remaining, 1400);
  assert.equal(summary.paid + summary.remaining, summary.budget);
  assert.equal(summary.percentOfBudget, 7);
});

test('overdue spans all active bills, not just the current month', () => {
  const summary = getMonthSummary(rows, { asOf });

  // The IRS bill is due in July but still owed in August.
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.overdue, 238);
});

test('inactive bills are excluded from the headline counts', () => {
  const summary = getMonthSummary(rows, { asOf });

  assert.equal(summary.activeCount, 4);
});

test('an empty ledger reports zero rather than dividing by zero', () => {
  const summary = getMonthSummary([], { asOf });

  assert.equal(summary.budget, 0);
  assert.equal(summary.percentOfBudget, 0);
});

test('due soon lists unpaid bills within the window, soonest first', () => {
  const due = getDueSoon(rows, { asOf, days: 7 });

  assert.deepEqual(due.map(({ id }) => id), ['a']);
});

test('due soon excludes bills already paid and bills already overdue', () => {
  const due = getDueSoon(rows, { asOf, days: 30 });

  assert.ok(!due.some(({ id }) => id === 'b'), 'paid bill should not appear');
  assert.ok(!due.some(({ id }) => id === 'd'), 'past-due bill is not upcoming');
  assert.deepEqual(due.map(({ id }) => id), ['a', 'c']);
});

test('the status breakdown covers every bill in the month exactly once', () => {
  const breakdown = getStatusBreakdown(rows, { asOf });
  const counted = breakdown.reduce((sum, { count }) => sum + count, 0);

  assert.equal(counted, billsForMonth(rows, { asOf }).length);
  assert.deepEqual(
    breakdown.map(({ key, count }) => [key, count]),
    [['paid', 1], ['pending', 1], ['overdue', 0], ['future', 1]],
  );
});

test('recent activity is newest first and labelled by status', () => {
  const activity = getRecentActivity(rows);

  assert.equal(activity.length, 1);
  assert.equal(activity[0].payee, 'Water');
  assert.equal(activity[0].label, 'Payment Matched');
  assert.equal(activity[0].tone, 'good');
});

test('ring segments are laid end to end and span the circumference', () => {
  const breakdown = [
    { key: 'paid', amount: 75 },
    { key: 'pending', amount: 25 },
  ];

  const segments = toRingSegments(breakdown, 100);

  assert.equal(segments[0].length, 75);
  assert.equal(segments[0].offset, 0);
  assert.equal(segments[1].length, 25);
  assert.equal(segments[1].offset, 75);
});

test('a ring with no amounts produces no arc instead of NaN', () => {
  const segments = toRingSegments([{ key: 'paid', amount: 0 }], 100);

  assert.equal(segments[0].length, 0);
  assert.equal(segments[0].fraction, 0);
});
