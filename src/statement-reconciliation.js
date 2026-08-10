import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const MONEY = /\$?(\d{1,3}(?:,\d{3})*\.\d{2})-?/g;
const START = /(\d{2}\/\d{2})(?=(?:Withdrawal|CardPurchase|Deposit|Comment))/g;
const BILL_WORDS = /(payment|pay|insurance|mutual|water|utility|utilities|mobile|wireless|internet|loan|credit|card|mortgage|rent|property|affirm|afterpay|upgrade|missionlane|sirius|fidelity|wci)/i;
const EXCLUDED_WORDS = /(starbucks|burgerking|doordash|baskin|nailbar|dollartree|cashapp|venmo|restaurant|grill|fish|chic|tiktok|schnucks|ontherun|atm)/i;
const NOISE = /(terminalid|ref|payment|payments|pymnts|pmt|webpmts|online|fields|kimberly|fields|kim|postpaid|fdp|edi|acct)/g;

function decodePdfString(value) {
  return value
    .replace(/\\([nrtbf()\\])/g, (_match, code) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }[code]))
    .replace(/\\([0-7]{1,3})/g, (_match, octal) => String.fromCharCode(Number.parseInt(octal, 8)))
    .replace(/\\\r?\n/g, '');
}

function collectPdfStrings(buffer, depth = 0) {
  if (depth > 3) return [];
  const source = buffer.toString('latin1');
  const output = [];
  const textPattern = /\((?:\\.|[^\\)])*\)\s*Tj|\[(.*?)\]\s*TJ/gs;
  let match;
  while ((match = textPattern.exec(source))) {
    if (match[0].startsWith('(')) {
      output.push(decodePdfString(match[0].replace(/\)\s*Tj$/, '').slice(1)));
    } else {
      const inner = match[1];
      const strings = /\((?:\\.|[^\\)])*\)/g;
      let item;
      while ((item = strings.exec(inner))) output.push(decodePdfString(item[0].slice(1, -1)));
    }
  }

  const streamPattern = /stream\r?\n/g;
  while ((match = streamPattern.exec(source))) {
    const start = match.index + match[0].length;
    const end = source.indexOf('endstream', start);
    if (end < 0) break;
    const header = source.slice(Math.max(0, match.index - 350), match.index);
    if (/FlateDecode/.test(header)) {
      let rawEnd = end;
      if (buffer[rawEnd - 1] === 10) rawEnd -= 1;
      if (buffer[rawEnd - 1] === 13) rawEnd -= 1;
      try {
        output.push(...collectPdfStrings(inflateSync(buffer.subarray(start, rawEnd)), depth + 1));
      } catch {
        // Some streams use predictors or unsupported filters; other text streams can still be parsed.
      }
    }
    streamPattern.lastIndex = end + 9;
  }
  return output;
}

export function compactPdfText(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('The uploaded file is not a valid PDF statement.');
  }
  return collectPdfStrings(buffer).join('').replace(/[\u0000-\u001f]/g, '');
}

function isoDate(monthDay, year) {
  const [month, day] = monthDay.split('/');
  return `${year}-${month}-${day}`;
}

