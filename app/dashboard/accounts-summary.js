'use client';

import { useEffect, useState } from 'react';

import { formatLastFour, sortAccounts } from '../../src/accounts.js';
import { loadAccounts } from '../../src/accounts-store.js';
import { SAMPLE_BALANCES } from '../../src/sample-data.js';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** A seven-point sparkline drawn from a small series of relative values. */
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

  useEffect(() => {
    setAccounts(loadAccounts());
    setLoaded(true);
  }, []);

  return (
    <article className="widget">
      <header>
        <strong>Accounts Summary</strong>
        <a href="/accounts">View Accounts</a>
      </header>

      {!loaded && <p className="muted">Loading accounts…</p>}

      {loaded && accounts.length === 0 && (
        <p className="muted">No accounts yet. <a href="/accounts">Add one</a> to see balances here.</p>
      )}

      {loaded && accounts.length > 0 && (
        <ul className="account-list">
          {sortAccounts(accounts).map((account) => {
            const balance = SAMPLE_BALANCES[account.kind] ?? SAMPLE_BALANCES.checking;
            return (
              <li key={account.id}>
                <span className={`bubble ${account.kind}`} aria-hidden="true" />
                <span className="account-name">
                  <b>{account.name}</b>
                  <small>{account.institution ? `${account.institution} ` : ''}{formatLastFour(account.lastFour)}</small>
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
