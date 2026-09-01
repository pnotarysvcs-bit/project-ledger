import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cashGuardCard = await readFile(new URL('../app/dashboard/cash-guard-card.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../app/dashboard-goals.css', import.meta.url), 'utf8');

test('Cash Guard row 1 renders exactly four numbered cards in the approved order', () => {
  const headings = ['1. Income', '2. Expenses', '3. Variable Essentials Reserve', '4. Planned One-Offs'];
  let lastIndex = -1;
  for (const heading of headings) {
    const index = cashGuardCard.indexOf(heading);
    assert.ok(index > lastIndex, `${heading} must appear in order`);
    lastIndex = index;
  }
  // Row 2 (Available Cash, Safe to Spend) are not numbered as cards 5/6.
  assert.doesNotMatch(cashGuardCard, /5\.\s*Build Emergency Fund/);
  assert.doesNotMatch(cashGuardCard, /Build Emergency Fund/);
});

test('Cash Guard renders the top Safe to Spend / Available cash snapshot banner before the four-card row', () => {
  const bannerIndex = cashGuardCard.indexOf('cash-guard-banner');
  const gridIndex = cashGuardCard.indexOf('cash-guard-grid');
  assert.ok(bannerIndex > -1, 'expected a cash-guard-banner element');
  assert.ok(bannerIndex < gridIndex, 'the banner must render above the four-card row');
  assert.match(cashGuardCard, /Safe to Spend/);
  assert.match(cashGuardCard, /Available cash snapshot/);
});

test('Cash Guard row 2 renders Available Cash (blue) and Safe to Spend (teal) as larger sections, not numbered cards', () => {
  assert.match(cashGuardCard, /cash-guard-summary-grid/);
  assert.match(cashGuardCard, /<h2>Available Cash<\/h2>/);
  assert.match(cashGuardCard, /<h2>Safe to Spend<\/h2>/);
  assert.match(cashGuardCard, /cash-guard-item blue summary/);
  assert.match(cashGuardCard, /cash-guard-item teal summary/);
  assert.match(cashGuardCard, /View Accounts/);
});

test('Cash Guard Income card keeps the deposit detail to the right of the dollar amount with a divider, not underneath it', () => {
  const incomeSection = cashGuardCard.slice(cashGuardCard.indexOf('1. Income'), cashGuardCard.indexOf('2. Expenses'));
  assert.match(incomeSection, /cash-guard-lower/);
  assert.match(incomeSection, /cash-guard-lower-divider/);
  const lowerIndex = incomeSection.indexOf('cash-guard-lower"');
  const strongIndex = incomeSection.indexOf('<strong>');
  const detailIndex = incomeSection.indexOf('cash-guard-detail');
  assert.ok(lowerIndex > -1 && strongIndex > lowerIndex && detailIndex > strongIndex, 'amount must precede the detail inside the shared lower row');
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
  assert.match(css, /\.cash-guard-item > strong, \.cash-guard-lower > strong\s*\{[^}]*font-size:\s*clamp\(/);
  assert.match(css, /@media \(max-width: 620px\)/);
});

test('Cash Guard dollar amounts use a reduced, non-dominating clamp scale that spans the full card width', () => {
  const strongRule = /\.cash-guard-item > strong, \.cash-guard-lower > strong\s*\{([^}]*)\}/.exec(css);
  assert.ok(strongRule, 'expected a shared .cash-guard-item > strong, .cash-guard-lower > strong rule');
  const body = strongRule[1];
  // The primary amount must span the full card (its own layout region), not be
  // squeezed into the narrow icon column, so it never overlaps adjacent text.
  assert.match(body, /grid-column:\s*1\s*\/\s*-1/);
  const clampMatch = /font-size:\s*clamp\((\d+)px,\s*[\d.]+vw,\s*(\d+)px\)/.exec(body);
  assert.ok(clampMatch, 'expected a clamp() font-size on the primary amount');
  const [, min, max] = clampMatch.map(Number);
  // Smaller than the previous oversized 22px/32px scale so the amount no
  // longer dominates the card, while remaining the largest text on the card.
  assert.ok(max <= 26, `max clamp size ${max}px should not dominate the card`);
  assert.ok(min >= 16, `min clamp size ${min}px should stay legible`);
  // Long values must wrap safely instead of forcing nowrap overflow.
  assert.doesNotMatch(body, /white-space:\s*nowrap/);
});

