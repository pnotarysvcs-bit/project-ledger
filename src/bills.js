const DAY_IN_MS = 24 * 60 * 60 * 1000;

function dateOnly(value) {
  if (!value) return null;

  const date = value instanceof Date
    ? new Date(value.getTime())
    : new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Invalid date: ${value}`);
  }

  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
}

function paymentBelongsToBill(payment, bill) {
  if (payment.billId != null && bill.id != null) {
    return String(payment.billId) === String(bill.id);
  }

  return payment.payee?.trim().toLocaleLowerCase()
    === bill.payee?.trim().toLocaleLowerCase();
}

/**
 * Return the latest imported payment for a bill.
 *
 * A payment linked by bill id takes precedence; payee matching supports older
 * imported transactions which pre-date stable bill ids.
 */
export function findLastPayment(bill, payments = []) {
  return payments
    .filter((payment) => paymentBelongsToBill(payment, bill) && payment.date)
    .sort((left, right) => dateOnly(right.date) - dateOnly(left.date))[0] ?? null;
}

/**
 * Derive status from the due date rather than trusting the persisted "new"
 * value. A bill is overdue beginning on the calendar day after its due date.
 */
export function deriveBillStatus(bill, { asOf = new Date(), lastPayment = null } = {}) {
  const dueDate = dateOnly(bill.nextDue);
  const today = dateOnly(asOf);
  const paidDate = dateOnly(lastPayment?.date ?? bill.lastPaid);
  const paidThrough = dateOnly(bill.paidThrough);

  if (bill.inactive) return 'inactive';
  if (!dueDate) return bill.status ?? 'new';

  // Some creditors post a payment before the cycle's nominal due date. In
  // that case paidThrough identifies the cycle settled by the payment.
  if ((paidThrough && paidThrough >= dueDate) || (paidDate && paidDate >= dueDate)) return 'paid';
  if (dueDate < today) return 'overdue';

  const daysUntilDue = Math.round((dueDate - today) / DAY_IN_MS);
  if (daysUntilDue <= 7) return 'due-soon';
  return bill.status === 'overdue' ? 'upcoming' : (bill.status ?? 'new');
}

/** Add statement payment data and a current status to every bill row. */
export function enrichBills(bills, payments = [], options = {}) {
  return bills.map((bill) => {
    const lastPayment = findLastPayment(bill, payments);
    const lastPaid = lastPayment?.date ?? bill.lastPaid ?? null;

    return {
      ...bill,
      lastPaid,
      status: deriveBillStatus(bill, { ...options, lastPayment }),
    };
  });
}
