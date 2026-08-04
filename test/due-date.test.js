import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampDayToMonth,
  daysInMonth,
  dueDateInPeriod,
  dueDatesInPeriod,
  isActiveInPeriod,
  nextDueDate,
} from '../src/bills/due-date.js';

const bill = (overrides = {}) => ({
  name: 'Test bill',
  due_day: 15,
  frequency: 'monthly',
  start_month: '2026-01-01',
  active: true,
  ...overrides,
});

test('month lengths account for leap years', () => {
  assert.equal(daysInMonth(2026, 1), 28); // February 2026
  assert.equal(daysInMonth(2028, 1), 29); // February 2028, a leap year
  assert.equal(daysInMonth(2026, 3), 30); // April
});

test('a day beyond the end of the month lands on the last day, not the next month', () => {
  assert.equal(clampDayToMonth(31, 2026, 1), 28); // Feb 2026
  assert.equal(clampDayToMonth(31, 2028, 1), 29); // Feb 2028
  assert.equal(clampDayToMonth(31, 2026, 3), 30); // April
  assert.equal(clampDayToMonth(15, 2026, 3), 15);
});

test('a day below one is pulled up to the first', () => {
  assert.equal(clampDayToMonth(0, 2026, 5), 1);
  assert.equal(clampDayToMonth(-3, 2026, 5), 1);
});

test('a monthly bill falls due every month from its start', () => {
  assert.equal(dueDateInPeriod(bill(), '2026-01'), '2026-01-15');
  assert.equal(dueDateInPeriod(bill(), '2026-02'), '2026-02-15');
  assert.equal(dueDateInPeriod(bill(), '2026-08'), '2026-08-15');
});

test('a bill is not due before the month it starts', () => {
  assert.equal(isActiveInPeriod(bill({ start_month: '2026-06-01' }), '2026-05'), false);
  assert.equal(dueDateInPeriod(bill({ start_month: '2026-06-01' }), '2026-05'), null);
  assert.equal(dueDateInPeriod(bill({ start_month: '2026-06-01' }), '2026-06'), '2026-06-15');
});

test('a bill due on the 31st still falls due in February', () => {
  const rent = bill({ due_day: 31 });

  assert.equal(dueDateInPeriod(rent, '2026-01'), '2026-01-31');
  assert.equal(dueDateInPeriod(rent, '2026-02'), '2026-02-28');
  assert.equal(dueDateInPeriod(rent, '2028-02'), '2028-02-29');
  assert.equal(dueDateInPeriod(rent, '2026-04'), '2026-04-30');
});

test('a quarterly bill falls due every third month from its start', () => {
  const quarterly = bill({ frequency: 'quarterly', start_month: '2026-02-01' });

  assert.equal(dueDateInPeriod(quarterly, '2026-02'), '2026-02-15');
  assert.equal(dueDateInPeriod(quarterly, '2026-03'), null);
  assert.equal(dueDateInPeriod(quarterly, '2026-04'), null);
  assert.equal(dueDateInPeriod(quarterly, '2026-05'), '2026-05-15');
  assert.equal(dueDateInPeriod(quarterly, '2027-02'), '2027-02-15');
});

test('an annual bill falls due once a year on its start month', () => {
  const annual = bill({ frequency: 'annual', start_month: '2026-03-01', due_day: 9 });

  assert.equal(dueDateInPeriod(annual, '2026-03'), '2026-03-09');
  assert.equal(dueDateInPeriod(annual, '2026-09'), null);
  assert.equal(dueDateInPeriod(annual, '2027-03'), '2027-03-09');
});

test('a one-time bill falls due only in its start month', () => {
  const once = bill({ frequency: 'one-time', start_month: '2026-04-01' });

  assert.equal(dueDateInPeriod(once, '2026-04'), '2026-04-15');
  assert.equal(dueDateInPeriod(once, '2026-05'), null);
  assert.equal(dueDateInPeriod(once, '2027-04'), null);
});

test('a fortnightly bill can fall due more than once in a month', () => {
  // Anchored 1 Jan 2026: 1, 15, 29 Jan, then 12, 26 Feb.
  const fortnightly = bill({ frequency: 'bi-weekly', start_month: '2026-01-01' });

  assert.deepEqual(dueDatesInPeriod(fortnightly, '2026-01'), ['2026-01-01', '2026-01-15', '2026-01-29']);
  assert.deepEqual(dueDatesInPeriod(fortnightly, '2026-02'), ['2026-02-12', '2026-02-26']);
});

test('a fortnightly bill ignores due_day, which does not apply to it', () => {
  const fortnightly = bill({ frequency: 'bi-weekly', start_month: '2026-01-01', due_day: 22 });

  assert.deepEqual(dueDatesInPeriod(fortnightly, '2026-01'), ['2026-01-01', '2026-01-15', '2026-01-29']);
});

test('an unrecognised cadence yields nothing rather than a wrong date', () => {
  assert.deepEqual(dueDatesInPeriod(bill({ frequency: 'whenever' }), '2026-08'), []);
  assert.equal(nextDueDate(bill({ frequency: 'whenever' }), { asOf: '2026-08-03' }), null);
});

test('underscore spellings still resolve', () => {
  assert.deepEqual(
    dueDatesInPeriod(bill({ frequency: 'bi_weekly', start_month: '2026-01-01' }), '2026-01'),
    ['2026-01-01', '2026-01-15', '2026-01-29'],
  );
});

test('an inactive bill is never due', () => {
  assert.deepEqual(dueDatesInPeriod(bill({ active: false }), '2026-08'), []);
});

test('the next due date is found from today, within the current month', () => {
  assert.equal(nextDueDate(bill(), { asOf: '2026-08-03' }), '2026-08-15');
});

test('once this month has passed, the next due date rolls to the following month', () => {
  assert.equal(nextDueDate(bill(), { asOf: '2026-08-16' }), '2026-09-15');
});

test('a bill due today is due today, not next month', () => {
  assert.equal(nextDueDate(bill(), { asOf: '2026-08-15' }), '2026-08-15');
});

test('an annual bill is still found months ahead', () => {
  const annual = bill({ frequency: 'annual', start_month: '2026-03-01', due_day: 9 });

  assert.equal(nextDueDate(annual, { asOf: '2026-08-03' }), '2027-03-09');
});

test('a search that can never succeed terminates instead of looping', () => {
  const expired = bill({ frequency: 'one-time', start_month: '2020-01-01' });

  assert.equal(nextDueDate(expired, { asOf: '2026-08-03' }), null);
});

test('a bare YYYY-MM period is accepted alongside a full date', () => {
  assert.equal(dueDateInPeriod(bill(), '2026-08'), '2026-08-15');
  assert.equal(dueDateInPeriod(bill(), '2026-08-01'), '2026-08-15');
});

test('an invalid date fails loudly', () => {
  assert.throws(() => dueDateInPeriod(bill(), 'not-a-month'), TypeError);
  assert.throws(() => dueDateInPeriod(bill({ start_month: 'nope' }), '2026-08'), TypeError);
});
