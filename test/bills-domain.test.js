import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOccurrenceAmounts,
  classifyBillStatus,
  deriveBillType,
  groupBillsByType,
  sortBillOccurrences,
} from '../src/bills/domain.js';

test('TCU and TCUB derive Personal and Business consistently', () => {
  assert.equal(deriveBillType('TCU', 'Streaming'), 'Personal');
  assert.equal(deriveBillType('TCUB', 'Personal'), 'Business');
  assert.equal(deriveBillType('Other', 'Streaming'), 'Streaming');
});

test('upcoming unpaid bills have no Future status label', () => {
  const asOf = new Date('2026-08-11T12:00:00Z');
  assert.equal(classifyBillStatus({ effectiveAmount: 100, submitted: 0, dueDate: '2026-08-20' }, asOf), '');
});

test('status precedence preserves submitted, overdue, and partial semantics', () => {
  const asOf = new Date('2026-08-11T12:00:00Z');
  assert.equal(classifyBillStatus({ effectiveAmount: 100, submitted: 100, dueDate: '2026-08-01' }, asOf), 'submitted');
  assert.equal(classifyBillStatus({ effectiveAmount: 100, submitted: 25, dueDate: '2026-08-01' }, asOf), 'overdue');
  assert.equal(classifyBillStatus({ effectiveAmount: 100, submitted: 25, dueDate: '2026-08-20' }, asOf), 'partial');
  assert.equal(classifyBillStatus({ effectiveAmount: null, submitted: 0, dueDate: '2026-08-01' }, asOf), 'incomplete');
});

test('bill occurrences sort by Next Due then Bill Name', () => {
  const rows = [
    { payee: 'Zulu', nextDue: '2026-08-05' },
    { payee: 'Alpha', nextDue: '2026-08-28' },
    { payee: 'Beta', nextDue: '2026-08-05' },
  ];
  assert.deepEqual(sortBillOccurrences(rows).map((row) => row.payee), ['Beta', 'Zulu', 'Alpha']);
});

test('section order is always Personal, Business, Streaming', () => {
  const rows = [
    { payee: 'Netflix', type: 'Streaming', nextDue: '2026-08-01' },
    { payee: 'FedEx', type: 'Personal', nextDue: '2026-08-03' },
    { payee: 'Square', type: 'Business', nextDue: '2026-08-02' },
  ];
  assert.deepEqual(groupBillsByType(rows).map(({ type }) => type), ['Personal', 'Business', 'Streaming']);
});

test('multiple payments aggregate into Submitted without replacing Actual', () => {
  const result = calculateOccurrenceAmounts({
    budget: 150,
    actualAmount: 100,
    payments: [{ amount: 40 }, { amount: 60 }],
  });
  assert.deepEqual(result, {
    effectiveAmount: 100,
    submitted: 100,
    remaining: 0,
    credit: 0,
  });
});

test('overpayment creates credit and never negative remaining', () => {
  const result = calculateOccurrenceAmounts({
    budget: 100,
    actualAmount: null,
    payments: [{ amount: 125 }],
  });
  assert.deepEqual(result, {
    effectiveAmount: 100,
    submitted: 125,
    remaining: 0,
    credit: 25,
  });
});
