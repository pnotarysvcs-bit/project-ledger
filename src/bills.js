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
export function findLastPayment(bill, payments = [], { asOf = new Date() } = {}) {
  const today = dateOnly(asOf);

  return payments
    .filter((payment) => paymentBelongsToBill(payment, bill)
      && payment.date
      && (!payment.postOn || dateOnly(payment.postOn) <= today))
    .sort((left, right) => dateOnly(right.date) - dateOnly(left.date))[0] ?? null;
}

function findSubmittedPaymentAwaitingRollover(bill, payments = [], asOf = new Date()) {
  const today = dateOnly(asOf);

  return payments.find((payment) => paymentBelongsToBill(payment, bill)
    && payment.date
    && payment.postOn
    && dateOnly(payment.postOn) > today) ?? null;
}

/**
 * Derive status from the due date rather than trusting the persisted "new"
 * value. A bill is overdue beginning on the calendar day after its due date.
 *
 * Statuses follow the managed_bill_status enum. "submitted" means a payment
 * has been sent but has not yet posted; it is currently treated as settled by
 * the budget totals, which is a deliberate choice and not yet confirmed
 * against how bill_payments.actual_amount is filled in.
 */
export function deriveBillStatus(bill, {
  asOf = new Date(),
  lastPayment = null,
  submittedPayment = null,
} = {}) {
  const dueDate = dateOnly(bill.nextDue);
  const today = dateOnly(asOf);
  const paidDate = dateOnly(lastPayment?.date ?? bill.lastPaid);

  if (bill.inactive) return 'inactive';
  if (!dueDate) return bill.status ?? 'new';
  if (submittedPayment) return 'submitted';

  if (paidDate && paidDate >= dueDate) return 'paid';
  if (dueDate < today) return 'overdue';

  const daysUntilDue = Math.round((dueDate - today) / DAY_IN_MS);
  if (daysUntilDue <= 7) return 'due-soon';
  return bill.status === 'overdue' ? 'upcoming' : (bill.status ?? 'new');
}

/** Add statement payment data and a current status to every bill row. */
export function enrichBills(bills, payments = [], options = {}) {
  return bills.map((bill) => {
    const lastPayment = findLastPayment(bill, payments, options);
    const submittedPayment = findSubmittedPaymentAwaitingRollover(bill, payments, options.asOf);
    const lastPaid = lastPayment?.date ?? bill.lastPaid ?? null;

    return {
      ...bill,
      lastPaid,
      status: deriveBillStatus(bill, { ...options, lastPayment, submittedPayment }),
    };
  });
}
