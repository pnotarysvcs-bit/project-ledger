import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pageSource = await readFile(new URL('../app/page.js', import.meta.url), 'utf8');
const actionSource = await readFile(new URL('../app/bills-actions.js', import.meta.url), 'utf8');
const serviceSource = await readFile(new URL('../src/bills/service.js', import.meta.url), 'utf8');

test('Bills workspace binds Add, Edit, Payment, Submit, and Archive to the canonical action boundary', () => {
  assert.match(pageSource, />Add Bill<\/Link>/);
  assert.match(pageSource, /action=\{addBillAction\}/);
  assert.match(pageSource, /action=\{editBillAction\}/);
  assert.match(pageSource, /action=\{addPaymentAction\}/);
  assert.match(pageSource, /action=\{submitBillAction\}/);
  assert.match(pageSource, /action=\{archiveBillAction\}/);
  assert.match(pageSource, /formAction=\{removePaymentAction\}/);
});

test('Bills page no longer owns direct master or occurrence mutation logic', () => {
  assert.doesNotMatch(pageSource, /ledger_bills\?select=id/);
  assert.doesNotMatch(pageSource, /ledger_bill_months\?select=id/);
  assert.doesNotMatch(pageSource, /async function addBill\(data\)/);
  assert.doesNotMatch(pageSource, /async function editBill\(data\)/);
});

test('Edit remains available when occurrenceId is missing and the service materializes the occurrence', () => {
  assert.match(pageSource, /<Link className="button ghost" href=\{`\/\?month=\$\{selectedMonth\}.*&edit=/s);
  assert.doesNotMatch(pageSource, /className=\{`button ghost \$\{!bill\.occurrenceId \? 'disabled'/);
  assert.match(actionSource, /await updateBill\(/);
  assert.match(serviceSource, /if \(!occurrence\) \{/);
  assert.match(serviceSource, /await repository\.createOccurrence\(/);
  assert.match(serviceSource, /Bill occurrence creation was not confirmed by the database/);
});

test('Type, Account, and Status filters use exact matching', () => {
  assert.match(pageSource, /exact\(bill\.type, filters\.type\)/);
  assert.match(pageSource, /exact\(bill\.account, filters\.account\)/);
  assert.match(pageSource, /exact\(bill\.status, filters\.status\)/);
});
