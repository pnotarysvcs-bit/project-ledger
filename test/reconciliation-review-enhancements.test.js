import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractTransactions } from '../src/statement-reconciliation.js';
import { calculateOccurrenceAmounts, classifyBillStatus } from '../src/bills/domain.js';
import { recordPayment } from '../src/bills/service.js';

const pageSource = readFileSync(new URL('../app/reconcile/page.js', import.meta.url), 'utf8');

test('dining and food transactions are excluded before reconciliation review', () => {
  const rows = extractTransactions(`
Apr 2 Apr 3 STARBUCKS STORE 123 $12.45
Apr 3 Apr 4 CHIPOTLE ONLINE $20.10
Apr 4 Apr 5 DOORDASH*RESTAURANT $31.22
Apr 5 Apr 6 NETFLIX.COM $19.99
`, 2026, 4);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].rawDescription, 'NETFLIX.COM');
  assert.equal(rows[0].amount, 19.99);
});

test('partial payment remains Partial against the bill budget when Actual is blank', () => {
  const amounts = calculateOccurrenceAmounts({
    budget: 100,
    actualAmount: null,
    payments: [{ amount: 11.90 }],
  });

  assert.equal(amounts.effectiveAmount, 100);
  assert.equal(amounts.submitted, 11.90);
  assert.equal(amounts.remaining, 88.10);
  assert.equal(classifyBillStatus({ ...amounts, dueDate: '2026-08-02' }, new Date('2026-08-13T12:00:00Z')), 'partial');
});

test('recording a partial payment does not write Actual Bill Amount', async () => {
  let addedPayment = null;
  let occurrenceUpdated = false;
  const repository = {
    getOccurrence: async () => ({ id: 'occurrence-1' }),
    addPayment: async (payload) => {
      addedPayment = payload;
      return { id: 'payment-1' };
    },
    updateOccurrence: async () => {
      occurrenceUpdated = true;
    },
  };

  await recordPayment({
    id: 'bill-1',
    occurrenceId: 'occurrence-1',
    month: '2026-08',
    dueDate: '2026-08-02',
    amount: '11.90',
    paymentDate: '2026-08-13',
    fundingAccount: 'TCUB',
    notes: '',
  }, repository);

  assert.equal(occurrenceUpdated, false);
  assert.equal(addedPayment.amount, 11.90);
  assert.equal(Object.hasOwn(addedPayment, 'actual_amount'), false);
});

test('reconciliation review supports status filters and inline new bill creation', () => {
  assert.match(pageSource, /name="matchStatus"/);
  assert.match(pageSource, /value="Matched">Matched/);
  assert.match(pageSource, /value="Unmatched">Unmatched/);
  assert.match(pageSource, /value="needs-review">Needs Review/);
  assert.match(pageSource, /REVIEW_STATUSES\.includes\(row\.match_status\).*decision.*approve-new/s);
  assert.match(pageSource, /Add New Bill &amp; Match/);
});

test('Master Bill options are alphabetized and Undo has a prominent dedicated style hook', () => {
  assert.match(pageSource, /String\(a\.payee \?\? ''\)\.localeCompare\(String\(b\.payee \?\? ''\)/);
  assert.match(pageSource, /className="undo-prominent">Undo Last Action/);
});
