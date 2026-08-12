import test from 'node:test';
import assert from 'node:assert/strict';
import { detectStatementPeriod, effectiveStatementMonth, extractTransactions, normalizePayee, planStatementPayments, reconcileTransactions, statementHash } from '../src/statement-reconciliation.js';

test('detects June 2026 printed statement period', () => assert.deepEqual(detectStatementPeriod('Statement Period 06/01/2026–06/30/2026'), { start: '2026-06-01', end: '2026-06-30', detectedMonth: '2026-06', confidence: 'high', spansMonths: false }));
test('requires confirmation for cross-month period and preserves override', () => { const period = detectStatementPeriod('05/28/2026 - 06/27/2026'); assert.equal(period.confidence, 'confirmation-required'); assert.equal(effectiveStatementMonth(period, '2026-05'), '2026-05'); });
test('rejects invalid month override', () => assert.throws(() => effectiveStatementMonth({}, 'June'), /YYYY-MM/));
test('normalizes transaction descriptions', () => assert.equal(normalizePayee('ACH AUTOPAY T-MOBILE #4412'), 't mobile'));
test('extracts debits and excludes credits', () => { const rows = extractTransactions('06/05 T-MOBILE AUTOPAY 120.00\n06/06 Deposit 500.00', 2026); assert.equal(rows.length, 1); assert.equal(rows[0].date, '2026-06-05'); });
test('matches exact payee and flags amount variance', () => { const bills = [{ id: 'b1', occurrenceId: 'o1', payee: 'T-Mobile', budget: 100, nextDue: '2026-06-05' }]; const [row] = reconcileTransactions([{ date: '2026-06-05', rawDescription: 'T-MOBILE AUTOPAY', normalizedPayee: 't mobile', amount: 120 }], bills); assert.equal(row.status, 'Amount Variance'); assert.equal(row.billId, 'b1'); });
test('proposes recurring unknown bill but excludes ordinary purchases', () => { const results = reconcileTransactions([{ date: '2026-06-05', rawDescription: 'NEW CREDIT PAYMENT', normalizedPayee: 'new credit', amount: 50 }, { date: '2026-06-06', rawDescription: 'STARBUCKS', normalizedPayee: 'starbucks', amount: 8 }], []); assert.deepEqual(results.map((r) => r.status), ['NEW', 'Unmatched']); });
test('hash is stable for duplicate detection', () => assert.equal(statementHash(Buffer.from('same')), statementHash(Buffer.from('same'))));

test('April submitted bill links the existing payment instead of creating a duplicate', () => {
  const rows = [{ id: 's1', bill_id: 'b1', occurrence_id: 'o1', amount: 100, transaction_date: '2026-04-10', match_status: 'Matched', payment_id: null }];
  const existing = [{ id: 'p1', bill_id: 'b1', occurrence_id: 'o1', amount: 100, payment_date: '2026-08-01' }];
  assert.deepEqual(planStatementPayments(rows, existing).map(({ action, paymentId }) => ({ action, paymentId })), [
    { action: 'link-existing', paymentId: 'p1' },
  ]);
});

test('April partial bill creates only the missing statement payment', () => {
  const rows = [
    { id: 's1', bill_id: 'b1', occurrence_id: 'o1', amount: 40, transaction_date: '2026-04-05', match_status: 'Matched', payment_id: null },
    { id: 's2', bill_id: 'b1', occurrence_id: 'o1', amount: 60, transaction_date: '2026-04-18', match_status: 'Matched', payment_id: null },
  ];
  const existing = [{ id: 'p1', bill_id: 'b1', occurrence_id: 'o1', amount: 40, payment_date: '2026-04-05' }];
  assert.deepEqual(planStatementPayments(rows, existing).map(({ row, action, paymentId }) => ({ id: row.id, action, paymentId: paymentId ?? null })), [
    { id: 's1', action: 'link-existing', paymentId: 'p1' },
    { id: 's2', action: 'create-payment', paymentId: null },
  ]);
});

test('split statement payments already represented by one submitted payment are not duplicated', () => {
  const rows = [
    { id: 's1', bill_id: 'b1', occurrence_id: 'o1', amount: 40, transaction_date: '2026-04-05', match_status: 'Matched', payment_id: null },
    { id: 's2', bill_id: 'b1', occurrence_id: 'o1', amount: 60, transaction_date: '2026-04-18', match_status: 'Matched', payment_id: null },
  ];
  const existing = [{ id: 'p1', bill_id: 'b1', occurrence_id: 'o1', amount: 100, payment_date: '2026-08-01' }];
  assert.deepEqual(planStatementPayments(rows, existing).map(({ action }) => action), ['covered-by-existing', 'covered-by-existing']);
});

test('already-linked payments are not reused for another statement row', () => {
  const rows = [
    { id: 's1', bill_id: 'b1', occurrence_id: 'o1', amount: 50, transaction_date: '2026-04-05', match_status: 'Matched', payment_id: 'p1' },
    { id: 's2', bill_id: 'b1', occurrence_id: 'o1', amount: 50, transaction_date: '2026-04-18', match_status: 'Matched', payment_id: null },
  ];
  const existing = [{ id: 'p1', bill_id: 'b1', occurrence_id: 'o1', amount: 50, payment_date: '2026-04-05' }];
  assert.deepEqual(planStatementPayments(rows, existing).map(({ action }) => action), ['create-payment']);
});
