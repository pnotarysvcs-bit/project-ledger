import { supabaseRequest } from './supabase-server.js';

const DAY = 86400000;

export function normalizeLedgerMonth(value, fallback = new Date()) {
  if (/^\d{4}-\d{2}$/.test(value ?? '')) return value;
  return fallback.toISOString().slice(0, 7);
}

function monthDate(value) {
  return new Date(`${normalizeLedgerMonth(value)}-01T00:00:00Z`);
}

function monthDifference(start, selected) {
  return (selected.getUTCFullYear() - start.getUTCFullYear()) * 12
    + selected.getUTCMonth() - start.getUTCMonth();
}

function appliesToMonth(bill, selected) {
  const difference = monthDifference(new Date(`${bill.start_month}T00:00:00Z`), selected);
  if (difference < 0) return false;
  if (bill.frequency === 'quarterly') return difference % 3 === 0;
  if (bill.frequency === 'annual') return difference % 12 === 0;
  if (bill.frequency === 'one-time') return difference === 0;
  return ['monthly', 'bi-weekly'].includes(bill.frequency);
}

function dueDateForMonth(selected, dueDay) {
  const last = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() + 1, 0)).getUTCDate();
  return `${selected.toISOString().slice(0, 7)}-${String(Math.min(Number(dueDay), last)).padStart(2, '0')}`;
}

function activeInMonth(bill, selected) {
  if (bill.is_active) return true;
  if (!bill.archived_at) return false;
  return new Date(bill.archived_at) >= new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() + 1, 1));
}

/** The single status precedence used by the Bills table and Dashboard overview. */
export function classifyLedgerBill({ effectiveAmount, submitted, dueDate }, asOf = new Date()) {
  if (effectiveAmount !== null && submitted >= effectiveAmount) return 'submitted';
  if (new Date(`${dueDate}T23:59:59Z`) < asOf) return 'overdue';
  if (submitted > 0) return 'partial';
  return 'future';
}

export function buildLedgerRows(bills, payments, { selectedMonth, asOf = new Date() } = {}) {
  const selected = monthDate(selectedMonth);
  const byBill = new Map();

  for (const payment of payments) {
    const list = byBill.get(payment.bill_id) ?? [];
    list.push({
      id: payment.id,
      amount: Number(payment.amount),
      paymentDate: payment.payment_date,
      fundingAccount: payment.funding_account,
      notes: payment.notes,
    });
    byBill.set(payment.bill_id, list);
  }

  return bills
    .filter((bill) => activeInMonth(bill, selected) && appliesToMonth(bill, selected))
    .map((bill) => {
      const budget = bill.budget === null ? null : Number(bill.budget);
      const actualAmount = bill.actual_amount === null || bill.actual_amount === undefined
        ? null
        : Number(bill.actual_amount);
      const effectiveAmount = actualAmount ?? budget;
      const transactions = byBill.get(bill.id) ?? [];
      const submitted = transactions.reduce((sum, payment) => sum + payment.amount, 0);
      const nextDue = dueDateForMonth(selected, bill.due_day);

      return {
        id: bill.id,
        payee: bill.bill_name,
        type: bill.bill_type,
        category: bill.category,
        account: bill.account,
        budget,
        actualAmount,
        effectiveAmount,
        frequency: bill.frequency,
        nextDue,
        dueDay: bill.due_day,
        startMonth: bill.start_month,
        notes: bill.notes,
        submitted,
        remaining: effectiveAmount === null ? null : Math.max(effectiveAmount - submitted, 0),
        credit: effectiveAmount === null ? 0 : Math.max(submitted - effectiveAmount, 0),
        transactions,
        status: classifyLedgerBill({ effectiveAmount, submitted, dueDate: nextDue }, asOf),
      };
    });
}

export async function getLedgerBills({ selectedMonth, asOf = new Date() } = {}) {
  const month = `${normalizeLedgerMonth(selectedMonth)}-01`;
  const [bills, payments] = await Promise.all([
    supabaseRequest(`ledger_bills?select=id,bill_name,bill_type,category,account,budget,actual_amount,frequency,due_day,start_month,notes,is_active,archived_at&start_month=lte.${month}&order=bill_name.asc`),
    supabaseRequest(`ledger_bill_payments?select=id,bill_id,amount,payment_date,funding_account,notes&payment_month=eq.${month}&order=payment_date.asc`),
  ]);
  return buildLedgerRows(bills, payments, { selectedMonth, asOf });
}

export function summarizeLedgerBills(rows, asOf = new Date()) {
  const todayStr = asOf.toISOString().slice(0, 10);
  const today = new Date(`${todayStr}T00:00:00Z`);

  return rows.reduce((summary, bill) => {
    const effectiveAmount = bill.effectiveAmount ?? 0;
    summary.total += effectiveAmount;
    summary.activeCount += 1;
    summary.credit += bill.credit ?? 0;

    if (bill.effectiveAmount === null) summary.incompleteCount += 1;

    if (bill.status === 'submitted') {
      summary.submitted += effectiveAmount;
      summary.submittedCount += 1;
    } else {
      summary.remaining += bill.remaining ?? 0;
      if (bill.status === 'partial') {
        summary.partial += bill.submitted;
        summary.partialCount += 1;
      }
    }

    if (bill.status === 'overdue') {
      summary.overdue += bill.remaining ?? 0;
      summary.overdueCount += 1;
    }

    const due = new Date(`${bill.nextDue}T00:00:00Z`);
    const days = (due - today) / DAY;
    if (!['submitted', 'overdue'].includes(bill.status) && (bill.remaining ?? 0) > 0 && days >= 0 && days <= 7) {
      summary.dueSoon += bill.remaining;
      summary.dueSoonCount += 1;
    }

    return summary;
  }, {
    total: 0,
    submitted: 0,
    partial: 0,
    remaining: 0,
    credit: 0,
    overdue: 0,
    dueSoon: 0,
    activeCount: 0,
    submittedCount: 0,
    partialCount: 0,
    overdueCount: 0,
    dueSoonCount: 0,
    incompleteCount: 0,
  });
}

export function getLedgerOverview(rows) {
  const definitions = [
    ['submitted', 'Submitted', (bill) => bill.effectiveAmount ?? 0],
    ['overdue', 'Overdue', (bill) => bill.remaining ?? 0],
    ['partial', 'Partial', (bill) => bill.submitted],
    ['future', 'Future', (bill) => bill.remaining ?? 0],
  ];

  return definitions.map(([key, label, amount]) => {
    const bills = rows.filter((bill) => bill.status === key);
    return {
      key,
      label,
      count: bills.length,
      amount: bills.reduce((sum, bill) => sum + amount(bill), 0),
    };
  });
}

export function groupLedgerBills(rows) {
  return [...rows.reduce((groups, bill) => {
    if (!groups.has(bill.type)) groups.set(bill.type, []);
    groups.get(bill.type).push(bill);
    return groups;
  }, new Map()).entries()].map(([type, bills]) => ({ type, bills }));
}
