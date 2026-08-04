'use client';

import { useEffect, useState } from 'react';

import {
  ACCOUNT_KINDS,
  createAccount,
  labelForKind,
  sortAccounts,
  summarizeAccounts,
  validateAccount,
} from '../../src/accounts.js';
import { loadAccounts, saveAccounts } from '../../src/accounts-store.js';

const EMPTY_FORM = { institution: '', kind: 'checking' };

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAccounts(loadAccounts());
    setLoaded(true);
  }, []);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const result = validateAccount(form, accounts);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    const next = [...accounts, createAccount(form)];
    if (!saveAccounts(next)) {
      setErrors({ form: 'The account could not be saved. Please try again.' });
      return;
    }

    setAccounts(next);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const handleRemove = (id) => {
    const next = accounts.filter((account) => account.id !== id);
    if (saveAccounts(next)) setAccounts(next);
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
            <input
              id="account-institution"
              value={form.institution}
              onChange={update('institution')}
              placeholder="Together Credit Union"
              aria-invalid={Boolean(errors.institution)}
              aria-describedby={errors.institution ? 'account-institution-error' : undefined}
            />
            {errors.institution && <small id="account-institution-error" className="error">{errors.institution}</small>}
          </div>

          <div className="field">
            <span className="label" id="account-kind-label">Account type</span>
            <div className="choices" role="radiogroup" aria-labelledby="account-kind-label">
              {ACCOUNT_KINDS.map((kind) => (
                <label key={kind} className={form.kind === kind ? 'choice selected' : 'choice'}>
                  <input
                    type="radio"
                    name="kind"
                    value={kind}
                    checked={form.kind === kind}
                    onChange={update('kind')}
                  />
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
            <thead>
              <tr><th>Bank</th><th>Account Type</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {!loaded && (
                <tr><td colSpan={3} className="empty">Loading accounts…</td></tr>
              )}
              {loaded && accounts.length === 0 && (
                <tr><td colSpan={3} className="empty">No accounts yet. Add one above.</td></tr>
              )}
              {sortAccounts(accounts).map((account) => (
                <tr key={account.id}>
                  <td><b>{account.institution}</b></td>
                  <td><span className={`status ${account.kind}`}>{labelForKind(account.kind)}</span></td>
                  <td>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleRemove(account.id)}
                      aria-label={`Remove ${account.institution} ${labelForKind(account.kind)} account`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
