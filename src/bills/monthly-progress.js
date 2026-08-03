const PAID_STATUSES = new Set(['paid', 'completed']);

function monthKey(value) {
  const date = value instanceof Date
    ? new Date(value.getTime())
    : new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Invalid date: ${value}`);
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function sumAmounts(bills) {
  return bills.reduce((total, bill) => total + (bill.amount ?? 0), 0);
}

/**
 * Measure how far through the current month's bills the ledger has got.
 *
 * Only bills due within the `asOf` month count toward the bar. An overdue bill
 * carried in from an earlier month is deliberately excluded: it would otherwise
 * make the current month look permanently unfinished.
 */
export function calculateMonthlyProgress(rows = [], { asOf = new Date() } = {}) {
  const currentMonth = monthKey(asOf);

  const thisMonth = rows.filter((bill) => bill.status !== 'inactive'
    && bill.nextDue
    && monthKey(bill.nextDue) === currentMonth);

  const paidBills = thisMonth.filter(({ status }) => PAID_STATUSES.has(status));

  const total = sumAmounts(thisMonth);
  const paid = sumAmounts(paidBills);

  return {
    month: currentMonth,
    billCount: thisMonth.length,
    paidCount: paidBills.length,
    total,
    paid,
    remaining: total - paid,
    // An empty month is complete, not stalled at zero.
    ratio: total === 0 ? 1 : paid / total,
    percent: total === 0 ? 100 : Math.round((paid / total) * 100),
  };
}
