# Project Ledger — Statement Upload & Reconciliation Requirements

## Document Control

- **Document ID:** PL-REQ-STM-REC
- **Version:** 1.0
- **Status:** Approved baseline for implementation
- **Date:** 2026-08-13
- **Related GitHub Issue:** #63
- **Applies to:** Project Ledger statement upload, parsing, reconciliation, payment posting, bill grouping, and status-driven actions

## 1. Purpose

### P-STM-001
Define the business, functional, non-functional, business-rule, acceptance, traceability, and completion requirements for uploading financial statements and reconciling statement transactions to Project Ledger bills.

### P-STM-002
Prevent statement parsing or reconciliation from creating incorrect financial data, including posting running balances as payment amounts, matching transactions to the wrong bill, or locking a bill in an incorrect status.

## 2. Scope

### S-STM-001 — In Scope
This specification covers statement file upload; supported statement sources; statement-period detection; institution-specific transaction extraction; transaction amount-column interpretation; transaction date/year determination; merchant normalization and aliasing; matching to Master Bills; NEW and unmatched transactions; amount variance handling; duplicate statement protection; multiple payments against one bill occurrence; statement provenance; payment creation/linking; reconciliation undo/reversal; bill status recalculation; account-based bill grouping; and regression testing using representative real statements.

### S-STM-002 — Supported Source Profiles
The reconciliation framework shall support source-specific parsing profiles. The initial approved profile is Capital One. TCU and TCUB shall be added as separate source profiles after representative statements are reviewed.

## 3. Business Requirements

### BR-STM-001 — Statement Upload Capability
The system shall allow a user to upload supported financial statements for reconciliation.

### BR-STM-002 — Statement Transaction Accuracy
The system shall import the actual posted transaction amount from a financial statement and shall not substitute account balances, running balances, available balances, statement balances, or other informational monetary values.

### BR-STM-003 — Institution-Specific Parsing
The system shall correctly interpret statement layouts from supported financial institutions rather than assuming all institutions use a single date, column, or transaction-row format.

### BR-STM-004 — Reconciliation Integrity
The system shall require a reliable relationship between a statement transaction and a Master Bill before creating or linking financial payment activity.

### BR-REC-001 — Reconciliation Correction Capability
The system shall allow the user to correct an erroneous reconciliation decision without deleting or re-uploading the statement.

### BR-STS-001 — Derived Status Integrity
Bill status shall reflect the current financial state after bill edits, payment actions, statement reconciliation, and reversals.

### BR-BILL-001 — Account-Based Bill Grouping
Bills shall appear in the monthly section that corresponds to their designated account grouping rules.

## 4. Functional Requirements

### FR-STM-001 — Supported File Types
The system shall accept PDF statements and approved CSV statement files.

### FR-STM-002 — Maximum File Size
The system shall accept an individual statement file up to 10 MB.

### FR-STM-003 — Request Capacity
The application request layer shall be configured above the 10 MB business file limit to allow multipart form overhead.

### FR-STM-004 — Statement Period Detection
The system shall detect the statement start date, end date, and effective reconciliation month when the statement provides a recognizable billing period.

### FR-STM-005 — Period Confirmation
If a statement spans months or the user selects a month that differs from the detected month, the system shall require explicit confirmation before import.

### FR-STM-006 — Duplicate Statement Detection
The system shall prevent duplicate statement imports using a deterministic statement fingerprint/hash.

### FR-STM-007 — Transaction Extraction
The system shall extract eligible transaction rows from supported statement layouts and retain source transaction date, raw description, normalized payee, and transaction amount.

### FR-STM-008 — Transaction Amount Selection
For a supported statement layout containing both a transaction amount and a running balance, the system shall persist the **first applicable monetary transaction column** as the payment/reconciliation amount and shall not use the subsequent running-balance column as a payment.

### FR-STM-009 — Provenance
The system shall retain sufficient source provenance to identify the statement import and source transaction associated with a posted or linked payment.

### FR-CAP-001 — Capital One Named-Month Dates
The system shall recognize Capital One transaction rows using named-month transaction and posting dates, including formats such as `Jan 2   Jan 3   Merchant   $39.95`.

### FR-CAP-002 — Capital One Year Rollover
When a Capital One billing cycle spans calendar years, the system shall assign each transaction to the correct year based on the statement period.

### FR-CAP-003 — Capital One Transaction Amount
For the approved Capital One profile, the system shall use the statement's transaction **Amount** field as the reconciliation amount and shall not interpret statement summary balances as transactions.

### FR-REC-001 — Match Review
The system shall classify extracted statement transactions as Matched, Amount Variance, NEW, or Unmatched according to reconciliation rules.

### FR-REC-002 — Multiple Payments
The system shall allow multiple statement transactions and/or manual payments to reconcile to the same bill occurrence when they represent distinct payments.

