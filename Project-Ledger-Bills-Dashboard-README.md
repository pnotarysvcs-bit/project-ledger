# Project Ledger – Bills and Dashboard Enhancement Handoff

## Purpose

This README serves as the authoritative implementation specification for the Project Ledger Bills workspace and Dashboard enhancements.

The implementation must establish the underlying data framework, persistence model, calculation services, and business rules before layout-level changes are completed.

The objective is to ensure that bill status, payment activity, summary cards, Dashboard metrics, and monthly overview values are calculated consistently from one persistent source of truth.

---

## Implementation Directive

Review the current repository and implement the requirements in this document exactly as written.

Do not change the existing visual design, navigation, typography, colors, table structure, or layout except where this README explicitly requires a new button, card, label, or status.

Implementation order:

1. Data model and persistence
2. Shared business-rule and calculation services
3. Submit, Partial, Edit, Archive, and Bulk Submit workflows
4. Bills workspace summary cards
5. Dashboard summary cards
6. This Month Overview status alignment
7. Automated tests and reconciliation validation
8. UI integration and regression testing

Before modifying code, inspect the current implementation and provide:

- Affected files
- Proposed implementation plan
- Existing conflicts with this README
- Required data-model changes
- Required API changes
- Any unresolved requirements requiring clarification

Do not begin implementation until the implementation plan has been reviewed and approved.

---

## Scope

This implementation includes:

- Bills workspace row actions
- Full-payment submission behavior
- Multiple partial-payment transactions
- Bill editing
- Bill retirement through Archive
- Bulk Submit for previous months
- Bills summary-card calculations
- Dashboard summary-card calculations
- This Month Overview status classification
- Shared persistence and calculation logic
- Automated tests for all calculations and state transitions

This implementation excludes:

- Unapproved visual redesign
- Navigation redesign
- Permanent deletion of bill records
- New reporting modules unless required to preserve archived history
- Overpayment support unless separately approved

---

## Core Terminology

### BR-001 — Submit Means Paid

Within Project Ledger, clicking **Submit** means the bill has been paid in full.

The system may continue to display the user-facing label **Submitted**, but the corresponding business state is **Paid in Full**.

### BR-002 — Partial

A bill is Partial when one or more payments have been recorded and the cumulative payment total is less than the bill amount.

### BR-003 — Archived

An Archived bill is retired and must be removed from the active interface while remaining available for historical reporting and audit purposes.

### BR-004 — Single Source of Truth

The Bills workspace, Dashboard, and This Month Overview must use the same persisted bill and payment data and the same shared calculation services.

---

# Bills Workspace Requirements

## FR-001 — Bill Row Action Order

Each active bill row must display actions in this order:

**Submit | Partial | Edit | Archive**

Required styling:

- Submit: green while unpaid
- Partial: yellow while an outstanding balance exists
- Edit: green
- Archive: preserve current approved Archive styling

The Submit button must remain visible after selection and become greyed out and disabled.

---

## FR-002 — Submit Button Behavior

When the user clicks **Submit**, the system must:

1. Treat the bill as paid in full.
2. Persist the status as Submitted/Paid.
3. Display **Submitted** as a blue status badge.
4. Change the Submit button from green to grey.
5. Disable the Submit button.
6. Set the remaining balance to `$0.00`.
7. Include the full bill amount in Submitted and Total Paid calculations.
8. Exclude the bill from Remaining, Due Soon, Overdue, Partial, and Future calculations where applicable.
9. Prevent duplicate submission.
10. Preserve the state after refresh, navigation, logout, and deployment.

The Submit button must not be removed from the interface.

---

## FR-003 — Partial Payment Button

Add a yellow **Partial** button to each active bill row with an outstanding balance.

When clicked, the system must open a payment-entry interface for the selected bill.

The user must be able to enter:

- Payment amount
- Payment date

The system must support several partial payments against the same bill during the same selected month.

Each partial payment must be retained as a separate transaction and must not overwrite prior payments.

Required calculations:

