import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cashGuardCard = await readFile(new URL('../app/dashboard/cash-guard-card.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../app/dashboard-goals.css', import.meta.url), 'utf8');

test('Cash Guard renders exactly five cards in the approved order', () => {
  const headings = ['1. Income', '2. Expenses', '3. Variable Essentials Reserve', '4. Planned One-Offs', '5. Build Emergency Fund'];
  let lastIndex = -1;
  for (const heading of headings) {
    const index = cashGuardCard.indexOf(heading);
    assert.ok(index > lastIndex, `${heading} must appear in order`);
    lastIndex = index;
  }
  assert.doesNotMatch(cashGuardCard, /Available Cash/);
  assert.doesNotMatch(cashGuardCard, /View Accounts/);
});

test('Cash Guard shows AI estimate vs manual override provenance for both reserves', () => {
  assert.match(cashGuardCard, /summary\.variableEssentialsSource === 'manual' \? 'Manual override' : 'AI estimate'/);
  assert.match(cashGuardCard, /summary\.plannedOneOffsSource === 'manual' \? 'Manual override' : 'AI estimate'/);
});

test('Cash Guard wires Recalculate and Adjust actions to the reserve-saving helpers', () => {
  assert.match(cashGuardCard, /import\s+\{[^}]*\bestimateReserveRecalculation\b[^}]*\bsaveCashGuardReserves\b[^}]*\}\s+from\s+['"]\.\.\/\.\.\/src\/cash-guard\.js['"];?/);
  assert.match(cashGuardCard, /<button type="submit">Recalculate<\/button>/);
  assert.match(cashGuardCard, /<button type="submit">Adjust<\/button>/g);
});

test('Cash Guard CSS defines a responsive grid with overflow-safe typography for every card', () => {
  assert.match(css, /\.cash-guard-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.cash-guard-item\s*\{[^}]*min-width:\s*0/);
  assert.match(css, /\.cash-guard-item > strong\s*\{[^}]*font-size:\s*clamp\(/);
  assert.match(css, /@media \(max-width: 620px\)/);
});
