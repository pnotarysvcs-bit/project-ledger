import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCOUNT_KINDS,
  createAccount,
  labelForKind,
  sortAccounts,
  summarizeAccounts,
  validateAccount,
} from '../src/accounts.js';
import { migrateAccount, needsMigration } from '../src/accounts-store.js';

const valid = { institution: 'Together Credit Union', kind: 'checking' };

test('bank name and account type pass validation', () => {
  const result = validateAccount(valid);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test('bank name and account type are required', () => {
  const result = validateAccount({ institution: '', kind: '' });

  assert.equal(result.valid, false);
  assert.ok(result.errors.institution);
  assert.ok(result.errors.kind);
});

test('only checking and savings are supported', () => {
  assert.deepEqual(ACCOUNT_KINDS, ['checking', 'savings']);
  assert.equal(validateAccount({ ...valid, kind: 'savings' }).valid, true);
  assert.equal(validateAccount({ ...valid, kind: 'credit_card' }).valid, false);
  assert.equal(validateAccount({ ...valid, kind: 'brokerage' }).valid, false);
});

test('labels are presentation only', () => {
  assert.equal(labelForKind('checking'), 'Checking');
  assert.equal(labelForKind('savings'), 'Savings');
});

test('the same bank and account type cannot be saved twice', () => {
  const existing = [createAccount(valid)];
  const duplicate = validateAccount(valid, existing);

  assert.equal(duplicate.valid, false);
  assert.match(duplicate.errors.institution, /already saved/);
});

test('the same bank may have one checking and one savings account', () => {
  const existing = [createAccount(valid)];
  const savings = validateAccount({ ...valid, kind: 'savings' }, existing);

  assert.equal(savings.valid, true);
});

test('editing an account does not collide with itself', () => {
  const saved = createAccount(valid);
  const edited = validateAccount({ ...valid, id: saved.id }, [saved]);

  assert.equal(edited.valid, true);
});

test('a created account contains no account-number fields', () => {
  const account = createAccount({ institution: ' Together Credit Union ', kind: 'savings' });

  assert.equal(account.institution, 'Together Credit Union');
  assert.equal(account.kind, 'savings');
  assert.equal(account.lastFour, undefined);
  assert.equal(account.number, undefined);
  assert.equal(account.name, undefined);
});

test('legacy account fields are discarded during migration', () => {
  const legacy = {
    id: 'a1',
    name: 'TCU Checking',
    institution: 'Together Credit Union',
    number: '1234567890',
    lastFour: '7890',
    kind: 'checking',
  };

  assert.deepEqual(migrateAccount(legacy), {
    id: 'a1',
    institution: 'Together Credit Union',
    kind: 'checking',
  });
});

test('legacy records are detected so storage can be rewritten', () => {
  assert.equal(needsMigration([{ id: 'a', institution: 'TCU', number: '12345678', kind: 'checking' }]), true);
  assert.equal(needsMigration([{ id: 'a', institution: 'TCU', lastFour: '5678', kind: 'checking' }]), true);
  assert.equal(needsMigration([{ id: 'a', institution: 'TCU', kind: 'checking' }]), false);
});

test('unsupported and unusable records are dropped', () => {
  assert.equal(migrateAccount(null), null);
  assert.equal(migrateAccount({ id: 'a', institution: '', kind: 'checking' }), null);
  assert.equal(migrateAccount({ id: 'a', institution: 'TCU', kind: 'credit_card' }), null);
});

test('accounts sort checking before savings, alphabetically by bank', () => {
  const accounts = [
    { id: '1', institution: 'Zeta Bank', kind: 'savings' },
    { id: '2', institution: 'Beta Bank', kind: 'checking' },
    { id: '3', institution: 'Alpha Bank', kind: 'savings' },
    { id: '4', institution: 'Alpha Bank', kind: 'checking' },
  ];

  assert.deepEqual(
    sortAccounts(accounts).map(({ institution, kind }) => `${institution}:${kind}`),
    ['Alpha Bank:checking', 'Beta Bank:checking', 'Alpha Bank:savings', 'Zeta Bank:savings'],
  );
});

test('the summary counts checking and savings', () => {
  const accounts = [
    { id: '1', institution: 'A', kind: 'checking' },
    { id: '2', institution: 'B', kind: 'savings' },
    { id: '3', institution: 'C', kind: 'savings' },
  ];

  assert.deepEqual(summarizeAccounts(accounts), { total: 3, checking: 1, savings: 2 });
  assert.deepEqual(summarizeAccounts(), { total: 0, checking: 0, savings: 0 });
});
