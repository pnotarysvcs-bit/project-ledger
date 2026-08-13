import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL('../supabase/migrations/202608130645_allow_audited_statement_provenance_links.sql', import.meta.url),
  'utf8',
);

test('historical statement provenance links are audited and narrowly scoped', () => {
  assert.match(migration, /create table if not exists public\.ledger_payment_provenance_audit/);
  assert.match(migration, /old\.statement_transaction_id is null/);
  assert.match(migration, /new\.statement_transaction_id is not null/);
  assert.match(migration, /to_jsonb\(old\) - 'statement_transaction_id' - 'updated_at'/);
  assert.match(migration, /insert into public\.ledger_payment_provenance_audit/);
  assert.match(migration, /Historical payment corrections require the audited correction workflow\./);
});
