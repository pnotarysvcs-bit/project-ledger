import { NextResponse } from 'next/server';
import { getLedgerBills, normalizeLedgerMonth } from '../../../../src/ledger-bills-data.js';
import { supabaseRequest } from '../../../../src/supabase-server.js';
import { normalizePayee } from '../../../../src/statement-reconciliation.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadTransaction(id, importId) {
  const rows = await supabaseRequest(`ledger_statement_transactions?select=*&id=eq.${encodeURIComponent(id)}&import_id=eq.${encodeURIComponent(importId)}&limit=1`);
  if (!rows?.[0]) throw new Error('Statement transaction not found.');
  return rows[0];
}

async function loadImport(importId) {
  const rows = await supabaseRequest(`ledger_statement_imports?select=*&id=eq.${encodeURIComponent(importId)}&limit=1`);
  if (!rows?.[0]) throw new Error('Statement import not found.');
  return rows[0];
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = String(body.action ?? '');
    const importId = String(body.importId ?? '');
    if (!importId) return NextResponse.json({ error: 'Import id is required.' }, { status: 400 });
    const importRecord = await loadImport(importId);
    const month = normalizeLedgerMonth(body.month ?? importRecord.confirmed_month?.slice(0, 7) ?? importRecord.detected_month?.slice(0, 7));

    if (action === 'set_month') {
      await supabaseRequest(`ledger_statement_imports?id=eq.${encodeURIComponent(importId)}`, { method: 'PATCH', body: { confirmed_month: `${month}-01` } });
      return NextResponse.json({ ok: true, month });
    }

    if (action === 'dismiss') {
      const transaction = await loadTransaction(String(body.transactionId ?? ''), importId);
      await supabaseRequest(`ledger_statement_transactions?id=eq.${encodeURIComponent(transaction.id)}`, { method: 'PATCH', body: { decision: 'dismissed', match_status: transaction.match_status === 'excluded' ? 'excluded' : 'unmatched', matched_bill_id: null, matched_occurrence_id: null, expected_amount: null } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'manual_match') {
      const transaction = await loadTransaction(String(body.transactionId ?? ''), importId);
      const billId = String(body.billId ?? '');
      const occurrenceId = String(body.occurrenceId ?? '');
      const bills = await getLedgerBills({ selectedMonth: month });
      const bill = bills.find((item) => item.id === billId && item.occurrenceId === occurrenceId);
      if (!bill) throw new Error('Select a valid bill occurrence for this month.');
      const expected = bill.actualAmount ?? bill.budget ?? bill.effectiveAmount ?? null;
      const variance = expected !== null && Math.abs(Number(transaction.amount) - Number(expected)) > 0.01;
      await supabaseRequest(`ledger_statement_transactions?id=eq.${encodeURIComponent(transaction.id)}`, { method: 'PATCH', body: { match_status: variance ? 'amount_variance' : 'matched', matched_bill_id: bill.id, matched_occurrence_id: bill.occurrenceId, expected_amount: expected, decision: 'manual_match' } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'approve_new') {
      const transaction = await loadTransaction(String(body.transactionId ?? ''), importId);
      const name = String(body.name ?? transaction.raw_description ?? '').trim();
      const category = String(body.category ?? '').trim();
      const account = String(body.account ?? '').trim().toUpperCase();
      const frequency = String(body.frequency ?? 'monthly').trim();
      if (!name || !category || !account) throw new Error('Bill name, Category, and Account are required to approve a NEW bill.');
      const billType = account.startsWith('TCUB') ? 'Business' : account.startsWith('TCU') ? 'Personal' : String(body.type ?? 'Personal');
      const dueDate = transaction.transaction_date;
      const created = await supabaseRequest('ledger_bills?select=id', {
        method: 'POST', headers: { Prefer: 'return=representation' }, body: {
          bill_name: name,
          bill_type: billType,
          category,
          account,
          budget: Number(transaction.amount),
          frequency,
          due_day: Number(dueDate.slice(8, 10)),
          recurrence_anchor: frequency === 'bi-weekly' ? dueDate : null,
          start_month: `${month}-01`,
          is_active: true,
          notes: 'Created from statement reconciliation',
        },
      });
      const billId = created?.[0]?.id;
      if (!billId) throw new Error('New bill creation was not confirmed.');
      const occurrences = await supabaseRequest('ledger_bill_months?select=id', {
        method: 'POST', headers: { Prefer: 'return=representation' }, body: {
          bill_id: billId,
          month: `${month}-01`,
          occurrence_budget_amount: Number(transaction.amount),
          actual_amount: Number(transaction.amount),
          due_date: dueDate,
          installment_key: dueDate,
          migration_incomplete: false,
        },
      });
      const occurrenceId = occurrences?.[0]?.id;
      if (!occurrenceId) throw new Error('New bill occurrence creation was not confirmed.');
      await supabaseRequest('ledger_bill_aliases', { method: 'POST', body: { bill_id: billId, alias: transaction.raw_description, normalized_alias: normalizePayee(transaction.raw_description) } });
      await supabaseRequest(`ledger_statement_transactions?id=eq.${encodeURIComponent(transaction.id)}`, { method: 'PATCH', body: { match_status: 'matched', matched_bill_id: billId, matched_occurrence_id: occurrenceId, expected_amount: Number(transaction.amount), decision: 'approved_new' } });
      return NextResponse.json({ ok: true, billId, occurrenceId });
    }

    if (action === 'complete') {
      const transactions = await supabaseRequest(`ledger_statement_transactions?select=*&import_id=eq.${encodeURIComponent(importId)}&order=transaction_date.asc`);
      const unresolved = transactions.filter((row) => ['new','unmatched'].includes(row.match_status) && !['dismissed','excluded_by_rule'].includes(row.decision));
      if (unresolved.length) return NextResponse.json({ error: `${unresolved.length} reconciliation item(s) still require review.`, unresolved: unresolved.length }, { status: 409 });

      const payable = transactions.filter((row) => ['matched','amount_variance'].includes(row.match_status) && row.matched_bill_id && row.matched_occurrence_id && !row.payment_id);
      for (const row of payable) {
        const existing = await supabaseRequest(`ledger_bill_payments?select=id&statement_transaction_id=eq.${encodeURIComponent(row.id)}&limit=1`);
        let paymentId = existing?.[0]?.id;
        if (!paymentId) {
          const bills = await getLedgerBills({ selectedMonth: month });
          const bill = bills.find((item) => item.id === row.matched_bill_id && item.occurrenceId === row.matched_occurrence_id);
          if (!bill) throw new Error(`Matched bill occurrence is no longer available for ${row.raw_description}.`);
          const createdPayment = await supabaseRequest('ledger_bill_payments?select=id', {
            method: 'POST', headers: { Prefer: 'return=representation' }, body: {
              bill_id: row.matched_bill_id,
              occurrence_id: row.matched_occurrence_id,
              amount: Number(row.amount),
              payment_month: `${month}-01`,
              payment_date: row.transaction_date,
              funding_account: bill.account,
              notes: `Statement reconciliation: ${importRecord.file_name}`,
              statement_transaction_id: row.id,
            },
          });
          paymentId = createdPayment?.[0]?.id;
        }
        if (!paymentId) throw new Error('Statement payment creation was not confirmed.');
        await supabaseRequest(`ledger_statement_transactions?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: { payment_id: paymentId, decision: row.decision ?? 'accepted_match' } });
      }

      const grouped = new Map();
      for (const row of transactions.filter((item) => ['matched','amount_variance'].includes(item.match_status) && item.matched_occurrence_id)) {
        grouped.set(row.matched_occurrence_id, (grouped.get(row.matched_occurrence_id) ?? 0) + Number(row.amount));
      }
      for (const [occurrenceId, actual] of grouped) {
        await supabaseRequest(`ledger_bill_months?id=eq.${encodeURIComponent(occurrenceId)}&month=eq.${month}-01`, { method: 'PATCH', body: { actual_amount: Number(actual.toFixed(2)), migration_incomplete: false } });
      }

      await supabaseRequest(`ledger_statement_imports?id=eq.${encodeURIComponent(importId)}`, { method: 'PATCH', body: { status: 'completed', completed_at: new Date().toISOString(), confirmed_month: `${month}-01` } });
      return NextResponse.json({ ok: true, appliedPayments: payable.length });
    }

    return NextResponse.json({ error: 'Unsupported reconciliation action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
