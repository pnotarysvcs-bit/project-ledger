import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLedgerRows, groupLedgerBills } from '../src/ledger-bills-data.js';

test('Bills sections always render Personal, Business, then Streaming', () => {
  const rows = [
    { type: 'Streaming', nextDue: '2026-08-03', payee: 'Netflix' },
    { type: 'Personal', nextDue: '2026-08-01', payee: 'Rent' },
    { type: 'Business', nextDue: '2026-08-02', payee: 'Office Rent' },
  ];

  assert.deepEqual(groupLedgerBills(rows).map(({ type }) => type), [
    'Personal',
    'Business',
    'Streaming',
  ]);
});

test('multiple payments total into Submitted while Actual remains the bill amount', () => {
  const bills = [{
    id: 'bill-1',
    bill_name: 'Example Bill',
    bill_type: 'Personal',
    category: 'Other',
    account: 'TCU',
    budget: '120.00',
    frequency: 'monthly',
    due_day: 15,
    recurrence_anchor: null,
    start_month: '2026-08-01',
    notes: null,
    is_active: true,
    archived_at: null,
  }];
  const occurrences = [{
    id: 'occ-1',
    bill_id: 'bill-1',
    occurrence_budget_amount: '120.00',
    actual_amount: '100.00',
    due_date: '2026-08-15',
    installment_key: '2026-08-15',
    migration_incomplete: false,
  }];
  const payments = [
    { id: 'p1', bill_id: 'bill-1', occurrence_id: 'occ-1', amount: '40.00', payment_date: '2026-08-05', funding_account: 'TCU', notes: null },
    { id: 'p2', bill_id: 'bill-1', occurrence_id: 'occ-1', amount: '60.00', payment_date: '2026-08-10', funding_account: 'TCU', notes: null },
  ];

  const [row] = buildLedgerRows(bills, occurrences, payments, {
    selectedMonth: '2026-08',
    asOf: new Date('2026-08-11T00:00:00Z'),
  });

  assert.equal(row.actualAmount, 100);
  assert.equal(row.submitted, 100);
  assert.equal(row.remaining, 0);
  assert.equal(row.status, 'submitted');
});
