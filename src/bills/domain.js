export const BILL_TYPE_ORDER = Object.freeze(['Personal', 'Capital One', 'Business', 'Streaming']);

export function invalidBillCategory(value) {
  return ['business', 'personal'].includes(String(value ?? '').trim().toLowerCase());
}

export function deriveBillType(account, requestedType) {
  const normalizedAccount = String(account ?? '').trim().toUpperCase();
  if (normalizedAccount.startsWith('TCUB')) return 'Business';
  if (normalizedAccount.startsWith('TCU')) return 'Personal';
  return String(requestedType ?? '').trim();
}

function billGroup(bill) {
  const account = String(bill?.account ?? '').trim().toUpperCase();
  if (account.startsWith('TCUB')) return 'Business';
  if (account.startsWith('TCU')) return 'Personal';
  if (account.includes('CAPITAL ONE') || account === 'CAPITALONE') return 'Capital One';
  return String(bill?.type ?? '').trim();
}

export function classifyBillStatus({ effectiveAmount, submitted = 0, dueDate }, asOf = new Date()) {
  if (effectiveAmount === null || effectiveAmount === undefined) return 'incomplete';
  if (submitted >= effectiveAmount) return 'submitted';
  if (submitted > 0) return 'partial';
  if (dueDate && new Date(`${dueDate}T23:59:59Z`) < asOf) return 'overdue';
  return '';
}

export function sortBillOccurrences(rows) {
  return [...rows].sort((a, b) => {
    const due = String(a.nextDue ?? '').localeCompare(String(b.nextDue ?? ''));
    if (due !== 0) return due;
    return String(a.payee ?? '').localeCompare(String(b.payee ?? ''));
  });
}

export function groupBillsByType(rows) {
  const groups = new Map(BILL_TYPE_ORDER.map((type) => [type, []]));
  for (const bill of rows) {
    const group = billGroup(bill);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(bill);
  }

  const canonical = BILL_TYPE_ORDER
    .map((type) => ({ type, bills: sortBillOccurrences(groups.get(type) ?? []) }))
    .filter(({ bills }) => bills.length > 0);

  const unknown = [...groups.entries()]
    .filter(([type, bills]) => !BILL_TYPE_ORDER.includes(type) && bills.length > 0)
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([type, bills]) => ({ type, bills: sortBillOccurrences(bills) }));

  return [...canonical, ...unknown];
}

export function calculateOccurrenceAmounts({ budget, actualAmount, payments = [] }) {
  const effectiveAmount = actualAmount ?? budget ?? null;
  const submitted = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  return {
    effectiveAmount,
    submitted,
    remaining: effectiveAmount === null ? null : Math.max(effectiveAmount - submitted, 0),
    credit: effectiveAmount === null ? 0 : Math.max(submitted - effectiveAmount, 0),
  };
}
