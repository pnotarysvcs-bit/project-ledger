import test from 'node:test';
import assert from 'node:assert/strict';
import {
  archiveBill,
  changePayment,
  createBill,
  deletePayment,
  recordBulkPayments,
  recordPayment,
  updateBill,
} from '../src/bills/service.js';

function fakeRepository(overrides = {}) {
  const calls = [];
  const repository = {
    calls,
    async getMasterBill(id) {
      calls.push(['getMasterBill', id]);
      return { id, bill_name: 'FedEx', bill_type: 'Personal', category: '', account: 'TCU', budget: 80, frequency: 'monthly', due_day: 12 };
    },
    async createMasterBill(payload) {
      calls.push(['createMasterBill', payload]);
      return { id: 'bill-new' };
    },
    async updateMasterBill(id, patch) { calls.push(['updateMasterBill', id, patch]); },
    async getOccurrence(input) {
      calls.push(['getOccurrence', input]);
      return {
        id: input.occurrenceId || 'occ-1',
        occurrence_budget_amount: 80,
        actual_amount: 75,
        due_date: '2026-08-12',
      };
    },
    async createOccurrence(payload) {
      calls.push(['createOccurrence', payload]);
      return { id: 'occ-new' };
    },
    async updateOccurrence(key, patch) { calls.push(['updateOccurrence', key, patch]); },
    async addPayment(payload) {
      calls.push(['addPayment', payload]);
      return { id: 'pay-new' };
    },
    async addPayments(payloads) {
      calls.push(['addPayments', payloads]);
      return payloads.map((_, index) => ({ id: `pay-bulk-${index + 1}` }));
    },
    async updatePayment(key, patch) { calls.push(['updatePayment', key, patch]); },
    async removePayment(key) { calls.push(['removePayment', key]); },
    async archiveBill(id, archivedAt) { calls.push(['archiveBill', id, archivedAt]); },
    ...overrides,
  };
  return repository;
}

test('category-only edit updates only master category and leaves occurrence untouched', async () => {
  const repository = fakeRepository();
  await updateBill({
    id: 'bill-1', occurrenceId: 'occ-1', month: '2026-08', name: 'FedEx', type: 'Personal',
    category: 'Shipping', account: 'TCU', frequency: 'monthly', budget: '80', actualAmount: '75', nextDue: '2026-08-12',
  }, repository);

  const masterUpdate = repository.calls.find(([name]) => name === 'updateMasterBill');
  assert.deepEqual(masterUpdate, ['updateMasterBill', 'bill-1', { category: 'Shipping' }]);
  assert.equal(repository.calls.some(([name]) => name === 'updateOccurrence'), false);
});

test('budget-only edit updates master budget and leaves the monthly occurrence untouched', async () => {
  const repository = fakeRepository();
  await updateBill({
    id: 'bill-1', occurrenceId: 'occ-1', month: '2026-08', name: 'FedEx', type: 'Personal',
    category: '', account: 'TCU', frequency: 'monthly', budget: '90', actualAmount: '75', nextDue: '2026-08-12',
  }, repository);

  assert.deepEqual(repository.calls.find(([name]) => name === 'updateMasterBill'), ['updateMasterBill', 'bill-1', { budget: 90 }]);
  assert.equal(repository.calls.some(([name]) => name === 'updateOccurrence'), false);
});

test('create bill writes master and one monthly occurrence through repository boundary', async () => {
  const repository = fakeRepository();
  const result = await createBill({
    month: '2026-08', name: 'New Utility', type: 'Personal', category: 'Utilities', account: 'TCU',
    frequency: 'monthly', budget: '120', actualAmount: '', nextDue: '2026-08-20', notes: 'new bill',
  }, repository);

  assert.deepEqual(result, { billId: 'bill-new', occurrenceId: 'occ-new' });
  const masterCreate = repository.calls.find(([name]) => name === 'createMasterBill')[1];
  assert.equal(masterCreate.bill_type, 'Personal');
  assert.equal(masterCreate.category, 'Utilities');
  assert.equal(masterCreate.budget, 120);
  const occurrenceCreate = repository.calls.find(([name]) => name === 'createOccurrence')[1];
  assert.equal(occurrenceCreate.occurrence_budget_amount, 120);
  assert.equal(occurrenceCreate.actual_amount, null);
});

test('record payment resolves occurrence then persists one payment', async () => {
  const repository = fakeRepository();
  const result = await recordPayment({
    id: 'bill-1', occurrenceId: 'occ-1', month: '2026-08', dueDate: '2026-08-12',
    amount: '40', paymentDate: '2026-08-11', fundingAccount: 'TCU', notes: 'part one',
  }, repository);
  assert.deepEqual(result, { billId: 'bill-1', occurrenceId: 'occ-1', paymentId: 'pay-new' });
  assert.equal(repository.calls.find(([name]) => name === 'addPayment')[1].amount, 40);
});

test('bulk submit persists only eligible previous-month balances through repository boundary', async () => {
  const repository = fakeRepository();
  const result = await recordBulkPayments({
    month: '2026-07',
    currentMonth: '2026-08',
    bills: [
      { id: 'a', occurrenceId: 'occ-a', effectiveAmount: 100, remaining: 25, nextDue: '2026-07-10', account: 'TCU' },
      { id: 'b', occurrenceId: 'occ-b', effectiveAmount: 50, remaining: 0, nextDue: '2026-07-12', account: 'TCU' },
      { id: 'c', occurrenceId: null, effectiveAmount: 75, remaining: 75, nextDue: '2026-07-15', account: 'TCUB' },
    ],
  }, repository);

  assert.deepEqual(result, { count: 1 });
  const payloads = repository.calls.find(([name]) => name === 'addPayments')[1];
  assert.equal(payloads.length, 1);
  assert.deepEqual(payloads[0], {
    bill_id: 'a', occurrence_id: 'occ-a', amount: 25, payment_month: '2026-07-01',
    payment_date: '2026-07-10', funding_account: 'TCU', notes: 'Bulk payment submitted',
  });
});

test('bulk submit rejects the current or a future month', async () => {
  const repository = fakeRepository();
  await assert.rejects(
    recordBulkPayments({ month: '2026-08', currentMonth: '2026-08', bills: [] }, repository),
    /previous months/,
  );
  assert.equal(repository.calls.some(([name]) => name === 'addPayments'), false);
});

test('payment update and removal remain occurrence-scoped', async () => {
  const repository = fakeRepository();
  await changePayment({
    id: 'bill-1', occurrenceId: 'occ-1', paymentId: 'pay-1', month: '2026-08',
    amount: '42', paymentDate: '2026-08-11', fundingAccount: 'TCU', notes: '',
  }, repository);
  await deletePayment({ id: 'bill-1', occurrenceId: 'occ-1', paymentId: 'pay-1', month: '2026-08' }, repository);

  assert.deepEqual(repository.calls.find(([name]) => name === 'updatePayment')[1], {
    billId: 'bill-1', occurrenceId: 'occ-1', paymentId: 'pay-1', month: '2026-08',
  });
  assert.deepEqual(repository.calls.find(([name]) => name === 'removePayment')[1], {
    billId: 'bill-1', occurrenceId: 'occ-1', paymentId: 'pay-1', month: '2026-08',
  });
});

test('archive bill is handled by the repository boundary', async () => {
  const repository = fakeRepository();
  await archiveBill({ id: 'bill-1', archivedAt: '2026-08-11T20:30:00.000Z' }, repository);
  assert.deepEqual(repository.calls.find(([name]) => name === 'archiveBill'), [
    'archiveBill', 'bill-1', '2026-08-11T20:30:00.000Z',
  ]);
});
