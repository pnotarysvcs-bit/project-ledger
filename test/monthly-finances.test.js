import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonthlyIncome, getMonthlyIncome, saveMonthlyIncome } from '../src/monthly-finances.js';

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
