import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveBillStatus, enrichBills, findLastPayment } from '../src/bills.js';

const asOf = new Date('2026-07-31T18:00:00Z');

test('past-due bills override a persisted new status', () => {
  assert.equal(deriveBillStatus({ nextDue: '2026-07-15', status: 'new' }, { asOf }), 'overdue');
  assert.equal(deriveBillStatus({ nextDue: '2026-07-26', status: 'new' }, { asOf }), 'overdue');
});

test('a bill is not overdue until the day after its due date', () => {
  assert.equal(deriveBillStatus({ nextDue: '2026-07-31' }, { asOf }), 'due-soon');
  assert.equal(deriveBillStatus({ nextDue: '2026-08-01' }, { asOf }), 'due-soon');
});

test('a payment for the current cycle marks the bill paid', () => {
  const bill = { id: 7, nextDue: '2026-07-15', status: 'new' };
  const lastPayment = { billId: 7, date: '2026-07-15' };

  assert.equal(deriveBillStatus(bill, { asOf, lastPayment }), 'paid');
});

test('latest imported payment is found by id or normalized payee', () => {
  const bill = { id: 7, payee: 'Missouri Dep of Rev' };
  const payments = [
    { billId: 7, date: '2026-05-26', amount: 147.13 },
    { payee: '  MISSOURI DEP OF REV ', date: '2026-06-26', amount: 147.13 },
  ];

  assert.equal(findLastPayment(bill, payments).date, '2026-06-26');
});

test('overdue bills without imported payments keep an empty last-paid date', () => {
  const bills = [
    { id: 'irs', payee: 'IRS installment', nextDue: '2026-07-15', status: 'new' },
    { id: 'dor', payee: 'Missouri Dept of Rev', nextDue: '2026-07-26', status: 'new' },
  ];

  assert.deepEqual(
    enrichBills(bills, [], { asOf }).map(({ status, lastPaid }) => ({ status, lastPaid })),
    [
      { status: 'overdue', lastPaid: null },
      { status: 'overdue', lastPaid: null },
    ],
  );
});

test('invalid dates fail loudly instead of silently changing status', () => {
  assert.throws(() => deriveBillStatus({ nextDue: 'not-a-date' }, { asOf }), /Invalid date/);
});
