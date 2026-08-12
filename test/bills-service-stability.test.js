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
    frequency: 'monthly',
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

test('budget-only edit changes occurrence and does not rewrite master fields', async () => {
  const { repository, calls } = repositoryFixture();
  await updateBill({ ...baseInput, budget: '150' }, repository);

  const masterUpdate = calls.find(([name]) => name === 'updateMasterBill');
  assert.deepEqual(masterUpdate[2], {});
  const occurrenceUpdate = calls.find(([name]) => name === 'updateOccurrence');
  assert.deepEqual(occurrenceUpdate[2], { occurrence_budget_amount: 150, migration_incomplete: false });
});

test('actual-only edit preserves budget and updates only Actual', async () => {
  const { repository, calls } = repositoryFixture();
  await updateBill({ ...baseInput, actualAmount: '119.45' }, repository);

  const occurrenceUpdate = calls.find(([name]) => name === 'updateOccurrence');
  assert.deepEqual(occurrenceUpdate[2], { actual_amount: 119.45, migration_incomplete: false });
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
