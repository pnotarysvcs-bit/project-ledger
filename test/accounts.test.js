import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCOUNT_KINDS,
  createAccount,
  maskAccountNumber,
  normalizeAccountNumber,
  sortAccounts,
  summarizeAccounts,
  validateAccount,
} from '../src/accounts.js';

const valid = { name: 'TCU Checking', number: '12345678', kind: 'Checking' };

test('spaces and dashes are stripped from account numbers', () => {
  assert.equal(normalizeAccountNumber('1234-5678'), '12345678');
  assert.equal(normalizeAccountNumber('1234 5678'), '12345678');
  assert.equal(normalizeAccountNumber(null), '');
});

test('only the last four digits are ever displayed', () => {
  assert.equal(maskAccountNumber('123456789'), '••••6789');
  assert.equal(maskAccountNumber('1234-5678'), '••••5678');
  assert.equal(maskAccountNumber(''), '');
});

test('a number too short to have a tail is masked completely', () => {
  assert.equal(maskAccountNumber('1234'), '••••');
  assert.equal(maskAccountNumber('12'), '••');
});

test('a complete account passes validation', () => {
  const result = validateAccount(valid);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test('name, number, and kind are each required', () => {
  const result = validateAccount({ name: '  ', number: '', kind: '' });

  assert.equal(result.valid, false);
  assert.ok(result.errors.name);
  assert.ok(result.errors.number);
  assert.ok(result.errors.kind);
});

test('account numbers must be digits only', () => {
  const result = validateAccount({ ...valid, number: '12ab5678' });

  assert.equal(result.valid, false);
  assert.match(result.errors.number, /digits only/);
});

test('account numbers outside 4 to 17 digits are rejected', () => {
  assert.equal(validateAccount({ ...valid, number: '123' }).valid, false);
  assert.equal(validateAccount({ ...valid, number: '1'.repeat(18) }).valid, false);
  assert.equal(validateAccount({ ...valid, number: '1'.repeat(17) }).valid, true);
});

test('only checking and savings are accepted', () => {
  assert.deepEqual(ACCOUNT_KINDS, ['Checking', 'Savings']);
  assert.equal(validateAccount({ ...valid, kind: 'Savings' }).valid, true);
  assert.equal(validateAccount({ ...valid, kind: 'Brokerage' }).valid, false);
});

test('the same number cannot be saved twice, however it is punctuated', () => {
  const existing = [createAccount(valid)];
  const duplicate = validateAccount({ ...valid, number: '1234-5678' }, existing);

  assert.equal(duplicate.valid, false);
  assert.match(duplicate.errors.number, /already saved/);
});

test('editing an account does not collide with itself', () => {
  const saved = createAccount(valid);
  const edited = validateAccount({ ...valid, id: saved.id, name: 'Renamed' }, [saved]);

  assert.equal(edited.valid, true);
});

test('a created account stores the number normalized', () => {
  const account = createAccount({ name: '  TCU Savings ', number: '9876-5432', kind: 'Savings' });

  assert.equal(account.name, 'TCU Savings');
  assert.equal(account.number, '98765432');
  assert.equal(account.kind, 'Savings');
  assert.ok(account.id);
});

test('accounts sort checking before savings, alphabetically within a kind', () => {
  const accounts = [
    { id: '1', name: 'Zeta Savings', number: '1111', kind: 'Savings' },
    { id: '2', name: 'Beta Checking', number: '2222', kind: 'Checking' },
    { id: '3', name: 'Alpha Savings', number: '3333', kind: 'Savings' },
    { id: '4', name: 'Alpha Checking', number: '4444', kind: 'Checking' },
  ];

  assert.deepEqual(
    sortAccounts(accounts).map(({ name }) => name),
    ['Alpha Checking', 'Beta Checking', 'Alpha Savings', 'Zeta Savings'],
  );
});

test('the summary counts each kind', () => {
  const accounts = [
    { id: '1', name: 'A', number: '1111', kind: 'Checking' },
    { id: '2', name: 'B', number: '2222', kind: 'Savings' },
    { id: '3', name: 'C', number: '3333', kind: 'Savings' },
  ];

  assert.deepEqual(summarizeAccounts(accounts), { total: 3, checking: 1, savings: 2 });
  assert.deepEqual(summarizeAccounts(), { total: 0, checking: 0, savings: 0 });
});