function parseUsDate(value) {
  const [month, day, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

export function detectStatementPeriod(compactText) {
  const explicit = compactText.match(/StatementFor:?(\d{2}\/\d{2}\/\d{4})-(\d{2}\/\d{2}\/\d{4})/i);
  if (!explicit) throw new Error('The statement period could not be detected. Choose the reporting month manually.');
  const start = parseUsDate(explicit[1]);
  const end = parseUsDate(explicit[2]);
  const startMonth = start.slice(0, 7);
  const endMonth = end.slice(0, 7);
  return { start, end, detectedMonth: startMonth === endMonth ? startMonth : null, spansMonths: startMonth !== endMonth };
}

function amountValues(segment) {
  const values = [];
  let match;
  MONEY.lastIndex = 0;
  while ((match = MONEY.exec(segment))) values.push(Number(match[1].replaceAll(',', '')));
  return values;
}

function rawPayee(segment) {
  return segment
    .replace(/^(Withdrawal(?:ACH|BillPayment)?|CardPurchase)/, '')
    .replace(/TerminalID:?.*$/i, '')
    .replace(/Ref:?.*$/i, '')
    .replace(/\d{1,3}(?:,\d{3})*\.\d{2}-?.*$/, '')
    .slice(0, 180);
}

export function normalizePayee(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
    .replace(NOISE, '')
    .replace(/inc|llc|com|www/g, '');
}

export function parseStatementTransactions(compactText, period) {
  const starts = [...compactText.matchAll(START)];
  const year = period.start.slice(0, 4);
  const transactions = [];
  for (let index = 0; index < starts.length; index += 1) {
    const current = starts[index];
    const next = starts[index + 1];
    const segment = compactText.slice(current.index + current[1].length, next?.index ?? compactText.length);
    const kind = segment.startsWith('Withdrawal') ? 'withdrawal' : segment.startsWith('CardPurchase') ? 'card' : segment.startsWith('Deposit') ? 'deposit' : 'comment';
    if (kind === 'deposit' || kind === 'comment') continue;
    if (/^Withdrawal(?:OverdraftFee|ATM|Transfer)/.test(segment)) continue;
    const amounts = amountValues(segment);
    if (amounts.length < 2) continue;
    const amount = amounts.at(-2);
    const description = rawPayee(segment) || segment.slice(0, 180);
    transactions.push({
      transactionDate: isoDate(current[1], year),
      rawDescription: description,
      normalizedPayee: normalizePayee(description),
      amount,
      kind,
      sourceSegment: segment.slice(0, 500),
    });
  }
  return transactions;
}

function tokenScore(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.88;
  const a = new Set(left.match(/[a-z]+|\d+/g) ?? []);
  const b = new Set(right.match(/[a-z]+|\d+/g) ?? []);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((item) => b.has(item)).length;
  return intersection / Math.max(a.size, b.size);
}

function amountScore(statementAmount, expectedAmount) {
  if (expectedAmount === null || expectedAmount === undefined) return 0;
  const delta = Math.abs(statementAmount - Number(expectedAmount));
  if (delta <= 0.01) return 1;
  const tolerance = Math.max(5, Number(expectedAmount) * 0.1);
  return delta <= tolerance ? 0.6 : 0;
}

function likelyRecurring(transaction) {
  const text = `${transaction.rawDescription} ${transaction.sourceSegment}`;
  return transaction.kind === 'withdrawal' || BILL_WORDS.test(text);
}

function excluded(transaction) {
  return transaction.kind === 'card' && EXCLUDED_WORDS.test(`${transaction.rawDescription} ${transaction.sourceSegment}`) && !BILL_WORDS.test(transaction.rawDescription);
}

export function matchTransactions(transactions, bills, aliases = []) {
  const aliasMap = new Map();
  for (const alias of aliases) {
    const list = aliasMap.get(alias.bill_id) ?? [];
    list.push(alias.normalized_alias || normalizePayee(alias.alias));
    aliasMap.set(alias.bill_id, list);
  }

  return transactions.map((transaction, index) => {
    if (excluded(transaction)) return { ...transaction, transactionKey: `${transaction.transactionDate}:${transaction.amount}:${index}`, matchStatus: 'excluded' };
    let best = null;
    for (const bill of bills) {
      const names = [normalizePayee(bill.payee), ...(aliasMap.get(bill.id) ?? [])].filter(Boolean);
      const nameScore = Math.max(0, ...names.map((name) => tokenScore(transaction.normalizedPayee, name)));
      const expectedAmount = bill.actualAmount ?? bill.budget ?? bill.effectiveAmount ?? null;
      const score = nameScore * 0.78 + amountScore(transaction.amount, expectedAmount) * 0.22;
      if (!best || score > best.score) best = { bill, score, nameScore, expectedAmount };
    }

    if (best && best.nameScore >= 0.72 && best.score >= 0.7) {
      const variance = best.expectedAmount !== null && Math.abs(transaction.amount - Number(best.expectedAmount)) > 0.01;
      return {
        ...transaction,
        transactionKey: `${transaction.transactionDate}:${transaction.amount}:${transaction.normalizedPayee}:${index}`,
        matchStatus: variance ? 'amount_variance' : 'matched',
        matchedBillId: best.bill.id,
        matchedOccurrenceId: best.bill.occurrenceId,
        matchedPayee: best.bill.payee,
        expectedAmount: best.expectedAmount,
        confidence: Number(best.score.toFixed(3)),
      };
    }

    return {
      ...transaction,
      transactionKey: `${transaction.transactionDate}:${transaction.amount}:${transaction.normalizedPayee}:${index}`,
      matchStatus: likelyRecurring(transaction) ? 'new' : 'unmatched',
      confidence: best ? Number(best.score.toFixed(3)) : 0,
    };
  });
}

export function statementHash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function parseAndMatchStatement(buffer, bills, aliases = []) {
  const compactText = compactPdfText(buffer);
  const period = detectStatementPeriod(compactText);
  const transactions = parseStatementTransactions(compactText, period);
  return { period, transactions: matchTransactions(transactions, bills, aliases), hash: statementHash(buffer) };
}
