'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function BillsMonthSelector({ selectedMonth, options }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statement, setStatement] = useState(null);
  const [statementError, setStatementError] = useState(null);

  useEffect(() => {
    let active = true;
    setStatement(null);
    setStatementError(null);
    fetch(`/api/statements?month=${encodeURIComponent(selectedMonth)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Statement status could not be loaded.');
        if (active) setStatement(payload.statement ?? null);
      })
      .catch((error) => { if (active) setStatementError(error.message); });
    return () => { active = false; };
  }, [selectedMonth]);

  function changeMonth(event) {
    const query = new URLSearchParams();
    query.set('month', event.target.value);
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith('f_') && value) query.set(key, value);
    }
    router.push(`/?${query.toString()}`);
  }

  const statusLabel = statement?.status === 'completed' ? 'Completed' : 'Review';

  return (
    <div className="month-selector">
      <label htmlFor="bills-month">Month</label>
      <select id="bills-month" name="month" value={selectedMonth} onChange={changeMonth}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {statement && (
        <div className="statement-month-status" role="status">
          <strong>Statement: {statement.source_name}</strong>
          <span>{statusLabel} · {statement.transactionCount} transactions{statement.unresolvedCount ? ` · ${statement.unresolvedCount} need review` : ''}</span>
          <Link className="button ghost" href={`/reconcile?import=${encodeURIComponent(statement.id)}`}>
            {statement.status === 'completed' ? 'View Reconciliation' : 'Continue Reconciliation'}
          </Link>
        </div>
      )}
      {statementError && <small className="alert">Statement status unavailable: {statementError}</small>}
    </div>
  );
}