### FR-REC-003 — Undo Last Reconciliation Action
The system shall provide an **Undo** control for the most recent eligible reconciliation action on the active statement.

### FR-REC-004 — State Restoration
Undo shall restore the affected statement transaction and associated bill/payment state to the state that existed immediately before the reversed action.

### FR-REC-005 — Recalculation After Undo
After an undo or reversal, the system shall recalculate payment totals, remaining amount, credit amount, and bill status.

### FR-BILL-001 — Capital One Section
The monthly Bills view shall provide a dedicated **Capital One** section for bills assigned to the Capital One account grouping.

### FR-BILL-002 — Capital One Placement
A bill assigned to Capital One shall appear under Capital One and shall not appear under Personal, Business, or Streaming solely because of its stored bill type.

### FR-STS-001 — Submitted Actions
When a bill is Submitted, the system shall prevent duplicate full Submit actions while continuing to allow edit, payment review/correction, reconciliation, eligible undo/reversal, and archive actions.

### FR-STS-002 — Overdue Actions
When a bill is Overdue, the system shall allow full payment submission, partial payment, edit, actual-amount correction, statement reconciliation, and archive actions.

### FR-STS-003 — Partial Actions
When a bill is Partial, the system shall allow additional payments, payment correction/removal, bill edit, actual-amount correction, and statement reconciliation.

## 5. Non-Functional Requirements

### NFR-STM-001 — Financial Safety
A parsing or reconciliation ambiguity shall fail safe to review rather than silently creating an incorrect payment.

### NFR-STM-002 — Auditability
Reconciliation actions that create, link, edit, remove, or reverse financial payment relationships shall be auditable.

### NFR-STM-003 — Regression Protection
Automated regression coverage shall include upload-size boundaries, supported source date formats, amount-column selection, year rollover, matching safety, status recalculation, and grouping rules.

### NFR-STM-004 — UI Consistency
Changes required by this specification shall preserve the existing Project Ledger visual design unless a new control or section is required by an approved functional requirement.

## 6. Business Rules

### BRULE-STM-001 — Request Limit Contract
The framework request-body limit shall exceed the application's 10 MB per-file maximum. A 12 MB Server Action limit is the approved configuration target to permit multipart overhead.

### BRULE-STM-002 — Transaction Amount Priority
When an applicable transaction row contains two monetary columns after the transaction description, the first monetary column is the actual transaction/payment amount and the second monetary column is the running balance.

### BRULE-STM-003 — No Balance as Payment
Running balance, statement balance, current balance, previous balance, available balance, credit limit, and similar summary values shall never be interpreted or persisted as bill payments.

### BRULE-STM-004 — Source-Specific Parsing
A supported institution may define source-specific transaction-row parsing rules. Source-specific rules shall not weaken common reconciliation safety rules.

### BRULE-CAP-001 — Capital One Named-Date Rule
Capital One named-month transaction and posting dates shall be recognized as transaction rows.

### BRULE-CAP-002 — Capital One Calendar Boundary
Capital One transactions occurring in December on a statement ending in January shall use the prior calendar year; January transactions shall use the statement end year.

### BRULE-CAP-003 — Capital One Transaction Section
Capital One purchase transactions shall be extracted from the transaction section; payments, credits, adjustments, totals, statement balances, fees, interest summaries, rewards, and credit-limit values shall not be imported as bill payments.

### BRULE-REC-001 — Reliable Match Required
A payment shall not be created from a statement transaction unless the transaction has an approved reliable match or the user explicitly resolves the transaction to a bill.

### BRULE-REC-002 — Amount Variance Review
An Amount Variance shall require explicit user review before it can create or link a payment.

### BRULE-REC-003 — Undo Auditability
Undo shall be recorded as a reversal in the audit history; the original action shall not silently disappear.

### BRULE-REC-004 — Undo Scope
Undo shall apply to the most recent eligible reconciliation action for the active statement unless a later approved requirement expands undo to multi-level history.

### BRULE-STS-001 — Status Is Derived
Submitted, Partial, Overdue, and incomplete/open status values shall be calculated from effective amount, due date, and recorded payment state. Users shall not manually set these statuses.

### BRULE-STS-002 — Submitted Behavior
When status is Submitted, duplicate full Submit shall be disabled. Editing the bill, correcting Actual, reviewing/correcting payments, statement reconciliation, eligible undo, and archive shall remain available.

### BRULE-STS-003 — Submitted Recalculation
If the underlying Actual amount or payment records change after a bill is Submitted, the system shall recalculate the status and may change it to Partial, Overdue, open, or another valid derived state.

### BRULE-STS-004 — Overdue Behavior
When status is Overdue, full payment, partial payment, edit, actual-amount correction, statement reconciliation, and archive shall remain available.

