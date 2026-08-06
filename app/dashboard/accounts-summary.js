'use client';

import { useEffect, useState } from 'react';

import { labelForKind, sortAccounts } from '../../src/accounts.js';
import { fetchActiveAccounts } from '../../src/accounts-client.js';
import { SAMPLE_BALANCES } from '../../src/sample-data.js';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function Sparkline({ points, tone }) {
  const max = Math.max(...points, 1);
  const path = points
    .map((value, index) => `${(index / (points.length - 1)) * 60},${20 - (value / max) * 18}`)
    .join(' ');

  return (
    <svg className={`spark ${tone}`} viewBox="0 0 60 20" width="60" height="20" aria-hidden="true">
      <polyline points={path} fill="none" strokeWidth="2" />
    </svg>
  );
}

export default function AccountsSummary() {
  const [accounts, setAccounts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetchActiveAccounts()
      .then((savedAccounts) => {
        if (!cancelled) setAccounts(savedAccounts);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <article className="widget">
      <header>
        <strong>Accounts Summary</strong>
        <a href="/accounts">View Accounts</a>
      </header>

      {!loaded && <p className="muted">Loading accounts…</p>}

      {loaded && loadError && (
        <p className="error">{loadError}</p>
      )}

      {loaded && !loadError && accounts.length === 0 && (
        <p className="muted">No accounts yet. <a href="/accounts">Add one</a> to see it here.</p>
      )}

      {loaded && !loadError && accounts.length > 0 && (
        <ul className="account-list">
          {sortAccounts(accounts).map((account) => {
            const balance = SAMPLE_BALANCES[account.kind] ?? SAMPLE_BALANCES.checking;
            return (
              <li key={account.id}>
                <span className={`bubble ${account.kind}`} aria-hidden="true" />
                <span className="account-name">
                  <b>{account.institution}</b>
                  <small>{labelForKind(account.kind)}</small>
                </span>
                <span className="account-balance">
                  <b>{money.format(balance.amount)}</b>
                  <small>{balance.caption} <em>sample</em></small>
                </span>
                <Sparkline points={balance.trend} tone={account.kind} />
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
