'use client';

import { useEffect, useState } from 'react';

import {
  ACCOUNT_KINDS,
  createAccount,
  maskAccountNumber,
  sortAccounts,
  summarizeAccounts,
  validateAccount,
} from '../../src/accounts.js';
import { loadAccounts, saveAccounts } from '../../src/accounts-store.js';

const EMPTY_FORM = { name: '', number: '', kind: 'Checking' };

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loaded, setLoaded] = useState(false);

  // Read after mount: localStorage does not exist during server rendering.
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
    setAccounts(next);
    saveAccounts(next);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const handleRemove = (id) => {
    const next = accounts.filter((account) => account.id !== id);
    setAccounts(next);
    saveAccounts(next);
  };

  const summary = summarizeAccounts(accounts);

  return (
    <>
      <p className="eyebrow">Bank accounts</p>
      <h1>Accounts</h1>
      <p className="lede">Add the checking and savings accounts your bills are paid from. Account numbers are stored on this device only and are shown as the last four digits.</p>

      <section className="summary" aria-label="Account summary">
        <article><span>Accounts</span><strong>{summary.total}</strong><small>Saved on this device</small></article>
        <article><span>Checking</span><strong className="blue">{summary.checking}</strong><small>Everyday accounts</small></article>
        <article><span>Savings</span><strong className="amber">{summary.savings}</strong><small>Reserve accounts</small></article>
      </section>

      <section className="panel">
        <header><strong>Add account</strong></header>
        <form className="account-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="account-name">Account name</label>
            <input
              id="account-name"
              value={form.name}
              onChange={update('name')}
              placeholder="TCU Checking"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'account-name-error' : undefined}
            />
            {errors.name && <small id="account-name-error" className="error">{errors.name}</small>}
          </div>

          <div className="field">
            <label htmlFor="account-number">Account number</label>
            <input
              id="account-number"
              value={form.number}
              onChange={update('number')}
              inputMode="numeric"
              autoComplete="off"
              placeholder="1234567890"
              aria-invalid={Boolean(errors.number)}
              aria-describedby={errors.number ? 'account-number-error' : undefined}
            />
            {errors.number && <small id="account-number-error" className="error">{errors.number}</small>}
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
                  {kind}
                </label>
              ))}
            </div>
            {errors.kind && <small className="error">{errors.kind}</small>}
          </div>

          <button type="submit">+ Add Account</button>
        </form>
      </section>

      <section className="panel">
        <header><strong>Saved accounts <small>{summary.total}</small></strong></header>
        <div className="table-wrap">
          <table className="accounts-table">
            <thead>
              <tr><th>Account</th><th>Type</th><th>Number</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {!loaded && (
                <tr><td colSpan={4} className="empty">Loading accounts…</td></tr>
              )}
              {loaded && accounts.length === 0 && (
                <tr><td colSpan={4} className="empty">No accounts yet. Add one above.</td></tr>
              )}
              {sortAccounts(accounts).map((account) => (
                <tr key={account.id}>
                  <td><b>{account.name}</b></td>
                  <td><span className={`status ${account.kind.toLowerCase()}`}>{account.kind}</span></td>
                  <td>{maskAccountNumber(account.number)}</td>
                  <td>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleRemove(account.id)}
                      aria-label={`Remove ${account.name}`}
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