```text
Cumulative Partial Paid = Sum of all partial-payment transactions for the bill and selected month
Remaining Balance = Bill Amount - Cumulative Partial Paid
```

Required behavior:

- Display cumulative amount paid.
- Display remaining balance.
- Display a yellow **Partial** status badge while the bill has an outstanding balance.
- Update Bills and Dashboard totals immediately.
- Persist payment history after refresh, navigation, logout, and deployment.
- Prevent cumulative payments from exceeding the bill amount unless an overpayment rule is later approved.
- Allow an incorrect partial-payment transaction to be reviewed, edited, or removed.
- Preserve an audit history where supported.

### FR-003A — Automatic Completion

When cumulative partial payments equal the full bill amount, the system must:

1. Change the bill to Submitted/Paid.
2. Display the blue Submitted badge.
3. Set the remaining balance to `$0.00`.
4. Grey out and disable the Submit button.
5. Remove the bill from Partial status.
6. Include the full bill amount in Submitted and Total Paid.
7. Preserve all individual payment transactions.

---

## FR-004 — Edit Button

When the user clicks **Edit**, the system must allow all approved editable fields to be changed.

Required editable fields:

- Bill name
- Type
- Category
- Account
- Monthly budget amount
- Frequency
- Next due date
- Status, where permitted by business rules

When changes are saved, the system must:

1. Validate all required fields.
2. Update the existing persistent Bills Master record.
3. Retain the existing unique identifier.
4. Prevent duplicate bill creation.
5. Refresh the affected row.
6. Recalculate all affected Bills and Dashboard values.
7. Preserve the changes after refresh, navigation, logout, and deployment.

If a bill amount is changed after partial payments already exist, the system must recalculate the remaining balance and status.

---

## FR-005 — Archive Button

When the user clicks **Archive**, the system must:

1. Treat the bill as retired.
2. Persist an archived or inactive state.
3. Remove the bill from the active Bills interface immediately.
4. Preserve the bill record and payment history.
5. Exclude the bill from all active calculations and counts.

Archived bills must be excluded from:

- Active Bills
- Total Budget
- Submitted
- Partial
- Remaining
- Due Soon
- Overdue
- Future
- Total Paid
- This Month Overview

Archive must not permanently delete the bill.

---

## FR-006 — Bulk Submit for Previous Months

Add a **Bulk Submit** action for previous months.

The action must:

1. Appear only when a month before the current month is selected.
2. Apply only to the selected month.
3. Include all eligible unpaid bills.
4. Exclude Submitted/Paid bills.
5. Exclude Archived bills.
6. Exclude otherwise ineligible bills.
7. Require user confirmation.
8. Mark all eligible bills as Submitted/Paid.
9. Display the blue Submitted badge on each affected bill.
10. Grey out and disable each affected Submit button.
11. Set each affected remaining balance to `$0.00`.
12. Recalculate all monthly summary cards and Dashboard values.
13. Display the number of bills successfully submitted.

Bulk Submit must not affect the current month or any other month.

---

# Bills Workspace Summary Cards

## FR-007 — Summary Card Order

Display Bills workspace summary cards in this order:

**Total Budget | Submitted | Partial | Remaining | Due Soon**

Preserve the current visual design. Add approved yellow styling for the Partial card.

---

## FR-008 — Total Budget Card

The **Total Budget** card must equal the sum of full monthly bill amounts for all active, non-archived bills in the selected month.

```text
Total Budget = Sum of full bill amounts for active bills in the selected month
```

Include:

- Unpaid bills
- Partial bills
- Submitted/Paid bills

Exclude:

- Archived bills

Rules:

- Partial payments must not reduce Total Budget.
- Several partial payments toward one bill must not cause duplicate counting.
- Add, Edit, and Archive actions must immediately update Total Budget.

---

## FR-009 — Submitted Card

The **Submitted** card must equal the full amount of bills that have been submitted and are therefore paid in full.

```text
Submitted Total = Sum of full bill amounts for Submitted/Paid bills
```

Include:

