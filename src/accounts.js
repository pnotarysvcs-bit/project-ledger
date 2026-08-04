/**
 * Bank accounts — validation and display rules.
 *
 * Project Ledger only needs the bank name and whether the account is checking
 * or savings. Account numbers and last-four references are intentionally not
 * collected or stored.
 */

export const ACCOUNT_KINDS = ['checking', 'savings'];

export const ACCOUNT_KIND_LABELS = {
  checking: 'Checking',
  savings: 'Savings',
};

export const labelForKind = (kind) => ACCOUNT_KIND_LABELS[kind] ?? kind;

const MAX_TEXT_LENGTH = 60;

export function validateAccount(input = {}, existingAccounts = []) {
  const institution = String(input.institution ?? '').trim();
  const kind = input.kind ?? '';
  const errors = {};

  if (!institution) {
    errors.institution = 'Enter the bank name.';
  } else if (institution.length > MAX_TEXT_LENGTH) {
    errors.institution = `Keep the bank name under ${MAX_TEXT_LENGTH} characters.`;
  } else if (existingAccounts.some((account) =>
    account.institution?.toLocaleLowerCase() === institution.toLocaleLowerCase()
    && account.kind === kind
    && account.id !== input.id)) {
    errors.institution = `That ${labelForKind(kind).toLowerCase()} account is already saved for this bank.`;
  }

  if (!ACCOUNT_KINDS.includes(kind)) {
    errors.kind = 'Choose checking or savings.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Build a stored account record from validated form input. */
export function createAccount(input, { id = null } = {}) {
  const institution = String(input.institution ?? '').trim();

  return {
    id: id ?? `acct_${input.kind}_${Date.now().toString(36)}`,
    institution,
    kind: input.kind,
  };
}

/** Grouped by account type, then alphabetically by bank name. */
export function sortAccounts(accounts = []) {
  return [...accounts].sort((left, right) => {
    if (left.kind !== right.kind) {
      return ACCOUNT_KINDS.indexOf(left.kind) - ACCOUNT_KINDS.indexOf(right.kind);
    }
    return left.institution.localeCompare(right.institution);
  });
}

export function summarizeAccounts(accounts = []) {
  const countOf = (kind) => accounts.filter((account) => account.kind === kind).length;

  return {
    total: accounts.length,
    checking: countOf('checking'),
    savings: countOf('savings'),
  };
}
