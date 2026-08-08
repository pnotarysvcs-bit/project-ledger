import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/page.js', import.meta.url), 'utf8');

test('Bills workspace renders an Add Bill action and persisted add workflow', () => {
  assert.match(source, />Add Bill<\/Link>/);
  assert.match(source, /async function addBill\(data\)/);
  assert.match(source, /ledger_bills\?select=id/);
  assert.match(source, /ledger_bill_months/);
});

test('Edit remains available when occurrenceId is missing', () => {
  assert.match(source, /<Link className="button ghost" href=\{`\/\?month=\$\{selectedMonth\}.*&edit=/s);
  assert.doesNotMatch(source, /className=\{`button ghost \$\{!bill\.occurrenceId \? 'disabled'/);
  assert.doesNotMatch(source, /if \(!id \|\| !occurrenceId\) throw new Error\('Bill occurrence is required\.'\)/);
});

test('Edit materializes a missing occurrence before saving', () => {
  assert.match(source, /if \(!occurrenceId\) \{/);
  assert.match(source, /method: 'POST'/);
  assert.match(source, /Bill occurrence creation was not confirmed by the database/);
});

test('Type, Account, and Status filters use exact matching', () => {
  assert.match(source, /exact\(bill\.type, filters\.type\)/);
  assert.match(source, /exact\(bill\.account, filters\.account\)/);
  assert.match(source, /exact\(bill\.status, filters\.status\)/);
});