### BRULE-STS-005 — Overdue Transition
An Overdue bill shall become Partial when a payment is recorded but an outstanding balance remains, and Submitted when payments meet or exceed the effective amount.

### BRULE-STS-006 — Partial Behavior
When status is Partial, additional payments, payment correction/removal, edit, actual-amount correction, statement reconciliation, and archive shall remain available.

### BRULE-STS-007 — Reconciliation Recalculates Status
After statement reconciliation creates, links, corrects, or reverses payment activity, the system shall recalculate bill status from the resulting financial state.

### BRULE-BILL-001 — TCU Grouping
Bills assigned to TCU shall be grouped under Personal.

### BRULE-BILL-002 — TCUB Grouping
Bills assigned to TCUB shall be grouped under Business.

### BRULE-BILL-003 — Capital One Grouping
Bills assigned to Capital One shall be grouped under Capital One and shall not remain under Personal, Business, or Streaming because of a stale stored bill type.

## 7. Acceptance Criteria

### AC-STM-001
Given a valid PDF statement at or below 10 MB, when the user uploads it, then the request shall reach application validation and shall not fail because of the framework's default 1 MB Server Action limit.

### AC-CAP-001
Given a Capital One transaction row formatted with named-month transaction/post dates, when the statement is parsed, then the transaction shall be extracted with the correct date, merchant description, and amount.

### AC-CAP-002
Given a Capital One statement crossing December to January, when transactions are parsed, then December rows shall receive the prior year and January rows the statement end year.

### AC-CAP-003
The January–July 2026 Capital One regression pack shall parse eligible purchase rows from every statement and shall not return zero transactions because of named-month date formatting.

### AC-STM-002
Given a supported two-money-column transaction layout, when parsed, then the first applicable monetary column shall be persisted as the transaction amount and the subsequent running-balance column shall not be posted as payment data.

### AC-REC-001
Given an incorrect eligible reconciliation action, when the user selects Undo, then the most recent eligible action shall be reversed, the prior state restored, and status/payment totals recalculated.

### AC-BILL-001
Given a bill with account `CAPITAL ONE`, when the monthly Bills view is displayed, then the bill shall appear under Capital One and not under Personal, Business, or Streaming.

### AC-STS-001
Given a Submitted bill, when displayed, then Submit shall be disabled while edit/correction and reconciliation actions required by this specification remain available.

### AC-STS-002
Given an Overdue bill with a partial payment posted, when totals are recalculated, then status shall become Partial if an outstanding balance remains.

### AC-STS-003
Given a Partial bill whose payments meet or exceed the effective amount, when totals are recalculated, then status shall become Submitted.

## 8. Traceability Matrix

| Requirement | Implementation Area | Acceptance Coverage |
|---|---|---|
| BR-STM-001 / FR-STM-002 / FR-STM-003 | Next.js upload/server-action configuration | AC-STM-001 |
| BR-STM-002 / FR-STM-008 | statement parser | AC-STM-002 |
| FR-CAP-001 | Capital One parser | AC-CAP-001, AC-CAP-003 |
| FR-CAP-002 / BRULE-CAP-002 | date/year resolver | AC-CAP-002 |
| BR-REC-001 / FR-REC-003 / FR-REC-004 | reconciliation actions/UI/audit | AC-REC-001 |
| BR-BILL-001 / FR-BILL-001 / FR-BILL-002 | Bills grouping/domain | AC-BILL-001 |
| FR-STS-001 / BRULE-STS-002 | Bills action controls/status domain | AC-STS-001 |
| FR-STS-002 / BRULE-STS-005 | status domain | AC-STS-002 |
| FR-STS-003 / BRULE-STS-006 | status domain | AC-STS-003 |

## 9. Definition of Done

### D-STM-001
The requirements baseline is committed to the repository and linked to the implementation work.

### D-STM-002
The upload-size configuration supports the 10 MB business limit without bypassing application validation.

### D-STM-003
Capital One named-month transaction rows parse correctly, including year rollover and transaction amount selection.

### D-STM-004
Capital One bills are grouped under a dedicated Capital One section.

### D-STM-005
Undo/reversal behavior is implemented with auditability and state/status recalculation.

### D-STM-006
Full automated regression tests and production build pass.

### D-STM-007
Vercel Preview is validated using representative Capital One statements before merge.

### D-STM-008
After merge, production deployment is verified on Vercel project `prj_uKSSmtrWFvrGi7rHz1Gnvo2Rf0HC`.

## 10. Version History

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-08-13 | Initial formal baseline covering statement upload, Capital One parsing, amount-column rules, reconciliation undo, status-driven actions, and Capital One bill grouping. |

## 11. Approval

Approved for implementation by the Product Owner in the active Project Ledger work session on 2026-08-13.
