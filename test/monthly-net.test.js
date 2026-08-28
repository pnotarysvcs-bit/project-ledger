import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { calculateMonthlyNet } from '../src/monthly-net.js';

const income = { payrollIncome: 3000, notarySupport: 500, otherFunding: 200, householdFunding: 3700 };
const summary = { total: 2800, totalPaid: 1200, remaining: 1400, overdue: 200, incompleteCount: 0 };

test('net is household income minus monthly expenses', () => {
  const net = calculateMonthlyNet(income, summary);

  assert.equal(net.income, 3700);
  assert.equal(net.expenses, 2800);
  assert.equal(net.net, 900);
  assert.equal(net.covered, true);
  assert.equal(net.shortfall, 0);
  assert.equal(net.stillToPay, 1600, 'remaining plus overdue');
  assert.equal(net.leftAfterBillsPaid, 2500);
});

test('net reports a shortfall when bills exceed income', () => {
  const net = calculateMonthlyNet({ householdFunding: 1500 }, { total: 2800 });

  assert.equal(net.net, -1300);
  assert.equal(net.covered, false);
  assert.equal(net.shortfall, 1300);
});

test('missing or invalid figures are treated as zero', () => {
  const net = calculateMonthlyNet({}, {});

  assert.equal(net.income, 0);
  assert.equal(net.expenses, 0);
  assert.equal(net.net, 0);
  assert.equal(net.covered, true);
});

test('dashboard renders the income vs expenses card', async () => {
  const page = await readFile(new URL('../app/dashboard/page.js', import.meta.url), 'utf8');
  assert.match(page, /import IncomeExpensesCard from '\.\/income-expenses-card\.js';/);
  assert.match(page, /<IncomeExpensesCard summary=\{summary\} selectedMonth=\{normalizedMonth\} \/>/);

  const card = await readFile(new URL('../app/dashboard/income-expenses-card.js', import.meta.url), 'utf8');
  assert.match(card, /Income minus expenses/);
  assert.match(card, /Household Income/);
  assert.match(card, /Monthly Expenses/);
});
