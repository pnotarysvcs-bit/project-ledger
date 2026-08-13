'use client';

import { useEffect } from 'react';

const KNOWN_RECONCILIATION_ERRORS = {
  '251918708': {
    title: 'Statement period confirmation required',
    message: 'This statement spans more than one month. Confirm the printed statement period on the upload form, then upload the same statement again. You do not need to enter a month override when the detected reporting month is correct.',
  },
  '3336565119': {
    title: 'Statement period could not be detected',
    message: 'Project Ledger could not identify the printed statement period. Return to the statement upload form and verify the statement source before trying again.',
  },
};

export default function ReconcileError({ error, reset }) {
  useEffect(() => {
    console.error('Statement reconciliation error', error);
  }, [error]);

  const known = KNOWN_RECONCILIATION_ERRORS[String(error?.digest ?? '')];
  const title = known?.title ?? 'Statement reconciliation could not continue';
  const message = known?.message ?? 'The statement could not be processed. Return to Statements and try again. If the error repeats, keep the displayed error number for troubleshooting.';

  return (
    <section className="panel" role="alert">
      <header><strong>{title}</strong></header>
      <p className="lede">{message}</p>
      {error?.digest && <p><small>Error reference: {error.digest}</small></p>}
      <div className="add-bill-actions">
        <button type="button" onClick={() => window.location.assign('/reconcile')}>Back to Statement Upload</button>
        {!known && <button type="button" className="ghost" onClick={() => reset()}>Try Again</button>}
      </div>
    </section>
  );
}
