import { enrichBills } from './bills.js';

/**
 * Bills Master — the canonical source of truth for bill and payment records.
 *
 * Nothing else in the app may declare bill data. Views read through
 * `getBillsMaster` so that status, classification, and totals are derived once
 * and cannot drift between the table and the summary tiles.
 */

const BILL_RECORDS = [
  { id: 'wci', payee: 'WCI of Missouri', frequency: 'Quarterly', account: 'TCU', amount: 101.76, lastPaid: '2026-06-07', nextDue: '2026-08-07' },
  { id: 'affirm', payee: 'Affirm', frequency: 'Monthly', account: 'TCU', amount: 64.52, lastPaid: '2026-06-06', nextDue: '2026-07-06' },
  { id: 'irs', payee: 'IRS installment', frequency: 'Monthly', account: 'TCU', amount: 238, nextDue: '2026-07-15' },
  { id: 'dor', payee: 'Missouri Dept of Rev', frequency: 'Monthly', account: 'TCU', amount: 147.13, nextDue: '2026-07-26' },
];

const PAYMENT_RECORDS = [
  // Affirm was completed in July. It becomes the last-paid payment in August.
  { billId: 'affirm', date: '2026-07-06', postOn: '2026-08-01', amount: 64.52 },
];

const ACCOUNT_TYPES = {
  TCUB: 'Business',
  TCU: 'Personal',
};

const PAID_STATUSES = new Set(['paid', 'completed']);

/**
 * Resolve a bill's ledger type from its funding account.
 *
 * TCUB is the business account and TCU the personal one. An unrecognised
 * account falls back to the record's declared type so that adding a new
 * account does not silently reclassify its bills.
 */
export function classifyAccount(account, declaredType = null) {
  if (account == null) return declaredType;
  return ACCOUNT_TYPES[String(account).trim().toUpperCase()] ?? declaredType;
}

function sumAmounts(bills) {
  return bills.reduce((total, bill) => total + (bill.amount ?? 0), 0);
}

/** Read the canonical bill rows, enriched with payments, status, and type. */
export function getBillsMaster({ asOf = new Date() } = {}) {
  return enrichBills(BILL_RECORDS, PAYMENT_RECORDS, { asOf })
    .map((bill) => ({
      ...bill,
      type: classifyAccount(bill.account, bill.type ?? null),
    }));
}

/** Group canonical rows by ledger type, preserving row order within a group. */
export function groupByType(rows) {
  const groups = new Map();

  for (const bill of rows) {
    const key = bill.type ?? 'Unclassified';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(bill);
  }

  return [...groups.entries()].map(([type, bills]) => ({ type, bills }));
}

/**
 * Derive the summary metrics from the same rows the table renders.
 *
 * Total, Paid, and Remaining are a closed set — Paid + Remaining always equals
 * Total — so the tiles cannot disagree with each other or with the table.
 */
export function summarizeBills(rows) {
  const active = rows.filter(({ status }) => status !== 'inactive');
  const paid = active.filter(({ status }) => PAID_STATUSES.has(status));
  const remaining = active.filter(({ status }) => !PAID_STATUSES.has(status));
  const dueSoon = active.filter(({ status }) => status === 'due-soon');
  const overdue = active.filter(({ status }) => status === 'overdue');

  return {
    activeCount: active.length,
    total: sumAmounts(active),
    paid: sumAmounts(paid),
    paidCount: paid.length,
    remaining: sumAmounts(remaining),
    remainingCount: remaining.length,
    dueSoon: sumAmounts(dueSoon),
    dueSoonCount: dueSoon.length,
    overdue: sumAmounts(overdue),
    overdueCount: overdue.length,
  };
}
