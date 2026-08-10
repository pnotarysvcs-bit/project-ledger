'use client';

import { useEffect, useMemo, useState } from 'react';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function statusLabel(value) {
  return ({ matched: 'Matched', amount_variance: 'Amount Variance', new: 'NEW', unmatched: 'Unmatched', excluded: 'Excluded', duplicate: 'Already Imported' })[value] ?? value;
}

export default function ReconciliationClient({ initialImportId = '' }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(id) {
    if (!id) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/reconciliation?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Reconciliation could not be loaded.');
      setData(body);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  useEffect(() => { if (initialImportId) load(initialImportId); }, [initialImportId]);

  async function upload(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/reconciliation', { method: 'POST', body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Statement upload failed.');
      setData(body);
      const url = new URL(window.location.href);
      url.searchParams.set('import', body.id);
      window.history.replaceState({}, '', url);
      setNotice(body.duplicateUpload ? 'This statement was already imported. Existing reconciliation results were reopened.' : `Statement imported for ${body.confirmedMonth}.`);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function act(payload) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/reconciliation/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ importId: data.id, month: data.confirmedMonth, ...payload }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Reconciliation action failed.');
      if (payload.action === 'complete') setNotice(`Reconciliation completed. ${body.appliedPayments} statement payment(s) applied.`);
      else setNotice('Reconciliation item updated.');
      await load(data.id);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const counts = useMemo(() => {
    const result = { matched: 0, variance: 0, new: 0, unmatched: 0, excluded: 0 };
    for (const row of data?.transactions ?? []) {
      if (row.matchStatus === 'matched') result.matched += 1;
      else if (row.matchStatus === 'amount_variance') result.variance += 1;
      else if (row.matchStatus === 'new') result.new += 1;
      else if (row.matchStatus === 'unmatched') result.unmatched += 1;
      else if (row.matchStatus === 'excluded') result.excluded += 1;
    }
    return result;
  }, [data]);

  return <>
    <p className="eyebrow">Statement reconciliation</p>
    <div className="page-heading-row"><div><h1>Reconcile Bills</h1><p className="lede">Upload a monthly bank statement, review only exceptions, then apply confirmed payments to the selected month.</p></div></div>

    <section className="panel reconciliation-upload">
      <header><strong>Upload Statement</strong><span>PDF</span></header>
      <form onSubmit={upload} className="reconciliation-upload-form">
        <label>Bank statement<input type="file" name="statement" accept="application/pdf,.pdf" required /></label>
        <label>Month override <input type="month" name="month" aria-describedby="month-help" /></label>
        <small id="month-help">Leave blank to use the statement period detected from the PDF.</small>
        <button type="submit" disabled={busy}>{busy ? 'Working…' : 'Upload & Match'}</button>
      </form>
    </section>

    {error && <p className="alert" role="alert">{error}</p>}
    {notice && <p className="success" role="status">{notice}</p>}

    {data && <>
      <section className="summary reconciliation-summary" aria-label="Reconciliation summary">
        <article><span>Detected Month</span><strong>{data.detectedMonth ?? 'Review'}</strong><small>{data.detectedPeriodStart} – {data.detectedPeriodEnd}</small></article>
        <article><span>Matched</span><strong>{counts.matched}</strong><small>ready</small></article>
        <article><span>Variance</span><strong className="amber">{counts.variance}</strong><small>matched, amount differs</small></article>
        <article><span>NEW</span><strong>{counts.new}</strong><small>approval required</small></article>
        <article><span>Unmatched</span><strong>{counts.unmatched}</strong><small>review required</small></article>
      </section>

      {data.detectedMonth && data.confirmedMonth !== data.detectedMonth && <p className="alert">The statement detected {data.detectedMonth}, but reconciliation is currently assigned to {data.confirmedMonth}.</p>}

      <section className="panel">
        <header><strong>{data.fileName}</strong><span>{data.status === 'completed' ? 'Completed' : 'Review in progress'}</span></header>
        <div className="table-wrap"><table className="reconciliation-table"><thead><tr><th>Date</th><th>Statement Payee</th><th>Expected</th><th>Statement Amount</th><th>Status</th><th>Review</th></tr></thead>
        <tbody>{data.transactions.filter((row) => row.matchStatus !== 'excluded').map((row) => <tr key={row.id}>
          <td>{row.transactionDate}</td>
          <td><b>{row.rawDescription}</b>{row.matchedBillId && <small>{data.bills.find((bill) => bill.id === row.matchedBillId && bill.occurrenceId === row.matchedOccurrenceId)?.payee ?? 'Matched bill'}</small>}</td>
          <td>{row.expectedAmount === null ? '—' : money.format(row.expectedAmount)}</td>
          <td>{money.format(row.amount)}</td>
          <td><span className={`recon-status ${row.matchStatus}`}>{statusLabel(row.matchStatus)}</span>{row.decision === 'dismissed' && <small>Dismissed</small>}</td>
          <td><ReviewControls row={row} bills={data.bills} busy={busy || data.status === 'completed'} onAction={act} /></td>
        </tr>)}</tbody></table></div>
        {counts.excluded > 0 && <p className="reconciliation-note">{counts.excluded} ordinary/discretionary transaction(s) were excluded automatically and do not block reconciliation.</p>}
      </section>

      <div className="reconciliation-complete">
        <button type="button" disabled={busy || data.status === 'completed'} onClick={() => act({ action: 'complete' })}>{data.status === 'completed' ? 'Reconciliation Completed' : 'Complete Reconciliation'}</button>
        <small>Completion applies confirmed matches as bill payments and updates Actual Bill Amount for the matched occurrence.</small>
      </div>
    </>}
  </>;
}

