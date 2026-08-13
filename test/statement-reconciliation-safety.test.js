import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractTransactions, normalizePayee, planStatementPayments, reconcileTransactions } from '../src/statement-reconciliation.js';

const reconcilePage = await readFile(new URL('../app/reconcile/page.js', import.meta.url), 'utf8');

test('parser uses transaction amount instead of trailing running balance', () => {
  const [row] = extractTransactions('06/09 InvideoInc $19.00 $620.00', 2026);
  assert.equal(row.rawDescription, 'InvideoInc');
  assert.equal(row.amount, 19);
});

test('extreme merchant amount mismatch requires review instead of auto-posting', () => {
  const bills = [{ id: 'inv', occurrenceId: 'inv-june', payee: 'InvideoInc', budget: 19, nextDue: '2026-06-09' }];
  const [row] = reconcileTransactions([{ date: '2026-06-09', rawDescription: 'InvideoInc', normalizedPayee: normalizePayee('InvideoInc'), amount: 620 }], bills);
  assert.equal(row.status, 'Amount Variance');
  assert.equal(row.billId, 'inv');
  assert.match(row.reason, /explicit review/i);
});

test('amount variance never enters automatic payment plan', () => {
  const rows = [{ id: 's1', bill_id: 'b1', occurrence_id: 'o1', amount: 620, transaction_date: '2026-06-09', match_status: 'Amount Variance', payment_id: null }];
  assert.deepEqual(planStatementPayments(rows, []), []);
});

test('cash app and burger king remain non-bill review items', () => {
  const rows = reconcileTransactions([
    { date: '2026-06-21', rawDescription: 'CashApp*YorkFields', normalizedPayee: normalizePayee('CashApp*YorkFields'), amount: 175 },
    { date: '2026-06-21', rawDescription: 'BurgerKing#4671', normalizedPayee: normalizePayee('BurgerKing#4671'), amount: 14.31 },
  ], []);
  assert.deepEqual(rows.map((row) => row.status), ['Unmatched', 'Unmatched']);
});

test('reconciliation page exposes editable amount, bill and variance approval controls', () => {
  assert.match(reconcilePage, /name="correctedAmount"/);
  assert.match(reconcilePage, /name="billOccurrence"/);
  assert.match(reconcilePage, /name="approveVariance"/);
  assert.match(reconcilePage, /Save Review/);
});

test('completion treats amount variance as unresolved and redirects instead of throwing a server error', () => {
  assert.match(reconcilePage, /\['NEW', 'Unmatched', 'Amount Variance'\]/);
  assert.match(reconcilePage, /notice=Resolve/);
});
