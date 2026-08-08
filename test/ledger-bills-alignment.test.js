import test from 'node:test';
import assert from 'node:assert/strict';
import { biweeklyDueDates, buildLedgerRows, classifyLedgerBill, summarizeLedgerBills } from '../src/ledger-bills-data.js';

test('status precedence is submitted then overdue then partial then future', () => {
  const asOf = new Date('2026-08-08T12:00:00Z');
  assert.equal(classifyLedgerBill({ effectiveAmount: 100, submitted: 100, dueDate: '2026-08-01' }, asOf), 'submitted');
  assert.equal(classifyLedgerBill({ effectiveAmount: 100, submitted: 20, dueDate: '2026-08-01' }, asOf), 'overdue');
  assert.equal(classifyLedgerBill({ effectiveAmount: 100, submitted: 20, dueDate: '2026-08-20' }, asOf), 'partial');
  assert.equal(classifyLedgerBill({ effectiveAmount: 100, submitted: 0, dueDate: '2026-08-20' }, asOf), 'future');
});

test('past-due overpayment is submitted with credit and never overdue', () => {
  const asOf = new Date('2026-08-08T12:00:00Z');
  assert.equal(classifyLedgerBill({ effectiveAmount: 114.98, submitted: 124.98, dueDate: '2026-04-27' }, asOf), 'submitted');

  const bills = [{ id: 'b1', bill_name: 'AfterPay', bill_type: 'Personal', category: 'Online Credit', account: 'TCU', budget: 114.98, frequency: 'monthly', due_day: 27, start_month: '2026-04-01', notes: null, is_active: true, archived_at: null }];
  const occurrences = [{ id: 'o1', bill_id: 'b1', month: '2026-04-01', occurrence_budget_amount: 114.98, actual_amount: null, due_date: '2026-04-27', migration_incomplete: false }];
  const payments = [
    { id: 'p1', bill_id: 'b1', occurrence_id: 'o1', amount: 114.98, payment_date: '2026-04-27', funding_account: 'TCU', notes: null },
    { id: 'p2', bill_id: 'b1', occurrence_id: 'o1', amount: 10, payment_date: '2026-04-28', funding_account: 'TCU', notes: null },
  ];
  const [row] = buildLedgerRows(bills, occurrences, payments, { selectedMonth: '2026-04', asOf });
  assert.equal(row.effectiveAmount, 114.98);
  assert.equal(row.submitted, 124.98);
  assert.equal(row.remaining, 0);
  assert.equal(row.credit, 10);
  assert.equal(row.status, 'submitted');

  const summary = summarizeLedgerBills([row], asOf);
  assert.equal(summary.overdueCount, 0);
  assert.equal(summary.overdue, 0);
  assert.equal(summary.credit, 10);
});

test('monthly Actual overrides Budget and preserves overpayment as credit', () => {
  const bills = [{ id: 'b1', bill_name: 'Utility', bill_type: 'Personal', category: 'Utilities', account: 'TCU', budget: 150, frequency: 'monthly', due_day: 15, start_month: '2026-04-01', notes: null, is_active: true, archived_at: null }];
  const occurrences = [{ id: 'o1', bill_id: 'b1', month: '2026-08-01', occurrence_budget_amount: 150, actual_amount: 100, due_date: '2026-08-15', migration_incomplete: false }];
  const payments = [{ id: 'p1', bill_id: 'b1', occurrence_id: 'o1', amount: 125, payment_date: '2026-08-10', funding_account: 'TCU', notes: null }];
  const [row] = buildLedgerRows(bills, occurrences, payments, { selectedMonth: '2026-08', asOf: new Date('2026-08-10T12:00:00Z') });
  assert.equal(row.effectiveAmount, 100);
  assert.equal(row.remaining, 0);
  assert.equal(row.credit, 25);
  assert.equal(row.status, 'submitted');
  assert.equal(row.transactions.length, 1);
});

