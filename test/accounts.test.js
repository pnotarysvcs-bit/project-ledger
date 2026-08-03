import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCOUNT_KINDS,
  createAccount,
  formatLastFour,
  labelForKind,
  normalizeDigits,
  sortAccounts,
  summarizeAccounts,
  toLastFour,
  validateAccount,
} from '../src/accounts.js';
import { migrateAccount, needsMigration } from '../src/accounts-store.js';

const valid = { name: 'TCU Checking', institution: 'TCU', lastFour: '5678', kind: 'checking' };

test('spaces and dashes are stripped', () => {
  assert.equal(normalizeDigits('1234-5678'), '12345678');
  assert.equal(normalizeDigits('1234 5678'), '12345678');
  assert.equal(normalizeDigits(null), '');
});

test('pasting a whole account number keeps only the last four digits', () => {
  assert.equal(toLastFour('1234567890'), '7890');
  assert.equal(toLastFour('1234-5678'), '5678');
  assert.equal(toLastFour('5678'), '5678');
});

test('stored digits render masked', () => {
  assert.equal(formatLastFour('5678'), '••••5678');
  assert.equal(formatLastFour(''), '');
});

test('a complete account passes validation', () => {
  const result = validateAccount(valid);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test('name, institution, last four, and kind are each required', () => {
  const result = validateAccount({ name: '  ', institution: '', lastFour: '', kind: '' });

  assert.equal(result.valid, false);
  assert.ok(result.errors.name);
  assert.ok(result.errors.institution);
  assert.ok(result.errors.lastFour);
  assert.ok(result.errors.kind);
});

test('last four must be exactly four digits', () => {
  assert.match(validateAccount({ ...valid, lastFour: '567' }).errors.lastFour, /exactly four/);
  assert.match(validateAccount({ ...valid, lastFour: '56789' }).errors.lastFour, /exactly four/);
  assert.match(validateAccount({ ...valid, lastFour: '56a8' }).errors.lastFour, /Digits only/);
});

test('kinds mirror the account_type enum exactly', () => {
  assert.deepEqual(ACCOUNT_KINDS, ['checking', 'savings', 'credit_card']);
  assert.equal(validateAccount({ ...valid, kind: 'savings' }).valid, true);
  assert.equal(validateAccount({ ...valid, kind: 'credit_card' }).valid, true);
  assert.equal(validateAccount({ ...valid, kind: 'brokerage' }).valid, false);
  // Capitalised labels are presentation only and are not valid stored values.
  assert.equal(validateAccount({ ...valid, kind: 'Checking' }).valid, false);
});

test('labels are presentation only', () => {
  assert.equal(labelForKind('credit_card'), 'Credit Card');
  assert.equal(labelForKind('checking'), 'Checking');
});

test('the same last four at the same institution cannot be saved twice', () => {
  const existing = [createAccount(valid)];
  const duplicate = validateAccount(valid, existing);

  assert.equal(duplicate.valid, false);
  assert.match(duplicate.errors.lastFour, /already saved/);
});

test('the same last four at a different institution is allowed', () => {
  const existing = [createAccount(valid)];
  const other = validateAccount({ ...valid, institution: 'Chase' }, existing);

  assert.equal(other.valid, true);
});

test('editing an account does not collide with itself', () => {
  const saved = createAccount(valid);
  const edited = validateAccount({ ...valid, id: saved.id, name: 'Renamed' }, [saved]);

  assert.equal(edited.valid, true);
});

test('a created account never carries a full account number', () => {
  const account = createAccount({ name: ' TCU Savings ', institution: ' TCU ', lastFour: '9876-5432', kind: 'savings' });

  assert.equal(account.name, 'TCU Savings');
  assert.equal(account.institution, 'TCU');
  assert.equal(account.lastFour, '5432');
  assert.equal(account.number, undefined);
});

test('a legacy record with a full number is reduced to its last four', () => {
  const legacy = { id: 'a1', name: 'Old', number: '1234567890', kind: 'Checking' };

  const migrated = migrateAccount(legacy);

  assert.equal(migrated.kind, 'checking', 'capitalised label migrates to the enum value');
  assert.equal(migrated.lastFour, '7890');
  assert.equal(migrated.number, undefined);
  assert.equal(migrated.institution, '');
});

test('legacy records are detected so storage can be rewritten', () => {
  assert.equal(needsMigration([{ id: 'a', number: '12345678' }]), true);
  assert.equal(needsMigration([{ id: 'a', lastFour: '5678', kind: 'Checking' }]), true);
  assert.equal(needsMigration([{ id: 'a', lastFour: '5678', kind: 'checking' }]), false);
});

test('unusable records are dropped rather than half-loaded', () => {
  assert.equal(migrateAccount(null), null);
  assert.equal(migrateAccount({ id: 'a', name: 'No digits', kind: 'checking' }), null);
  assert.equal(migrateAccount({ id: 'a', name: 'Bad kind', lastFour: '1234', kind: 'brokerage' }), null);
});

test('accounts sort checking before savings, alphabetically within a kind', () => {
  const accounts = [
    { id: '1', name: 'Zeta Savings', lastFour: '1111', kind: 'savings' },
    { id: '2', name: 'Beta Checking', lastFour: '2222', kind: 'checking' },
    { id: '3', name: 'Alpha Savings', lastFour: '3333', kind: 'savings' },
    { id: '4', name: 'Alpha Checking', lastFour: '4444', kind: 'checking' },
  ];

  assert.deepEqual(
    sortAccounts(accounts).map(({ name }) => name),
    ['Alpha Checking', 'Beta Checking', 'Alpha Savings', 'Zeta Savings'],
  );
});

test('the summary counts each kind', () => {
  const accounts = [
    { id: '1', name: 'A', lastFour: '1111', kind: 'checking' },
    { id: '2', name: 'B', lastFour: '2222', kind: 'savings' },
    { id: '3', name: 'C', lastFour: '3333', kind: 'savings' },
  ];

  assert.deepEqual(summarizeAccounts(accounts), { total: 3, checking: 1, savings: 2, creditCard: 0 });
  assert.deepEqual(summarizeAccounts(), { total: 0, checking: 0, savings: 0, creditCard: 0 });
});
