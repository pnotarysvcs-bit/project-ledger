import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOccurrenceAmounts,
  classifyBillStatus,
  deriveBillType,
  groupBillsByType,
} from '../src/bills/domain.js';

test('bill sections are always Personal, Business, then Streaming and due-date ordered', () => {
  const groups = groupBillsByType([
    { payee: 'Stream B', type: 'Streaming', nextDue: '2026-08-02' },
    { payee: 'Biz Late', type: 'Business', nextDue: '2026-08-20' },
    { payee: 'Personal Late', type: 'Personal', nextDue: '2026-08-30' },
    { payee: 'Biz Early', type: 'Business', nextDue: '2026-08-05' },
    { payee: 'Personal Early', type: 'Personal', nextDue: '2026-08-01' },
  ]);

  assert.deepEqual(groups.map((group) => group.type), ['Personal', 'Business', 'Streaming']);
  assert.deepEqual(groups[0].bills.map((bill) => bill.payee), ['Personal Early', 'Personal Late']);
  assert.deepEqual(groups[1].bills.map((bill) => bill.payee), ['Biz Early', 'Biz Late']);
});

test('upcoming unpaid bills do not expose Future status', () => {
  const status = classifyBillStatus(
    { effectiveAmount: 100, submitted: 0, dueDate: '2026-08-20' },
    new Date('2026-08-11T12:00:00Z'),
  );
  assert.equal(status, '');
});

test('status precedence is incomplete, submitted, partial, overdue, then blank upcoming', () => {
  const asOf = new Date('2026-08-11T12:00:00Z');
  assert.equal(classifyBillStatus({ effectiveAmount: null, submitted: 0, dueDate: '2026-08-01' }, asOf), 'incomplete');
  assert.equal(classifyBillStatus({ effectiveAmount: 100, submitted: 100, dueDate: '2026-08-01' }, asOf), 'submitted');
  assert.equal(classifyBillStatus({ effectiveAmount: 100, submitted: 20, dueDate: '2026-08-01' }, asOf), 'partial');
  assert.equal(classifyBillStatus({ effectiveAmount: 100, submitted: 20, dueDate: '2026-08-20' }, asOf), 'partial');
  assert.equal(classifyBillStatus({ effectiveAmount: 100, submitted: 0, dueDate: '2026-08-01' }, asOf), 'overdue');
  assert.equal(classifyBillStatus({ effectiveAmount: 100, submitted: 0, dueDate: '2026-08-20' }, asOf), '');
});

test('account-driven classification is consistent', () => {
  assert.equal(deriveBillType('TCU', 'Business'), 'Personal');
  assert.equal(deriveBillType('TCUB', 'Personal'), 'Business');
  assert.equal(deriveBillType('OTHER', 'Streaming'), 'Streaming');
});

test('multiple payments aggregate into Submitted while Actual remains authoritative', () => {
  const amounts = calculateOccurrenceAmounts({
    budget: 125,
    actualAmount: 100,
    payments: [{ amount: 40 }, { amount: 60 }],
  });

  assert.deepEqual(amounts, {
    effectiveAmount: 100,
    submitted: 100,
    remaining: 0,
    credit: 0,
  });
});
