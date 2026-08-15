import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOverdueCarryForward, buildLedgerRows, summarizeLedgerBills } from '../src/ledger-bills-data.js';

const bill = {
  id: 'b1',
  bill_name: 'Example Bill',
  bill_type: 'Personal',
  category: 'Utilities',
  account: 'TCU',
  budget: 100,
  frequency: 'monthly',
  due_day: 5,
  start_month: '2026-04-01',
  notes: null,
  is_active: true,
  archived_at: null,
};

const july = {
  id: 'jul', bill_id: 'b1', month: '2026-07-01', occurrence_budget_amount: 100,
  actual_amount: null, due_date: '2026-07-05', installment_key: '2026-07-05', migration_incomplete: false,
};
const august = {
  id: 'aug', bill_id: 'b1', month: '2026-08-01', occurrence_budget_amount: 100,
  actual_amount: null, due_date: '2026-08-05', installment_key: '2026-08-05', migration_incomplete: false,
};

function augustRows(payments = [], asOf = new Date('2026-08-14T12:00:00Z')) {
  const current = buildLedgerRows([bill], [august], payments.filter((p) => p.payment_month === '2026-08-01'), {
    selectedMonth: '2026-08',
    asOf,
  });
  return applyOverdueCarryForward(current, [bill], [july, august], payments, { asOf });
}

test('prior and current overdue occurrences remain distinct and reconcile to the summary count', () => {
  const [row] = augustRows();
  assert.equal(row.status, 'overdue');
  assert.equal(row.overdueCount, 1);
  assert.equal(row.overdueOutstanding, 100);
  assert.equal(row.payee, 'Example Bill');
  assert.deepEqual(row.overdueOccurrences.map(({ id, month, dueDate, remaining }) => ({ id, month, dueDate, remaining })), [
    { id: 'jul', month: '2026-07', dueDate: '2026-07-05', remaining: 100 },
  ]);

  const summary = summarizeLedgerBills([row], new Date('2026-08-14T12:00:00Z'));
  assert.equal(summary.overdueCount, 2);
  assert.equal(summary.overdue, 200);
});

test('paying the prior occurrence leaves only the current overdue occurrence', () => {
  const payments = [{
    id: 'p-jul', bill_id: 'b1', occurrence_id: 'jul', amount: 100,
    payment_date: '2026-08-01', payment_month: '2026-07-01', funding_account: 'TCU', notes: null,
  }];
  const [row] = augustRows(payments);
  assert.equal(row.status, 'overdue');
  assert.equal(row.overdueCount, 0);
  assert.equal(row.overdueOutstanding, 0);
  assert.deepEqual(row.overdueOccurrences, []);

  const summary = summarizeLedgerBills([row], new Date('2026-08-14T12:00:00Z'));
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.overdue, 100);
});

test('a prior overdue occurrence does not mark a future current occurrence overdue', () => {
  const futureAugust = { ...august, due_date: '2026-08-20', installment_key: '2026-08-20' };
  const asOf = new Date('2026-08-14T12:00:00Z');
  const current = buildLedgerRows([{ ...bill, due_day: 20 }], [futureAugust], [], { selectedMonth: '2026-08', asOf });
  const [row] = applyOverdueCarryForward(current, [{ ...bill, due_day: 20 }], [july, futureAugust], [], { asOf });
  assert.equal(row.status, '');
  assert.equal(row.payee, 'Example Bill');
  assert.equal(row.overdueCount, 1);
  assert.equal(row.overdueOutstanding, 100);
  assert.equal(row.overdueOccurrences[0].id, 'jul');
});

test('current submitted status is preserved while an older overdue occurrence remains separately visible', () => {
  const payments = [{
    id: 'p-aug', bill_id: 'b1', occurrence_id: 'aug', amount: 100,
    payment_date: '2026-08-05', payment_month: '2026-08-01', funding_account: 'TCU', notes: null,
  }];
  const [row] = augustRows(payments);
  assert.equal(row.status, 'submitted');
  assert.equal(row.overdueCount, 1);
  assert.equal(row.overdueOutstanding, 100);
  assert.equal(row.payee, 'Example Bill');
  assert.equal(row.overdueOccurrences[0].id, 'jul');

  const summary = summarizeLedgerBills([row], new Date('2026-08-14T12:00:00Z'));
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.overdue, 100);
});
