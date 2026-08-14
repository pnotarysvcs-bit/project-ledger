import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deletePayment } from '../src/bills/service.js';

const actionSource = readFileSync(new URL('../app/bills-actions.js', import.meta.url), 'utf8');
const enhancerSource = readFileSync(new URL('../app/bills-action-enhancer.js', import.meta.url), 'utf8');
const repositorySource = readFileSync(new URL('../src/bills/repository.js', import.meta.url), 'utf8');

test('legacy month payment can be reversed without an occurrence id', async () => {
  let removal = null;
  const repository = {
    async removePayment(input) { removal = input; },
  };

  const result = await deletePayment({
    id: 'bill-mo-dor',
    occurrenceId: '',
    paymentId: 'payment-july',
    month: '2026-07',
    reason: 'Undo Submitted',
  }, repository);

  assert.deepEqual(result, {
    billId: 'bill-mo-dor',
    occurrenceId: null,
    paymentId: 'payment-july',
  });
  assert.equal(removal.billId, 'bill-mo-dor');
  assert.equal(removal.paymentId, 'payment-july');
  assert.equal(removal.month, '2026-07');
});

test('submitted rows expose Undo Submitted and send an explicit server-action flag', () => {
  assert.match(enhancerSource, /button\.textContent = 'Undo Submitted'/);
  assert.match(enhancerSource, /flag\.name = 'undoSubmitted'/);
  assert.match(actionSource, /value\(data, 'undoSubmitted'\) === 'yes'/);
  assert.match(actionSource, /message: 'Submitted status undone\.'/);
});

test('payment removals use the audited reversal RPC rather than direct DELETE', () => {
  assert.match(repositorySource, /rpc\/project_ledger_reverse_payment/);
  assert.match(repositorySource, /p_payment_id: paymentId/);
  assert.match(repositorySource, /p_bill_id: billId/);
  assert.match(repositorySource, /p_payment_month: `\$\{month\}-01`/);
});
