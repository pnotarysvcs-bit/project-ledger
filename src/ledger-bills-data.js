import { supabaseRequest } from './supabase-server.js';
import {
  calculateOccurrenceAmounts,
  classifyBillStatus,
  groupBillsByType,
  sortBillOccurrences,
} from './bills/domain.js';

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

export function biweeklyDueDates(anchorValue, selectedMonth) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorValue ?? '')) return [];
  const selected = monthDate(selectedMonth);
  const monthStart = selected.getTime();
  const monthEnd = Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() + 1, 1) - DAY;
  let cursor = new Date(`${anchorValue}T00:00:00Z`).getTime();

  if (cursor < monthStart) {
    const intervals = Math.ceil((monthStart - cursor) / (14 * DAY));
    cursor += intervals * 14 * DAY;
  }

  const dates = [];
  while (cursor <= monthEnd) {
    if (cursor >= monthStart) dates.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 14 * DAY;
  }
  return dates;
}

function dueDatesForBill(bill, selectedMonth) {
  if (bill.frequency === 'bi-weekly') return biweeklyDueDates(bill.recurrence_anchor, selectedMonth);
  return [dueDateForMonth(monthDate(selectedMonth), bill.due_day)];
}

function activeInMonth(bill, selected) {
  if (bill.is_active) return true;
  if (!bill.archived_at) return false;
  return new Date(bill.archived_at) >= new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() + 1, 1));
}

export function classifyLedgerBill(input, asOf = new Date()) {
  return classifyBillStatus(input, asOf);
}

function expectedBills(bills, selectedMonth) {
  const selected = monthDate(selectedMonth);
  return bills.filter((bill) => activeInMonth(bill, selected) && appliesToMonth(bill, selected));
}

export async function ensureLedgerOccurrencesForMonth(selectedMonth) {
  const normalized = normalizeLedgerMonth(selectedMonth);
  const currentMonth = normalizeLedgerMonth();
  if (normalized < currentMonth) return;

  const month = `${normalized}-01`;
  const [bills, existing] = await Promise.all([
    supabaseRequest(`ledger_bills?select=id,budget,frequency,due_day,recurrence_anchor,start_month,is_active,archived_at&start_month=lte.${month}`),
    supabaseRequest(`ledger_bill_months?select=id,bill_id,due_date&month=eq.${month}`),
  ]);
  const existingKeys = new Set(existing.filter((row) => row.due_date).map((row) => `${row.bill_id}:${row.due_date}`));
  const existingBillIds = new Set(existing.map((row) => row.bill_id));
  const creates = [];

  for (const bill of expectedBills(bills, normalized)) {
    for (const dueDate of dueDatesForBill(bill, normalized)) {
      if (bill.frequency !== 'bi-weekly' && existingBillIds.has(bill.id)) continue;
      const key = `${bill.id}:${dueDate}`;
      if (existingKeys.has(key)) continue;
      creates.push({
        bill_id: bill.id,
        month,
        status: null,
        occurrence_budget_amount: bill.budget,
        actual_amount: null,
        due_date: dueDate,
        installment_key: dueDate,
        migration_incomplete: false,
      });
      existingKeys.add(key);
      existingBillIds.add(bill.id);
    }
  }

  if (creates.length) await supabaseRequest('ledger_bill_months', { method: 'POST', body: creates });
}

