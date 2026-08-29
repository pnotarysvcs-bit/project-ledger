import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateCashGuard, saveCashGuardReserves } from '../src/cash-guard.js';

const originalFetch = global.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function restoreEnv() {
  global.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
}

const rows = [
  { id: 'rent', remaining: 400, overdueOutstanding: 0 },
  { id: 'utility', remaining: 100, overdueOutstanding: 50 },
  { id: 'utility', remaining: 25, overdueOutstanding: 50 },
];

const inputs = {
  availableCash: 1000,
  variableEssentialsReserve: 100,
  plannedOneOffsReserve: 50,
  cashFloor: 100,
  payPeriods: [
    { regularIncome: 500, notaryIncome: 200 },
    { regularIncome: 0, notaryIncome: 100 },
  ],
};

test('cash guard subtracts unpaid bills and reserves from available cash', () => {
  const result = calculateCashGuard(rows, inputs, new Date('2026-08-29T12:00:00Z'));

  assert.equal(result.currentBillsRemaining, 525);
  assert.equal(result.overdueBillsRemaining, 50, 'overdue is counted once per bill');
  assert.equal(result.billsReserved, 575);
  assert.equal(result.fundingReceived, 800);
  assert.equal(result.safeToSpend, 175);
  assert.equal(result.fundingGap, 0);
});

test('discretionary lock forces safe to spend to zero', () => {
  const result = calculateCashGuard(rows, {
    ...inputs,
    discretionaryLockUntil: '2026-08-28',
  }, new Date('2026-08-22T12:00:00Z'));

  assert.equal(result.locked, true);
  assert.equal(result.safeToSpend, 0);
});

test('cash guard reports a funding gap when bills exceed available cash', () => {
  const result = calculateCashGuard(rows, {
    ...inputs,
    availableCash: 300,
  }, new Date('2026-08-29T12:00:00Z'));

  assert.equal(result.safeToSpend, 0);
  assert.equal(result.fundingGap, 525);
});

test('cash guard reserve adjustments upsert only the selected month reserves', { concurrency: false }, async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  let request = null;
  global.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await saveCashGuardReserves('2026-08', { variableEssentialsReserve: 125, plannedOneOffsReserve: 75 });
    assert.match(request.url, /ledger_cash_guard\?on_conflict=month$/);
    assert.equal(request.options.method, 'POST');
    assert.deepEqual(JSON.parse(request.options.body), {
      month: '2026-08-01',
      variable_essentials_reserve: 125,
      planned_one_offs_reserve: 75,
    });
  } finally {
    restoreEnv();
  }
});
