'use client';

import { useEffect, useState } from 'react';

import {
  ACCOUNT_KINDS,
  labelForKind,
  sortAccounts,
  summarizeAccounts,
  validateAccount,
} from '../../src/accounts.js';
import { loadAccounts } from '../../src/accounts-store.js';

const EMPTY_FORM = { institution: '', kind: 'checking' };

async function readJson(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'The request failed.');
  return data;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { accounts: persisted } = await readJson(await fetch('/api/accounts', { cache: 'no-store' }));
        const legacy = loadAccounts();
        const existing = new Set(persisted.map((account) => `${account.institution.toLowerCase()}|${account.kind}`));
        const migrated = [];

        for (const account of legacy) {
          const key = `${account.institution.toLowerCase()}|${account.kind}`;
          if (existing.has(key)) continue;

          try {
            const result = await readJson(await fetch('/api/accounts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(account),
            }));
            migrated.push(result.account);
            existing.add(key);
          } catch {
            // A legacy duplicate or invalid record must not block confirmed server data.
          }
        }

        if (!cancelled) setAccounts([...persisted, ...migrated]);
      } catch (error) {
        if (!cancelled) setErrors({ form: error.message });
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const result = validateAccount(form, accounts);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    try {
      const data = await readJson(await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }));
      setAccounts((current) => [...current, data.account]);
      setForm(EMPTY_FORM);
      setErrors({});
    } catch (error) {
      setErrors({ form: error.message });
    }
  };

  const handleRemove = async (id) => {
    try {
      await readJson(await fetch('/api/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }));
      setAccounts((current) => current.filter((account) => account.id !== id));
    } catch (error) {
      setErrors({ form: error.message });
    }
  };

  const summary = summarizeAccounts(accounts);

  return (
    <>
      <p className="eyebrow">Bank accounts</p>
      <h1>Accounts</h1>
      <p className="lede">Add the banks used for your bills and identify each account as checking or savings. Account numbers are not collected.</p>

      <section className="summary" aria-label="Account summary">
        <article><span>Accounts</span><strong>{summary.total}</strong><small>Saved accounts</small></article>
        <article><span>Checking</span><strong className="blue">{summary.checking}</strong><small>Checking accounts</small></article>
        <article><span>Savings</span><strong className="amber">{summary.savings}</strong><small>Savings accounts</small></article>
      </section>

      <section className="panel">
        <header><strong>Add account</strong></header>
        <form className="account-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="account-institution">Bank name</label>
            <input id="account-institution" value={form.institution} onChange={update('institution')} placeholder="Together Credit Union" aria-invalid={Boolean(errors.institution)} aria-describedby={errors.institution ? 'account-institution-error' : undefined} />
            {errors.institution && <small id="account-institution-error" className="error">{errors.institution}</small>}
          </div>

          <div className="field">
            <span className="label" id="account-kind-label">Account type</span>
            <div className="choices" role="radiogroup" aria-labelledby="account-kind-label">
              {ACCOUNT_KINDS.map((kind) => (
                <label key={kind} className={form.kind === kind ? 'choice selected' : 'choice'}>
                  <input type="radio" name="kind" value={kind} checked={form.kind === kind} onChange={update('kind')} />
                  {labelForKind(kind)}
                </label>
              ))}
            </div>
            {errors.kind && <small className="error">{errors.kind}</small>}
          </div>

          {errors.form && <p className="error">{errors.form}</p>}
          <button type="submit">+ Add Account</button>
        </form>
      </section>

      <section className="panel">
        <header><strong>Saved accounts <small>{summary.total}</small></strong></header>
        <div className="table-wrap">
          <table className="accounts-table">
            <thead><tr><th>Bank</th><th>Account Type</th><th>Actions</th></tr></thead>
            <tbody>
              {!loaded && <tr><td colSpan={3} className="empty">Loading accounts…</td></tr>}
              {loaded && accounts.length === 0 && <tr><td colSpan={3} className="empty">No accounts yet. Add one above.</td></tr>}
              {sortAccounts(accounts).map((account) => (
                <tr key={account.id}>
                  <td><b>{account.institution}</b></td>
                  <td><span className={`status ${account.kind}`}>{labelForKind(account.kind)}</span></td>
                  <td><button type="button" className="ghost" onClick={() => handleRemove(account.id)} aria-label={`Remove ${account.institution} ${labelForKind(account.kind)} account`}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
