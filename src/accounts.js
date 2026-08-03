/**
 * Bank accounts — validation and display rules.
 *
 * Kept free of storage and React so the rules can be tested directly and
 * reused by any view that needs to render or check an account.
 */

export const ACCOUNT_KINDS = ['Checking', 'Savings'];

const MIN_DIGITS = 4;
const MAX_DIGITS = 17;
const MAX_NAME_LENGTH = 60;

/** Strip the spaces and dashes people paste in from a statement or cheque. */
export function normalizeAccountNumber(number) {
  return String(number ?? '').replace(/[\s-]/g, '');
}

/**
 * Render an account number as the last four digits only.
 *
 * The full number is never displayed back to the page. A number too short to
 * have a meaningful tail is masked completely rather than partially revealed.
 */
export function maskAccountNumber(number) {
  const digits = normalizeAccountNumber(number);
  if (!digits) return '';
  if (digits.length <= MIN_DIGITS) return '•'.repeat(digits.length);
  return `••••${digits.slice(-4)}`;
}

export function validateAccount(input = {}, existingAccounts = []) {
  const name = String(input.name ?? '').trim();
  const digits = normalizeAccountNumber(input.number);
  const kind = input.kind ?? '';
  const errors = {};

  if (!name) {
    errors.name = 'Enter an account name.';
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Keep the name under ${MAX_NAME_LENGTH} characters.`;
  }

  if (!digits) {
    errors.number = 'Enter an account number.';
  } else if (!/^\d+$/.test(digits)) {
    errors.number = 'Account numbers contain digits only.';
  } else if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) {
    errors.number = `Account numbers are ${MIN_DIGITS} to ${MAX_DIGITS} digits.`;
  } else if (existingAccounts.some((account) => account.number === digits
    && account.id !== input.id)) {
    errors.number = 'That account number is already saved.';
  }

  if (!ACCOUNT_KINDS.includes(kind)) {
    errors.kind = 'Choose checking or savings.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Build a stored account record from validated form input.
 *
 * The number is held normalized so that "1234-5678" and "12345678" cannot be
 * saved as two different accounts.
 */
export function createAccount(input, { id = null } = {}) {
  return {
    id: id ?? `acct_${normalizeAccountNumber(input.number).slice(-4)}_${Date.now().toString(36)}`,
    name: String(input.name ?? '').trim(),
    number: normalizeAccountNumber(input.number),
    kind: input.kind,
  };
}

/** Checking first, then savings, alphabetical within each group. */
export function sortAccounts(accounts = []) {
  return [...accounts].sort((left, right) => {
    if (left.kind !== right.kind) {
      return ACCOUNT_KINDS.indexOf(left.kind) - ACCOUNT_KINDS.indexOf(right.kind);
    }
    return left.name.localeCompare(right.name);
  });
}

export function summarizeAccounts(accounts = []) {
  return {
    total: accounts.length,
    checking: accounts.filter(({ kind }) => kind === 'Checking').length,
    savings: accounts.filter(({ kind }) => kind === 'Savings').length,
  };
}
