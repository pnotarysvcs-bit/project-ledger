import { supabaseRequest } from './supabase-server.js';
import { normalizeLedgerMonth } from './ledger-bills-data.js';

export async function getMonthlyIncome(selectedMonth) {
  const month = `${normalizeLedgerMonth(selectedMonth)}-01`;
  const rows = await supabaseRequest(`ledger_monthly_finances?select=income&month=eq.${month}`);
  if (!rows?.length) return null;
  return Number(rows[0].income);
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
