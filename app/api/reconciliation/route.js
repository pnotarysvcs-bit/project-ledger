import { NextResponse } from 'next/server';
import { getLedgerBills, normalizeLedgerMonth } from '../../../src/ledger-bills-data.js';
import { supabaseRequest } from '../../../src/supabase-server.js';
import { parseAndMatchStatement, statementHash } from '../../../src/statement-reconciliation.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function serializeImport(record, transactions, bills = []) {
  return {
    id: record.id,
    fileName: record.file_name,
    detectedPeriodStart: record.detected_period_start,
    detectedPeriodEnd: record.detected_period_end,
    detectedMonth: record.detected_month?.slice(0, 7) ?? null,
    confirmedMonth: record.confirmed_month?.slice(0, 7) ?? null,
    status: record.status,
    createdAt: record.created_at,
    completedAt: record.completed_at,
    transactions: (transactions ?? []).map((row) => ({
      id: row.id,
      transactionDate: row.transaction_date,
      rawDescription: row.raw_description,
      normalizedPayee: row.normalized_payee,
      amount: Number(row.amount),
      matchStatus: row.match_status,
      matchedBillId: row.matched_bill_id,
      matchedOccurrenceId: row.matched_occurrence_id,
      expectedAmount: row.expected_amount === null ? null : Number(row.expected_amount),
      decision: row.decision,
      paymentId: row.payment_id,
    })),
    bills: bills.map((bill) => ({ id: bill.id, occurrenceId: bill.occurrenceId, payee: bill.payee, account: bill.account, type: bill.type, category: bill.category, expectedAmount: bill.actualAmount ?? bill.budget ?? bill.effectiveAmount ?? null, nextDue: bill.nextDue })),
  };
}

async function loadImport(id) {
  const imports = await supabaseRequest(`ledger_statement_imports?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  const record = imports?.[0];
  if (!record) return null;
  const month = record.confirmed_month?.slice(0, 7) ?? record.detected_month?.slice(0, 7);
  const [transactions, bills] = await Promise.all([
    supabaseRequest(`ledger_statement_transactions?select=*&import_id=eq.${encodeURIComponent(id)}&order=transaction_date.asc,created_at.asc`),
    month ? getLedgerBills({ selectedMonth: month }) : Promise.resolve([]),
  ]);
  return serializeImport(record, transactions, bills);
}

export async function GET(request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Import id is required.' }, { status: 400 });
    const result = await loadImport(id);
    if (!result) return NextResponse.json({ error: 'Statement import not found.' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get('statement');
    const overrideMonthRaw = String(form.get('month') ?? '').trim();
    if (!file || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'Choose a PDF bank statement.' }, { status: 400 });
    if (file.type && file.type !== 'application/pdf') return NextResponse.json({ error: 'PDF statements are required for this UAT build.' }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = statementHash(buffer);

    const existing = await supabaseRequest(`ledger_statement_imports?select=*&statement_hash=eq.${hash}&limit=1`);
    if (existing?.[0]) {
      const result = await loadImport(existing[0].id);
      return NextResponse.json({ ...result, duplicateUpload: true });
    }

    // First pass detects the statement month; the selected-month Master Bills are then used for matching.
    const detected = parseAndMatchStatement(buffer, [], []);
    const detectedMonth = detected.period.detectedMonth;
    const confirmedMonth = overrideMonthRaw ? normalizeLedgerMonth(overrideMonthRaw) : detectedMonth;
    if (!confirmedMonth) {
      return NextResponse.json({ error: 'This statement spans more than one calendar month. Select the reporting month and upload again.', period: detected.period }, { status: 422 });
    }

    const [bills, aliases] = await Promise.all([
      getLedgerBills({ selectedMonth: confirmedMonth }),
      supabaseRequest('ledger_bill_aliases?select=bill_id,alias,normalized_alias'),
    ]);
    const parsed = parseAndMatchStatement(buffer, bills, aliases ?? []);

    const created = await supabaseRequest('ledger_statement_imports?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        statement_hash: hash,
        file_name: file.name || 'statement.pdf',
        detected_period_start: parsed.period.start,
        detected_period_end: parsed.period.end,
        detected_month: parsed.period.detectedMonth ? `${parsed.period.detectedMonth}-01` : null,
        confirmed_month: `${confirmedMonth}-01`,
        status: 'review',
      },
    });
    const importRecord = created?.[0];
    if (!importRecord) throw new Error('Statement import was not confirmed by the database.');

    const rows = parsed.transactions.map((transaction) => ({
      import_id: importRecord.id,
      transaction_key: transaction.transactionKey,
      transaction_date: transaction.transactionDate,
      raw_description: transaction.rawDescription,
      normalized_payee: transaction.normalizedPayee,
      amount: transaction.amount,
      match_status: transaction.matchStatus,
      matched_bill_id: transaction.matchedBillId ?? null,
      matched_occurrence_id: transaction.matchedOccurrenceId ?? null,
      expected_amount: transaction.expectedAmount ?? null,
      decision: transaction.matchStatus === 'excluded' ? 'excluded_by_rule' : null,
    }));
    if (rows.length) await supabaseRequest('ledger_statement_transactions', { method: 'POST', body: rows });

    const result = await loadImport(importRecord.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
