import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateMonthlyProgress } from '../src/bills/monthly-progress.js';

test('progress counts only bills due in the asOf month', () => {
  const rows = [
    { id: 'august', amount: 100, nextDue: '2026-08-07', status: 'due-soon' },
    { id: 'september', amount: 500, nextDue: '2026-09-01', status: 'upcoming' },
  ];

  const progress = calculateMonthlyProgress(rows, { asOf: '2026-08-03' });

  assert.equal(progress.month, '2026-08');
  assert.equal(progress.billCount, 1);
  assert.equal(progress.total, 100);
});

test('paid and completed bills both count toward progress', () => {
  const rows = [
    { id: 'a', amount: 100, nextDue: '2026-08-07', status: 'paid' },
    { id: 'b', amount: 100, nextDue: '2026-08-15', status: 'completed' },
    { id: 'c', amount: 200, nextDue: '2026-08-20', status: 'due-soon' },
  ];

  const progress = calculateMonthlyProgress(rows, { asOf: '2026-08-03' });

  assert.equal(progress.paidCount, 2);
  assert.equal(progress.paid, 200);
  assert.equal(progress.remaining, 200);
  assert.equal(progress.percent, 50);
});

test('a bill carried over from an earlier month does not drag the bar down', () => {
  const rows = [
    { id: 'july', amount: 900, nextDue: '2026-07-15', status: 'overdue' },
    { id: 'august', amount: 100, nextDue: '2026-08-07', status: 'paid' },
  ];

  const progress = calculateMonthlyProgress(rows, { asOf: '2026-08-03' });

  assert.equal(progress.billCount, 1);
  assert.equal(progress.percent, 100);
});

test('inactive bills are ignored', () => {
  const rows = [
    { id: 'a', amount: 100, nextDue: '2026-08-07', status: 'paid' },
    { id: 'archived', amount: 400, nextDue: '2026-08-09', status: 'inactive' },
  ];

  const progress = calculateMonthlyProgress(rows, { asOf: '2026-08-03' });

  assert.equal(progress.billCount, 1);
  assert.equal(progress.percent, 100);
});

test('a month with no bills reads as complete rather than stalled', () => {
  const progress = calculateMonthlyProgress([], { asOf: '2026-08-03' });

  assert.equal(progress.billCount, 0);
  assert.equal(progress.ratio, 1);
  assert.equal(progress.percent, 100);
});

test('bills without a due date are skipped', () => {
  const rows = [
    { id: 'undated', amount: 75, status: 'new' },
    { id: 'august', amount: 25, nextDue: '2026-08-07', status: 'paid' },
  ];

  const progress = calculateMonthlyProgress(rows, { asOf: '2026-08-03' });

  assert.equal(progress.billCount, 1);
  assert.equal(progress.total, 25);
});

test('an invalid due date fails loudly', () => {
  const rows = [{ id: 'bad', amount: 10, nextDue: 'not-a-date', status: 'new' }];

  assert.throws(
    () => calculateMonthlyProgress(rows, { asOf: '2026-08-03' }),
    TypeError,
  );
});
