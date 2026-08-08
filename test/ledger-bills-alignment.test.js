import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLedgerRows, classifyLedgerBill, summarizeLedgerBills } from '../src/ledger-bills-data.js';

test('status precedence is submitted then overdue then partial then future', () => {
  const asOf = new Date('2026-08-08T12:00:00Z');
  assert.equal(classifyLedgerBill({ effectiveAmount: 100, submitted: 100, dueDate: '2026-08-01' }, asOf), 'submitted');
  assert.equal(classifyLedgerBill({ effectiveAmount: 100, submitted: 20, dueDate: '2026-08-01' }, asOf), 'overdue');
  assert.equal(classifyLedgerBill({ effectiveAmount: 100, submitted: 20, dueDate: '2026-08-20' }, asOf), 'partial');
  assert.equal(classifyLedgerBill({ effectiveAmount: 100, submitted: 0, dueDate: '2026-08-20' }, asOf), 'future');
});

test('monthly Actual overrides Budget and preserves overpayment as credit', () => {
  const bills = [{ id: 'b1', bill_name: 'Utility', bill_type: 'Personal', category: 'Utilities', account: 'TCU', budget: 150, frequency: 'monthly', due_day: 15, start_month: '2026-04-01', notes: null, is_active: true, archived_at: null }];
  const occurrences = [{ id: 'o1', bill_id: 'b1', month: '2026-08-01', occurrence_budget_amount: 150, actual_amount: 100, due_date: '2026-08-15' }];
  const payments = [{ id: 'p1', bill_id: 'b1', amount: 125, payment_date: '2026-08-10', funding_account: 'TCU', notes: null }];
  const [row] = buildLedgerRows(bills, occurrences, payments, { selectedMonth: '2026-08', asOf: new Date('2026-08-10T12:00:00Z') });
  assert.equal(row.effectiveAmount, 100);
  assert.equal(row.remaining, 0);
  assert.equal(row.credit, 25);
  assert.equal(row.status, 'submitted');
  assert.equal(row.transactions.length, 1);
});

test('summary counts only rows currently classified partial', () => {
  const rows = [
    { effectiveAmount: 100, status: 'partial', submitted: 20, remaining: 80, credit: 0, nextDue: '2026-08-20' },
    { effectiveAmount: 100, status: 'overdue', submitted: 20, remaining: 80, credit: 0, nextDue: '2026-08-01' },
  ];
  const summary = summarizeLedgerBills(rows, new Date('2026-08-08T12:00:00Z'));
  assert.equal(summary.partialCount, 1);
  assert.equal(summary.partial, 20);
  assert.equal(summary.overdueCount, 1);
});

test('Total Paid includes submitted, partial, and overdue payment transactions', () => {
  const rows = [
    { effectiveAmount: 100, status: 'submitted', submitted: 100, remaining: 0, credit: 0, nextDue: '2026-08-01' },
    { effectiveAmount: 100, status: 'partial', submitted: 20, remaining: 80, credit: 0, nextDue: '2026-08-20' },
    { effectiveAmount: 100, status: 'overdue', submitted: 30, remaining: 70, credit: 0, nextDue: '2026-08-01' },
  ];
  const summary = summarizeLedgerBills(rows, new Date('2026-08-08T12:00:00Z'));
  assert.equal(summary.totalPaid, 150);
  assert.equal(summary.submitted, 100);
  assert.equal(summary.partial, 20);
});
