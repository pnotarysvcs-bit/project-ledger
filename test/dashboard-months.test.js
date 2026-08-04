import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DASHBOARD_MONTHS,
  dateForDashboardMonth,
  labelForDashboardMonth,
  resolveDashboardMonth,
} from '../src/dashboard-months.js';

test('Dashboard month selector exposes April through December 2026', () => {
  assert.deepEqual(
    DASHBOARD_MONTHS.map(({ value }) => value),
    [
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
    ],
  );
});

test('current supported month is selected by default', () => {
  assert.equal(resolveDashboardMonth(undefined, new Date('2026-08-04T14:00:00Z')), '2026-08');
});

test('an explicitly selected supported month is preserved', () => {
  assert.equal(resolveDashboardMonth('2026-06', new Date('2026-08-04T14:00:00Z')), '2026-06');
  assert.equal(labelForDashboardMonth('2026-06'), 'June 2026');
  assert.equal(dateForDashboardMonth('2026-06').toISOString(), '2026-06-01T00:00:00.000Z');
});

test('unsupported months do not enter Dashboard state', () => {
  assert.equal(resolveDashboardMonth('2027-01', new Date('2026-08-04T14:00:00Z')), '2026-08');
});

test('an out-of-range current date defaults to the most recent available month', () => {
  assert.equal(resolveDashboardMonth(undefined, new Date('2027-01-01T00:00:00Z')), '2026-12');
});
