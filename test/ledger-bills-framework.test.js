import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLedgerRows, getLedgerOverview, summarizeLedgerBills } from '../src/ledger-bills-data.js';

const bills = [
  { id: 'paid', bill_name: 'Paid', bill_type: 'Personal', category: 'Home', account: 'TCU', budget: '100', frequency: 'monthly', due_day: 10, start_month: '2026-04-01', is_active: true },
  { id: 'part', bill_name: 'Part', bill_type: 'Personal', category: 'Home', account: 'TCU', budget: '80', frequency: 'monthly', due_day: 20, start_month: '2026-04-01', is_active: true },
  { id: 'late', bill_name: 'Late', bill_type: 'Business', category: 'Tax', account: 'TCUB', budget: '50', frequency: 'monthly', due_day: 1, start_month: '2026-04-01', is_active: true },
];
const payments = [
  { id: 'p1', bill_id: 'paid', amount: '40', payment_date: '2026-08-01' },
  { id: 'p2', bill_id: 'paid', amount: '60', payment_date: '2026-08-02' },
  { id: 'p3', bill_id: 'part', amount: '20', payment_date: '2026-08-03' },
];

test('transactions produce submitted, partial, remaining and reconciling totals', () => {
  const rows = buildLedgerRows(bills, payments, { selectedMonth: '2026-08', asOf: new Date('2026-08-06T00:00:00Z') });
  const summary = summarizeLedgerBills(rows);
  assert.equal(rows[0].transactions.length, 2);
  assert.equal(rows[0].status, 'submitted');
  assert.equal(rows[1].status, 'partial');
  assert.equal(rows[2].status, 'overdue');
  assert.deepEqual([summary.total, summary.submitted, summary.partial, summary.remaining], [230, 100, 20, 110]);
  assert.equal(summary.total, summary.submitted + summary.partial + summary.remaining);
});

test('overview precedence counts every active bill exactly once', () => {
  const rows = buildLedgerRows(bills, [...payments, { id: 'p4', bill_id: 'late', amount: '10', payment_date: '2026-08-03' }], { selectedMonth: '2026-08', asOf: new Date('2026-08-06T00:00:00Z') });
  const overview = getLedgerOverview(rows);
  assert.deepEqual(overview.map(({ key, count }) => [key, count]), [['submitted', 1], ['overdue', 1], ['partial', 1], ['future', 0]]);
  assert.equal(overview.reduce((sum, bucket) => sum + bucket.count, 0), rows.length);
  assert.equal(overview.find((bucket) => bucket.key === 'overdue').amount, 40);
});
