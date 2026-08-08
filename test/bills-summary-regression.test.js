import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyLedgerBill, summarizeLedgerBills } from '../src/ledger-bills-data.js';

test('overpaid occurrence is submitted with credit and never overdue', () => {
  const asOf = new Date('2026-08-08T00:00:00Z');
  assert.equal(classifyLedgerBill({ effectiveAmount: 55, submitted: 124.98, dueDate: '2026-04-13' }, asOf), 'submitted');
});

test('past-due partially paid occurrence remains overdue under approved overdue precedence', () => {
  const asOf = new Date('2026-08-08T00:00:00Z');
  assert.equal(classifyLedgerBill({ effectiveAmount: 200, submitted: 124.98, dueDate: '2026-04-27' }, asOf), 'overdue');
});

test('partial summary includes partially paid overdue occurrences', () => {
  const rows = [{
    effectiveAmount: 200,
    submitted: 124.98,
    remaining: 75.02,
    credit: 0,
    migrationIncomplete: false,
    status: 'overdue',
    nextDue: '2026-04-27',
  }];
  const summary = summarizeLedgerBills(rows, new Date('2026-08-08T00:00:00Z'));
  assert.equal(summary.partial, 124.98);
  assert.equal(summary.partialCount, 1);
  assert.equal(summary.overdue, 75.02);
  assert.equal(summary.overdueCount, 1);
});
