import test from 'node:test';
import assert from 'node:assert/strict';

import { updateBill } from '../src/bills/service.js';
import { buildLedgerRows } from '../src/ledger-bills-data.js';

function masterBill(overrides = {}) {
  return {
    id: 'bill-1',
    bill_name: 'Affirm',
    bill_type: 'Personal',
    category: 'Credit',
    account: 'TCU',
    budget: '125.00',
    frequency: 'monthly',
    due_day: 20,
    recurrence_anchor: null,
    start_month: '2026-04-01',
    notes: null,
    is_active: true,
    archived_at: null,
    ...overrides,
  };
}

function occurrence(month, actualAmount, overrides = {}) {
  return {
    id: `occ-${month}`,
    bill_id: 'bill-1',
    month: `${month}-01`,
    occurrence_budget_amount: '90.00',
    actual_amount: actualAmount,
    due_date: `${month}-15`,
    installment_key: `${month}-15`,
    migration_incomplete: false,
    ...overrides,
  };
}

test('master Budget and Due Date render consistently across historical months while Actual stays month-specific', () => {
  const bill = masterBill();
  const [june] = buildLedgerRows(
    [bill],
    [occurrence('2026-06', '111.00')],
    [],
    { selectedMonth: '2026-06', asOf: new Date('2026-06-01T00:00:00Z') },
  );
  const [august] = buildLedgerRows(
    [bill],
    [occurrence('2026-08', '119.00')],
    [],
    { selectedMonth: '2026-08', asOf: new Date('2026-08-01T00:00:00Z') },
  );

  assert.equal(june.budget, 125);
  assert.equal(august.budget, 125);
  assert.equal(june.nextDue, '2026-06-20');
  assert.equal(august.nextDue, '2026-08-20');
  assert.equal(june.actualAmount, 111);
  assert.equal(august.actualAmount, 119);
});

test('editing Budget and Due Date updates the master while only Actual updates the selected occurrence', async () => {
  const calls = { masterPatch: null, occurrencePatch: null };
  const repository = {
    getMasterBill: async () => masterBill({ budget: '100.00', due_day: 15 }),
    updateMasterBill: async (_id, patch) => { calls.masterPatch = patch; },
    getOccurrence: async () => occurrence('2026-08', '105.00'),
    createOccurrence: async () => { throw new Error('should not create occurrence'); },
    updateOccurrence: async (_identity, patch) => { calls.occurrencePatch = patch; },
  };

  await updateBill({
    id: 'bill-1',
    occurrenceId: 'occ-2026-08',
    month: '2026-08',
    name: 'Affirm Updated',
    type: 'Personal',
    category: 'Credit',
    account: 'TCU',
    frequency: 'monthly',
    budget: '125.00',
    actualAmount: '119.00',
    nextDue: '2026-08-20',
  }, repository);

  assert.equal(calls.masterPatch.bill_name, 'Affirm Updated');
  assert.equal(calls.masterPatch.budget, 125);
  assert.equal(calls.masterPatch.due_day, 20);
  assert.equal(calls.masterPatch.recurrence_anchor, undefined);
  assert.deepEqual(calls.occurrencePatch, { actual_amount: 119, migration_incomplete: false });
  assert.equal('occurrence_budget_amount' in calls.occurrencePatch, false);
  assert.equal('due_date' in calls.occurrencePatch, false);
});

test('bi-weekly Due Date edit updates the master recurrence anchor', async () => {
  let masterPatch;
  const repository = {
    getMasterBill: async () => masterBill({ frequency: 'bi-weekly', recurrence_anchor: '2026-08-01', due_day: 1 }),
    updateMasterBill: async (_id, patch) => { masterPatch = patch; },
    getOccurrence: async () => occurrence('2026-08', null, { due_date: '2026-08-01' }),
    createOccurrence: async () => { throw new Error('should not create occurrence'); },
    updateOccurrence: async () => {},
  };

  await updateBill({
    id: 'bill-1',
    occurrenceId: 'occ-2026-08',
    month: '2026-08',
    name: 'Affirm',
    type: 'Personal',
    category: 'Credit',
    account: 'TCU',
    frequency: 'bi-weekly',
    budget: '125.00',
    actualAmount: '',
    nextDue: '2026-08-03',
  }, repository);

  assert.equal(masterPatch.due_day, 3);
  assert.equal(masterPatch.recurrence_anchor, '2026-08-03');
});
