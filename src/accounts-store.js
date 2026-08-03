import { toLastFour } from './accounts.js';

const STORAGE_KEY = 'project-ledger.accounts.v1';

/**
 * Browser-local persistence for saved bank accounts.
 *
 * There is no backend wired yet, so accounts live in localStorage and stay on
 * the device that entered them. Every read is defensive: a corrupt or
 * hand-edited value must not take the page down.
 */

function storage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    // Storage is unavailable in private-mode and sandboxed contexts.
    return null;
  }
}

function isRecord(value) {
  return value && typeof value === 'object' && typeof value.id === 'string';
}

/**
 * Bring a stored record up to the current shape.
 *
 * Earlier builds stored a whole account number under `number`. Those are
 * reduced to their last four digits here and the full value is dropped, so
 * loading the page is enough to clear it from the device.
 */
export function migrateAccount(record) {
  if (!isRecord(record)) return null;

  const lastFour = toLastFour(record.lastFour ?? record.number);
  if (!lastFour || typeof record.name !== 'string' || typeof record.kind !== 'string') {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    institution: typeof record.institution === 'string' ? record.institution : '',
    lastFour,
    kind: record.kind,
  };
}

/** True when any stored record still carries a pre-migration full number. */
export function needsMigration(records = []) {
  return records.some((record) => isRecord(record) && record.number !== undefined);
}

export function loadAccounts() {
  const store = storage();
  if (!store) return [];

  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];

    const migrated = parsed.map(migrateAccount).filter(Boolean);

    // Rewrite immediately so a discarded full number does not linger on disk.
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
    store.setItem(STORAGE_KEY, JSON.stringify(accounts));
    return true;
  } catch {
    return false;
  }
}
