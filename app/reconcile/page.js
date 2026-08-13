import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { getLedgerBills, normalizeLedgerMonth } from '../../src/ledger-bills-data.js';
import { supabaseRequest } from '../../src/supabase-server.js';
import { detectStatementPeriod, effectiveStatementMonth, extractTransactions, normalizePayee, planStatementPayments, reconcileTransactions, statementHash, statementWarningRequired } from '../../src/statement-reconciliation.js';

export const dynamic = 'force-dynamic';
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const AMOUNT_TOLERANCE = 5;

async function getBillsWithAliases(selectedMonth) {
  const bills = await getLedgerBills({ selectedMonth });
  const aliases = await supabaseRequest('ledger_bill_aliases?select=bill_id,alias_raw,alias_normalized,amount_hint');
  const byBill = new Map();
  for (const alias of aliases ?? []) {
    const list = byBill.get(alias.bill_id) ?? [];
    list.push({ value: alias.alias_raw || alias.alias_normalized, amountHint: alias.amount_hint });
    byBill.set(alias.bill_id, list);
  }
  return bills.map((bill) => ({ ...bill, aliases: byBill.get(bill.id) ?? [] }));
}

async function rememberAlias(transaction, billId) {
  const aliasRaw = String(transaction.raw_description ?? '').trim();
  const aliasNormalized = normalizePayee(aliasRaw);
  if (!aliasRaw || !aliasNormalized || !billId) return;
  await supabaseRequest('ledger_bill_aliases?on_conflict=alias_normalized,bill_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: {
      bill_id: billId,
      alias_raw: aliasRaw,
      alias_normalized: aliasNormalized,
      amount_hint: Number(transaction.amount),
      last_seen_at: new Date().toISOString(),
    },
  });
}

async function uploadStatement(formData) {
  'use server';
  const file = formData.get('statement');
  if (!file || file.size === 0) throw new Error('Choose a PDF or CSV statement.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Statement files must be 10 MB or smaller.');
  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = statementHash(buffer);
  const duplicate = await supabaseRequest(`ledger_statement_imports?select=id,effective_month&source_hash=eq.${hash}`);
  if (duplicate[0]) redirect(`/reconcile?import=${duplicate[0].id}&duplicate=1`);
  const isCsv = /csv/i.test(file.type) || file.name.toLowerCase().endsWith('.csv');
  if (!isCsv && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('PDF is required for UAT; CSV is also accepted.');
  const text = isCsv ? buffer.toString('utf8') : (await pdf(buffer)).text;
  const detection = detectStatementPeriod(text);
  const override = String(formData.get('monthOverride') ?? '').trim() || null;
  const selectedMonth = effectiveStatementMonth(detection, override);
  if (!selectedMonth) throw new Error('The statement period could not be detected. Enter a reporting month override and upload again.');
  const warningRequired = statementWarningRequired(detection, override);
  if (warningRequired && formData.get('confirmWarning') !== 'yes') {
    const printedPeriod = detection.start && detection.end ? `${detection.start} through ${detection.end}` : selectedMonth;
    const notice = `This statement covers ${printedPeriod} and will be reconciled to ${selectedMonth}. Check the confirmation box and upload the same statement again.`;
    redirect(`/reconcile?month=${selectedMonth}&notice=${encodeURIComponent(notice)}`);
  }
  const bills = await getBillsWithAliases(selectedMonth);
  const year = Number(selectedMonth.slice(0, 4));
  const anchorMonth = Number((detection.end ?? `${selectedMonth}-01`).slice(5, 7));
  const reconciled = reconcileTransactions(extractTransactions(text, year, anchorMonth), bills, { amountTolerance: AMOUNT_TOLERANCE });
  const created = await supabaseRequest('ledger_statement_imports?select=id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: {
      source_name: file.name,
      source_hash: hash,
      period_start: detection.start,
      period_end: detection.end,
      detected_month: detection.detectedMonth ? `${detection.detectedMonth}-01` : null,
      override_month: override ? `${override}-01` : null,
      effective_month: `${selectedMonth}-01`,
      warning_confirmed: !warningRequired || formData.get('confirmWarning') === 'yes',
    },
  });
  const importId = created?.[0]?.id;
  if (!importId) throw new Error('Statement import was not confirmed by the database.');
  if (reconciled.length) {
    await supabaseRequest('ledger_statement_transactions', {
      method: 'POST',
      body: reconciled.map((row, index) => ({
        import_id: importId,
        source_identity: statementHash(Buffer.from(`${row.date}|${row.rawDescription}|${row.amount}|${index}`)),
        transaction_date: row.date,
        raw_description: row.rawDescription,
        normalized_payee: row.normalizedPayee,
        amount: row.amount,
        expected_amount: row.expectedAmount ?? null,
        match_status: row.status,
        bill_id: row.billId ?? null,
        occurrence_id: row.occurrenceId ?? null,
        confidence: row.confidence ?? null,
        decision_note: row.reason ?? null,
      })),
    });
  }
  redirect(`/reconcile?import=${importId}`);
}

