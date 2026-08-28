import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const billsPage = await readFile(new URL('../app/page.js', import.meta.url), 'utf8');
const incomePage = await readFile(new URL('../app/income/page.js', import.meta.url), 'utf8');
const incomeCard = await readFile(new URL('../app/dashboard/monthly-income-card.js', import.meta.url), 'utf8');

test('Bills workspace uses Due Date instead of Next Due in user-facing labels', () => {
  assert.doesNotMatch(billsPage, />Next Due</);
  assert.doesNotMatch(billsPage, /aria-label="Next Due"/);
  assert.match(billsPage, /<label>Due Date<input name="nextDue"/);
  assert.match(billsPage, /<label>Due Date<input name="f_due"/);
  assert.match(billsPage, /<th>Due Date<\/th>/);
  assert.match(billsPage, /aria-label="Due Date" name="nextDue"/);
});

test('Income accepts a new paycheck without replacing the recorded monthly total', () => {
  assert.match(incomeCard, />Add a paycheck<\/span>/);
  assert.match(incomeCard, /<button type="submit">Add Paycheck<\/button>/);
  assert.match(incomeCard, /defaultValue=\{0\}/);
  assert.match(incomeCard, /await addMonthlyIncome\(month, income\)/);
  assert.doesNotMatch(incomeCard, /defaultValue=\{income \?\? 0\}/);
});

test('Income page renders Monthly Income for the selected month', () => {
  assert.match(incomePage, /<MonthlyIncomeCard selectedMonth=\{selectedMonth\} searchParams=\{params\} \/>/);
});