- Individual Submit
- Bulk Submit
- Bills completed through cumulative partial payments

Exclude:

- Unpaid bills
- Bills that remain partially paid
- Archived bills

The associated bill count must equal the number of Submitted/Paid bills.

Partial-payment amounts must not be included until the bill is fully paid.

---

## FR-010 — Partial Card

Add a yellow **Partial** summary card.

The card must display the cumulative amount already paid toward bills that remain partially paid.

```text
Partial Total = Sum of partial-payment transactions for bills currently in Partial status
```

Include:

- All partial payments for bills with an outstanding balance
- Several payments toward the same bill

Exclude:

- Unpaid bills with no payments
- Fully Submitted/Paid bills
- Archived bills

The card count must count each partially paid bill once, regardless of the number of payment transactions.

Once the bill becomes fully paid, it must leave Partial and move to Submitted.

---

## FR-011 — Remaining Card

The **Remaining** card must display the total outstanding balance across all unpaid and partially paid bills.

```text
Remaining Total = Sum of outstanding balances for active bills not paid in full
```

At the bill level:

- Unpaid bill: remaining balance equals full bill amount.
- Partial bill: remaining balance equals bill amount minus cumulative payments.
- Submitted/Paid bill: remaining balance equals `$0.00`.

Exclude:

- Submitted/Paid bills
- Archived bills

Remaining must never be below `$0.00`.

---

## FR-012 — Due Soon Card

The **Due Soon** card must display the outstanding amount for active bills due within the next seven calendar days.

```text
Due Soon Total = Sum of outstanding balances for eligible bills due within the next 7 days
```

Include:

- Bills due today
- Unpaid bills due within seven days
- Partial bills due within seven days, using only the outstanding balance

Exclude:

- Submitted/Paid bills
- Archived bills
- Bills with a `$0.00` balance
- Overdue bills unless the existing runbook explicitly defines them as Due Soon

The count must equal eligible bill records, not payment transactions.

---

## BR-005 — Bills Workspace Reconciliation

The following calculation must reconcile for every selected month:

```text
Total Budget = Submitted Total + Partial Total + Remaining Total
```

Definitions:

- Submitted = full scheduled amount of bills paid in full
- Partial = payment amounts already applied to bills that remain partially paid
- Remaining = outstanding balance of unpaid and partially paid bills

No amount may be counted twice.

---

# Dashboard Requirements

## FR-013 — Shared Dashboard Data

The Dashboard must use the same persisted Bills Master records and calculation services as the Bills workspace.

The Dashboard must not use:

- Placeholder values
- Hard-coded values
- Duplicate local-only state
- Separate calculation logic
- Payment-transaction counts where bill-record counts are required

---

## FR-014 — Active Bills Card

The **Active Bills** card must equal the exact number of active, non-archived bills in the selected month.

```text
Active Bills Count = Count of active, non-archived bill records in selected month
```

Include:

- Unpaid bills
- Partial bills
- Submitted/Paid bills that remain active bill records

Exclude:

- Archived bills

Each bill must be counted once, regardless of payment frequency or number of payment transactions.

The count must match the active bill records represented on the Bills tab for the same month.

---

## FR-015 — Overdue Card

The **Overdue** card must equal the exact number of active bills with a due date before today and an outstanding balance greater than `$0.00`.

```text
Overdue Count = Count of active bills where due date < today and remaining balance > 0
```

Include:

- Unpaid overdue bills
- Partially paid overdue bills with an outstanding balance

Exclude:

- Submitted/Paid bills
- Archived bills
- Bills with a `$0.00` balance

Each overdue bill must be counted once.

---

## FR-016 — Rename Dashboard Remaining Card to Partial

Change the Dashboard card currently labeled **Remaining** to **Partial**.

The Dashboard Partial card must display the same amount as the Partial card on the Bills workspace.

```text
Dashboard Partial Total = Bills Workspace Partial Total
```

Include cumulative payments for bills that remain in Partial status.

Exclude:

- Unpaid bills
- Submitted/Paid bills
- Archived bills

