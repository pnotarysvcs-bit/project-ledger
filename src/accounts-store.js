const STORAGE_KEY = 'project-ledger.accounts.v1';

/**
 * Browser-local persistence for saved bank accounts.
 *
 * There is no backend yet, so accounts live in localStorage and stay on the
 * device that entered them. Every read is defensive: a corrupt or hand-edited
 * value must not take the page down.
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

function isAccountRecord(value) {
  return value
    && typeof value === 'object'
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.number === 'string'
    && typeof value.kind === 'string';
}

export function loadAccounts() {
  const store = storage();
  if (!store) return [];

  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isAccountRecord) : [];
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
