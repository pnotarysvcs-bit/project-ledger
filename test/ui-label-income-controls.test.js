import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const billsPage = await readFile(new URL('../app/page.js', import.meta.url), 'utf8');
const dashboardPage = await readFile(new URL('../app/dashboard/page.js', import.meta.url), 'utf8');
const incomeCard = await readFile(new URL('../app/dashboard/monthly-income-card.js', import.meta.url), 'utf8');

test('Bills workspace uses Due Date instead of Next Due in user-facing labels', () => {
  assert.doesNotMatch(billsPage, />Next Due</);
  assert.doesNotMatch(billsPage, /aria-label="Next Due"/);
  assert.match(billsPage, /<label>Due Date<input name="nextDue"/);
  assert.match(billsPage, /<label>Due Date<input name="f_due"/);
  assert.match(billsPage, /<th>Due Date<\/th>/);
  assert.match(billsPage, /aria-label="Due Date" name="nextDue"/);
});

test('Monthly Income remains directly editable and preserves the current saved amount in the field', () => {
  assert.match(incomeCard, /<button type="submit">Save<\/button>/);
  assert.match(incomeCard, /defaultValue=\{income \?\? 0\}/);
  assert.doesNotMatch(incomeCard, /readOnly=/);
  assert.doesNotMatch(incomeCard, />Edit<\/a>/);
  assert.doesNotMatch(incomeCard, />Save Income<\/button>/);
});

test('Dashboard still renders Monthly Income for the selected month', () => {
  assert.match(dashboardPage, /<MonthlyIncomeCard selectedMonth=\{selectedMonth\} searchParams=\{params\} \/>/);
});
