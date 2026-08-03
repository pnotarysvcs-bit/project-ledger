/**
 * Bank accounts — validation and display rules.
 *
 * Modelled on the `accounts` table, which stores `last_four` rather than a
 * whole account number. Only the last four digits are ever captured, so a full
 * account number never reaches the client or storage in the first place.
 *
 * Kept free of storage and React so the rules can be tested directly and
 * reused by any view that needs to render or check an account.
 */

// Mirrors the accounts.account_type enum exactly. Values are stored as the
// database spells them; labels are presentation only.
export const ACCOUNT_KINDS = ['checking', 'savings', 'credit_card'];

export const ACCOUNT_KIND_LABELS = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
};

export const labelForKind = (kind) => ACCOUNT_KIND_LABELS[kind] ?? kind;

const LAST_FOUR_LENGTH = 4;
const MAX_TEXT_LENGTH = 60;

/** Strip the spaces and dashes people paste in from a statement or cheque. */
export function normalizeDigits(value) {
  return String(value ?? '').replace(/[\s-]/g, '');
}

/**
 * Reduce whatever was typed to the last four digits.
 *
 * Accepts a full account number so that pasting one still works, but keeps
 * only the tail — the rest is discarded before it can be stored.
 */
export function toLastFour(value) {
  const digits = normalizeDigits(value);
  return digits.slice(-LAST_FOUR_LENGTH);
}

/** Render stored digits as a masked account reference. */
export function formatLastFour(lastFour) {
  const digits = normalizeDigits(lastFour);
  if (!digits) return '';
  return `••••${digits.slice(-LAST_FOUR_LENGTH)}`;
}

export function validateAccount(input = {}, existingAccounts = []) {
  const name = String(input.name ?? '').trim();
  const institution = String(input.institution ?? '').trim();
  const lastFour = normalizeDigits(input.lastFour);
  const kind = input.kind ?? '';
  const errors = {};

  if (!name) {
    errors.name = 'Enter an account name.';
  } else if (name.length > MAX_TEXT_LENGTH) {
    errors.name = `Keep the name under ${MAX_TEXT_LENGTH} characters.`;
  }

  if (!institution) {
    errors.institution = 'Enter the bank or institution.';
  } else if (institution.length > MAX_TEXT_LENGTH) {
    errors.institution = `Keep the institution under ${MAX_TEXT_LENGTH} characters.`;
  }

  if (!lastFour) {
    errors.lastFour = 'Enter the last four digits.';
  } else if (!/^\d+$/.test(lastFour)) {
    errors.lastFour = 'Digits only.';
  } else if (lastFour.length !== LAST_FOUR_LENGTH) {
    errors.lastFour = 'Enter exactly four digits.';
  } else if (existingAccounts.some((account) => account.lastFour === lastFour
    && account.institution?.toLocaleLowerCase() === institution.toLocaleLowerCase()
    && account.id !== input.id)) {
    // Last four alone is not unique across banks, so match on the pair.
    errors.lastFour = 'That account is already saved for this institution.';
  }

  if (!ACCOUNT_KINDS.includes(kind)) {
    errors.kind = 'Choose an account type.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Build a stored account record from validated form input. */
export function createAccount(input, { id = null } = {}) {
  // Truncate rather than normalize: if a whole number reaches here despite
  // validation, only its tail is allowed into storage.
  const lastFour = toLastFour(input.lastFour);

  return {
    id: id ?? `acct_${lastFour}_${Date.now().toString(36)}`,
    name: String(input.name ?? '').trim(),
    institution: String(input.institution ?? '').trim(),
    lastFour,
    kind: input.kind,
  };
}

/** Grouped in enum order, alphabetical by name within each group. */
export function sortAccounts(accounts = []) {
  return [...accounts].sort((left, right) => {
    if (left.kind !== right.kind) {
      return ACCOUNT_KINDS.indexOf(left.kind) - ACCOUNT_KINDS.indexOf(right.kind);
    }
    return left.name.localeCompare(right.name);
  });
}

export function summarizeAccounts(accounts = []) {
  const countOf = (kind) => accounts.filter((account) => account.kind === kind).length;

  return {
    total: accounts.length,
    checking: countOf('checking'),
    savings: countOf('savings'),
    creditCard: countOf('credit_card'),
  };
}
