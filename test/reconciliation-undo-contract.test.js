import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('../app/reconcile/page.js', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../supabase/migrations/202608131615_create_reconciliation_action_audit.sql', import.meta.url), 'utf8');

test('statement confirmation redirects back to upload instead of throwing a digest', () => {
  assert.match(pageSource, /warningRequired && formData\.get\('confirmWarning'\) !== 'yes'/);
  assert.match(pageSource, /redirect\(`\/reconcile\?month=\$\{selectedMonth\}&notice=/);
  assert.doesNotMatch(pageSource, /requires confirmation before importing/);
});

test('statement transaction year resolution uses detected statement-end month', () => {
  assert.match(pageSource, /const anchorMonth = Number\(\(detection\.end/);
  assert.match(pageSource, /extractTransactions\(text, year, anchorMonth\)/);
});

test('eligible reconciliation review actions snapshot their before state', () => {
  assert.match(pageSource, /function reconciliationBeforeState/);
  assert.match(pageSource, /recordReconciliationAction\(transaction, importId, 'dismiss'\)/);
  assert.match(pageSource, /recordReconciliationAction\(transaction, importId, 'edit-review'\)/);
  assert.match(pageSource, /recordReconciliationAction\(transaction, importId, 'match-existing'\)/);
});

test('Undo Last Action restores the latest snapshot and marks the audit row reversed', () => {
  assert.match(pageSource, /async function undoLastReconciliationAction/);
  assert.match(pageSource, /order=created_at\.desc&limit=1/);
  assert.match(pageSource, /body: \{ reversed_at: new Date\(\)\.toISOString\(\) \}/);
  assert.match(pageSource, />Undo Last Action<\/button>/);
});

test('Undo is blocked after reconciliation completion or payment linkage', () => {
  assert.match(pageSource, /imported\.status === 'completed'/);
  assert.match(pageSource, /if \(transaction\.payment_id\)/);
});

test('undo audit schema is additive and retains prior state', () => {
  assert.match(migrationSource, /create table if not exists public\.ledger_reconciliation_actions/);
  assert.match(migrationSource, /before_state jsonb not null/);
  assert.match(migrationSource, /reversed_at timestamptz/);
});
