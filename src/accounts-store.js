import { ACCOUNT_KINDS } from './accounts.js';

const STORAGE_KEY = 'project-ledger.accounts.v1';

/**
 * Temporary browser-local persistence for saved bank accounts.
 *
 * Records contain only bank name and account type. Legacy account-number,
 * last-four, nickname, and credit-card fields are discarded during migration.
 */

function storage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value) {
  return value && typeof value === 'object' && typeof value.id === 'string';
}

export function migrateAccount(record) {
  if (!isRecord(record)) return null;

  const institution = String(record.institution ?? record.name ?? '').trim();
  const kind = String(record.kind ?? '').toLowerCase().replace(/[\s-]/g, '_');

  if (!institution || !ACCOUNT_KINDS.includes(kind)) return null;

  return {
    id: record.id,
    institution,
    kind,
  };
}

export function needsMigration(records = []) {
  return records.some((record) => isRecord(record)
    && (record.number !== undefined
      || record.lastFour !== undefined
      || record.name !== undefined
      || !ACCOUNT_KINDS.includes(record.kind)));
}

export function loadAccounts() {
  const store = storage();
  if (!store) return [];

  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];

    const migrated = parsed.map(migrateAccount).filter(Boolean);
    if (needsMigration(parsed)) saveAccounts(migrated);

    return migrated;
  } catch {
    return [];
  }
}

export function saveAccounts(accounts) {
  const store = storage();
  if (!store) return false;

  try {
    const safeAccounts = accounts.map(migrateAccount).filter(Boolean);
    store.setItem(STORAGE_KEY, JSON.stringify(safeAccounts));
    return true;
  } catch {
    return false;
  }
}
