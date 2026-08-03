import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyAccount,
  getBillsMaster,
  groupByType,
  summarizeBills,
} from '../src/bills-master.js';

test('TCU bills are personal and TCUB bills are business', () => {
  assert.equal(classifyAccount('TCU'), 'Personal');
  assert.equal(classifyAccount('TCUB'), 'Business');
  assert.equal(classifyAccount('tcub'), 'Business');
  assert.equal(classifyAccount(' TCU '), 'Personal');
});

test('an unknown account keeps its declared type instead of being reclassified', () => {
  assert.equal(classifyAccount('CHASE', 'Business'), 'Business');
  assert.equal(classifyAccount(null, 'Personal'), 'Personal');
  assert.equal(classifyAccount('CHASE'), null);
});

test('Bills Master classifies every canonical row from its account', () => {
  const rows = getBillsMaster({ asOf: '2026-08-03' });

  assert.ok(rows.length > 0);
  for (const bill of rows) {
    assert.equal(bill.type, classifyAccount(bill.account));
    assert.ok(bill.status, `${bill.payee} should have a derived status`);
  }
});

test('the Affirm payment rolls over to last-paid once it posts', () => {
  const beforePosting = getBillsMaster({ asOf: '2026-07-31' })
    .find(({ id }) => id === 'affirm');
  const afterPosting = getBillsMaster({ asOf: '2026-08-03' })
    .find(({ id }) => id === 'affirm');

  assert.equal(beforePosting.status, 'completed');
  assert.equal(beforePosting.lastPaid, '2026-06-06');

  assert.equal(afterPosting.lastPaid, '2026-07-06');
  assert.equal(afterPosting.status, 'paid');
});

test('paid and remaining always add up to the total', () => {
  const rows = [
    { id: 'a', amount: 100, status: 'paid' },
    { id: 'b', amount: 50, status: 'overdue' },
    { id: 'c', amount: 25, status: 'due-soon' },
    { id: 'd', amount: 10, status: 'completed' },
  ];

  const summary = summarizeBills(rows);

  assert.equal(summary.total, 185);
  assert.equal(summary.paid, 110);
  assert.equal(summary.remaining, 75);
  assert.equal(summary.paid + summary.remaining, summary.total);
});

test('inactive bills are excluded from every summary metric', () => {
  const rows = [
    { id: 'a', amount: 100, status: 'paid' },
    { id: 'archived', amount: 999, status: 'inactive' },
  ];

  const summary = summarizeBills(rows);

  assert.equal(summary.activeCount, 1);
  assert.equal(summary.total, 100);
  assert.equal(summary.remaining, 0);
});

test('due-soon and overdue are counted separately', () => {
  const rows = [
    { id: 'a', amount: 40, status: 'due-soon' },
    { id: 'b', amount: 60, status: 'overdue' },
  ];

  const summary = summarizeBills(rows);

  assert.equal(summary.dueSoon, 40);
  assert.equal(summary.dueSoonCount, 1);
  assert.equal(summary.overdue, 60);
  assert.equal(summary.overdueCount, 1);
});

test('rows group by ledger type without losing any bill', () => {
  const rows = [
    { id: 'a', type: 'Personal', amount: 1 },
    { id: 'b', type: 'Business', amount: 2 },
    { id: 'c', type: 'Personal', amount: 3 },
  ];

  const groups = groupByType(rows);

  assert.deepEqual(groups.map(({ type }) => type), ['Personal', 'Business']);
  assert.deepEqual(groups[0].bills.map(({ id }) => id), ['a', 'c']);
  assert.deepEqual(groups[1].bills.map(({ id }) => id), ['b']);
});
