/**
 * Placeholder data for dashboard widgets the ledger cannot yet derive.
 *
 * NOT REAL FIGURES. The ledger records bills and payments, so it has no income
 * stream, no account balances, and no savings goals to read from. These values
 * exist so the dashboard can be laid out and reviewed, and every widget that
 * uses them is marked "Sample" in the interface.
 *
 * Replace each export as its backing feature lands, and delete this file once
 * nothing imports it.
 */

export const SAMPLE_CASH_FLOW = {
  income: 6850,
  expenses: 4825.19,
  netCashFlow: 2024.81,
  availableToAllocate: 1785.52,
};

export const SAMPLE_SAVINGS_GOALS = [
  { id: 'emergency', name: 'Emergency Fund', saved: 3450, target: 5000, tone: 'blue' },
  { id: 'down-payment', name: '2026 Down Payment', saved: 7825, target: 20000, tone: 'green' },
  { id: 'mom', name: 'Mom Fund', saved: 2125, target: 5000, tone: 'purple' },
];

/**
 * Balances shown beside saved accounts.
 *
 * Keyed by account kind because a real balance feed does not exist yet; the
 * Accounts page stores a name, number, and kind but no balance.
 */
export const SAMPLE_BALANCES = {
  checking: { amount: 2457.32, caption: 'Available', trend: [4, 6, 5, 8, 7, 9, 8] },
  savings: { amount: 8650, caption: 'Available', trend: [3, 4, 4, 5, 6, 6, 7] },
  credit_card: { amount: 1245.78, caption: 'Current Balance', trend: [7, 6, 8, 5, 6, 4, 5] },
};

export const SAMPLE_TIP = 'Reconcile your accounts weekly to stay on track and avoid surprises.';