function ReviewControls({ row, bills, busy, onAction }) {
  const [billValue, setBillValue] = useState('');
  if (row.decision === 'dismissed') return <span>Dismissed</span>;
  if (row.matchStatus === 'matched' || row.matchStatus === 'amount_variance') return <button type="button" className="ghost" disabled={busy} onClick={() => onAction({ action: 'dismiss', transactionId: row.id })}>Dismiss</button>;

  if (row.matchStatus === 'new') return <details className="reconciliation-action"><summary>Review NEW</summary><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onAction({ action: 'approve_new', transactionId: row.id, name: form.get('name'), category: form.get('category'), account: form.get('account'), frequency: form.get('frequency') }); }}>
    <label>Bill name<input name="name" defaultValue={row.rawDescription} required /></label>
    <label>Category<input name="category" placeholder="e.g. Utilities" required /></label>
    <label>Account<input name="account" placeholder="TCU / TCUB" required /></label>
    <label>Frequency<select name="frequency" defaultValue="monthly"><option>monthly</option><option>bi-weekly</option><option>quarterly</option><option>annual</option><option>one-time</option></select></label>
    <div><button disabled={busy}>Approve NEW</button><button type="button" className="ghost" disabled={busy} onClick={() => onAction({ action: 'dismiss', transactionId: row.id })}>Dismiss</button></div>
  </form></details>;

  return <div className="manual-match"><select value={billValue} onChange={(event) => setBillValue(event.target.value)}><option value="">Select bill…</option>{bills.map((bill) => <option key={`${bill.id}:${bill.occurrenceId}`} value={`${bill.id}:${bill.occurrenceId}`}>{bill.payee} · {bill.nextDue}</option>)}</select><button type="button" disabled={busy || !billValue} onClick={() => { const [billId, occurrenceId] = billValue.split(':'); onAction({ action: 'manual_match', transactionId: row.id, billId, occurrenceId }); }}>Match</button><button type="button" className="ghost" disabled={busy} onClick={() => onAction({ action: 'dismiss', transactionId: row.id })}>Dismiss</button></div>;
}
