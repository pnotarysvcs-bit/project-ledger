import { createHash } from 'node:crypto';

const MONTH_NAMES = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const MONTHS = Object.fromEntries(MONTH_NAMES.flatMap((name, i) => [[name, i + 1], [name.slice(0, 3), i + 1]]));
const MONTH_ABBR = Object.fromEntries(MONTH_NAMES.flatMap((name, i) => [[name.slice(0, 3), i + 1], [name, i + 1]]));
const MONTH_PATTERN = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const EXCLUDED = /\b(restaurant|cafe|coffee|starbucks|mcdonald|wendy|burger\s*king|gas|fuel|shell|quiktrip|walmart|target|cash app|cashapp|venmo|zelle)\b/i;
const RECURRING_HINT = /\b(payment|autopay|insurance|utility|water|mobile|wireless|credit|card|loan|mortgage|property|life|affirm|afterpay)\b/i;
const NON_PURCHASE = /\b(payment|pymt|credit|refund|adjustment|deposit|interest\s+charge|fee\s+summary|rewards?)\b/i;
const cents = (value) => Math.round(Number(value ?? 0) * 100);

export function monthFromDate(value) { return value ? String(value).slice(0, 7) : null; }

function monthNumber(value) {
  return MONTHS[String(value ?? '').toLowerCase()] ?? null;
}

