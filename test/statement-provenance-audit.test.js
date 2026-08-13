import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const billsPage = await readFile(new URL('../app/page.js', import.meta.url), 'utf8');
const reconcilePage = await readFile(new URL('../app/reconcile/page.js', import.meta.url), 'utf8');

test('Bills workspace shows Actual source as Statement or Manual', () => {
  assert.match(billsPage, /function actualSource\(bill\)/);
  assert.match(billsPage, /fundingAccount === 'Statement import'/);
  assert.match(billsPage, /Source: \{actualSource\(bill\)\}/);
});

test('statement reconciliation cannot complete with zero parsed transactions', () => {
  assert.match(reconcilePage, /if \(!rows\.length\) throw new Error\('This statement has no parsed transactions\. It cannot be marked completed\.'\)/);
});

test('statement-created payments preserve transaction provenance', () => {
  assert.match(reconcilePage, /statement_transaction_id: row\.id/);
  assert.match(reconcilePage, /Some matched statement transactions are not fully reconciled/);
  assert.match(reconcilePage, /A statement payment could not be confirmed/);
});
