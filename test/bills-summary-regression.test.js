import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyLedgerBill, summarizeLedgerBills } from '../src/ledger-bills-data.js';

test('overpaid occurrence is submitted with credit and never overdue', () => {
  const asOf = new Date('2026-08-08T00:00:00Z');
  assert.equal(classifyLedgerBill({ effectiveAmount: 55, submitted: 124.98, dueDate: '2026-04-13' }, asOf), 'submitted');
});

test('past-due partially paid occurrence remains Partial while a balance remains', () => {
  const asOf = new Date('2026-08-08T00:00:00Z');
  assert.equal(classifyLedgerBill({ effectiveAmount: 200, submitted: 124.98, dueDate: '2026-04-27' }, asOf), 'partial');
});

test('partial summary includes past-due partially paid occurrences without counting them as overdue', () => {
  const rows = [{
    effectiveAmount: 200,
    submitted: 124.98,
    remaining: 75.02,
    credit: 0,
    migrationIncomplete: false,
    status: 'partial',
    nextDue: '2026-04-27',
  }];
  const summary = summarizeLedgerBills(rows, new Date('2026-08-08T00:00:00Z'));
  assert.equal(summary.partial, 124.98);
  assert.equal(summary.partialCount, 1);
  assert.equal(summary.overdue, 0);
  assert.equal(summary.overdueCount, 0);
});