test('Cash Guard maintains one consistent typography hierarchy across every card (row 1 and row 2)', () => {
  const headingMatch = /\.cash-guard-item h2\s*\{([^}]*)\}/.exec(css);
  const descriptionMatch = /\.cash-guard-item p\s*\{([^}]*)\}/.exec(css);
  const supportingMatch = /\.cash-guard-item small\s*\{([^}]*)\}/.exec(css);
  const detailMatch = /\.cash-guard-detail\s*\{([^}]*)\}/.exec(css);
  assert.ok(headingMatch && descriptionMatch && supportingMatch && detailMatch, 'expected typography rules for every hierarchy level');

  const sizeOf = (body) => Number(/font-size:\s*(\d+)px/.exec(body)?.[1]);
  const headingSize = sizeOf(headingMatch[1]);
  const descriptionSize = sizeOf(descriptionMatch[1]);
  const supportingSize = sizeOf(supportingMatch[1]);
  const detailSize = sizeOf(detailMatch[1]);

  // A single rule set for each level means every card (Income, Expenses,
  // Variable Essentials Reserve, Planned One-Offs, Build Emergency Fund)
  // shares the exact same scale rather than each card defining its own.
  assert.ok(headingSize > 0 && headingSize <= 14, `card headings (${headingSize}px) must use the reduced mockup scale`);
  assert.ok(descriptionSize > 0 && descriptionSize <= 13, `descriptions (${descriptionSize}px) must be smaller than headings`);
  assert.ok(supportingSize > 0 && supportingSize < descriptionSize, 'supporting/source text must be the smallest tier');
  assert.ok(detailSize > 0 && detailSize <= 13, `detail rows (${detailSize}px) must match the reduced supporting-text scale`);
});

test('Cash Guard button and form text stay proportionate to the surrounding content', () => {
  const editorMatch = /\.reserve-editor\s*\{([^}]*)\}/.exec(css);
  const buttonMatch = /\.reserve-editor button\s*\{([^}]*)\}/.exec(css);
  assert.ok(editorMatch && buttonMatch, 'expected reserve-editor and button typography rules');
  const editorSize = Number(/font-size:\s*(\d+)px/.exec(editorMatch[1])?.[1]);
  const buttonSize = Number(/font-size:\s*(\d+)px/.exec(buttonMatch[1])?.[1]);
  assert.ok(editorSize > 0 && editorSize <= 13, `reserve editor text (${editorSize}px) must match the reduced supporting scale`);
  assert.ok(buttonSize > 0 && buttonSize <= 13, `button text (${buttonSize}px) must not be larger than surrounding content`);
});

test('Planned One-Offs has no Manage button and is updated by the same Recalculate flow as Variable Essentials', () => {
  assert.doesNotMatch(cashGuardCard, /Manage/);
  const plannedSection = cashGuardCard.slice(cashGuardCard.indexOf('4. Planned One-Offs'), cashGuardCard.indexOf('cash-guard-summary-grid'));
  assert.doesNotMatch(plannedSection, /recalculateCashGuard/);

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

test('Row 2 Available Cash and Safe to Spend sections consume the existing residual cash calculation without adding new financial logic', () => {
  const summarySection = cashGuardCard.slice(cashGuardCard.indexOf('cash-guard-summary-grid'));
  assert.match(summarySection, /summary\.availableCash/);
  assert.match(summarySection, /summary\.safeToSpend/);
  // The gauge is a display-only ratio derived from already-computed summary fields.
  assert.match(summarySection, /summary\.safeToSpend\s*\/\s*summary\.availableCash|safeToSpendGaugePercent/);
});
