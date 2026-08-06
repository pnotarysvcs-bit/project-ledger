import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchActiveAccounts } from '../src/accounts-client.js';

test('account summary loading uses the persisted accounts API', async () => {
  const calls = [];
  const accounts = [{ id: '1', institution: 'Community Bank', kind: 'checking' }];
  const fetcher = async (...args) => {
    calls.push(args);
    return { ok: true, json: async () => ({ accounts }) };
  };

  assert.deepEqual(await fetchActiveAccounts(fetcher), accounts);
  assert.deepEqual(calls, [['/api/accounts', { cache: 'no-store' }]]);
});

test('account summary loading surfaces API errors', async () => {
  const fetcher = async () => ({
    ok: false,
    json: async () => ({ error: 'Database unavailable.' }),
  });

  await assert.rejects(fetchActiveAccounts(fetcher), /Database unavailable/);
});
