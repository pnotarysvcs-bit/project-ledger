import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLedgerRows } from '../src/ledger-bills-data.js';
import { applyBillFilters } from '../src/bills/filters.js';

const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const displayDate = (date) => date || '-';
const displayCategory = (value) => value || 'Needs category';

function master(overrides = {}) {
  return {
    id: 'bill-1',
    bill_name: 'Recurring Bill',
    bill_type: 'Personal',
    category: 'Utilities',
    account: 'TCU',
    budget: 100,
    frequency: 'monthly',
    due_day: 10,
    recurrence_anchor: null,
    start_month: '2026-04-01',
    notes: null,
    is_active: true,
    archived_at: null,
    ...overrides,
  };
}

function occurrence(month) {
  return {
    id: `occ-${month}`,
    bill_id: 'bill-1',
    month: `${month}-01`,
    occurrence_budget_amount: 100,
    actual_amount: null,
    due_date: `${month}-10`,
    installment_key: `${month}-10`,
    migration_incomplete: false,
  };
}

test('archived master bill stays out of every active month view from April forward', () => {
  const archived = master({ is_active: false, archived_at: '2026-08-14T15:00:00Z' });
  for (const month of ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08']) {
    const rows = buildLedgerRows([archived], [occurrence(month)], [], {
      selectedMonth: month,
      asOf: new Date('2026-08-14T12:00:00Z'),
    });
    assert.equal(rows.length, 0, `${month} should not show the archived master bill`);
  }
});

test('active master bill still appears in applicable months', () => {
  const rows = buildLedgerRows([master()], [occurrence('2026-04')], [], {
    selectedMonth: '2026-04',
    asOf: new Date('2026-04-05T12:00:00Z'),
  });
  assert.equal(rows.length, 1);
});

test('blank token finds empty fields without matching populated rows', () => {
  const rows = [
    {
      payee: 'Missing Data', type: 'Personal', category: '', account: '', budget: null,
      actualAmount: null, nextDue: '', status: '',
    },
    {
      payee: 'Complete Data', type: 'Business', category: 'Utilities', account: 'TCUB', budget: 100,
      actualAmount: 95, nextDue: '2026-04-10', status: 'submitted',
    },
  ];

  const emptyFilters = { bill: '', type: '', category: '', account: '', budget: '', actual: '', due: '', status: '' };
  for (const field of ['category', 'account', 'budget', 'actual', 'due', 'status']) {
    const filters = { ...emptyFilters, [field]: 'blank' };
    const result = applyBillFilters(rows, filters, { moneyFormatter, displayDate, displayCategory });
    assert.deepEqual(result.map((row) => row.payee), ['Missing Data'], `${field} should support blank filtering`);
  }
});

test('blank aliases empty and (blank) are accepted', () => {
  const rows = [{ payee: 'Missing Actual', type: 'Personal', category: 'Other', account: 'TCU', budget: 10, actualAmount: null, nextDue: '2026-04-10', status: 'upcoming' }];
  const base = { bill: '', type: '', category: '', account: '', budget: '', actual: '', due: '', status: '' };
  for (const token of ['blank', 'empty', '(blank)']) {
    const result = applyBillFilters(rows, { ...base, actual: token }, { moneyFormatter, displayDate, displayCategory });
    assert.equal(result.length, 1);
  }
});
