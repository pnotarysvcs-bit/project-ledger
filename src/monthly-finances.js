import { supabaseRequest } from './supabase-server.js';
import { normalizeLedgerMonth } from './ledger-bills-data.js';

const number = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function getMonthlyIncome(selectedMonth) {
  const month = `${normalizeLedgerMonth(selectedMonth)}-01`;
  const rows = await supabaseRequest(`ledger_monthly_finances?select=income&month=eq.${month}`);
  if (!rows?.length) return null;
  return Number(rows[0].income);
}

const ENTRY_FIELDS = 'id,month,received_on,amount,kind,source,notes';

const toEntry = (row) => ({
  id: row.id,
  month: String(row.month ?? '').slice(0, 7),
  receivedOn: row.received_on,
  amount: number(row.amount),
  kind: row.kind ?? 'paycheck',
  source: row.source ?? 'manual',
  notes: row.notes ?? null,
});

// A month with no entries table yet (migration not applied) must not break the
// page -- it falls back to the older monthly-total shape instead.
async function listIncomeEntryRows(month) {
  try {
    return await supabaseRequest(`ledger_income_entries?select=${ENTRY_FIELDS}&month=eq.${month}&order=received_on.asc`);
  } catch {
    return null;
  }
}

export async function listIncomeEntries(selectedMonth) {
  const month = `${normalizeLedgerMonth(selectedMonth)}-01`;
  const rows = await listIncomeEntryRows(month);
  return (rows ?? []).map(toEntry);
}

export async function addIncomeEntry(selectedMonth, { amount, receivedOn, kind = 'paycheck', notes = null } = {}) {
  const normalized = normalizeLedgerMonth(selectedMonth);
  const month = `${normalized}-01`;
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Paycheck amount must be greater than zero.');

  const received = String(receivedOn ?? '').trim() || month;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(received)) throw new Error('Enter the date the paycheck was received.');
  if (!received.startsWith(normalized)) throw new Error(`That date is outside ${normalized}. Switch months, or correct the date.`);

  const rows = await supabaseRequest('ledger_income_entries', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: { month, received_on: received, amount: value, kind, source: 'manual', notes },
  });

  return toEntry(rows?.[0] ?? {});
}

export async function deleteIncomeEntry(id) {
  const entryId = String(id ?? '').trim();
  if (!entryId) throw new Error('An income entry id is required.');
  await supabaseRequest(`ledger_income_entries?id=eq.${entryId}`, { method: 'DELETE' });
}

export async function getIncomeBreakdown(selectedMonth) {
  const month = `${normalizeLedgerMonth(selectedMonth)}-01`;
  const [entryRows, monthlyRows, payPeriods] = await Promise.all([
    listIncomeEntryRows(month),
    supabaseRequest(`ledger_monthly_finances?select=income&month=eq.${month}`),
    supabaseRequest(`ledger_pay_period_finances?select=period,regular_income,notary_income,ahead_contribution,target_month&month=eq.${month}&order=period.asc`),
  ]);

  const periods = (payPeriods ?? []).map((row) => ({
    period: Number(row.period),
    regularIncome: number(row.regular_income),
    notaryIncome: number(row.notary_income),
    aheadContribution: number(row.ahead_contribution),
    targetMonth: row.target_month ?? null,
  }));

  return summarizeIncome({
    entries: (entryRows ?? []).map(toEntry),
    postedPayroll: periods.reduce((sum, row) => sum + row.regularIncome, 0),
    recordedMonthlyIncome: number(monthlyRows?.[0]?.income),
    notarySupport: periods.reduce((sum, row) => sum + row.notaryIncome, 0),
    periods,
  });
}

// One income figure: paychecks plus notary income, nothing else.
//
// Each paycheck is its own dated entry, so paychecks are simply summed -- two
// paychecks of the same amount are two rows, and one paycheck is one row no
// matter how many times the page is opened.
//
// Months predating income entries fall back to the old shape, where a paycheck
// could be posted to a pay period or recorded as a single monthly total. Those
// are the same money, so the larger of the two is used rather than the sum.
export function summarizeIncome({ entries, postedPayroll = 0, recordedMonthlyIncome = 0, notarySupport = 0, periods = [] } = {}) {
  const rows = entries ?? [];
  const hasEntries = rows.length > 0;
  const entryTotal = (kind) => rows
    .filter((entry) => entry.kind === kind)
    .reduce((sum, entry) => sum + number(entry.amount), 0);

  const paychecks = hasEntries
    ? entryTotal('paycheck') + entryTotal('other')
    : Math.max(number(postedPayroll), number(recordedMonthlyIncome));
  const notary = hasEntries
    ? entryTotal('notary') + number(notarySupport)
    : number(notarySupport);

  return {
    paychecks,
    notarySupport: notary,
    totalIncome: paychecks + notary,
    entries: rows,
    usesEntries: hasEntries,
    postedPayroll: number(postedPayroll),
    recordedMonthlyIncome: number(recordedMonthlyIncome),
    periods,
  };
}

export async function getPayPeriodIncome(selectedMonth, period) {
  const month = `${normalizeLedgerMonth(selectedMonth)}-01`;
  const rows = await supabaseRequest(
    `ledger_pay_period_finances?select=period,regular_income,notary_income,ahead_contribution,target_month&month=eq.${month}&period=eq.${Number(period)}&limit=1`,
  );
  const row = rows?.[0] ?? {};
  return {
    period: Number(period),
    regularIncome: number(row.regular_income),
    notaryIncome: number(row.notary_income),
    aheadContribution: number(row.ahead_contribution),
    targetMonth: row.target_month ?? null,
  };
}

export async function saveMonthlyIncome(selectedMonth, income) {
  const month = `${normalizeLedgerMonth(selectedMonth)}-01`;
  const amount = Number(income);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Monthly income must be zero or greater.');

  const rows = await supabaseRequest('ledger_monthly_finances?on_conflict=month', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: { month, income: amount, updated_at: new Date().toISOString() },
  });

  return Number(rows?.[0]?.income ?? amount);
}

export async function addMonthlyIncome(selectedMonth, addition) {
  const amount = Number(addition);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Income addition must be zero or greater.');

  const current = await getMonthlyIncome(selectedMonth);
  const total = Number(current ?? 0) + amount;
  return saveMonthlyIncome(selectedMonth, total);
}
