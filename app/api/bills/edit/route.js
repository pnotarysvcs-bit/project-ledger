import { NextResponse } from 'next/server';
import { normalizeLedgerMonth } from '../../../../src/ledger-bills-data.js';
import { supabaseRequest } from '../../../../src/supabase-server.js';

const invalidCategory = (value) => ['business', 'personal'].includes(String(value ?? '').trim().toLowerCase());

function numericOrNull(value) {
  const raw = String(value ?? '').trim();
  if (raw === '') return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Amounts must be zero or greater.');
  return parsed;
}

export async function POST(request) {
  try {
    const data = await request.formData();
    const id = String(data.get('id') ?? '');
    const occurrenceId = String(data.get('occurrenceId') ?? '');
    const month = normalizeLedgerMonth(String(data.get('month') ?? ''));
    const name = String(data.get('name') ?? '').trim();
    const category = String(data.get('category') ?? '').trim();
    const account = String(data.get('account') ?? '').trim().toUpperCase();
    const frequency = String(data.get('frequency') ?? '').trim();
    const requestedType = String(data.get('type') ?? '').trim();
    const dueDate = String(data.get('nextDue') ?? '').trim();
    const budget = numericOrNull(data.get('budget'));
    const actualAmount = numericOrNull(data.get('actualAmount'));

    if (!id || !name || !account) throw new Error('Bill name and Account are required.');
    if (category && invalidCategory(category)) throw new Error('Business and Personal are Types, not Categories. Choose a bill category.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error('A valid Next Due date is required.');

    const billType = account.startsWith('TCUB') ? 'Business' : account.startsWith('TCU') ? 'Personal' : requestedType;
    const masterRows = await supabaseRequest(`ledger_bills?select=id,bill_name,bill_type,category,account,frequency&id=eq.${encodeURIComponent(id)}`);
    const master = masterRows?.[0];
    if (!master) throw new Error('The selected bill was not found. Refresh and try again.');

    const masterPatch = {};
    if (name !== master.bill_name) masterPatch.bill_name = name;
    if (billType && billType !== master.bill_type) masterPatch.bill_type = billType;
    if (category && category !== master.category) masterPatch.category = category;
    if (account !== master.account) masterPatch.account = account;
    if (frequency && frequency !== master.frequency) masterPatch.frequency = frequency;

    if (Object.keys(masterPatch).length) {
      await supabaseRequest(`ledger_bills?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: masterPatch });
    }

    if (occurrenceId) {
      const occurrenceRows = await supabaseRequest(`ledger_bill_months?select=id,occurrence_budget_amount,actual_amount,due_date,installment_key&bill_id=eq.${encodeURIComponent(id)}&id=eq.${encodeURIComponent(occurrenceId)}&month=eq.${month}-01`);
      const occurrence = occurrenceRows?.[0];
      if (!occurrence) throw new Error('The selected bill occurrence was not found. Refresh and try again.');

      const occurrencePatch = {};
      const currentBudget = occurrence.occurrence_budget_amount == null ? null : Number(occurrence.occurrence_budget_amount);
      const currentActual = occurrence.actual_amount == null ? null : Number(occurrence.actual_amount);
      if (budget !== currentBudget) occurrencePatch.occurrence_budget_amount = budget;
      if (actualAmount !== currentActual) occurrencePatch.actual_amount = actualAmount;
      if (dueDate !== occurrence.due_date) {
        occurrencePatch.due_date = dueDate;
        occurrencePatch.installment_key = dueDate;
      }
      if (Object.keys(occurrencePatch).length) {
        occurrencePatch.migration_incomplete = false;
        await supabaseRequest(`ledger_bill_months?id=eq.${encodeURIComponent(occurrenceId)}&bill_id=eq.${encodeURIComponent(id)}&month=eq.${month}-01`, { method: 'PATCH', body: occurrencePatch });
      }
    }

    const rowKey = String(data.get('rowKey') ?? '');
    const returnQuery = String(data.get('returnQuery') ?? '');
    const query = new URLSearchParams({ month, notice: 'Bill updated.' });
    if (returnQuery) {
      const filters = new URLSearchParams(returnQuery);
      for (const [key, value] of filters) if (key.startsWith('f_') && value) query.set(key, value);
    }
    const anchor = rowKey ? `#bill-${rowKey.replace(/[^a-zA-Z0-9_-]/g, '-')}` : '';
    return NextResponse.json({ ok: true, redirect: `/?${query.toString()}${anchor}` });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Bill update failed.' }, { status: 400 });
  }
}
