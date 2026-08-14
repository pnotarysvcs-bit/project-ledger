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

test('July and August unpaid display two overdue occurrences in August', () => {
  const [row] = augustRows();
  assert.equal(row.status, 'overdue');
  assert.equal(row.overdueCount, 2);
  assert.equal(row.overdueOutstanding, 200);
  assert.match(row.payee, /Overdue ×2/);

  const summary = summarizeLedgerBills([row], new Date('2026-08-14T12:00:00Z'));
  assert.equal(summary.overdueCount, 2);
  assert.equal(summary.overdue, 200);
});

test('paying one occurrence reduces the overdue count by one', () => {
  const payments = [{
    id: 'p-jul', bill_id: 'b1', occurrence_id: 'jul', amount: 100,
    payment_date: '2026-08-01', payment_month: '2026-07-01', funding_account: 'TCU', notes: null,
  }];
  const [row] = augustRows(payments);
  assert.equal(row.overdueCount, 1);
  assert.equal(row.overdueOutstanding, 100);
  assert.match(row.payee, /· Overdue$/);
});

test('a prior overdue occurrence carries forward before the current occurrence is due', () => {
  const futureAugust = { ...august, due_date: '2026-08-20', installment_key: '2026-08-20' };
  const asOf = new Date('2026-08-14T12:00:00Z');
  const current = buildLedgerRows([{ ...bill, due_day: 20 }], [futureAugust], [], { selectedMonth: '2026-08', asOf });
  const [row] = applyOverdueCarryForward(current, [{ ...bill, due_day: 20 }], [july, futureAugust], [], { asOf });
  assert.equal(row.status, 'overdue');
  assert.equal(row.overdueCount, 1);
  assert.equal(row.overdueOutstanding, 100);
});

test('current submitted status is preserved while an older overdue occurrence remains visible', () => {
  const payments = [{
    id: 'p-aug', bill_id: 'b1', occurrence_id: 'aug', amount: 100,
    payment_date: '2026-08-05', payment_month: '2026-08-01', funding_account: 'TCU', notes: null,
  }];
  const [row] = augustRows(payments);
  assert.equal(row.status, 'submitted');
  assert.equal(row.overdueCount, 1);
  assert.equal(row.overdueOutstanding, 100);
  assert.match(row.payee, /· Overdue$/);

  const summary = summarizeLedgerBills([row], new Date('2026-08-14T12:00:00Z'));
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.overdue, 100);
});
