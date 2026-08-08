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
  if (bill.frequency === 'bi-weekly') {
    return biweeklyDueDates(bill.recurrence_anchor, selectedMonth);
  }
  return [dueDateForMonth(monthDate(selectedMonth), bill.due_day)];
}

function activeInMonth(bill, selected) {
  if (bill.is_active) return true;
  if (!bill.archived_at) return false;
  return new Date(bill.archived_at) >= new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() + 1, 1));
}

/** Single precedence shared by Bills and Dashboard: Incomplete → Submitted → Overdue → Partial → Future. */
export function classifyLedgerBill({ effectiveAmount, submitted, dueDate }, asOf = new Date()) {
  if (effectiveAmount === null) return 'incomplete';
  if (submitted >= effectiveAmount) return 'submitted';
  if (new Date(`${dueDate}T23:59:59Z`) < asOf) return 'overdue';
  if (submitted > 0) return 'partial';
  return 'future';
}

function expectedBills(bills, selectedMonth) {
  const selected = monthDate(selectedMonth);
  return bills.filter((bill) => activeInMonth(bill, selected) && appliesToMonth(bill, selected));
}

/**
 * Materialize current/future occurrences from durable recurrence data.
 * Historical months are never auto-created from today's master values.
 */
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
  const creates = [];

  for (const bill of expectedBills(bills, normalized)) {
    for (const dueDate of dueDatesForBill(bill, normalized)) {
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
    }
  }

  if (creates.length) {
    await supabaseRequest('ledger_bill_months', { method: 'POST', body: creates });
  }
}

export function buildLedgerRows(bills, occurrences, payments, { selectedMonth, asOf = new Date() } = {}) {
  const normalized = normalizeLedgerMonth(selectedMonth);
  const selected = monthDate(normalized);
  const occurrencesByBill = new Map();
  for (const occurrence of occurrences) {
    const list = occurrencesByBill.get(occurrence.bill_id) ?? [];
    list.push(occurrence);
    occurrencesByBill.set(occurrence.bill_id, list);
  }
  for (const list of occurrencesByBill.values()) list.sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

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
    const masterBudget = bill.budget === null ? null : Number(bill.budget);
    const persisted = occurrencesByBill.get(bill.id) ?? [];
    const expectedDates = dueDatesForBill(bill, normalized);
    const occurrenceMap = new Map(persisted.filter((row) => row.due_date).map((row) => [row.due_date, row]));

    const dates = bill.frequency === 'bi-weekly'
      ? [...new Set([...expectedDates, ...persisted.map((row) => row.due_date).filter(Boolean)])].sort()
      : [persisted[0]?.due_date || expectedDates[0]];

    for (const dueDate of dates) {
      const occurrence = occurrenceMap.get(dueDate) ?? (bill.frequency === 'bi-weekly' ? null : persisted[0]);
      const historicalMissing = normalized < normalizeLedgerMonth() && !occurrence;
      const migrationIncomplete = historicalMissing || occurrence?.migration_incomplete === true;
      const occurrenceBudget = occurrence
        ? (occurrence.occurrence_budget_amount === null || occurrence.occurrence_budget_amount === undefined
          ? null
          : Number(occurrence.occurrence_budget_amount))
        : (historicalMissing ? null : masterBudget);
      const actualAmount = occurrence?.actual_amount === null || occurrence?.actual_amount === undefined
        ? null
        : Number(occurrence.actual_amount);
      const effectiveAmount = actualAmount ?? occurrenceBudget;
      const occurrencePayments = occurrence ? (paymentsByOccurrence.get(occurrence.id) ?? []) : [];
      const legacyPayments = bill.frequency === 'bi-weekly' ? [] : (legacyPaymentsByBill.get(bill.id) ?? []);
      const transactions = [...occurrencePayments, ...legacyPayments].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
      const submitted = transactions.reduce((sum, payment) => sum + payment.amount, 0);
      const nextDue = occurrence?.due_date || dueDate;

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
        budget: occurrenceBudget,
        actualAmount,
        effectiveAmount,
        migrationIncomplete: migrationIncomplete || (bill.frequency === 'bi-weekly' && (legacyPaymentsByBill.get(bill.id)?.length ?? 0) > 0),
        frequency: bill.frequency,
        recurrenceAnchor: bill.recurrence_anchor,
        nextDue,
        dueDay: bill.due_day,
        startMonth: bill.start_month,
        notes: bill.notes,
        submitted,
        remaining: effectiveAmount === null ? null : Math.max(effectiveAmount - submitted, 0),
        credit: effectiveAmount === null ? 0 : Math.max(submitted - effectiveAmount, 0),
        transactions,
        status: classifyLedgerBill({ effectiveAmount, submitted, dueDate: nextDue }, asOf),
      });
    }
  }

  return rows.sort((a, b) => a.payee.localeCompare(b.payee) || a.nextDue.localeCompare(b.nextDue));
}

export async function getLedgerBills({ selectedMonth, asOf = new Date() } = {}) {
  const normalized = normalizeLedgerMonth(selectedMonth);
  await ensureLedgerOccurrencesForMonth(normalized);
  const month = `${normalized}-01`;
  const [bills, occurrences, payments] = await Promise.all([
    supabaseRequest(`ledger_bills?select=id,bill_name,bill_type,category,account,budget,frequency,due_day,recurrence_anchor,start_month,notes,is_active,archived_at&start_month=lte.${month}&order=bill_name.asc`),
    supabaseRequest(`ledger_bill_months?select=id,bill_id,month,occurrence_budget_amount,actual_amount,due_date,installment_key,migration_incomplete&month=eq.${month}&order=due_date.asc`),
    supabaseRequest(`ledger_bill_payments?select=id,bill_id,occurrence_id,amount,payment_date,funding_account,notes&payment_month=eq.${month}&order=payment_date.asc`),
  ]);
  return buildLedgerRows(bills, occurrences, payments, { selectedMonth: normalized, asOf });
}

export function summarizeLedgerBills(rows, asOf = new Date()) {
  const today = new Date(`${asOf.toISOString().slice(0, 10)}T00:00:00Z`);

  return rows.reduce((summary, bill) => {
    const effectiveAmount = bill.effectiveAmount ?? 0;
    summary.total += effectiveAmount;
    summary.totalPaid += bill.submitted ?? 0;
    summary.activeCount += 1;
    summary.credit += bill.credit ?? 0;

    if (bill.effectiveAmount === null) summary.incompleteCount += 1;
    if (bill.migrationIncomplete) summary.dataQualityCount += 1;

    if (bill.status === 'submitted') {
      summary.submitted += effectiveAmount;
      summary.submittedCount += 1;
    } else if (bill.status !== 'incomplete') {
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