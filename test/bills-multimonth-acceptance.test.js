import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLedgerRows, groupLedgerBills, getLedgerOverview } from '../src/ledger-bills-data.js';

const baseBills = [
  {
    id: 'personal-late', bill_name: 'Personal Later', bill_type: 'Personal', category: 'Other', account: 'TCU',
    budget: 75, frequency: 'monthly', due_day: 20, recurrence_anchor: null, start_month: '2026-04-01',
    notes: null, is_active: true, archived_at: null,
  },
  {
    id: 'personal-early', bill_name: 'Personal Early', bill_type: 'Personal', category: 'Other', account: 'TCU',
    budget: 50, frequency: 'monthly', due_day: 5, recurrence_anchor: null, start_month: '2026-04-01',
    notes: null, is_active: true, archived_at: null,
  },
  {
    id: 'business', bill_name: 'Business Bill', bill_type: 'Business', category: 'Other', account: 'TCUB',
    budget: 100, frequency: 'monthly', due_day: 10, recurrence_anchor: null, start_month: '2026-04-01',
    notes: null, is_active: true, archived_at: null,
  },
  {
    id: 'streaming', bill_name: 'Streaming Bill', bill_type: 'Streaming', category: 'Streaming', account: 'OTHER',
    budget: 15, frequency: 'monthly', due_day: 15, recurrence_anchor: null, start_month: '2026-04-01',
    notes: null, is_active: true, archived_at: null,
  },
  {
    id: 'quarterly', bill_name: 'Quarterly Personal', bill_type: 'Personal', category: 'Other', account: 'TCU',
    budget: 40, frequency: 'quarterly', due_day: 12, recurrence_anchor: null, start_month: '2026-04-01',
    notes: null, is_active: true, archived_at: null,
  },
];

function occurrence(id, month, day, budget) {
  const due = `${month}-${String(day).padStart(2, '0')}`;
  return {
    id: `occ-${id}-${month}`,
    bill_id: id,
    month: `${month}-01`,
    occurrence_budget_amount: budget,
    actual_amount: null,
    due_date: due,
    installment_key: due,
    migration_incomplete: false,
  };
}

function occurrencesFor(month) {
  const result = [
    occurrence('personal-late', month, 20, 75),
    occurrence('personal-early', month, 5, 50),
    occurrence('business', month, 10, 100),
    occurrence('streaming', month, 15, 15),
  ];
  if (month === '2026-04' || month === '2026-07') result.push(occurrence('quarterly', month, 12, 40));
  return result;
}

for (const month of ['2026-04', '2026-06', '2026-07', '2026-08']) {
  test(`${month} keeps canonical section order and due-date sorting`, () => {
    const rows = buildLedgerRows(baseBills, occurrencesFor(month), [], {
      selectedMonth: month,
      asOf: new Date('2026-08-11T12:00:00Z'),
    });
    const groups = groupLedgerBills(rows);
    assert.deepEqual(groups.map((group) => group.type), ['Personal', 'Business', 'Streaming']);
    for (const group of groups) {
      const dueDates = group.bills.map((bill) => bill.nextDue);
      assert.deepEqual(dueDates, [...dueDates].sort());
    }
  });
}

test('August upcoming unpaid bills expose no Future status anywhere', () => {
  const rows = buildLedgerRows(baseBills, occurrencesFor('2026-08'), [], {
    selectedMonth: '2026-08',
    asOf: new Date('2026-08-11T12:00:00Z'),
  });
  assert.equal(rows.some((bill) => bill.status === 'future'), false);
  assert.equal(getLedgerOverview(rows).some((item) => item.key === 'future'), false);
});

test('month-specific recurrence changes row count without changing section contract', () => {
  const april = buildLedgerRows(baseBills, occurrencesFor('2026-04'), [], { selectedMonth: '2026-04' });
  const june = buildLedgerRows(baseBills, occurrencesFor('2026-06'), [], { selectedMonth: '2026-06' });
  const july = buildLedgerRows(baseBills, occurrencesFor('2026-07'), [], { selectedMonth: '2026-07' });
  const august = buildLedgerRows(baseBills, occurrencesFor('2026-08'), [], { selectedMonth: '2026-08' });

  assert.equal(april.length, 5);
  assert.equal(june.length, 4);
  assert.equal(july.length, 5);
  assert.equal(august.length, 4);
  for (const rows of [april, june, july, august]) {
    assert.deepEqual(groupLedgerBills(rows).map((group) => group.type), ['Personal', 'Business', 'Streaming']);
  }
});
