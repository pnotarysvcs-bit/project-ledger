import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const billsPage = await readFile(new URL('../app/page.js', import.meta.url), 'utf8');
const reconcilePage = await readFile(new URL('../app/reconcile/page.js', import.meta.url), 'utf8');
const ledgerData = await readFile(new URL('../src/ledger-bills-data.js', import.meta.url), 'utf8');
const provenanceMigration = await readFile(new URL('../supabase/migrations/202608131150_allow_historical_statement_provenance.sql', import.meta.url), 'utf8');

test('Bills workspace shows Actual source as Statement or Manual from persisted provenance', () => {
  assert.match(billsPage, /function actualSource\(bill\)/);
  assert.match(billsPage, /payment\.statementTransactionId/);
  assert.match(billsPage, /Source: \{actualSource\(bill\)\}/);
  assert.match(ledgerData, /statementTransactionId: payment\.statement_transaction_id \?\? null/);
  assert.match(ledgerData, /statement_transaction_id&payment_month/);
});

test('statement reconciliation cannot complete with zero parsed transactions', () => {
  assert.match(reconcilePage, /if \(!rows\.length\) throw new Error\('This statement has no parsed transactions\. It cannot be marked completed\.'\)/);
});

test('statement-created payments preserve transaction provenance', () => {
  assert.match(reconcilePage, /statement_transaction_id: row\.id/);
  assert.match(reconcilePage, /Some matched statement transactions are not fully reconciled/);
  assert.match(reconcilePage, /A statement payment could not be confirmed/);
});

test('complete reconciliation keeps planned and newly created payment ids in separate scopes', () => {
  assert.match(reconcilePage, /for \(const \{ row, action, paymentId \} of actions\)/);
  assert.match(reconcilePage, /const createdPaymentId = payment\?\.\[0\]\?\.id/);
  assert.match(reconcilePage, /payment_id: createdPaymentId/);
  assert.doesNotMatch(reconcilePage, /const paymentId = payment\?\.\[0\]\?\.id/);
});

test('historical payment guard permits only first-time statement provenance attachment', () => {
  assert.match(provenanceMigration, /old\.statement_transaction_id is null/);
  assert.match(provenanceMigration, /new\.statement_transaction_id is not null/);
  for (const field of ['bill_id', 'occurrence_id', 'payment_month', 'payment_date', 'amount', 'funding_account', 'notes', 'allocation_provenance']) {
    assert.match(provenanceMigration, new RegExp(`new\\.${field} is not distinct from old\\.${field}`));
  }
  assert.match(provenanceMigration, /Historical payment corrections require the audited correction workflow/);
});