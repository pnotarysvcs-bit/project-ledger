import test from 'node:test';
import assert from 'node:assert/strict';
import { updateBill } from '../src/bills/service.js';

function repositoryFixture({ masterOverrides = {}, occurrenceOverrides = {} } = {}) {
  const calls = [];
  const master = {
    id: 'bill-1',
    bill_name: 'FedEx',
    bill_type: 'Personal',
    category: '',
    account: 'TCU',
    budget: 125,
    frequency: 'monthly',
    due_day: 20,
    ...masterOverrides,
  };
  const occurrence = {
    id: 'occ-1',
    occurrence_budget_amount: 125,
    actual_amount: null,
    due_date: '2026-08-20',
    installment_key: '2026-08-20',
    migration_incomplete: false,
    ...occurrenceOverrides,
  };

  return {
    calls,
    repository: {
      async getMasterBill() { calls.push(['getMasterBill']); return master; },
      async updateMasterBill(id, patch) { calls.push(['updateMasterBill', id, patch]); },
      async getOccurrence() { calls.push(['getOccurrence']); return occurrence; },
      async createOccurrence(payload) { calls.push(['createOccurrence', payload]); return { id: 'created-occ' }; },
      async updateOccurrence(key, patch) { calls.push(['updateOccurrence', key, patch]); },
    },
  };
}

const baseInput = {
  id: 'bill-1',
  occurrenceId: 'occ-1',
  month: '2026-08',
  name: 'FedEx',
  type: 'Personal',
  category: '',
  account: 'TCU',
  frequency: 'monthly',
  budget: '125',
  actualAmount: '',
  nextDue: '2026-08-20',
};

test('category-only edit updates master metadata without rewriting occurrence', async () => {
  const { repository, calls } = repositoryFixture();
  await updateBill({ ...baseInput, category: 'Shipping' }, repository);

  const masterUpdate = calls.find(([name]) => name === 'updateMasterBill');
  assert.deepEqual(masterUpdate[2], { category: 'Shipping' });
  assert.equal(calls.some(([name]) => name === 'updateOccurrence'), false);
  assert.equal(calls.some(([name]) => name === 'createOccurrence'), false);
});

test('FedEx legacy Category Business can be corrected without rewriting unrelated fields', async () => {
  const { repository, calls } = repositoryFixture({
    masterOverrides: { category: 'Business', bill_type: 'Personal', account: 'TCU', budget: 104.30 },
    occurrenceOverrides: { occurrence_budget_amount: 104.30 },
  });

  await updateBill({
    ...baseInput,
    category: 'Shipping',
    budget: '104.30',
  }, repository);

  const masterUpdate = calls.find(([name]) => name === 'updateMasterBill');
  assert.deepEqual(masterUpdate[2], { category: 'Shipping' });
  assert.equal(calls.some(([name]) => name === 'updateOccurrence'), false);
  assert.equal(calls.some(([name]) => name === 'createOccurrence'), false);
});

test('legacy invalid category does not block an unrelated edit when the value is unchanged', async () => {
  const { repository, calls } = repositoryFixture({ masterOverrides: { category: 'Business' } });
  await updateBill({ ...baseInput, category: 'Business', name: 'FedEx Ground' }, repository);

  const masterUpdate = calls.find(([name]) => name === 'updateMasterBill');
  assert.deepEqual(masterUpdate[2], { bill_name: 'FedEx Ground' });
  assert.equal(Object.hasOwn(masterUpdate[2], 'category'), false);
});

test('a new Business or Personal category is still rejected', async () => {
  const { repository } = repositoryFixture({ masterOverrides: { category: 'Shipping' } });
  await assert.rejects(
    updateBill({ ...baseInput, category: 'Business' }, repository),
    /Business and Personal are Types, not Categories/,
  );
});

test('budget-only edit updates the master budget and leaves the occurrence untouched', async () => {
  const { repository, calls } = repositoryFixture();
  await updateBill({ ...baseInput, budget: '150' }, repository);

  const masterUpdate = calls.find(([name]) => name === 'updateMasterBill');
  assert.deepEqual(masterUpdate[2], { budget: 150 });
  assert.equal(calls.some(([name]) => name === 'updateOccurrence'), false);
});

test('actual-only edit preserves budget and updates only Actual', async () => {
  const { repository, calls } = repositoryFixture();
  await updateBill({ ...baseInput, actualAmount: '119.45' }, repository);

  const occurrenceUpdate = calls.find(([name]) => name === 'updateOccurrence');
  assert.deepEqual(occurrenceUpdate[2], { actual_amount: 119.45, migration_incomplete: false });
});

test('submitted bill workflow still permits Actual to be entered without touching payment history', async () => {
  const { repository, calls } = repositoryFixture();
  // Payments/status are intentionally outside updateBill; editing occurrence data must
  // remain independent from payment history even after a bill has been submitted.
  await updateBill({ ...baseInput, actualAmount: '104.30' }, repository);

  const occurrenceUpdate = calls.find(([name]) => name === 'updateOccurrence');
  assert.deepEqual(occurrenceUpdate[2], { actual_amount: 104.30, migration_incomplete: false });
  assert.equal(calls.some(([name]) => /Payment/.test(name)), false);
});

test('TCUB account change derives Business type through canonical rule', async () => {
  const { repository, calls } = repositoryFixture();
  await updateBill({ ...baseInput, account: 'TCUB Operating' }, repository);

  const masterUpdate = calls.find(([name]) => name === 'updateMasterBill');
  assert.deepEqual(masterUpdate[2], { bill_type: 'Business', account: 'TCUB OPERATING' });
});

test('blank category remains allowed during unrelated edits and is never written as null', async () => {
  const { repository, calls } = repositoryFixture();
  await updateBill({ ...baseInput, name: 'FedEx Ground' }, repository);

  const masterUpdate = calls.find(([name]) => name === 'updateMasterBill');
  assert.deepEqual(masterUpdate[2], { bill_name: 'FedEx Ground' });
  assert.equal(Object.hasOwn(masterUpdate[2], 'category'), false);
});

test('missing occurrence is created once with the selected month values', async () => {
  const { repository, calls } = repositoryFixture();
  repository.getOccurrence = async () => { calls.push(['getOccurrence']); return null; };
  const result = await updateBill({ ...baseInput, occurrenceId: '' }, repository);

  const create = calls.find(([name]) => name === 'createOccurrence');
  assert.equal(create[1].bill_id, 'bill-1');
  assert.equal(create[1].month, '2026-08-01');
  assert.equal(create[1].occurrence_budget_amount, 125);
  assert.equal(create[1].due_date, '2026-08-20');
  assert.equal(result.occurrenceId, 'created-occ');
});
