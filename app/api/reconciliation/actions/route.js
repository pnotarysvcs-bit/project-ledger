import { NextResponse } from 'next/server';
import { getLedgerBills, normalizeLedgerMonth } from '../../../../src/ledger-bills-data.js';
import { supabaseRequest } from '../../../../src/supabase-server.js';
import { matchTransactions, normalizePayee } from '../../../../src/statement-reconciliation.js';

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

async function saveAlias(billId, rawDescription) {
  const normalizedAlias = normalizePayee(rawDescription);
  if (!billId || !normalizedAlias) return;
  const existing = await supabaseRequest(`ledger_bill_aliases?select=id&bill_id=eq.${encodeURIComponent(billId)}&normalized_alias=eq.${encodeURIComponent(normalizedAlias)}&limit=1`);
  if (!existing?.[0]) {
    await supabaseRequest('ledger_bill_aliases', { method: 'POST', body: { bill_id: billId, alias: rawDescription, normalized_alias: normalizedAlias } });
  }
}

async function assignSamePayeeRows(importId, transaction, bill, expectedAmount, decision) {
  const normalized = transaction.normalized_payee || normalizePayee(transaction.raw_description);
  if (!normalized) return;
  const peers = await supabaseRequest(`ledger_statement_transactions?select=*&import_id=eq.${encodeURIComponent(importId)}&normalized_payee=eq.${encodeURIComponent(normalized)}&order=transaction_date.asc`);
  for (const peer of peers ?? []) {
    if (peer.decision === 'deleted' || peer.payment_id) continue;
    const variance = expectedAmount !== null && expectedAmount !== undefined && Math.abs(Number(peer.amount) - Number(expectedAmount)) > 0.01;
    await supabaseRequest(`ledger_statement_transactions?id=eq.${encodeURIComponent(peer.id)}`, {
      method: 'PATCH',
      body: {
        match_status: variance ? 'amount_variance' : 'matched',
        matched_bill_id: bill.id,
        matched_occurrence_id: bill.occurrenceId,
        expected_amount: expectedAmount,
        decision: peer.id === transaction.id ? decision : 'learned_same_payee',
      },
    });
  }
}

async function rematchEditedTransaction(transaction, month, transactionDate, rawDescription, amount) {
  const bills = await getLedgerBills({ selectedMonth: month });
  const aliases = await supabaseRequest('ledger_bill_aliases?select=bill_id,alias,normalized_alias');
  const normalizedPayee = normalizePayee(rawDescription);

  if (transaction.matched_bill_id && transaction.matched_occurrence_id) {
    const bill = bills.find((item) => item.id === transaction.matched_bill_id && item.occurrenceId === transaction.matched_occurrence_id);
    if (bill) {
      const expectedAmount = bill.actualAmount ?? bill.budget ?? bill.effectiveAmount ?? null;
      const variance = expectedAmount !== null && Math.abs(Number(amount) - Number(expectedAmount)) > 0.01;
      return { normalizedPayee, matchStatus: variance ? 'amount_variance' : 'matched', matchedBillId: bill.id, matchedOccurrenceId: bill.occurrenceId, expectedAmount };
    }
  }

  const result = matchTransactions([{ transactionDate, rawDescription, normalizedPayee, amount, kind: 'withdrawal', sourceSegment: rawDescription }], bills, aliases ?? [])[0];
  return {
    normalizedPayee,
    matchStatus: result.matchStatus,
    matchedBillId: result.matchedBillId ?? null,
    matchedOccurrenceId: result.matchedOccurrenceId ?? null,
    expectedAmount: result.expectedAmount ?? null,
  };
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

    if (action === 'edit_row') {
      const transaction = await loadTransaction(String(body.transactionId ?? ''), importId);
      if (transaction.payment_id) throw new Error('This transaction already created a bill payment. Edit it from the bill payment history.');
      const transactionDate = String(body.transactionDate ?? transaction.transaction_date ?? '');
      const rawDescription = String(body.rawDescription ?? transaction.raw_description ?? '').trim();
      const amount = Number(body.amount);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) throw new Error('Enter a valid transaction date.');
      if (!rawDescription) throw new Error('Statement payee is required.');
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Statement amount must be greater than zero.');
      const rematched = await rematchEditedTransaction(transaction, month, transactionDate, rawDescription, amount);
      await supabaseRequest(`ledger_statement_transactions?id=eq.${encodeURIComponent(transaction.id)}`, {
        method: 'PATCH',
        body: {
          transaction_date: transactionDate,
          raw_description: rawDescription,
          normalized_payee: rematched.normalizedPayee,
          amount,
          match_status: rematched.matchStatus,
          matched_bill_id: rematched.matchedBillId,
          matched_occurrence_id: rematched.matchedOccurrenceId,
          expected_amount: rematched.expectedAmount,
          decision: 'edited_by_user',
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete_row') {
      const transaction = await loadTransaction(String(body.transactionId ?? ''), importId);
      if (transaction.payment_id) throw new Error('This transaction already created a bill payment. Remove or edit it from the bill payment history.');
      await supabaseRequest(`ledger_statement_transactions?id=eq.${encodeURIComponent(transaction.id)}`, {
        method: 'PATCH',
        body: { decision: 'deleted', match_status: 'excluded', matched_bill_id: null, matched_occurrence_id: null, expected_amount: null },
      });
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
      await saveAlias(bill.id, transaction.raw_description);
      await assignSamePayeeRows(importId, transaction, bill, expected, 'manual_match');
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
      const bill = { id: billId, occurrenceId, payee: name };
      await saveAlias(billId, transaction.raw_description);
      await assignSamePayeeRows(importId, transaction, bill, Number(transaction.amount), 'approved_new');
      return NextResponse.json({ ok: true, billId, occurrenceId });
    }

    if (action === 'complete') {
      const transactions = await supabaseRequest(`ledger_statement_transactions?select=*&import_id=eq.${encodeURIComponent(importId)}&order=transaction_date.asc`);
      const active = transactions.filter((row) => row.decision !== 'deleted');
      const unresolved = active.filter((row) => ['new','unmatched'].includes(row.match_status) && row.decision !== 'excluded_by_rule');
      if (unresolved.length) return NextResponse.json({ error: `${unresolved.length} reconciliation item(s) still require review.`, unresolved: unresolved.length }, { status: 409 });

      const payable = active.filter((row) => ['matched','amount_variance'].includes(row.match_status) && row.matched_bill_id && row.matched_occurrence_id && !row.payment_id);
      const bills = await getLedgerBills({ selectedMonth: month });
      for (const row of payable) {
        const existing = await supabaseRequest(`ledger_bill_payments?select=id&statement_transaction_id=eq.${encodeURIComponent(row.id)}&limit=1`);
        let paymentId = existing?.[0]?.id;
        if (!paymentId) {
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
      for (const row of active.filter((item) => ['matched','amount_variance'].includes(item.match_status) && item.matched_occurrence_id)) {
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
