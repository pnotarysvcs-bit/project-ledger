import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pageSource = await readFile(new URL('../app/accounts/page.js', import.meta.url), 'utf8');
const apiSource = await readFile(new URL('../app/api/accounts/route.js', import.meta.url), 'utf8');
const cssSource = await readFile(new URL('../app/bills-hotfix.css', import.meta.url), 'utf8');

test('saved accounts expose Edit and Remove actions', () => {
  assert.match(pageSource, />Edit<\/button>/);
  assert.match(pageSource, />Remove<\/button>/);
  assert.match(pageSource, /method: 'PATCH'/);
  assert.match(apiSource, /export async function PATCH\(request\)/);
});

test('mobile account cards use account-specific labels instead of Bills labels', () => {
  assert.match(cssSource, /\.accounts-table td:nth-child\(1\)::before \{ content: 'Bank'; \}/);
  assert.match(cssSource, /\.accounts-table td:nth-child\(2\)::before \{ content: 'Account Type'; \}/);
  assert.match(cssSource, /\.accounts-table td:nth-child\(3\)::before \{ content: 'Actions'; \}/);
});
