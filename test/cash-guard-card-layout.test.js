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

test('Cash Guard shows source provenance for both reserves without claiming AI/ChatGPT-backing', () => {
  assert.match(cashGuardCard, /summary\.variableEssentialsSource === 'manual' \? 'Manual override' : 'System estimate \(not AI-backed\)'/);
  assert.match(cashGuardCard, /summary\.plannedOneOffsSource === 'manual' \? 'Manual override' : 'System estimate \(not AI-backed\)'/);
  assert.doesNotMatch(cashGuardCard, /\bAI estimate\b/i);
  assert.doesNotMatch(cashGuardCard, /ChatGPT/i);
});

test('Cash Guard does not invent Spent so far or Remaining protected values', () => {
  assert.match(cashGuardCard, /Spent so far <b>—<\/b>/);
  assert.match(cashGuardCard, /Remaining protected <b>—<\/b>/);
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

test('Planned One-Offs has no Manage button and is updated by the same Recalculate flow as Variable Essentials', () => {
  assert.doesNotMatch(cashGuardCard, /Manage/);
  const plannedSection = cashGuardCard.slice(cashGuardCard.indexOf('4. Planned One-Offs'));
  assert.doesNotMatch(plannedSection.slice(0, plannedSection.indexOf('5. Build Emergency Fund')), /recalculateCashGuard/);

  // A single Recalculate action (recalculateCashGuard) saves both reserves together.
  const recalcBody = cashGuardCard.slice(
    cashGuardCard.indexOf('async function recalculateCashGuard'),
    cashGuardCard.indexOf('export default async function CashGuardCard'),
  );
  assert.match(recalcBody, /variableEssentialsReserve:\s*estimate\.variableEssentialsReserve/);
  assert.match(recalcBody, /plannedOneOffsReserve:\s*estimate\.plannedOneOffsReserve/);
});

test('Adjust on Variable Essentials always tags the reserve as a manual override', () => {
  const adjustBody = cashGuardCard.slice(
    cashGuardCard.indexOf('async function adjustVariableEssentials'),
    cashGuardCard.indexOf('async function adjustPlannedOneOffs'),
  );
  assert.match(adjustBody, /variableEssentialsSource:\s*'manual'/);
});

test('Build Emergency Fund is the only card that consumes the residual cash calculation; no separate Safe to Spend or Available Cash section exists', () => {
  assert.doesNotMatch(cashGuardCard, /Safe to Spend/);
  assert.doesNotMatch(cashGuardCard, /Available Cash/);
  const emergencyFundSection = cashGuardCard.slice(cashGuardCard.indexOf('5. Build Emergency Fund'));
  assert.match(emergencyFundSection, /summary\.safeToSpend/);
});