test('historical migrated occurrence does not inherit the current master budget', () => {
  const bills = [{ id: 'b1', bill_name: 'Utility', bill_type: 'Personal', category: 'Utilities', account: 'TCU', budget: 200, frequency: 'monthly', due_day: 15, start_month: '2026-04-01', notes: null, is_active: true, archived_at: null }];
  const occurrences = [{ id: 'o1', bill_id: 'b1', month: '2026-05-01', occurrence_budget_amount: null, actual_amount: null, due_date: null, migration_incomplete: true }];
  const [row] = buildLedgerRows(bills, occurrences, [], { selectedMonth: '2026-05', asOf: new Date('2026-08-08T12:00:00Z') });
  assert.equal(row.masterBudget, 200);
  assert.equal(row.budget, null);
  assert.equal(row.effectiveAmount, null);
  assert.equal(row.migrationIncomplete, true);
  const summary = summarizeLedgerBills([row], new Date('2026-08-08T12:00:00Z'));
  assert.equal(summary.total, 0);
  assert.equal(summary.incompleteCount, 1);
});

test('summary counts all partially paid rows, including overdue rows', () => {
  const rows = [
    { effectiveAmount: 100, status: 'partial', submitted: 20, remaining: 80, credit: 0, nextDue: '2026-08-20' },
    { effectiveAmount: 100, status: 'overdue', submitted: 20, remaining: 80, credit: 0, nextDue: '2026-08-01' },
  ];
  const summary = summarizeLedgerBills(rows, new Date('2026-08-08T12:00:00Z'));
  assert.equal(summary.partialCount, 2);
  assert.equal(summary.partial, 40);
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
  assert.equal(summary.partial, 50);
  assert.equal(summary.partialCount, 2);
});

test('bi-weekly recurrence materializes every 14-day installment including three-installment months', () => {
  assert.deepEqual(biweeklyDueDates('2026-04-13', '2026-08'), ['2026-08-03', '2026-08-17', '2026-08-31']);
});

test('bi-weekly installments keep payments, remaining, and status independent by occurrence', () => {
  const bills = [{
    id: 'b1', bill_name: 'Affirm', bill_type: 'Personal', category: 'Online Credit', account: 'TCU', budget: 100,
    frequency: 'bi-weekly', due_day: 13, recurrence_anchor: '2026-04-13', start_month: '2026-04-01', notes: null,
    is_active: true, archived_at: null,
  }];
  const occurrences = [
    { id: 'o1', bill_id: 'b1', month: '2026-08-01', occurrence_budget_amount: 100, actual_amount: null, due_date: '2026-08-03', installment_key: '2026-08-03', migration_incomplete: false },
    { id: 'o2', bill_id: 'b1', month: '2026-08-01', occurrence_budget_amount: 100, actual_amount: null, due_date: '2026-08-17', installment_key: '2026-08-17', migration_incomplete: false },
    { id: 'o3', bill_id: 'b1', month: '2026-08-01', occurrence_budget_amount: 100, actual_amount: null, due_date: '2026-08-31', installment_key: '2026-08-31', migration_incomplete: false },
  ];
  const payments = [
    { id: 'p1', bill_id: 'b1', occurrence_id: 'o1', amount: 100, payment_date: '2026-08-03', funding_account: 'TCU', notes: null },
    { id: 'p2', bill_id: 'b1', occurrence_id: 'o2', amount: 25, payment_date: '2026-08-08', funding_account: 'TCU', notes: null },
  ];
  const rows = buildLedgerRows(bills, occurrences, payments, { selectedMonth: '2026-08', asOf: new Date('2026-08-08T12:00:00Z') });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row.occurrenceId), ['o1', 'o2', 'o3']);
  assert.deepEqual(rows.map((row) => row.submitted), [100, 25, 0]);
  assert.deepEqual(rows.map((row) => row.remaining), [0, 75, 100]);
  assert.deepEqual(rows.map((row) => row.status), ['submitted', 'partial', 'future']);
  const summary = summarizeLedgerBills(rows, new Date('2026-08-08T12:00:00Z'));
  assert.equal(summary.total, 300);
  assert.equal(summary.totalPaid, 125);
  assert.equal(summary.remaining, 175);
});
