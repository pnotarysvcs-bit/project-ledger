# Project Ledger — Bills Module

## Phase 1 Approved Requirements Addendum

**Status:** Approved  
**Version:** 1.1.0  
**Approval Date:** August 4, 2026  
**Applies To:** `README-Bills-Phase1.md`

## Approved Scope Additions

The following requirements supplement and refine the approved Phase 1 Bills specification.

### Bills Master baseline

- April 2026 is the baseline start month.
- The supplied April master list contains 48 records: 25 Personal, 8 Streaming, and 15 Business.
- All 48 records must be available initially so the user can move month by month from April through August, adding or archiving bills as needed.
- The initial database load must not imply that every April bill remains active indefinitely.

### Bills Master fields

Each master bill must support:

- Bill
- Type
- Category
- Account
- Budget
- Frequency
- Due day or due information
- Start month
- Active state
- Archive state
- Notes

The approved categories from the April baseline are Home, Auto, Credit Card, Online Credit, Other, Savings, Streaming, and Business.

### Bills workspace UI

The primary table must display active bills only and use these columns:

`Bill | Type | Category | Account | Budget | Frequency | Next Due | Status | Actions`

Additional UI rules:

- Replace headings such as `Personal 4` with `Personal Bills` and show the count separately.
- Sort the Bill column alphabetically, A–Z.
- Rename Amount to Budget.
- Display Budget rounded to the nearest whole dollar while retaining cent precision in storage.
- Remove the Last Paid column.
- Provide Add Bill, Edit, Archive, and Delete capabilities.

### Frequency

Supported frequencies are:

- Monthly
- Bi-Weekly
- Quarterly
- Annual
- One-Time

Quarterly and annual bills appear only in applicable months. One-time bills do not automatically generate a new occurrence in later months.

### Lifecycle and monthly status

Active is the durable lifecycle state that determines whether a bill appears in the active UI. Archived bills remain excluded and do not automatically reactivate.

Approved monthly statuses are:

- Due Soon
- Overdue
- Partial
- Submitted

Paid is not an available status.

At the start of a new month, prior monthly payment activity and Submitted status do not carry forward. The new month's status is calculated from the due date and that month's payment activity without modifying the durable Bills Master definition.

### Multiple payments for every bill

Any bill may have any number of payment entries during a month. This applies to all bill types, not only credit cards.

Each payment must support:

- Payment date
- Amount
- Funding account
- Optional notes
- Edit
- Delete

Monthly calculations:

- `Submitted Total = sum of all payment entries for the bill and selected month`
- `Remaining = Budget - Submitted Total`

Status rules:

- Due Soon: no payment exists and the bill is approaching its due date.
- Overdue: the due date has passed and Submitted Total is below Budget.
- Partial: one or more payments exist and Submitted Total is below Budget.
- Submitted: Submitted Total equals or exceeds Budget.

Partial and Submitted must be derived from confirmed payment records. Monthly payment records must remain separate from the durable Bills Master record.

### Income & Credits separation

Income and Credits live in a dedicated `/income` workspace and remain separate from Bills Master. The Dashboard Income & Credits widget uses persisted entries for the selected month. Any number of income or credit entries may exist in a month.

## Additional Functional Requirements

**FR-021 — Category**  
The system must persist and display an approved Category for each bill.

**FR-022 — April Baseline**  
The system must load the 48 supplied April 2026 Bills Master records.

**FR-023 — Active-Only Primary List**  
The primary Bills table must exclude inactive and archived bills.

**FR-024 — Alphabetical Ordering**  
The primary Bills table must order bill names alphabetically.

**FR-025 — Approved Frequencies**  
The system must support Monthly, Bi-Weekly, Quarterly, Annual, and One-Time frequencies.

**FR-026 — Multiple Bill Payments**  
The system must permit any number of monthly payment records for any bill.

**FR-027 — Payment Management**  
The user must be able to add, edit, and delete individual payment records.

**FR-028 — Submitted Total**  
The system must calculate the monthly Submitted Total from confirmed payment records.

**FR-029 — Remaining Balance**  
The system must calculate Remaining as Budget minus Submitted Total.

**FR-030 — Approved Status Set**  
The monthly status set must be Due Soon, Overdue, Partial, and Submitted. Paid must not be available.

**FR-031 — Monthly Reset**  
A new month must begin without carrying forward prior-month payment records or Submitted status.

**FR-032 — Budget Display**  
The primary UI must display Budget rounded to the nearest whole dollar while preserving cent precision in storage.

**FR-033 — Row Actions**  
Each bill row must provide Edit, Archive, and Delete actions.

## Additional Business Rules

**RULE-011 — Active Controls Visibility**  
Only active, non-archived bills appear in the primary Bills table.

**RULE-012 — Payment Records Are Separate**  
Payment activity must not overwrite the Bills Master Budget, Category, Frequency, or account definition.

**RULE-013 — Partial Status**  
A bill is Partial when one or more payments exist for the selected month and their total is below Budget.

**RULE-014 — Submitted Status**  
A bill is Submitted when monthly payment totals equal or exceed Budget.

**RULE-015 — Unlimited Monthly Payments**  
No fixed limit may be imposed on the number of payments recorded for a bill in a month.

**RULE-016 — No Paid Status**  
Paid is not a supported monthly status.

**RULE-017 — New-Month Isolation**  
Payments and monthly status from one month must not alter another month.

## Additional Acceptance Criteria

**AC-020**  
Given the April baseline is loaded, when Bills Master is queried, then 48 records exist: 25 Personal, 8 Streaming, and 15 Business.

**AC-021**  
Given the primary Bills table loads, when active records are displayed, then inactive and archived records are excluded and Bill names are ordered A–Z.

**AC-022**  
Given a bill is displayed, then Category, Frequency, Budget, and approved row actions are available and Last Paid is absent.

**AC-023**  
Given any bill, when multiple valid payment entries are added in the same month, then all entries persist independently after refresh.

**AC-024**  
Given monthly payments total less than Budget, when at least one payment exists, then the bill status is Partial.

**AC-025**  
Given monthly payments equal or exceed Budget, then the bill status is Submitted.

**AC-026**  
Given a new month begins, then prior-month payment records and Submitted status do not carry forward.

**AC-027**  
Given a bill is archived, then it remains excluded in later months until explicitly restored.

## Definition of Done Additions

Phase 1 is not complete until:

- The database contains the verified 48-record April baseline.
- Category is implemented and displayed.
- Add, Edit, Archive, Delete, and payment-entry workflows persist after refresh.
- Any bill can receive unlimited monthly payment entries.
- Due Soon, Overdue, Partial, and Submitted reconcile to due dates, Budget, and confirmed payment totals.
- Paid is absent.
- Active-only filtering and alphabetical ordering are verified.
- The database migration, tests, UI changes, and requirements documentation are committed in the same implementation branch and pull request.

## Version History

| Version | Date | Change | Status |
|---|---|---|---|
| 1.1.0 | 2026-08-04 | Added April baseline, Category, active-only UI, frequency, multiple payments, Partial status, and monthly reset requirements | Approved |