---

## FR-017 — Total Paid Card

The Dashboard **Total Paid** card must equal the full dollar amount of bills marked Submitted/Paid.

```text
Total Paid = Sum of full bill amounts for Submitted/Paid bills
```

Include:

- Individual Submit
- Bulk Submit
- Bills completed through cumulative partial payments

Exclude:

- Unpaid bills
- Bills that remain partially paid
- Archived bills

Required reconciliation:

```text
Dashboard Total Paid = Bills Workspace Submitted Total
```

---

# This Month Overview Requirements

## FR-018 — Replace Pending Status

Remove the current **Pending** label from the Dashboard This Month Overview section.

Replace it with:

**Submitted | Partial | Overdue | Future**

The status classifications must match the Bills tab for the same selected month.

---

## FR-019 — Submitted Overview Status

A bill is Submitted when it is paid in full.

Include:

- Individual Submit
- Bulk Submit
- Bills completed through cumulative partial payments

Exclude:

- Partial bills
- Archived bills

Displayed amount:

```text
Submitted Amount = Full bill amount for Submitted/Paid bills
```

---

## FR-020 — Partial Overview Status

A bill is Partial when:

- One or more payments exist.
- The bill is not paid in full.
- The bill is not overdue.

Count each bill once.

Displayed amount:

```text
Partial Amount = Cumulative amount paid toward non-overdue bills currently in Partial status
```

Exclude:

- Submitted/Paid bills
- Unpaid bills with no payments
- Overdue bills
- Archived bills

An overdue bill with partial payments must be classified as Overdue, not Partial.

---

## FR-021 — Overdue Overview Status

A bill is Overdue when:

- Its due date is before today.
- It has an outstanding balance greater than `$0.00`.

Include:

- Fully unpaid overdue bills
- Partially paid overdue bills

Exclude:

- Submitted/Paid bills
- Archived bills

Displayed amount:

```text
Overdue Amount = Outstanding balance of overdue bills
```

Overdue takes precedence over Partial and Future.

---

## FR-022 — Future Overview Status

A bill is Future when:

- It is unpaid.
- It has no partial payments.
- Its due date is today or later.
- It is not overdue.

Displayed amount:

```text
Future Amount = Outstanding balance of unpaid future bills
```

Exclude:

- Submitted bills
- Partial bills
- Overdue bills
- Archived bills

Bills due today are Future unless already Submitted or Partial.

---

## BR-006 — Status Precedence

Apply This Month Overview status classification in this order:

1. Submitted
2. Overdue
3. Partial
4. Future

Each active bill must appear in only one status category.

---

## BR-007 — Overview Count Reconciliation

For the selected month:

```text
Active Bills Count = Submitted Count + Overdue Count + Partial Count + Future Count
```

Each bill must be counted once.

The authoritative financial reconciliation remains:

```text
Total Budget = Submitted + Partial Payments + Remaining Outstanding Balance
```

---

# System-Wide Requirements

## NFR-001 — Persistence

The following must persist after refresh, navigation, logout, and deployment:

- Bill records
- Bill amounts
- Bill due dates
- Bill statuses
- Submitted/Paid state
- Archived state
- Individual partial-payment transactions
- Cumulative partial-payment totals
- Remaining balances

The UI must not display a successful update unless the persistent operation completes successfully.

---

## NFR-002 — Immediate Recalculation

The following actions must immediately recalculate all affected Bills and Dashboard values:

- Add Bill
- Submit
- Bulk Submit
- Add Partial Payment
- Edit Partial Payment
- Remove Partial Payment
- Edit Bill
- Archive Bill
- Change selected month

No manual page refresh may be required.

---

## NFR-003 — Shared Calculation Service

All financial totals, bill counts, and status classifications must be derived through shared calculation services.

The Bills workspace and Dashboard must not implement independent versions of the same business logic.

---

## NFR-004 — Data Integrity

The implementation must prevent:

