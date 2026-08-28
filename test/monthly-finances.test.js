import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonthlyIncome, getIncomeBreakdown, getMonthlyIncome, saveMonthlyIncome, summarizeIncome } from '../src/monthly-finances.js';

const originalFetch = global.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function withSupabaseEnv() {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
}

function restoreEnv() {
  global.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
}

test('monthly income is read for the selected month only', { concurrency: false }, async () => {
  withSupabaseEnv();
  let requestedUrl = '';
  global.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify([{ income: '4250.50' }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const income = await getMonthlyIncome('2026-04');
    assert.equal(income, 4250.5);
    assert.match(requestedUrl, /ledger_monthly_finances\?select=income&month=eq\.2026-04-01/);
  } finally {
    restoreEnv();
  }
});

test('months recorded before itemized paychecks still count each paycheck once', { concurrency: false }, async () => {
  withSupabaseEnv();
  global.fetch = async (url) => {
    const value = String(url);
    if (value.includes('ledger_income_entries')) {
      return new Response(JSON.stringify({ code: 'PGRST205', message: 'Could not find the table' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    if (value.includes('ledger_pay_period_finances')) {
      return new Response(JSON.stringify([
        { period: 1, regular_income: '2992.15', notary_income: '1030.78', ahead_contribution: '0', target_month: '2026-08-01' },
        { period: 2, regular_income: '0', notary_income: '364.00', ahead_contribution: '0', target_month: '2026-08-01' },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify([{ income: '3092.15' }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const result = await getIncomeBreakdown('2026-08');
    // Recorded monthly income (3092.15) covers the posted paycheck (2992.15)
    // plus 100 entered by hand, so paychecks is the larger of the two, not the sum.
    assert.equal(result.paychecks, 3092.15);
    assert.equal(result.notarySupport, 1394.78);
    assert.equal(result.totalIncome, 4486.93);
  } finally {
    restoreEnv();
  }
});

test('monthly income upserts without changing bill or payment data', { concurrency: false }, async () => {
  withSupabaseEnv();
  let request = null;
  global.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify([{ income: '5100.00' }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const income = await saveMonthlyIncome('2026-05', 5100);
    assert.equal(income, 5100);
    assert.match(request.url, /ledger_monthly_finances\?on_conflict=month$/);
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers.Prefer, 'resolution=merge-duplicates,return=representation');
    assert.deepEqual(JSON.parse(request.options.body).month, '2026-05-01');
    assert.deepEqual(JSON.parse(request.options.body).income, 5100);
  } finally {
    restoreEnv();
  }
});

test('monthly income additions accumulate onto the existing month total', { concurrency: false }, async () => {
  withSupabaseEnv();
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if ((options.method ?? 'GET') === 'GET') {
      return new Response(JSON.stringify([{ income: '2992.00' }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const body = JSON.parse(options.body);
    return new Response(JSON.stringify([{ income: String(body.income) }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const income = await addMonthlyIncome('2026-08', 2117);
    assert.equal(income, 5109);
    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /month=eq\.2026-08-01/);
    assert.equal(JSON.parse(requests[1].options.body).income, 5109);
  } finally {
    restoreEnv();
  }
});

test('monthly income rejects negative values before persistence', { concurrency: false }, async () => {
  withSupabaseEnv();
  let called = false;
  global.fetch = async () => { called = true; return new Response('[]', { status: 200 }); };

  try {
    await assert.rejects(() => saveMonthlyIncome('2026-06', -1), /zero or greater/);
    await assert.rejects(() => addMonthlyIncome('2026-06', -1), /zero or greater/);
    assert.equal(called, false);
  } finally {
    restoreEnv();
  }
});

test('a paycheck counts once whether it is posted to a pay period or recorded by hand', () => {
  const posted = summarizeIncome({ postedPayroll: 5984.15, recordedMonthlyIncome: 0, notarySupport: 1050 });
  const byHand = summarizeIncome({ postedPayroll: 0, recordedMonthlyIncome: 5984.15, notarySupport: 1050 });
  const both = summarizeIncome({ postedPayroll: 5984.15, recordedMonthlyIncome: 5984.15, notarySupport: 1050 });

  assert.equal(posted.totalIncome, 7034.15);
  assert.equal(byHand.totalIncome, 7034.15, 'entering it on the Income tab gives the same total');
  assert.equal(both.totalIncome, 7034.15, 'recorded in both places is still one paycheck');
});

test('income is only paychecks and notary income', () => {
  const income = summarizeIncome({ postedPayroll: 3000, recordedMonthlyIncome: 0, notarySupport: 500 });

  assert.equal(income.paychecks, 3000);
  assert.equal(income.notarySupport, 500);
  assert.equal(income.totalIncome, 3500);
  assert.equal(summarizeIncome({}).totalIncome, 0);
});

test('itemized paychecks are summed, so two equal paychecks both count', () => {
  const income = summarizeIncome({
    entries: [
      { id: 'a', amount: 2992, kind: 'paycheck' },
      { id: 'b', amount: 2992, kind: 'paycheck' },
      { id: 'c', amount: 1050, kind: 'notary' },
    ],
  });

  assert.equal(income.paychecks, 5984, 'two separate paychecks, not one deduplicated to 2992');
  assert.equal(income.notarySupport, 1050);
  assert.equal(income.totalIncome, 7034);
  assert.equal(income.usesEntries, true);
});

test('income entries are the only source: pay period figures are ignored', () => {
  const income = summarizeIncome({
    entries: [{ id: 'a', amount: 2992, kind: 'paycheck' }],
    postedPayroll: 2992,
    recordedMonthlyIncome: 5984,
    notarySupport: 1050,
  });

  assert.equal(income.notarySupport, 0, 'notary income comes from entries, not the pay period rows');
  assert.equal(income.totalIncome, 2992);
});

test('a month with no entries table falls back to the larger of posted payroll and the monthly total', () => {
  const income = summarizeIncome({ entries: null, postedPayroll: 3337, recordedMonthlyIncome: 5984.15, notarySupport: 1050 });

  assert.equal(income.usesEntries, false);
  assert.equal(income.totalIncome, 7034.15);
});

test('an empty month stays empty instead of reviving the legacy total', () => {
  const cleared = summarizeIncome({ entries: [], postedPayroll: 2992, recordedMonthlyIncome: 5984, notarySupport: 1050 });

  assert.equal(cleared.totalIncome, 0, 'removing the last entry clears the month');
  assert.equal(cleared.usesEntries, true);
});

test('only an unavailable entries table falls back to legacy figures', () => {
  const fallback = summarizeIncome({ entries: null, postedPayroll: 2992, recordedMonthlyIncome: 5984, notarySupport: 1050 });

  assert.equal(fallback.usesEntries, false);
  assert.equal(fallback.totalIncome, 7034);
});

test('other income keeps its own subtotal and is not reported as paychecks', () => {
  const income = summarizeIncome({
    entries: [
      { id: 'a', amount: 2992, kind: 'paycheck' },
      { id: 'b', amount: 400, kind: 'other' },
      { id: 'c', amount: 1050, kind: 'notary' },
    ],
  });

  assert.equal(income.paychecks, 2992, 'other income is not folded into paychecks');
  assert.equal(income.otherIncome, 400);
  assert.equal(income.totalIncome, 4442, 'but it still counts toward total income');
});
