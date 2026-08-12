# Issue #44 — Project Ledger Architecture Stabilization Baseline

## Objective

Stabilize Project Ledger before resuming statement-reconciliation UAT. The Bills workspace must behave consistently across months and ordinary edits must not fail or regress unrelated behavior.

## Current architecture findings

### 1. Bills page has too many responsibilities

`app/page.js` currently owns rendering, month navigation, filters, add/edit validation, bill persistence, occurrence persistence, payment creation/update/removal, submit, archive, redirects, and Supabase orchestration. This creates high coupling and makes regression containment difficult.

### 2. Core business rules are mixed with persistence

`src/ledger-bills-data.js` combines recurrence materialization, Supabase queries, status classification, row construction, sorting, summaries, overview definitions, and grouping. Rules such as status precedence, section ordering, and due-date ordering should be deterministic domain functions that do not depend on database access.

### 3. UI behavior has been patched after render

Recent UAT work introduced client-side interception/hotfix layers for month switching, filtering, and editing. These can hide defects in the owning server/UI component and create competing execution paths. Core Bills behavior must be implemented directly rather than patched after render.

### 4. Regression coverage is not equivalent to user workflow coverage

The current Node test suite contains valuable domain tests, but several workspace tests inspect source text rather than executing the application. There is no browser-level test that performs the same steps as UAT: switch month, edit a field, save, reload, verify persisted data, submit/partially pay, and verify calculations.

### 5. CI and Preview readiness are not aligned

A Vercel Preview can be successful while GitHub Actions is failing. A deployment must not be declared UAT-ready unless the full release gate is green.

## Canonical Bills invariants

These invariants apply to every supported month unless a documented business rule explicitly says otherwise.

1. Section order is always Personal Bills, Business Bills, Streaming Bills.
2. Within each section, occurrences are ordered by Next Due ascending, then Bill Name ascending for ties.
3. The `Future` status is not displayed. An upcoming unpaid bill has no visible status label unless another approved status applies.
4. The month selector changes the month immediately; no View button is required.
5. Layout and column geometry remain consistent across months.
6. Submitted bills remain editable.
7. Editing one field must not silently overwrite unrelated fields.
8. Category is bill metadata; blank/missing category may be corrected independently of Budget or Actual.
9. TCU account classification is Personal; TCUB account classification is Business. Streaming remains a distinct approved type when not account-reclassified.
10. Budget is the planned amount for the occurrence. Actual is the actual bill/invoice amount for the occurrence.
11. Payments are separate transactions. Multiple payments sum into Submitted; they do not replace Actual.
12. Remaining = max(Actual-or-Budget effective amount − sum of payments, 0).
13. Overpayments appear as Credit and must not make a bill Overdue.
14. Filters apply consistently in every month and do not alter persistence.
15. Month switching and refresh must preserve persisted data, not reconstruct historical values from current master data.

## Target architecture

### UI layer

Responsibilities: render Bills workspace, capture user intent, show validation/errors, navigate months. It must not contain direct Supabase query construction.

Suggested modules:
- `app/page.js` — composition only
- `app/components/bills-month-selector.js`
- `app/components/bills-table.js`
- `app/components/bill-edit-form.js`
- `app/components/bill-payment-panel.js`

### Domain/service layer

Responsibilities: deterministic rules and use-case orchestration.

Suggested modules:
- `src/bills/domain.js` — classification, type derivation, sorting, grouping, calculations, validation
- `src/bills/service.js` — add/edit/submit/partial/update/remove/archive use cases

No framework redirects or DOM operations belong here.

### Repository/data-access layer

Responsibilities: Supabase persistence only.

Suggested module:
- `src/bills/repository.js`

It should expose typed operations such as `getBill`, `updateBillMetadata`, `getOccurrence`, `updateOccurrence`, `createOccurrence`, `listPayments`, and `addPayment` rather than allowing UI code to build PostgREST query strings.

### Mutation boundary

Each Bills operation has exactly one authoritative mutation path. No operation may simultaneously exist as both a server action and a client-intercepted API workaround.

## Refactor sequence

1. Freeze statement-reconciliation feature work. Keep PR #43 draft/unmerged.
2. Introduce deterministic Bills domain functions and contract tests for the canonical invariants.
3. Extract Supabase access into a Bills repository.
4. Extract edit/add/payment/submit/archive operations into one service layer.
5. Replace the existing page-local server actions with the service layer one operation at a time.
6. Remove client interception shims after their owning behavior exists directly.
7. Replace static source/regex workspace checks with integration tests.
8. Add browser E2E coverage for April, June, July, and August 2026.
9. Make CI block UAT readiness unless unit + integration + E2E + production build all pass.
10. Rebase/reconcile statement work only after the Bills stabilization gate is green.

## Required automated acceptance scenarios

- Open April, June, July, and August and verify identical section/column structure.
- Verify Personal → Business → Streaming in each month.
- Verify due-date ordering inside every section.
- Verify no visible Future status.
- Verify no View button; month selection navigates directly.
- Edit Bill Name only; save/reload/persist.
- Edit Category only; save/reload/persist.
- Edit Account only and verify type recalculation.
- Edit Budget only; save/reload/persist.
- Edit Actual only; save/reload/persist.
- Edit Next Due only; save/reload/persist.
- Edit a Submitted bill without deleting payment history.
- Add one partial payment and verify Submitted/Remaining.
- Add multiple payments and verify they aggregate while Actual remains unchanged.
- Update and remove an individual payment and verify recalculation.
- Verify all column filters after month changes.
- Add a bill and verify persistence and correct section/order.
- Archive a bill and verify subsequent views.
- Refresh after each mutation and verify state from the database.

## Release gate

A Preview is UAT-ready only when:

1. Unit/domain tests pass.
2. Repository/service integration tests pass.
3. Browser E2E Bills acceptance tests pass.
4. Production build passes.
5. CI reports success on the exact commit deployed to Preview.
6. No temporary core-behavior interception shim is required.

Statement reconciliation remains out of scope until this gate is satisfied.