- Duplicate bill creation during Edit
- Duplicate submission
- Duplicate counting of bills
- Duplicate counting of partial-payment transactions
- Negative remaining balances
- Archived bills appearing in active totals
- Cross-month Bulk Submit updates
- UI success states when persistence fails

---

## NFR-005 — Backward Compatibility

Where the existing system stores a technical status named `submitted`, the implementation may preserve that technical value for backward compatibility, provided the business meaning remains Paid in Full and all user-facing calculations behave accordingly.

---

## NFR-006 — UI Guardrails

Do not change the existing:

- Overall visual design
- Navigation
- Typography
- Established color palette
- Table structure
- Layout conventions

Permitted changes are limited to those explicitly required in this README:

- Yellow Partial button
- Yellow Partial card
- Blue Submitted status badge
- Grey disabled Submit state
- Bulk Submit action
- Label changes
- This Month Overview status changes

---

# Data Model Expectations

## D-001 — Bill Record

Each bill record should support, at minimum:

- Stable unique identifier
- Name
- Type
- Category
- Account
- Monthly amount
- Frequency
- Due date
- Selected month or billing-period association
- Active status
- Archived status
- Submitted/Paid status
- Created timestamp
- Updated timestamp

---

## D-002 — Payment Transaction

Each partial-payment transaction should support, at minimum:

- Stable unique identifier
- Bill identifier
- Billing month or period
- Payment amount
- Payment date
- Created timestamp
- Updated timestamp
- Deleted or reversed state, if soft deletion is used

Payments must not be stored only as a cumulative value. Individual transactions must remain available.

---

## D-003 — Derived Values

The following should be derived, not independently maintained where avoidable:

- Cumulative Partial Paid
- Remaining Balance
- Submitted Total
- Partial Total
- Remaining Total
- Due Soon Total
- Active Bills Count
- Overdue Count
- Total Paid
- This Month Overview status

---

# Required Automated Tests

## T-001 — Submit Tests

Verify:

- Submit marks bill paid in full.
- Submitted badge displays.
- Submit button remains visible, grey, and disabled.
- Remaining balance becomes zero.
- State persists.
- Duplicate Submit is blocked.

## T-002 — Partial Payment Tests

Verify:

- Multiple partial payments can be entered.
- Each payment remains a separate transaction.
- Cumulative paid is correct.
- Remaining balance is correct.
- Partial badge displays.
- Bill automatically becomes Submitted/Paid at full payment.
- Overpayment is blocked.
- Edit and removal of partial payments recalculate totals correctly.

## T-003 — Edit Tests

Verify:

- All approved fields are editable.
- Existing ID remains unchanged.
- No duplicate bill is created.
- Totals recalculate correctly.
- Changes persist.

## T-004 — Archive Tests

Verify:

- Archived bill disappears from active UI.
- Bill remains in persistent storage.
- Payment history remains available.
- Archived bill is excluded from all active counts and totals.

## T-005 — Bulk Submit Tests

Verify:

- Action appears only for previous months.
- Only selected month is affected.
- Eligible bills are submitted.
- Submitted and archived bills are excluded.
- Summary values recalculate correctly.

## T-006 — Card Calculation Tests

Verify for each selected month:

```text
Total Budget = Submitted + Partial + Remaining
```

Verify:

- Total Budget uses active full bill amounts.
- Submitted uses full amounts of paid bills.
- Partial uses payments for bills still partially paid.
- Remaining uses outstanding balances.
- Due Soon uses outstanding balances due in seven days.
- No duplicate counting occurs.

## T-007 — Dashboard Synchronization Tests

Verify:

```text
Dashboard Total Paid = Bills Submitted Total
Dashboard Partial Total = Bills Partial Total
Dashboard Active Bills Count = Active non-archived bill count
Dashboard Overdue Count = Active overdue bills with outstanding balance
```

## T-008 — Overview Status Tests

Verify:

- Pending is removed.
- Submitted, Partial, Overdue, and Future display.
- Each active bill appears in one status only.
- Status precedence is enforced.
- Counts reconcile to Active Bills.

---

