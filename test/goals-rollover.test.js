import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyEquivalent, recommendNextPayoff } from '../src/goals.js';

test('monthlyEquivalent normalizes recurring actual payments', () => {
  assert.equal(monthlyEquivalent({ actualAmount: 400, frequency: 'monthly' }), 400);
  assert.equal(monthlyEquivalent({ actualAmount: 1200, frequency: 'quarterly' }), 400);
  assert.equal(monthlyEquivalent({ actualAmount: 1200, frequency: 'annual' }), 100);
  assert.equal(monthlyEquivalent({ actualAmount: 500, frequency: 'one-time' }), 0);
});

test('payoff recommendation favors the payoff-like bill that frees the most monthly cash', () => {
  const result = recommendNextPayoff([
    { id: 'closed', payee: 'Bobs Furniture', category: 'Financing', actualAmount: 425, frequency: 'monthly' },
    { id: 'utility', payee: 'Electric Utility', category: 'Utilities', actualAmount: 190, frequency: 'monthly' },
    { id: 'affirm', payee: 'Affirm', category: 'Debt', actualAmount: 482.37, frequency: 'monthly' },
    { id: 'card', payee: 'Mercury Card', category: 'Credit Card', actualAmount: 132, frequency: 'monthly' },
  ], 'closed');

  assert.equal(result.id, 'affirm');
  assert.equal(result.monthlyEquivalent, 482.37);
});

test('essential recurring bills are not recommended as payoff targets', () => {
  const result = recommendNextPayoff([
    { id: 'rent', payee: 'Rent', category: 'Housing', actualAmount: 2200, frequency: 'monthly' },
    { id: 'insurance', payee: 'Liberty Mutual Insurance', category: 'Insurance', actualAmount: 296, frequency: 'monthly' },
  ]);
  assert.equal(result, null);
});
