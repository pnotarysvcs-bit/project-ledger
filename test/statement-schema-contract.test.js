import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const APP_PATH = new URL('../app/reconcile/page.js', import.meta.url);
const MIGRATION_PATH = new URL('../supabase/migrations/202608111200_create_statement_reconciliation.sql', import.meta.url);
const ALIGNMENT_PATH = new URL('../supabase/migrations/202608120315_align_statement_reconciliation_schema.sql', import.meta.url);

async function source(path) {
  return readFile(path, 'utf8');
}

test('statement upload queries only columns guaranteed by the reconciled schema', async () => {
  const app = await source(APP_PATH);
  const migration = await source(MIGRATION_PATH);
  const alignment = await source(ALIGNMENT_PATH);
  const schema = `${migration}\n${alignment}`;

  const importColumns = [
    'source_name', 'source_hash', 'period_start', 'period_end',
    'detected_month', 'override_month', 'effective_month',
    'warning_confirmed', 'status', 'completed_at',
  ];
  const transactionColumns = [
    'source_identity', 'transaction_date', 'raw_description',
    'normalized_payee', 'amount', 'expected_amount', 'match_status',
    'bill_id', 'occurrence_id', 'payment_id', 'confidence',
    'decision_note', 'resolved_at',
  ];

  for (const column of [...importColumns, ...transactionColumns]) {
    assert.match(schema, new RegExp(`\\b${column}\\b`), `schema must define ${column}`);
  }

  assert.match(app, /source_hash=eq\./, 'duplicate detection must use source_hash');
  assert.match(app, /select=id,effective_month/, 'duplicate lookup must return effective_month');
  assert.doesNotMatch(app, /statement_hash=eq\./, 'legacy statement_hash lookup must not return');
  assert.doesNotMatch(app, /confirmed_month/, 'legacy confirmed_month must not return to server action');
  assert.doesNotMatch(app, /transaction_key/, 'legacy transaction_key must not return to server action');
  assert.doesNotMatch(app, /matched_bill_id|matched_occurrence_id/, 'legacy match columns must not return');
});

test('statement status values used by the server action are accepted by the canonical schema', async () => {
  const app = await source(APP_PATH);
  const migration = await source(MIGRATION_PATH);

  for (const status of ['Matched', 'Amount Variance', 'NEW', 'Unmatched', 'Duplicate', 'Dismissed']) {
    assert.match(migration, new RegExp(status.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')), `migration must accept ${status}`);
  }

  assert.match(app, /\['NEW', 'Unmatched'\]/, 'completion must block unresolved NEW and Unmatched rows');
  assert.match(app, /match_status: 'Dismissed'/, 'dismiss action must use canonical Dismissed status');
});
