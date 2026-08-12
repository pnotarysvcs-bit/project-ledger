import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyLedgerBill, getLedgerBills, summarizeLedgerBills } from '../src/ledger-bills-data.js';

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('April 2026 returns all 48 active seeded bills alphabetically', async (t) => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  const bills = Array.from({ length: 48 }, (_, index) => ({
    id: `bill-${String(index + 1).padStart(2, '0')}`,
    bill_name: `Bill ${String(index + 1).padStart(2, '0')}`,
    bill_type: index < 25 ? 'Personal' : index < 33 ? 'Streaming' : 'Business',
    category: 'Other',
    account: index < 33 ? 'TCU' : 'TCUB',
    budget: '10.00',
    frequency: 'monthly',
    due_day: 15,
    start_month: '2026-04-01',
    notes: null,
    is_active: true,
  }));

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('ledger_bills?')) return jsonResponse(bills);
    if (target.includes('ledger_bill_months?')) return jsonResponse([]);
    if (target.includes('ledger_bill_payments?')) return jsonResponse([]);
    return new Response('Not found', { status: 404 });
  };
  t.after(() => { global.fetch = originalFetch; });

  const rows = await getLedgerBills({
    selectedMonth: '2026-04',
    asOf: new Date('2026-04-01T00:00:00Z'),
  });

  assert.equal(rows.length, 48);
  assert.equal(rows[0].payee, 'Bill 01');
  assert.equal(rows[47].payee, 'Bill 48');
  assert.equal(summarizeLedgerBills(rows).activeCount, 48);
});

test('one-time, quarterly, and annual bills follow their scheduled months', async (t) => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  const bills = [
    { id: 'monthly', bill_name: 'Monthly', bill_type: 'Personal', category: 'Other', account: 'TCU', budget: '10', frequency: 'monthly', due_day: 1, start_month: '2026-04-01', notes: null, is_active: true },
    { id: 'quarterly', bill_name: 'Quarterly', bill_type: 'Personal', category: 'Other', account: 'TCU', budget: '10', frequency: 'quarterly', due_day: 1, start_month: '2026-04-01', notes: null, is_active: true },
    { id: 'annual', bill_name: 'Annual', bill_type: 'Business', category: 'Business', account: 'TCUB', budget: '10', frequency: 'annual', due_day: 1, start_month: '2026-04-01', notes: null, is_active: true },
    { id: 'once', bill_name: 'Once', bill_type: 'Personal', category: 'Other', account: 'TCU', budget: '10', frequency: 'one-time', due_day: 1, start_month: '2026-04-01', notes: null, is_active: true },
  ];

  const originalFetch = global.fetch;
  global.fetch = async (url) => String(url).includes('ledger_bills?')
    ? jsonResponse(bills)
    : jsonResponse([]);
  t.after(() => { global.fetch = originalFetch; });

  const april = await getLedgerBills({ selectedMonth: '2026-04', asOf: new Date('2026-04-01T00:00:00Z') });
  const may = await getLedgerBills({ selectedMonth: '2026-05', asOf: new Date('2026-05-01T00:00:00Z') });
  const july = await getLedgerBills({ selectedMonth: '2026-07', asOf: new Date('2026-07-01T00:00:00Z') });

  assert.deepEqual(april.map((bill) => bill.id), ['annual', 'monthly', 'once', 'quarterly']);
  assert.deepEqual(may.map((bill) => bill.id), ['monthly']);
  assert.deepEqual(july.map((bill) => bill.id), ['monthly', 'quarterly']);
});

test('bulk statuses do not carry submitted state into a month without payments', async (t) => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  const bill = {
    id: 'rent', bill_name: 'Rent', bill_type: 'Personal', category: 'Home',
    account: 'TCU', budget: '1000', frequency: 'monthly', due_day: 15,
    start_month: '2026-04-01', notes: null, is_active: true,
  };

  const occurrenceFor = (month, dueDate, id) => ({
    id,
    bill_id: bill.id,
    month,
    status: 'submitted',
    occurrence_budget_amount: '1000',
    actual_amount: null,
    due_date: dueDate,
    installment_key: dueDate,
    migration_incomplete: false,
  });

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('ledger_bills?')) return jsonResponse([bill]);
    if (target.includes('ledger_bill_months?')) {
      if (target.includes('month=eq.2026-07-01')) return jsonResponse([occurrenceFor('2026-07-01', '2026-07-15', 'occ-july')]);
      if (target.includes('month=eq.2026-08-01')) return jsonResponse([occurrenceFor('2026-08-01', '2026-08-15', 'occ-august')]);
      return jsonResponse([]);
    }
    if (target.includes('ledger_bill_payments?')) return jsonResponse([]);
    return new Response('Not found', { status: 404 });
  };
  t.after(() => { global.fetch = originalFetch; });

  const [julyBill] = await getLedgerBills({
    selectedMonth: '2026-07',
    asOf: new Date('2026-08-06T00:00:00Z'),
  });
  const [augustBill] = await getLedgerBills({
    selectedMonth: '2026-08',
    asOf: new Date('2026-08-06T00:00:00Z'),
  });

  assert.equal(julyBill.status, 'overdue');
  assert.equal(augustBill.status, '');
  assert.equal(augustBill.submitted, 0);
  assert.equal(augustBill.remaining, 1000);
});

test('past-due occurrence with no effective amount is incomplete, not overdue', () => {
  const status = classifyLedgerBill({
    effectiveAmount: null,
    submitted: 0,
    dueDate: '2026-04-15',
  }, new Date('2026-08-08T00:00:00Z'));

  assert.equal(status, 'incomplete');
});

test('missing amount and migration data-quality counts remain separate', () => {
  const rows = [
    {
      effectiveAmount: null,
      migrationIncomplete: false,
      submitted: 0,
      credit: 0,
      remaining: null,
      status: 'incomplete',
      nextDue: '2026-04-15',
    },
    {
      effectiveAmount: 25,
      migrationIncomplete: true,
      submitted: 0,
      credit: 0,
      remaining: 25,
      status: 'overdue',
      nextDue: '2026-04-15',
    },
  ];

  const summary = summarizeLedgerBills(rows, new Date('2026-08-08T00:00:00Z'));
  assert.equal(summary.incompleteCount, 1);
  assert.equal(summary.dataQualityCount, 1);
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.overdue, 25);
});