# Acceptance Criteria

## AC-001

Unpaid active bills display a green Submit button.

## AC-002

The Submit button remains visible after selection but becomes grey and disabled.

## AC-003

Clicking Submit means the bill is paid in full.

## AC-004

Submitted bills display a blue Submitted badge.

## AC-005

Submitted state persists after refresh.

## AC-006

Each eligible active bill displays a yellow Partial button.

## AC-007

Several partial payments can be entered for one bill in one month.

## AC-008

Each partial payment retains its own amount and date.

## AC-009

Cumulative paid and remaining balances calculate correctly.

## AC-010

Partially paid bills display a yellow Partial badge.

## AC-011

A bill automatically becomes Submitted/Paid when cumulative payments equal the bill amount.

## AC-012

Edit allows all approved fields to be changed.

## AC-013

Edit retains the bill ID and does not create a duplicate.

## AC-014

Archive retires a bill and removes it from the active UI.

## AC-015

Archived bill and payment history remain available for audit purposes.

## AC-016

Archived bills are excluded from active counts and totals.

## AC-017

Previous months display Bulk Submit.

## AC-018

Bulk Submit affects only eligible bills in the selected previous month.

## AC-019

Total Budget equals all active bill amounts for the selected month.

## AC-020

Submitted equals the full amount of bills paid in full.

## AC-021

Partial equals payments applied to bills that remain partially paid.

## AC-022

Remaining equals all outstanding unpaid and partial balances.

## AC-023

Due Soon equals eligible outstanding balances due within seven days.

## AC-024

Active Bills equals the exact number of active, non-archived bills.

## AC-025

Overdue equals the exact number of past-due active bills with outstanding balances.

## AC-026

The Dashboard Remaining card is renamed Partial.

## AC-027

Dashboard Partial matches Bills workspace Partial.

## AC-028

Dashboard Total Paid matches Bills workspace Submitted.

## AC-029

The Pending label is removed from This Month Overview.

## AC-030

This Month Overview displays Submitted, Partial, Overdue, and Future.

## AC-031

Each active bill appears in only one overview status.

## AC-032

Dashboard and Bills workspace values remain synchronized.

## AC-033

Multiple payment transactions do not duplicate bill counts or budget amounts.

## AC-034

All totals update immediately after a bill or payment action.

## AC-035

The following reconciliation passes for every selected month:

```text
Total Budget = Submitted + Partial + Remaining
```

## AC-036

No unapproved changes are made to the existing visual design, navigation, or layout.

---

# Definition of Done

The work is complete only when:

1. All approved requirements are implemented.
2. All calculations use persisted data.
3. All Bills and Dashboard values use shared logic.
4. All automated tests pass.
5. Production build succeeds.
6. No regression is introduced to existing approved behavior.
7. UI guardrails are preserved.
8. All acceptance criteria pass.
9. The implementation plan and affected files are documented.
10. Changes are committed with a clear implementation summary.

---

# Codex Handoff Prompt

Use the following instruction when handing this README to Codex:

> Review `README-Bills-Dashboard-Handoff.md` and implement the approved Bills workspace and Dashboard requirements exactly as documented.
>
> Begin with the data framework, persistence model, shared calculation services, and business rules before making layout changes.
>
> Do not change the existing UI design, colors, navigation, typography, table structure, or layout except where the README explicitly requires a new button, card, label, or status.
>
> Use the persistent backend and Bills Master data as the single source of truth. Do not introduce placeholder data, duplicate calculations, or local-only state.
>
> Before modifying code, inspect the repository and provide:
> - the affected files,
> - the proposed implementation plan,
> - existing conflicts with the README,
> - required data-model and API changes,
> - and any requirement that cannot be implemented without clarification.
>
> Do not begin implementation until the plan has been reviewed and approved.

---

# Version History

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-08-06 | Initial consolidated Bills and Dashboard handoff specification |

---

# Approval

Status: **Ready for implementation-plan review**

Implementation must not begin until the repository assessment and implementation plan have been reviewed and approved.