export function detectStatementPeriod(text) {
  const normalized = String(text ?? '').replace(/[–—]/g, '-');
  const numeric = normalized.match(/\b(0?[1-9]|1[0-2])[\/-](0?[1-9]|[12]\d|3[01])[\/-](20\d{2})\s*(?:-|to|through)\s*(0?[1-9]|1[0-2])[\/-](0?[1-9]|[12]\d|3[01])[\/-](20\d{2})\b/i);
  const named = normalized.match(new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(20\\d{2})\\s*(?:-|to|through)\\s*(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(20\\d{2})`, 'i'));
  let start; let end;
  if (numeric) {
    start = `${numeric[3]}-${String(numeric[1]).padStart(2, '0')}-${String(numeric[2]).padStart(2, '0')}`;
    end = `${numeric[6]}-${String(numeric[4]).padStart(2, '0')}-${String(numeric[5]).padStart(2, '0')}`;
  } else if (named) {
    start = `${named[3]}-${String(monthNumber(named[1])).padStart(2, '0')}-${String(named[2]).padStart(2, '0')}`;
    end = `${named[6]}-${String(monthNumber(named[4])).padStart(2, '0')}-${String(named[5]).padStart(2, '0')}`;
  } else return { start: null, end: null, detectedMonth: null, confidence: 'uncertain', spansMonths: false };
  const spansMonths = monthFromDate(start) !== monthFromDate(end);
  return { start, end, detectedMonth: spansMonths ? monthFromDate(end) : monthFromDate(start), confidence: spansMonths ? 'confirmation-required' : 'high', spansMonths };
}

export function normalizePayee(value) {
  return String(value ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\b(pos|debit|ach|withdrawal|payment|autopay|online|recurring|purchase|transaction|checkcard)\b/g, ' ')
    .replace(/[#*]\S+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMoneyToken(value) {
  const text = String(value ?? '');
  const negative = text.includes('-') || (text.startsWith('(') && text.endsWith(')'));
  const amount = Number(text.replace(/[^0-9.]/g, ''));
  return negative ? -amount : amount;
}

function nearestYearForMonth(month, anchorYear, anchorMonth) {
  const anchorIndex = anchorYear * 12 + (anchorMonth - 1);
  return [anchorYear - 1, anchorYear, anchorYear + 1]
    .map((year) => ({ year, distance: Math.abs((year * 12 + (month - 1)) - anchorIndex) }))
    .sort((a, b) => a.distance - b.distance)[0].year;
}

function namedMonthNumber(value) {
  return MONTH_ABBR[String(value ?? '').toLowerCase()] ?? null;
}

export function extractTransactions(text, year = new Date().getUTCFullYear(), anchorMonth = 12) {
  const rows = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    const named = trimmed.match(/^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})\s+(.+)$/i);
    if (named) {
      const transactionMonth = namedMonthNumber(named[1]);
      const remainder = named[5].trim();
      const moneyTokens = [...remainder.matchAll(/\(?-?\$?[\d,]+\.\d{2}\)?/g)];
      if (!transactionMonth || !moneyTokens.length) continue;
      const firstMoney = moneyTokens[0];
      const rawDescription = remainder.slice(0, firstMoney.index).trim();
      if (!rawDescription || NON_PURCHASE.test(rawDescription)) continue;
      const parsed = parseMoneyToken(firstMoney[0]);
      if (!Number.isFinite(parsed) || parsed <= 0) continue;
      const transactionYear = nearestYearForMonth(transactionMonth, Number(year), Number(anchorMonth));
      rows.push({
        date: `${transactionYear}-${String(transactionMonth).padStart(2, '0')}-${String(named[2]).padStart(2, '0')}`,
        rawDescription,
        normalizedPayee: normalizePayee(rawDescription),
        amount: parsed,
      });
      continue;
    }

    const dated = trimmed.match(/^(?:(\d{4})[-\/])?(\d{1,2})[-\/](\d{1,2})\s+(.+)$/);
    if (!dated) continue;
    const dateYear = dated[1] ?? year;
    const remainder = dated[4].trim();
    const moneyTokens = [...remainder.matchAll(/\(?-?\$?[\d,]+\.\d{2}\)?/g)];
    if (!moneyTokens.length) continue;
    const firstMoney = moneyTokens[0];
    const rawDescription = remainder.slice(0, firstMoney.index).trim();
    if (!rawDescription || NON_PURCHASE.test(rawDescription)) continue;
    const amount = Math.abs(parseMoneyToken(firstMoney[0]));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    rows.push({
      date: `${dateYear}-${dated[2].padStart(2, '0')}-${dated[3].padStart(2, '0')}`,
      rawDescription,
      normalizedPayee: normalizePayee(rawDescription),
      amount,
    });
  }
  return rows;
}

function editSimilarity(left, right) {
  if (!left || !right) return 0;
  const a = left.replace(/\s/g, '');
  const b = right.replace(/\s/g, '');
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  rows[0] = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return 1 - rows[a.length][b.length] / Math.max(a.length, b.length, 1);
}

function similarity(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.93;
  const a = new Set(left.split(' ').filter(Boolean));
  const b = new Set(right.split(' ').filter(Boolean));
  const overlap = [...a].filter((word) => b.has(word)).length / Math.max(a.size, b.size, 1);
  return Math.max(overlap, editSimilarity(left, right));
}

function aliasDetails(alias) {
  if (typeof alias === 'string') return { value: alias, amountHint: null };
  return { value: alias?.value ?? alias?.alias ?? '', amountHint: alias?.amountHint ?? alias?.amount_hint ?? null };
}

function scoreAmount(amount, expected, tolerance) {
  if (expected === null || expected === undefined || !Number.isFinite(Number(expected))) return { score: 0, difference: null, exact: false };
  const difference = Math.abs(Number(amount) - Number(expected));
  if (cents(amount) === cents(expected)) return { score: 0.45, difference, exact: true };
  if (difference <= 1) return { score: 0.35, difference, exact: false };
  if (difference <= tolerance) return { score: 0.25, difference, exact: false };
  const relative = difference / Math.max(Math.abs(Number(expected)), 25);
  return { score: relative <= 0.1 ? 0.08 : 0, difference, exact: false };
}

function materiallyDifferent(amount, expected, tolerance) {
  if (expected === null || expected === undefined || !Number.isFinite(Number(expected))) return false;
  const difference = Math.abs(Number(amount) - Number(expected));
  const relative = difference / Math.max(Math.abs(Number(expected)), 1);
  return difference > Math.max(tolerance * 3, 25) && relative > 0.35;
}

export function reconcileTransactions(transactions, bills, { amountTolerance = 5, dateWindowDays = 14, ambiguityMargin = 0.12 } = {}) {
  return transactions.map((transaction) => {
    if (EXCLUDED.test(transaction.rawDescription)) return { ...transaction, status: 'Unmatched', reason: 'Discretionary or person-to-person transaction' };
    const candidates = bills.map((bill) => {
      const baseNames = [bill.payee, bill.billName].filter(Boolean).map((value) => ({ value, amountHint: null, alias: false }));
      const aliasNames = (bill.aliases ?? []).map(aliasDetails).map((entry) => ({ ...entry, alias: true }));
      const names = [...baseNames, ...aliasNames];
      const nameMatches = names.map((entry) => {
        const normalized = normalizePayee(entry.value);
        const nameScore = similarity(transaction.normalizedPayee, normalized);
        const exactAlias = entry.alias && normalized === transaction.normalizedPayee;
        const aliasAmount = scoreAmount(transaction.amount, entry.amountHint, amountTolerance);
        return { nameScore, exactAlias, aliasAmountScore: exactAlias ? aliasAmount.score : 0 };
      });
      const bestName = nameMatches.sort((a, b) => (b.nameScore + b.aliasAmountScore) - (a.nameScore + a.aliasAmountScore))[0] ?? { nameScore: 0, exactAlias: false, aliasAmountScore: 0 };
      const expected = bill.actualAmount ?? bill.budget;
      const amount = scoreAmount(transaction.amount, expected, amountTolerance);
      const dueDifference = bill.nextDue ? Math.abs((new Date(`${transaction.date}T00:00:00Z`) - new Date(`${bill.nextDue}T00:00:00Z`)) / 86400000) : null;
      const dateScore = dueDifference != null && dueDifference <= dateWindowDays ? 0.1 : 0;
      const accountScore = !bill.account || !transaction.account || bill.account === transaction.account ? 0.05 : -0.15;
      const score = bestName.nameScore + bestName.aliasAmountScore + amount.score + dateScore + accountScore;
      return { bill, score, amountDifference: amount.difference, exactAmount: amount.exact, nameScore: bestName.nameScore, exactAlias: bestName.exactAlias, expected };
    }).sort((a, b) => b.score - a.score);

    const best = candidates[0];
    const second = candidates[1];
    const margin = best && second ? best.score - second.score : Number.POSITIVE_INFINITY;
    const strongAmountDisambiguation = Boolean(best?.exactAmount && best?.nameScore >= 0.75 && (!second?.exactAmount || best.score > second.score));
    const severeVariance = Boolean(best && best.nameScore >= 0.75 && materiallyDifferent(transaction.amount, best.expected, amountTolerance));

    if (severeVariance) {
      return {
        ...transaction,
        billId: best.bill.id,
        occurrenceId: best.bill.occurrenceId,
        expectedAmount: best.expected,
        status: 'Amount Variance',
        confidence: Math.min(best.score, 1.9999),
        reason: 'Amount differs materially from the Master Bill; explicit review is required before posting.',
      };
    }

    const reliable = best?.score >= 0.9 && (margin >= ambiguityMargin || strongAmountDisambiguation || best.exactAlias);
    if (reliable) {
      return {
        ...transaction,
        billId: best.bill.id,
        occurrenceId: best.bill.occurrenceId,
        expectedAmount: best.expected,
        status: best.amountDifference != null && best.amountDifference > amountTolerance ? 'Amount Variance' : 'Matched',
        confidence: Math.min(best.score, 1.9999),
        reason: best.exactAlias ? 'Matched using a learned merchant alias.' : strongAmountDisambiguation ? 'Matched using merchant similarity and exact amount.' : null,
      };
    }

    if (best?.score >= 0.9 && margin < ambiguityMargin) {
      return { ...transaction, status: 'Unmatched', confidence: Math.min(best.score, 1.9999), reason: 'Multiple Master Bills are plausible; review is required.' };
    }
    if (RECURRING_HINT.test(transaction.rawDescription)) return { ...transaction, status: 'NEW', reason: 'Likely recurring bill; approval required' };
    return { ...transaction, status: 'Unmatched', reason: 'No reliable Master Bill match' };
  });
}

export function planStatementPayments(rows, existingPayments = []) {
  const linkedPaymentIds = new Set(rows.map((row) => row.payment_id).filter(Boolean));
  const pending = rows.filter((row) => row.match_status === 'Matched' && !row.payment_id && row.bill_id && row.occurrence_id);
  const actions = [];
  const byOccurrence = new Map();

  for (const row of pending) {
    const list = byOccurrence.get(row.occurrence_id) ?? [];
    list.push(row);
    byOccurrence.set(row.occurrence_id, list);
  }

  for (const [occurrenceId, occurrenceRows] of byOccurrence) {
    const available = existingPayments
      .filter((payment) => payment.occurrence_id === occurrenceId && !linkedPaymentIds.has(payment.id))
      .map((payment) => ({ ...payment, used: false }));
    const unmatchedRows = [];

    for (const row of occurrenceRows) {
      let payment = available.find((candidate) => !candidate.used && cents(candidate.amount) === cents(row.amount) && candidate.payment_date === row.transaction_date);
      if (!payment) payment = available.find((candidate) => !candidate.used && cents(candidate.amount) === cents(row.amount));
      if (payment) {
        payment.used = true;
        actions.push({ row, action: 'link-existing', paymentId: payment.id });
      } else {
        unmatchedRows.push(row);
      }
    }

    const unusedPayments = available.filter((payment) => !payment.used);
    const statementTotal = unmatchedRows.reduce((sum, row) => sum + cents(row.amount), 0);
    const existingTotal = unusedPayments.reduce((sum, payment) => sum + cents(payment.amount), 0);

    if (unmatchedRows.length && unusedPayments.length && statementTotal === existingTotal) {
      for (const row of unmatchedRows) actions.push({ row, action: 'covered-by-existing' });
      continue;
    }

    for (const row of unmatchedRows) actions.push({ row, action: 'create-payment' });
  }

  return actions;
}

export function statementHash(buffer) { return createHash('sha256').update(buffer).digest('hex'); }

export function effectiveStatementMonth(detection, override) {
  if (override && !/^\d{4}-\d{2}$/.test(override)) throw new Error('Statement month override must use YYYY-MM.');
  return override || detection.detectedMonth;
}

export function statementWarningRequired(detection, override) {
  const detectedMonth = detection?.detectedMonth ?? null;
  const overrideDiffers = Boolean(override && detectedMonth && override !== detectedMonth);
  return Boolean(detection?.spansMonths || overrideDiffers);
}
