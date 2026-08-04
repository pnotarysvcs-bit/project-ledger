import { supabaseRequest } from './supabase-server.js';

function monthStart(value) {
  const match = /^\d{4}-\d{2}$/.test(value ?? '') ? value : null;
  const date = match ? new Date(`${match}-01T00:00:00Z`) : new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function isoMonth(date) {
  return date.toISOString().slice(0, 7);
}

function lastDayOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function dueDateForMonth(month, dueDay) {
  const day = Math.min(Number(dueDay), lastDayOfMonth(month));
  return `${isoMonth(month)}-${String(day).padStart(2, '0')}`;
}

function monthDifference(start, selected) {
  return (selected.getUTCFullYear() - start.getUTCFullYear()) * 12
    + selected.getUTCMonth() - start.getUTCMonth();
}

function appliesToMonth(bill, selected) {
  const start = new Date(`${bill.start_month}T00:00:00Z`);
  const difference = monthDifference(start, selected);
  if (difference < 0) return false;

  switch (bill.frequency) {
    case 'monthly':
    case 'bi-weekly':
      return true;
    case 'quarterly':
      return difference % 3 === 0;
    case 'annual':
      return difference % 12 === 0;
    case 'one-time':
      return difference === 0;
    default:
      return false;
  }
}

function calculateStatus({ explicitStatus, submitted, budget, dueDate, asOf }) {
  if (explicitStatus) return explicitStatus;
  if (budget !== null && submitted >= budget) return 'submitted';
  if (submitted > 0) return 'partial';

  const due = new Date(`${dueDate}T23:59:59Z`);
  if (due < asOf) return 'overdue';
  return 'due-soon';
}

export async function getLedgerBills({ selectedMonth, asOf = new Date() } = {}) {
  const selected = monthStart(selectedMonth);
  const month = `${isoMonth(selected)}-01`;

  const [bills, monthRows, payments] = await Promise.all([
    supabaseRequest(`ledger_bills?select=id,bill_name,bill_type,category,account,budget,frequency,due_day,start_month,notes,is_active&is_active=eq.true&start_month=lte.${month}&order=bill_name.asc`),
    supabaseRequest(`ledger_bill_months?select=bill_id,status&month=eq.${month}`),
    supabaseRequest(`ledger_bill_payments?select=bill_id,amount,payment_date&payment_month=eq.${month}`),
  ]);

  const statusByBill = new Map(monthRows.map((row) => [row.bill_id, row.status]));
  const paymentsByBill = new Map();
  for (const payment of payments) {
    const current = paymentsByBill.get(payment.bill_id) ?? 0;
    paymentsByBill.set(payment.bill_id, current + Number(payment.amount));
  }

  return bills
    .filter((bill) => appliesToMonth(bill, selected))
    .map((bill) => {
      const budget = bill.budget === null ? null : Number(bill.budget);
      const submitted = paymentsByBill.get(bill.id) ?? 0;
      const dueDate = dueDateForMonth(selected, bill.due_day);
      const status = calculateStatus({
        explicitStatus: statusByBill.get(bill.id),
        submitted,
        budget,
        dueDate,
        asOf,
      });

      return {
        id: bill.id,
        payee: bill.bill_name,
        type: bill.bill_type,
        category: bill.category,
        account: bill.account,
        budget,
        frequency: bill.frequency,
        nextDue: dueDate,
        status,
        submitted,
        remaining: budget === null ? null : Math.max(budget - submitted, 0),
        notes: bill.notes,
      };
    });
}

export function summarizeLedgerBills(rows) {
  return rows.reduce((summary, bill) => {
    const budget = bill.budget ?? 0;
    summary.total += budget;
    summary.submitted += bill.submitted;
    summary.remaining += bill.remaining ?? 0;
    summary.activeCount += 1;
    if (bill.status === 'submitted') summary.submittedCount += 1;
    if (bill.status === 'partial') summary.partialCount += 1;
    if (bill.status === 'overdue') {
      summary.overdue += bill.remaining ?? budget;
      summary.overdueCount += 1;
    }
    if (bill.status === 'due-soon') {
      summary.dueSoon += bill.remaining ?? budget;
      summary.dueSoonCount += 1;
    }
    return summary;
  }, {
    total: 0,
    submitted: 0,
    remaining: 0,
    overdue: 0,
    dueSoon: 0,
    activeCount: 0,
    submittedCount: 0,
    partialCount: 0,
    overdueCount: 0,
    dueSoonCount: 0,
  });
}

export function groupLedgerBills(rows) {
  const groups = new Map();
  for (const bill of rows) {
    if (!groups.has(bill.type)) groups.set(bill.type, []);
    groups.get(bill.type).push(bill);
  }
  return [...groups.entries()].map(([type, bills]) => ({ type, bills }));
}