export function buildLedgerRows(bills, occurrences, payments, { selectedMonth, asOf = new Date() } = {}) {
  const normalized = normalizeLedgerMonth(selectedMonth);
  const occurrencesByBill = new Map();
  for (const occurrence of occurrences) {
    const list = occurrencesByBill.get(occurrence.bill_id) ?? [];
    list.push(occurrence);
    occurrencesByBill.set(occurrence.bill_id, list);
  }
  for (const list of occurrencesByBill.values()) {
    list.sort((a, b) => String(a.due_date ?? '').localeCompare(String(b.due_date ?? '')));
  }

  const paymentsByOccurrence = new Map();
  const legacyPaymentsByBill = new Map();
  for (const payment of payments) {
    const normalizedPayment = {
      id: payment.id,
      amount: Number(payment.amount),
      paymentDate: payment.payment_date,
      fundingAccount: payment.funding_account,
      notes: payment.notes,
      occurrenceId: payment.occurrence_id ?? null,
      statementTransactionId: payment.statement_transaction_id ?? null,
    };
    if (payment.occurrence_id) {
      const list = paymentsByOccurrence.get(payment.occurrence_id) ?? [];
      list.push(normalizedPayment);
      paymentsByOccurrence.set(payment.occurrence_id, list);
    } else {
      const list = legacyPaymentsByBill.get(payment.bill_id) ?? [];
      list.push(normalizedPayment);
      legacyPaymentsByBill.set(payment.bill_id, list);
    }
  }

  const rows = [];
  for (const bill of expectedBills(bills, normalized)) {
    const masterBudget = bill.budget === null || bill.budget === undefined ? null : Number(bill.budget);
    const persisted = occurrencesByBill.get(bill.id) ?? [];
    const expectedDates = dueDatesForBill(bill, normalized);
    const occurrenceMap = new Map(persisted.filter((row) => row.due_date).map((row) => [row.due_date, row]));
    const dates = expectedDates;

    for (const [dateIndex, dueDate] of dates.entries()) {
      // Master schedule is authoritative. Exact persisted occurrences are preferred;
      // otherwise retain the existing occurrence identity by ordinal so Actuals,
      // payments, and statement provenance remain attached after a master Due Date edit.
      const occurrence = occurrenceMap.get(dueDate) ?? persisted[dateIndex] ?? null;
      const historicalMissing = normalized < normalizeLedgerMonth() && !occurrence;
      const migrationIncomplete = historicalMissing || occurrence?.migration_incomplete === true;
      const actualAmount = occurrence?.actual_amount === null || occurrence?.actual_amount === undefined
        ? null
        : Number(occurrence.actual_amount);
      const occurrencePayments = occurrence ? (paymentsByOccurrence.get(occurrence.id) ?? []) : [];
      const legacyPayments = bill.frequency === 'bi-weekly' ? [] : (legacyPaymentsByBill.get(bill.id) ?? []);
      const transactions = [...occurrencePayments, ...legacyPayments].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
      const amounts = calculateOccurrenceAmounts({ budget: masterBudget, actualAmount, payments: transactions });
      const nextDue = dueDate;

      rows.push({
        id: bill.id,
        occurrenceId: occurrence?.id ?? null,
        installmentKey: occurrence?.installment_key ?? nextDue,
        rowKey: occurrence?.id ?? `${bill.id}:${nextDue}`,
        payee: bill.bill_name,
        type: bill.bill_type,
        category: bill.category,
        account: bill.account,
        masterBudget,
        budget: masterBudget,
        actualAmount,
        effectiveAmount: amounts.effectiveAmount,
        migrationIncomplete: migrationIncomplete || (bill.frequency === 'bi-weekly' && (legacyPaymentsByBill.get(bill.id)?.length ?? 0) > 0),
        frequency: bill.frequency,
        recurrenceAnchor: bill.recurrence_anchor,
        nextDue,
        dueDay: bill.due_day,
        startMonth: bill.start_month,
        notes: bill.notes,
        submitted: amounts.submitted,
        remaining: amounts.remaining,
        credit: amounts.credit,
        transactions,
        status: classifyBillStatus({
          effectiveAmount: amounts.effectiveAmount,
          submitted: amounts.submitted,
          dueDate: nextDue,
        }, asOf),
      });
    }
  }

  return sortBillOccurrences(rows);
}

export async function getLedgerBills({ selectedMonth, asOf = new Date() } = {}) {
  const normalized = normalizeLedgerMonth(selectedMonth);
  await ensureLedgerOccurrencesForMonth(normalized);
  const month = `${normalized}-01`;
  const [bills, occurrences, payments] = await Promise.all([
    supabaseRequest(`ledger_bills?select=id,bill_name,bill_type,category,account,budget,frequency,due_day,recurrence_anchor,start_month,notes,is_active,archived_at&start_month=lte.${month}&order=bill_name.asc`),
    supabaseRequest(`ledger_bill_months?select=id,bill_id,month,occurrence_budget_amount,actual_amount,due_date,installment_key,migration_incomplete&month=eq.${month}&order=due_date.asc`),
    supabaseRequest(`ledger_bill_payments?select=id,bill_id,occurrence_id,amount,payment_date,funding_account,notes,statement_transaction_id&payment_month=eq.${month}&order=payment_date.asc`),
  ]);
  return buildLedgerRows(bills, occurrences, payments, { selectedMonth: normalized, asOf });
}

export function summarizeLedgerBills(rows, asOf = new Date()) {
  const today = new Date(`${asOf.toISOString().slice(0, 10)}T00:00:00Z`);
  return rows.reduce((summary, bill) => {
    const effectiveAmount = bill.effectiveAmount ?? 0;
    const submitted = bill.submitted ?? 0;
    const isPartiallyPaid = bill.effectiveAmount !== null && submitted > 0 && submitted < bill.effectiveAmount;

    summary.total += effectiveAmount;
    summary.totalPaid += submitted;
    summary.activeCount += 1;
    summary.credit += bill.credit ?? 0;
    if (bill.effectiveAmount === null) summary.incompleteCount += 1;
    if (bill.migrationIncomplete) summary.dataQualityCount += 1;

    if (bill.status === 'submitted') {
      summary.submitted += effectiveAmount;
      summary.submittedCount += 1;
    } else if (bill.status !== 'incomplete') {
      summary.remaining += bill.remaining ?? 0;
    }

    if (isPartiallyPaid) {
      summary.partial += submitted;
      summary.partialCount += 1;
    }
    if (bill.status === 'overdue') {
      summary.overdue += bill.remaining ?? 0;
      summary.overdueCount += 1;
    }

    const due = new Date(`${bill.nextDue}T00:00:00Z`);
    const days = (due - today) / DAY;
    if (!['submitted', 'overdue', 'incomplete'].includes(bill.status) && (bill.remaining ?? 0) > 0 && days >= 0 && days <= 7) {
      summary.dueSoon += bill.remaining;
      summary.dueSoonCount += 1;
    }
    return summary;
  }, {
    total: 0,
    totalPaid: 0,
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
    dataQualityCount: 0,
  });
}

export function getLedgerOverview(rows) {
  const definitions = [
    ['submitted', 'Submitted', (bill) => bill.effectiveAmount ?? 0],
    ['overdue', 'Overdue', (bill) => bill.remaining ?? 0],
    ['partial', 'Partial', (bill) => bill.submitted ?? 0],
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
  return groupBillsByType(rows);
}
