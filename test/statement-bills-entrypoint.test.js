import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const selector = await readFile(new URL('../app/bills-month-selector.js', import.meta.url), 'utf8');
const route = await readFile(new URL('../app/api/statements/route.js', import.meta.url), 'utf8');

test('Bills month control exposes an existing statement and reconciliation entry point', () => {
  assert.match(selector, /Statement: \{statement\.source_name\}/);
  assert.match(selector, /Continue Reconciliation/);
  assert.match(selector, /\/reconcile\?import=/);
});

test('statement status API resolves the latest import for the selected month', () => {
  assert.match(route, /ledger_statement_imports\?select=/);
  assert.match(route, /effective_month=eq\.\$\{month\}-01/);
  assert.match(route, /ledger_statement_transactions\?select=/);
});