async function resolveTransaction(formData) {
  'use server';
  const id = String(formData.get('id'));
  const importId = String(formData.get('importId'));
  const decision = String(formData.get('decision'));

  if (decision === 'dismiss') {
    await supabaseRequest(`ledger_statement_transactions?id=eq.${encodeURIComponent(id)}&import_id=eq.${encodeURIComponent(importId)}`, {
      method: 'PATCH',
      body: { match_status: 'Dismissed', decision_note: 'Dismissed by user', resolved_at: new Date().toISOString() },
    });
    revalidatePath('/reconcile');
    redirect(`/reconcile?import=${importId}`);
  }

  const transaction = (await supabaseRequest(`ledger_statement_transactions?select=*&id=eq.${encodeURIComponent(id)}&import_id=eq.${encodeURIComponent(importId)}`))[0];
  const imported = (await supabaseRequest(`ledger_statement_imports?select=effective_month&id=eq.${encodeURIComponent(importId)}`))[0];
  if (!transaction || !imported) throw new Error('The statement transaction could not be found.');

  if (decision === 'edit-review') {
    const correctedAmount = Number(formData.get('correctedAmount'));
    if (!Number.isFinite(correctedAmount) || correctedAmount <= 0) throw new Error('Enter a valid positive statement transaction amount.');
    const disposition = String(formData.get('reviewDisposition') ?? 'match');

    if (disposition === 'exclude') {
      await supabaseRequest(`ledger_statement_transactions?id=eq.${encodeURIComponent(id)}&import_id=eq.${encodeURIComponent(importId)}`, {
        method: 'PATCH',
        body: {
          amount: correctedAmount,
          match_status: 'Dismissed',
          bill_id: null,
          occurrence_id: null,
          expected_amount: null,
          confidence: null,
          decision_note: 'Excluded as not a bill by user review.',
          resolved_at: new Date().toISOString(),
        },
      });
      revalidatePath('/reconcile');
      redirect(`/reconcile?import=${importId}&notice=Review+saved.`);
    }

    const selection = String(formData.get('billOccurrence') ?? '');
    const [billId, occurrenceId] = selection.split('|');
    const selectedMonth = imported.effective_month.slice(0, 7);
    const bills = await getLedgerBills({ selectedMonth });
    const bill = bills.find((candidate) => candidate.id === billId && String(candidate.occurrenceId ?? '') === String(occurrenceId ?? ''));
    if (!bill) throw new Error('Choose a valid Master Bill occurrence.');
    const expected = bill.actualAmount ?? bill.budget;
    const difference = expected == null ? null : Math.abs(correctedAmount - Number(expected));
    const approveVariance = formData.get('approveVariance') === 'yes';
    const matchStatus = difference != null && difference > AMOUNT_TOLERANCE && !approveVariance ? 'Amount Variance' : 'Matched';
    const decisionNote = matchStatus === 'Amount Variance'
      ? 'Amount differs from the selected Master Bill; explicit variance approval is required before completion.'
      : difference != null && difference > AMOUNT_TOLERANCE
        ? 'Amount variance explicitly approved by user.'
        : 'Statement amount and Master Bill match confirmed by user.';

    await supabaseRequest(`ledger_statement_transactions?id=eq.${encodeURIComponent(id)}&import_id=eq.${encodeURIComponent(importId)}`, {
      method: 'PATCH',
      body: {
        amount: correctedAmount,
        match_status: matchStatus,
        bill_id: bill.id,
        occurrence_id: bill.occurrenceId,
        expected_amount: expected,
        confidence: 1,
        decision_note: decisionNote,
        resolved_at: null,
      },
    });
    if (matchStatus === 'Matched') await rememberAlias({ ...transaction, amount: correctedAmount }, bill.id);
    revalidatePath('/reconcile');
    redirect(`/reconcile?import=${importId}&notice=Review+saved.`);
  }

  if (decision === 'match-existing') {
    const selection = String(formData.get('billOccurrence') ?? '');
    const [billId, occurrenceId] = selection.split('|');
    const selectedMonth = imported.effective_month.slice(0, 7);
    const bills = await getLedgerBills({ selectedMonth });
    const bill = bills.find((candidate) => candidate.id === billId && String(candidate.occurrenceId ?? '') === String(occurrenceId ?? ''));
    if (!bill) throw new Error('Choose a valid Master Bill occurrence.');
    const expected = bill.actualAmount ?? bill.budget;
    const difference = expected == null ? null : Math.abs(Number(transaction.amount) - Number(expected));
    const matchStatus = difference != null && difference > AMOUNT_TOLERANCE ? 'Amount Variance' : 'Matched';
    await supabaseRequest(`ledger_statement_transactions?id=eq.${encodeURIComponent(id)}&import_id=eq.${encodeURIComponent(importId)}`, {
      method: 'PATCH',
      body: {
        match_status: matchStatus,
        bill_id: bill.id,
        occurrence_id: bill.occurrenceId,
        expected_amount: expected,
        confidence: 1,
        decision_note: matchStatus === 'Amount Variance'
          ? 'Matched to an existing Master Bill; amount variance requires explicit review before completion.'
          : 'Matched to an existing Master Bill by user; merchant alias learned.',
        resolved_at: null,
      },
    });
    if (matchStatus === 'Matched') await rememberAlias(transaction, bill.id);
  }

  if (decision === 'approve-new') {
    const billName = String(formData.get('billName') ?? transaction.raw_description).trim();
    const category = String(formData.get('category') ?? '').trim();
    const account = String(formData.get('account') ?? '').trim().toUpperCase();
    if (!billName || !category || !account) throw new Error('Bill name, category, and account are required to approve a NEW bill.');
    const created = await supabaseRequest('ledger_bills?select=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        bill_name: billName,
        bill_type: account.startsWith('TCUB') ? 'Business' : 'Personal',
        category,
        account,
        budget: transaction.amount,
        frequency: 'monthly',
        due_day: Number(transaction.transaction_date.slice(8, 10)),
        start_month: imported.effective_month,
        is_active: true,
        notes: `Approved from statement reconciliation ${importId}`,
      },
    });
    const billId = created?.[0]?.id;
    if (!billId) throw new Error('NEW bill creation was not confirmed.');
    const occurrence = await supabaseRequest('ledger_bill_months?select=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        bill_id: billId,
        month: imported.effective_month,
        occurrence_budget_amount: transaction.amount,
        actual_amount: transaction.amount,
        due_date: transaction.transaction_date,
        installment_key: transaction.transaction_date,
        migration_incomplete: false,
      },
    });
    await supabaseRequest(`ledger_statement_transactions?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: {
        match_status: 'Matched',
        bill_id: billId,
        occurrence_id: occurrence?.[0]?.id,
        expected_amount: transaction.amount,
        decision_note: 'Approved into Master Bills; merchant alias learned.',
        resolved_at: null,
      },
    });
    await rememberAlias(transaction, billId);
  }

  revalidatePath('/reconcile');
  redirect(`/reconcile?import=${importId}`);
}

async function completeReconciliation(formData) {
  'use server';
  const importId = String(formData.get('importId'));
  const imports = await supabaseRequest(`ledger_statement_imports?select=*&id=eq.${encodeURIComponent(importId)}`);
  const item = imports[0];
  if (!item) throw new Error('Reconciliation import not found.');
  const rows = await supabaseRequest(`ledger_statement_transactions?select=*&import_id=eq.${encodeURIComponent(importId)}`);
  if (!rows.length) redirect(`/reconcile?import=${importId}&notice=This+statement+has+no+parsed+transactions.`);

  const unresolved = rows.filter((row) => ['NEW', 'Unmatched', 'Amount Variance'].includes(row.match_status));
  if (unresolved.length) {
    redirect(`/reconcile?import=${importId}&notice=Resolve+${unresolved.length}+review+item${unresolved.length === 1 ? '' : 's'}+before+completing+reconciliation.`);
  }

  const existingPayments = await supabaseRequest(`ledger_bill_payments?select=id,bill_id,occurrence_id,amount,payment_date,payment_month,statement_transaction_id&payment_month=eq.${item.effective_month}`);
  const actions = planStatementPayments(rows, existingPayments);
  const resolvedAt = new Date().toISOString();

  for (const { row, action, paymentId } of actions) {
    if (action === 'link-existing') {
      await supabaseRequest(`ledger_bill_payments?id=eq.${encodeURIComponent(paymentId)}`, {
        method: 'PATCH',
        body: { statement_transaction_id: row.id },
      });
      await supabaseRequest(`ledger_statement_transactions?id=eq.${encodeURIComponent(row.id)}&import_id=eq.${encodeURIComponent(importId)}`, {
        method: 'PATCH',
        body: {
          payment_id: paymentId,
          resolved_at: resolvedAt,
          decision_note: 'Matched to an existing payment; no duplicate created.',
        },
      });
      continue;
    }

    if (action === 'covered-by-existing') {
      await supabaseRequest(`ledger_statement_transactions?id=eq.${encodeURIComponent(row.id)}&import_id=eq.${encodeURIComponent(importId)}`, {
        method: 'PATCH',
        body: {
          resolved_at: resolvedAt,
          decision_note: 'Already represented by existing payment history; no duplicate created.',
        },
      });
      continue;
    }

    const payment = await supabaseRequest('ledger_bill_payments?select=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        bill_id: row.bill_id,
        occurrence_id: row.occurrence_id,
        amount: row.amount,
        payment_month: item.effective_month,
        payment_date: row.transaction_date,
        funding_account: 'Statement import',
        notes: `Statement reconciliation ${importId}`,
        statement_transaction_id: row.id,
      },
    });
    const createdPaymentId = payment?.[0]?.id;
    if (!createdPaymentId) throw new Error('A statement payment could not be confirmed. Reconciliation was not completed.');
    await supabaseRequest(`ledger_statement_transactions?id=eq.${encodeURIComponent(row.id)}&import_id=eq.${encodeURIComponent(importId)}`, {
      method: 'PATCH',
      body: {
        payment_id: createdPaymentId,
        resolved_at: resolvedAt,
        decision_note: row.decision_note,
      },
    });
  }

  const finalRows = await supabaseRequest(`ledger_statement_transactions?select=id,match_status,payment_id,resolved_at,decision_note&import_id=eq.${encodeURIComponent(importId)}`);
  const incomplete = finalRows.filter((row) => row.match_status === 'Matched' && !row.payment_id && !row.resolved_at);
  if (incomplete.length) {
    redirect(`/reconcile?import=${importId}&notice=Resolve+${incomplete.length}+incomplete+matched+item${incomplete.length === 1 ? '' : 's'}+before+completion.`);
  }

  await supabaseRequest(`ledger_statement_imports?id=eq.${encodeURIComponent(importId)}`, {
    method: 'PATCH',
    body: { status: 'completed', completed_at: resolvedAt },
  });
  revalidatePath('/');
  revalidatePath('/dashboard');
  redirect(`/?month=${item.effective_month.slice(0, 7)}&notice=Statement+reconciliation+completed.`);
}

function uniqueBillOccurrences(rows) {
  const seen = new Set();
  return rows.filter((bill) => {
    const key = `${bill.id}|${bill.occurrenceId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default async function ReconcilePage({ searchParams }) {
  const params = await searchParams;
  const importId = String(params?.import ?? '');
  const viewedMonth = normalizeLedgerMonth(params?.month);
  let item = null;
  let rows = [];
  let billOptions = [];

  if (importId) {
    item = (await supabaseRequest(`ledger_statement_imports?select=*&id=eq.${encodeURIComponent(importId)}`))[0] ?? null;
    rows = item ? await supabaseRequest(`ledger_statement_transactions?select=*&import_id=eq.${encodeURIComponent(importId)}&order=transaction_date.asc`) : [];
    if (item) billOptions = uniqueBillOccurrences(await getLedgerBills({ selectedMonth: item.effective_month.slice(0, 7) }));
  }

  const reviewEditor = (row) => {
    if (row.payment_id) return <span>{row.decision_note ?? 'Already linked to a payment.'}</span>;
    const selectedValue = row.bill_id && row.occurrence_id ? `${row.bill_id}|${row.occurrence_id}` : '';
    return <form action={resolveTransaction} className="inline-form">
      <input type="hidden" name="id" value={row.id}/>
      <input type="hidden" name="importId" value={item.id}/>
      <input type="hidden" name="decision" value="edit-review"/>
      <label>Statement amount<input name="correctedAmount" type="number" step="0.01" min="0.01" defaultValue={Number(row.amount).toFixed(2)} required/></label>
      <label>Review decision<select name="reviewDisposition" defaultValue="match"><option value="match">Match to Master Bill</option><option value="exclude">Exclude / Not a Bill</option></select></label>
      <label>Master Bill<select name="billOccurrence" defaultValue={selectedValue}><option value="">Choose Master Bill</option>{billOptions.map((bill) => <option key={`${bill.id}|${bill.occurrenceId ?? ''}`} value={`${bill.id}|${bill.occurrenceId ?? ''}`}>{bill.payee} · {bill.budget == null ? 'No budget' : money.format(bill.budget)} · due {bill.nextDue}</option>)}</select></label>
      <label><input name="approveVariance" type="checkbox" value="yes"/> Approve this amount variance after verifying the statement transaction amount</label>
      <button type="submit">Save Review</button>
    </form>;
  };

  const unresolvedCount = rows.filter((row) => ['NEW', 'Unmatched', 'Amount Variance'].includes(row.match_status)).length;

  return <>
    <p className="eyebrow">Statement reconciliation</p>
    <div className="page-heading-row"><div><h1>Reconcile Statement</h1><p className="lede">Import posted payments, review exceptions, and preserve the Master Bills budget.</p></div><Link className="button ghost" href={`/?month=${item?.effective_month?.slice(0, 7) ?? viewedMonth}`}>Back to Bills</Link></div>

    {!item && <section className="panel add-bill-panel"><header><strong>Upload monthly statement</strong></header><form action={uploadStatement} className="add-bill-form" encType="multipart/form-data"><input type="hidden" name="viewedMonth" value={viewedMonth}/><label>Statement (PDF or CSV)<input name="statement" type="file" accept="application/pdf,.pdf,text/csv,.csv" required/></label><label>Month override (only if needed)<input name="monthOverride" type="month"/></label><label><input name="confirmWarning" type="checkbox" value="yes"/> Confirm only if the printed period spans months or the month override differs from the detected month</label><div className="add-bill-actions"><button type="submit">Detect Month &amp; Review</button></div></form></section>}

    {params?.duplicate === '1' && <p className="alert" role="status">This statement was already imported. The existing reconciliation is shown below.</p>}
    {params?.notice && <p className="alert" role="status">{String(params.notice)}</p>}

    {item && <>
      <section className="summary">
        <article><span>Detected Month</span><strong>{item.detected_month?.slice(0,7) ?? 'Uncertain'}</strong><small>{item.period_start ?? '?'} to {item.period_end ?? '?'}</small></article>
        <article><span>Reporting Month</span><strong>{item.effective_month.slice(0,7)}</strong><small>{item.override_month ? 'User override retained' : 'Detected period used'}</small></article>
        <article><span>Status</span><strong>{item.status}</strong><small>{item.source_name}</small></article>
      </section>

      <section className="panel">
        <header><strong>Review transactions</strong><span>{rows.length} posted debits · {unresolvedCount} need review</span></header>
        <div className="table-wrap"><table className="reconciliation-table"><thead><tr><th>Bill / Payee</th><th>Expected Amount</th><th>Statement Amount</th><th>Payment Date</th><th>Match Status</th><th>Review / Action</th></tr></thead><tbody>
          {rows.map((row) => <tr key={row.id}>
            <td><b>{row.raw_description}</b></td>
            <td>{row.expected_amount == null ? '—' : money.format(row.expected_amount)}</td>
            <td>{money.format(row.amount)}</td>
            <td>{row.transaction_date}</td>
            <td><span className={`status ${row.match_status.toLowerCase().replace(/\s/g,'-')}`}>{row.match_status}</span></td>
            <td>{row.match_status === 'Dismissed' ? (row.decision_note ?? 'Excluded') : <div className="inline-payment">{reviewEditor(row)}{row.match_status === 'NEW' && <form action={resolveTransaction} className="inline-form"><input type="hidden" name="id" value={row.id}/><input type="hidden" name="importId" value={item.id}/><input type="hidden" name="decision" value="approve-new"/><label>Bill name<input name="billName" defaultValue={row.raw_description} required/></label><label>Category<input name="category" required/></label><label>Account<input name="account" placeholder="TCU or TCUB" required/></label><button type="submit">Approve NEW Bill</button></form>}</div>}</td>
          </tr>)}
        </tbody></table></div>
      </section>

      {item.status !== 'completed' && <><p className="lede">{unresolvedCount ? `${unresolvedCount} review item${unresolvedCount === 1 ? '' : 's'} must be resolved before completion.` : 'All review items are resolved. Complete Reconciliation will link or create the confirmed payments.'}</p><form action={completeReconciliation}><input type="hidden" name="importId" value={item.id}/><button type="submit" disabled={unresolvedCount > 0}>Complete Reconciliation</button></form></>}
    </>}
  </>;
}