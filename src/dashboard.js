/**
 * Dashboard derivations.
 *
 * Every figure here is computed from the same Bills Master rows the Bills page
 * renders, so the two pages cannot disagree. Widgets that need data the ledger
 * does not hold yet draw on src/sample-data.js instead, which is named to make
 * that obvious at the import site.
 */

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// These two sets must stay disjoint: the overview buckets are meant to be
// exhaustive over the month, so a status in both would be counted twice and
// the ring would overrun. 'submitted' counts as settled, not pending.
const PAID_STATUSES = new Set(['paid', 'submitted']);
const PENDING_STATUSES = new Set(['due-soon', 'new']);

function dateOnly(value) {
  const date = value instanceof Date
    ? new Date(value.getTime())
    : new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Invalid date: ${value}`);
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function monthKey(value) {
  const date = dateOnly(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function sumAmounts(bills) {
  return bills.reduce((total, bill) => total + (bill.amount ?? 0), 0);
}

const ARCHIVED_STATUSES = new Set(['inactive', 'archived']);
const activeOnly = (rows) => rows.filter(({ status }) => !ARCHIVED_STATUSES.has(status));

/** Bills whose next due date falls in the asOf month. */
export function billsForMonth(rows = [], { asOf = new Date() } = {}) {
  const current = monthKey(asOf);
  return activeOnly(rows).filter((bill) => bill.nextDue && monthKey(bill.nextDue) === current);
}

/**
 * The five headline figures.
 *
 * Budget is the month's committed total; paid and remaining partition it, so
 * the three tiles always reconcile. Overdue is counted across all active bills
 * rather than the month alone, because an arrear carried from an earlier month
 * is still money owed today.
 */
export function getMonthSummary(rows = [], { asOf = new Date() } = {}) {
  const active = activeOnly(rows);
  const month = billsForMonth(rows, { asOf });

  const paidBills = month.filter(({ status }) => PAID_STATUSES.has(status));
  const remainingBills = month.filter(({ status }) => !PAID_STATUSES.has(status));
  const overdueBills = active.filter(({ status }) => status === 'overdue');

  const budget = sumAmounts(month);
  const paid = sumAmounts(paidBills);

  return {
    budget,
    paid,
    paidCount: paidBills.length,
    remaining: budget - paid,
    remainingCount: remainingBills.length,
    overdue: sumAmounts(overdueBills),
    overdueCount: overdueBills.length,
    activeCount: active.length,
    percentOfBudget: budget === 0 ? 0 : Math.round((paid / budget) * 100),
  };
}

/** Unpaid bills falling due within the next `days`, soonest first. */
export function getDueSoon(rows = [], { asOf = new Date(), days = 7 } = {}) {
  const today = dateOnly(asOf);
  const horizon = new Date(today.getTime() + days * DAY_IN_MS);

  return activeOnly(rows)
    .filter((bill) => bill.nextDue
      && !PAID_STATUSES.has(bill.status)
      && dateOnly(bill.nextDue) >= today
      && dateOnly(bill.nextDue) <= horizon)
    .sort((left, right) => dateOnly(left.nextDue) - dateOnly(right.nextDue));
}

/**
 * The month split into the four buckets the overview ring shows.
 *
 * Buckets are exhaustive over the month's bills so the ring always closes.
 */
export function getStatusBreakdown(rows = [], { asOf = new Date() } = {}) {
  const month = billsForMonth(rows, { asOf });

  const buckets = [
    { key: 'paid', label: 'Paid (Matched)', match: (s) => PAID_STATUSES.has(s) },
    { key: 'pending', label: 'Pending', match: (s) => PENDING_STATUSES.has(s) },
    { key: 'overdue', label: 'Overdue', match: (s) => s === 'overdue' },
    { key: 'future', label: 'Future', match: (s) => s === 'upcoming' },
  ];

  return buckets.map(({ key, label, match }) => {
    const bills = month.filter(({ status }) => match(status));
    return { key, label, count: bills.length, amount: sumAmounts(bills) };
  });
}

/**
 * Recent payment activity, newest first.
 *
 * Derived from the last-paid date each bill carries, so it reflects real
 * imported statement payments rather than a separate activity log.
 */
export function getRecentActivity(rows = [], { limit = 4 } = {}) {
  const labels = {
    paid: 'Payment Matched',
    submitted: 'Payment Submitted',
    overdue: 'Payment Overdue',
  };

  return activeOnly(rows)
    .filter((bill) => bill.lastPaid)
    .sort((left, right) => dateOnly(right.lastPaid) - dateOnly(left.lastPaid))
    .slice(0, limit)
    .map((bill) => ({
      id: bill.id,
      label: labels[bill.status] ?? 'Payment Pending',
      tone: PAID_STATUSES.has(bill.status) ? 'good' : (bill.status === 'overdue' ? 'bad' : 'warn'),
      payee: bill.payee,
      date: bill.lastPaid,
      amount: bill.amount,
    }));
}

/** Arc lengths for a donut ring, as [dasharray, dashoffset] pairs. */
export function toRingSegments(breakdown = [], circumference = 100) {
  let consumed = 0;
  const total = breakdown.reduce((sum, { amount }) => sum + amount, 0);

  return breakdown.map((bucket) => {
    const fraction = total === 0 ? 0 : bucket.amount / total;
    const length = fraction * circumference;
    const segment = { ...bucket, length, offset: consumed, fraction };
    consumed += length;
    return segment;
  });
}
