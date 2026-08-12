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
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

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

  const updateEdit = (field) => (event) => {
    setEditForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, edit: undefined, form: undefined }));
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

  const beginEdit = (account) => {
    setEditingId(account.id);
    setEditForm({ institution: account.institution, kind: account.kind });
    setErrors({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
    setErrors({});
  };

  const handleEdit = async (event, account) => {
    event.preventDefault();
    const candidate = { ...editForm, id: account.id };
    const result = validateAccount(candidate, accounts);
    if (!result.valid) {
      setErrors({ edit: result.errors.institution ?? result.errors.kind ?? 'Review the account details.' });
      return;
    }

    try {
      const data = await readJson(await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate),
      }));
      setAccounts((current) => current.map((item) => item.id === account.id ? data.account : item));
      setEditingId(null);
      setEditForm(EMPTY_FORM);
      setErrors({});
    } catch (error) {
      setErrors({ edit: error.message });
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
      if (editingId === id) cancelEdit();
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
        {errors.edit && <p className="error account-edit-error" role="alert">{errors.edit}</p>}
        <div className="table-wrap">
          <table className="accounts-table">
            <thead><tr><th>Bank</th><th>Account Type</th><th>Actions</th></tr></thead>
            <tbody>
              {!loaded && <tr><td colSpan={3} className="empty">Loading accounts…</td></tr>}
              {loaded && accounts.length === 0 && <tr><td colSpan={3} className="empty">No accounts yet. Add one above.</td></tr>}
              {sortAccounts(accounts).map((account) => {
                const editing = editingId === account.id;
                return (
                  <tr key={account.id} className={editing ? 'account-editing-row' : undefined}>
                    <td>{editing ? <input aria-label="Bank name" value={editForm.institution} onChange={updateEdit('institution')} /> : <b>{account.institution}</b>}</td>
                    <td>{editing ? <select aria-label="Account type" value={editForm.kind} onChange={updateEdit('kind')}>{ACCOUNT_KINDS.map((kind) => <option key={kind} value={kind}>{labelForKind(kind)}</option>)}</select> : <span className={`status ${account.kind}`}>{labelForKind(account.kind)}</span>}</td>
                    <td>{editing ? <form className="account-row-actions" onSubmit={(event) => handleEdit(event, account)}><button type="submit">Save</button><button type="button" className="ghost" onClick={cancelEdit}>Cancel</button></form> : <div className="account-row-actions"><button type="button" className="ghost" onClick={() => beginEdit(account)}>Edit</button><button type="button" className="ghost danger" onClick={() => handleRemove(account.id)} aria-label={`Remove ${account.institution} ${labelForKind(account.kind)} account`}>Remove</button></div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
