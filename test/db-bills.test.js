import test from 'node:test';
import assert from 'node:assert/strict';

import { enrichBill, mapBillRecord, toLedgerRows } from '../src/db/bills.js';
import { isConfigured, missingEnvVars } from '../src/db/client.js';

const asOf = '2026-08-04';

// Shaped like a real ledger_bills row.
const record = (overrides = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  bill_name: 'Adobe',
  bill_type: 'Business',
  category: 'Business',
  account: 'TCUB',
  budget: '19.99',
  frequency: 'monthly',
  due_day: 15,
  start_month: '2026-04-01',
  is_active: true,
  notes: null,
  ...overrides,
});

test('a record maps onto the shape the pages render', () => {
  const bill = mapBillRecord(record());

  assert.equal(bill.payee, 'Adobe');
  assert.equal(bill.type, 'Business');
  assert.equal(bill.account, 'TCUB');
  assert.equal(bill.active, true);
  assert.equal(bill.lastPaid, null, 'no payment history exists yet');
});

test('budget arrives as a numeric string and becomes a number', () => {
  assert.strictEqual(mapBillRecord(record()).amount, 19.99);
  assert.strictEqual(mapBillRecord(record({ budget: null })).amount, 0);
});

test('a monthly bill gets its due date computed for the current month', () => {
  const bill = enrichBill(mapBillRecord(record()), { asOf });

  assert.equal(bill.nextDue, '2026-08-15');
});

test('a past due date in the current month reads as overdue', () => {
  const bill = enrichBill(mapBillRecord(record({ due_day: 1 })), { asOf });

  // Due 1 Aug, today is 4 Aug, so the next occurrence is September.
  assert.equal(bill.nextDue, '2026-09-01');
});

test('an annual bill started in April is not due again until next April', () => {
  const bill = enrichBill(
    mapBillRecord(record({ frequency: 'annual', due_day: 27, start_month: '2026-04-01' })),
    { asOf },
  );

  assert.equal(bill.nextDue, '2027-04-27');
});

test('a quarterly bill started in April falls due in October', () => {
  const bill = enrichBill(
    mapBillRecord(record({ frequency: 'quarterly', due_day: 1, start_month: '2026-04-01' })),
    { asOf },
  );

  assert.equal(bill.nextDue, '2026-10-01');
});

test('a one-time bill whose month has passed has no next due date', () => {
  const bill = enrichBill(
    mapBillRecord(record({ frequency: 'one-time', start_month: '2026-04-01' })),
    { asOf },
  );

  assert.equal(bill.nextDue, null);
  assert.equal(bill.status, 'new', 'dateless, not overdue');
});

test('an inactive bill is archived rather than dropped', () => {
  const bill = enrichBill(mapBillRecord(record({ is_active: false })), { asOf });

  assert.equal(bill.status, 'archived');
  assert.equal(bill.nextDue, null);
});

test('rows keep their order and every one gets a status', () => {
  const rows = toLedgerRows([record(), record({ bill_name: 'Alignable', due_day: 13 })], { asOf });

  assert.deepEqual(rows.map(({ payee }) => payee), ['Adobe', 'Alignable']);
  for (const row of rows) assert.ok(row.status, `${row.payee} should have a status`);
});

test('the client reports what is missing without exposing values', () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    assert.equal(isConfigured(), false);
    assert.deepEqual(missingEnvVars(), ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  } finally {
    if (url) process.env.SUPABASE_URL = url;
    if (key) process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  }
});
