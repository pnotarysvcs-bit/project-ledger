import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateCashGuard, estimateReserveRecalculation } from '../src/cash-guard.js';

const rows = [
  { id: 'rent', remaining: 400, overdueOutstanding: 0 },
  { id: 'utility', remaining: 100, overdueOutstanding: 50 },
  { id: 'utility', remaining: 25, overdueOutstanding: 50 },
];

const inputs = {
  availableCash: 1000,
  variableEssentialsReserve: 100,
  plannedOneOffsReserve: 50,
  cashFloor: 100,
  payPeriods: [
    { regularIncome: 500, notaryIncome: 200 },
    { regularIncome: 0, notaryIncome: 100 },
  ],
};

test('cash guard subtracts unpaid bills and reserves from available cash', () => {
  const result = calculateCashGuard(rows, inputs, new Date('2026-08-29T12:00:00Z'));

  assert.equal(result.currentBillsRemaining, 525);
  assert.equal(result.overdueBillsRemaining, 50, 'overdue is counted once per bill');
  assert.equal(result.billsReserved, 575);
  assert.equal(result.fundingReceived, 800);
  assert.equal(result.safeToSpend, 175);
  assert.equal(result.fundingGap, 0);
});

test('discretionary lock forces safe to spend to zero', () => {
  const result = calculateCashGuard(rows, {
    ...inputs,
    discretionaryLockUntil: '2026-08-28',
  }, new Date('2026-08-22T12:00:00Z'));

  assert.equal(result.locked, true);
  assert.equal(result.safeToSpend, 0);
});

test('cash guard reports a funding gap when bills exceed available cash', () => {
  const result = calculateCashGuard(rows, {
    ...inputs,
    availableCash: 300,
  }, new Date('2026-08-29T12:00:00Z'));

  assert.equal(result.safeToSpend, 0);
  assert.equal(result.fundingGap, 525);
});

test('calculateCashGuard passes through reserve sources without altering financial totals', () => {
  const defaulted = calculateCashGuard(rows, inputs, new Date('2026-08-29T12:00:00Z'));
  assert.equal(defaulted.variableEssentialsSource, 'estimate');
  assert.equal(defaulted.plannedOneOffsSource, 'estimate');

  const manual = calculateCashGuard(rows, {
    ...inputs,
    variableEssentialsSource: 'manual',
    plannedOneOffsSource: 'manual',
  }, new Date('2026-08-29T12:00:00Z'));
  assert.equal(manual.variableEssentialsSource, 'manual');
  assert.equal(manual.plannedOneOffsSource, 'manual');
  assert.equal(manual.safeToSpend, defaulted.safeToSpend, 'source tagging must not change the calculated amounts');
});

test('estimateReserveRecalculation derives a deterministic estimate from income received', () => {
  const estimate = estimateReserveRecalculation({ payPeriods: inputs.payPeriods });
  assert.equal(estimate.variableEssentialsReserve, 120);
  assert.equal(estimate.plannedOneOffsReserve, 40);
});

test('estimateReserveRecalculation tolerates missing pay periods', () => {
  const estimate = estimateReserveRecalculation({});
  assert.equal(estimate.variableEssentialsReserve, 0);
  assert.equal(estimate.plannedOneOffsReserve, 0);
});
