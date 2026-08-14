import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLedgerRows } from '../src/ledger-bills-data.js';

test('archived bills are excluded from the active Bills view for historical months', () => {
  const bills = [{
    id: 'savings-1',
    bill_name: 'Savings #1',
    bill_type: 'Personal',
    category: 'Savings',
    account: 'TCU',
    budget: 1216.79,
    frequency: 'monthly',
    due_day: 13,
    recurrence_anchor: null,
    start_month: '2026-04-01',
    is_active: false,
    archived_at: '2026-08-14T10:14:23.867Z',
    notes: null,
  }];

  const occurrences = [{
    id: 'occ-july',
    bill_id: 'savings-1',
    month: '2026-07-01',
    occurrence_budget_amount: 1216.79,
    actual_amount: 1216.79,
    due_date: '2026-07-13',
    installment_key: '2026-07-13',
    migration_incomplete: false,
  }];

  const payments = [{
    id: 'pay-july',
    bill_id: 'savings-1',
    occurrence_id: 'occ-july',
    amount: 1216.79,
    payment_date: '2026-07-13',
    funding_account: 'TCU',
    notes: 'Full payment submitted',
    statement_transaction_id: null,
  }];

  const rows = buildLedgerRows(bills, occurrences, payments, {
    selectedMonth: '2026-07',
    asOf: new Date('2026-08-14T12:00:00Z'),
  });

  assert.deepEqual(rows, []);
});
