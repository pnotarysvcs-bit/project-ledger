import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { calculateMonthlyNet } from '../src/monthly-net.js';

const income = { paychecks: 3200, notarySupport: 500, totalIncome: 3700 };
const summary = { total: 2800, totalPaid: 1200, remaining: 1400, overdue: 200, overdueCarryForward: 200, incompleteCount: 0 };

test('net is household income minus monthly expenses', () => {
  const net = calculateMonthlyNet(income, summary);

  assert.equal(net.income, 3700);
  assert.equal(net.expenses, 2800);
  assert.equal(net.net, 900);
  assert.equal(net.covered, true);
  assert.equal(net.shortfall, 0);
  assert.equal(net.stillToPay, 1600, 'remaining plus prior-month carry-forward');
  assert.equal(net.leftAfterBillsPaid, 2500);
});

test('net reports a shortfall when bills exceed income', () => {
  const net = calculateMonthlyNet({ totalIncome: 1500 }, { total: 2800 });

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
  assert.match(card, /Paychecks \{money\.format\(net\.paychecks\)\}/);
  assert.match(card, /Monthly Expenses/);
});

test('the income card renders on the dashboard, pay period, and bills pages', async () => {
  const pages = {
    dashboard: '../app/dashboard/page.js',
    'pay period': '../app/pay-period/page.js',
    bills: '../app/page.js',
  };

  for (const [name, path] of Object.entries(pages)) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /import IncomeExpensesCard from/, `${name} imports the income card`);
    assert.match(source, /<IncomeExpensesCard summary=\{/, `${name} renders the income card`);
  }
});

test('a current overdue balance is not counted twice in still to pay', () => {
  // summarizeLedgerBills puts a current overdue bill in both remaining and
  // overdue; only prior-month carry-forward is additional.
  const net = calculateMonthlyNet(
    { totalIncome: 5000 },
    { total: 2000, remaining: 800, overdue: 500, overdueCarryForward: 200 },
  );

  assert.equal(net.stillToPay, 1000, '800 remaining + 200 carried forward, not + 500');
});
