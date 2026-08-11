import { createHash } from 'node:crypto';

const MONTHS = Object.fromEntries(['january','february','march','april','may','june','july','august','september','october','november','december'].map((name, i) => [name, i + 1]));
const EXCLUDED = /\b(restaurant|cafe|coffee|starbucks|mcdonald|wendy|gas|fuel|shell|quiktrip|walmart|target|cash app|venmo|zelle)\b/i;
const RECURRING_HINT = /\b(payment|autopay|insurance|utility|water|mobile|wireless|credit|card|loan|mortgage|property|life)\b/i;

export function monthFromDate(value) { return value ? String(value).slice(0, 7) : null; }

export function detectStatementPeriod(text) {
  const normalized = String(text ?? '').replace(/[–—]/g, '-');
  const numeric = normalized.match(/\b(0?[1-9]|1[0-2])[\/-](0?[1-9]|[12]\d|3[01])[\/-](20\d{2})\s*(?:-|to|through)\s*(0?[1-9]|1[0-2])[\/-](0?[1-9]|[12]\d|3[01])[\/-](20\d{2})\b/i);
  const named = normalized.match(new RegExp(`\\b(${Object.keys(MONTHS).join('|')})\\s+(\\d{1,2}),?\\s+(20\\d{2})\\s*(?:-|to|through)\\s*(${Object.keys(MONTHS).join('|')})\\s+(\\d{1,2}),?\\s+(20\\d{2})`, 'i'));
  let start; let end;
  if (numeric) {
    start = `${numeric[3]}-${String(numeric[1]).padStart(2, '0')}-${String(numeric[2]).padStart(2, '0')}`;
    end = `${numeric[6]}-${String(numeric[4]).padStart(2, '0')}-${String(numeric[5]).padStart(2, '0')}`;
  } else if (named) {
    start = `${named[3]}-${String(MONTHS[named[1].toLowerCase()]).padStart(2, '0')}-${String(named[2]).padStart(2, '0')}`;
    end = `${named[6]}-${String(MONTHS[named[4].toLowerCase()]).padStart(2, '0')}-${String(named[5]).padStart(2, '0')}`;
  } else return { start: null, end: null, detectedMonth: null, confidence: 'uncertain', spansMonths: false };
  const spansMonths = monthFromDate(start) !== monthFromDate(end);
  return { start, end, detectedMonth: spansMonths ? monthFromDate(end) : monthFromDate(start), confidence: spansMonths ? 'confirmation-required' : 'high', spansMonths };
}

export function normalizePayee(value) {
  return String(value ?? '').toLowerCase().replace(/\b(pos|debit|ach|withdrawal|payment|autopay|online|recurring|purchase)\b/g, ' ').replace(/[#*]\S+/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function extractTransactions(text, year = new Date().getUTCFullYear()) {
  const rows = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const match = line.trim().match(/^(?:(\d{4})[-\/])?(\d{1,2})[-\/](\d{1,2})\s+(.+?)\s+\(?-?\$?([\d,]+\.\d{2})\)?$/);
    if (!match) continue;
    const dateYear = match[1] ?? year;
    const rawDescription = match[4].trim();
    if (/deposit|credit|refund|interest/i.test(rawDescription)) continue;
    rows.push({ date: `${dateYear}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`, rawDescription, normalizedPayee: normalizePayee(rawDescription), amount: Number(match[5].replace(/,/g, '')) });
  }
  return rows;
}

function similarity(left, right) {
  if (!left || !right) return 0;
  if (left.includes(right) || right.includes(left)) return 0.9;
  const a = new Set(left.split(' ')); const b = new Set(right.split(' '));
  const overlap = [...a].filter((word) => b.has(word)).length;
  return overlap / Math.max(a.size, b.size);
}

export function reconcileTransactions(transactions, bills, { amountTolerance = 5, dateWindowDays = 14 } = {}) {
  return transactions.map((transaction) => {
    if (EXCLUDED.test(transaction.rawDescription)) return { ...transaction, status: 'Unmatched', reason: 'Discretionary or person-to-person transaction' };
    const candidates = bills.map((bill) => {
      const names = [bill.payee, bill.billName, ...(bill.aliases ?? [])].map(normalizePayee);
      const nameScore = Math.max(...names.map((name) => similarity(transaction.normalizedPayee, name)));
      const expected = bill.actualAmount ?? bill.budget;
      const amountDifference = expected == null ? null : Math.abs(transaction.amount - Number(expected));
      const dueDifference = bill.nextDue ? Math.abs((new Date(`${transaction.date}T00:00:00Z`) - new Date(`${bill.nextDue}T00:00:00Z`)) / 86400000) : null;
      const accountScore = !bill.account || !transaction.account || bill.account === transaction.account ? 0.05 : -0.15;
      const score = nameScore + (amountDifference != null && amountDifference <= amountTolerance ? 0.2 : 0) + (dueDifference != null && dueDifference <= dateWindowDays ? 0.1 : 0) + accountScore;
      return { bill, score, amountDifference };
    }).sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (best?.score >= 0.85) return { ...transaction, billId: best.bill.id, occurrenceId: best.bill.occurrenceId, expectedAmount: best.bill.actualAmount ?? best.bill.budget, status: best.amountDifference != null && best.amountDifference > amountTolerance ? 'Amount Variance' : 'Matched', confidence: best.score };
    if (RECURRING_HINT.test(transaction.rawDescription)) return { ...transaction, status: 'NEW', reason: 'Likely recurring bill; approval required' };
    return { ...transaction, status: 'Unmatched', reason: 'No reliable Master Bill match' };
  });
}

export function statementHash(buffer) { return createHash('sha256').update(buffer).digest('hex'); }

export function effectiveStatementMonth(detection, override) {
  if (override && !/^\d{4}-\d{2}$/.test(override)) throw new Error('Statement month override must use YYYY-MM.');
  return override || detection.detectedMonth;
}
