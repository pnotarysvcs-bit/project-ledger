# Project Ledger — Bills & Dashboard Authoritative Requirements

**Document:** Project-Ledger-Bills-Dashboard-README (Authoritative)  
**Status:** Approved (authoritative doc for Bills + Dashboard behavior)  
**Version:** 1.2.0  
**Approval Date:** 2026-08-08

## Purpose

This README is the single authoritative source of truth for approved Project Ledger Bills and Dashboard behavior. It consolidates the approved Phase 1 Bills requirements, subsequent occurrence/payment clarifications, and the Bills Workspace Enhancements approved on 2026-08-08.

Where a requirement in this document conflicts with an earlier Bills artifact, this document governs. Existing requirement identifiers are preserved where possible. Newly integrated enhancement requirements use unused higher-number ranges where needed to avoid collisions with legacy Phase 1 identifiers.

## Summary of Key Changes

Existing approved behavior remains in force, including distinct Budget Amount and Actual Bill Amount concepts, occurrence-level financial calculations, confirmed payments as the source of truth, historical preservation, TCUB/TCU classification rules, occurrence-scoped due dates, bi-weekly installment modeling, and migration/backfill safeguards.

Version 1.2.0 additionally requires:

- Bills workspace heading to display only the selected month and year.
- Incomplete/missing-amount occurrences to be mutually exclusive from Overdue status.
- A user-facing `Bills need an amount` alert that is separate from migration/data-quality indicators.
- Filtering on every displayed bill-data column except Actions.
- Business/Personal to remain Type classifications and not Category values.
- Removal of the separate edit panel in favor of inline row editing.
- Save and Cancel controls within the row being edited.
- No automatic scroll-to-top behavior after Edit, Save, Cancel, Submit, or Partial actions.
- Actual Bill Amount to remain editable after confirmed payment activity.
- Existing confirmed payment records to remain unchanged when Actual Bill Amount is later entered or corrected.
- Automatic recalculation of Effective Amount, Remaining Balance, Credit Amount, and derived Status when financial inputs change.
- Consistent behavior across Business, Personal, and Streaming bill sections.
- Yellow visual treatment for the Partial action without changing Partial payment logic.

## Definitions

- **Budget Amount:** The planned or budgeted amount for a bill occurrence in a reporting month. The durable planned amount is stored on the Bills Master. Each occurrence stores its own `occurrence_budget_amount` snapshot copied from the applicable master Budget when the occurrence is created unless explicitly overridden.
- **Actual Bill Amount:** The invoiced or confirmed dollar amount for a specific occurrence. It remains nullable until known, may differ from Budget Amount, and may be lower than cumulative payments.
- **Payments Made:** The sum of confirmed payment transactions attached to an occurrence. Each payment includes payment date, amount, funding_account, and optional notes.
- **Effective Amount:** Actual Bill Amount when Actual is non-null and explicitly set; otherwise occurrence Budget Amount.
- **Remaining Balance:** `max(Effective Amount - Payments Made, 0)`.
- **Credit Amount:** `max(Payments Made - Effective Amount, 0)`.
- **Confirmed Payment Record:** A persisted payment transaction confirmed by the database. Confirmed payment records are the financial source of truth for status derivation.
- **Reporting Month:** A calendar-month grouping used by Bills and Dashboard totals. It may contain more than one installment occurrence for a recurring bill.
- **Installment Occurrence:** A due-date-scoped instance of a bill with one due date, its own Budget snapshot, nullable Actual Bill Amount, payment records, Status, and stable identifier.
- **Monthly Occurrence:** The single installment occurrence produced by a monthly cadence. Occurrence-level calculations apply independently to every installment.
- **Historical Correction:** An explicit, user-initiated correction to a prior occurrence or payment that is persisted with an audit trail.
- **Bills Need an Amount:** A user-actionable condition that exists only when both occurrence Budget Amount and Actual Bill Amount are null.
- **Data Quality Condition:** A migration, provenance, legacy-allocation, or other technical condition requiring remediation. A data-quality condition is not the same as `Bills need an amount`.

## Business Requirements — Bills Workspace Enhancements

The enhancement requirements below were approved in the working session on 2026-08-08. They are numbered in the BR-200 range during integration to preserve global uniqueness against earlier Phase 1 BR identifiers.

- **BR-200 — Bills Workspace Title**  
  The Bills workspace shall display only the selected month and year in the page title and shall not include the word `Bills`.

- **BR-201 — Accurate Overdue Classification**  
  The system shall classify an occurrence as Overdue only when it has a valid Effective Amount, its due date has passed, and confirmed Payments Made are less than Effective Amount.

- **BR-202 — Missing Amount Alert**  
  The system shall provide a user-facing alert for occurrences requiring an amount. The alert shall represent only occurrences where both Budget Amount and Actual Bill Amount are missing.

- **BR-203 — Data Quality Separation**  
  Migration, reconciliation, provenance, legacy-allocation, or other technical data-quality conditions shall not be included in the user-facing `Bills need an amount` alert unless the occurrence independently meets BR-202.

- **BR-204 — Column Filtering**  
  The user shall be able to filter the Bills workspace using any displayed bill-data column except Actions.

- **BR-205 — Type and Category Separation**  
  Business and Personal shall be treated as bill Types and shall not be valid Category values. Category shall represent the nature or purpose of the expense.

- **BR-206 — Inline Bill Editing**  
  The user shall be able to edit bill information directly within the applicable bill row without using a separate edit panel.

- **BR-207 — Comprehensive Row Editing**  
  The Edit action shall allow the user to modify every field that is permitted to be edited for the selected bill or occurrence.

- **BR-208 — In-Row Save and Cancel**  
  While a row is in edit mode, the system shall provide Save and Cancel actions within that row.

- **BR-209 — Viewport Preservation**  
  Edit, Save, Cancel, Submit, and Partial actions shall not automatically reposition the user to the top of the Bills workspace.

- **BR-210 — Actual Amount Post-Submission Editing**  
  The user shall be able to enter or modify Actual Bill Amount after one or more confirmed payments have already been submitted.

- **BR-211 — Payment Record Preservation**  
  Editing Actual Bill Amount shall not modify, delete, replace, or recreate existing confirmed payment transactions.

- **BR-212 — Financial Recalculation**  
  When Actual Bill Amount is added or changed, the system shall recalculate Effective Amount, Remaining Balance, Credit Amount, and derived Status.

- **BR-213 — Consistent Bill-Section Behavior**  
  Inline editing, viewport preservation, filtering, financial recalculation, and applicable bill actions shall operate consistently across Business, Personal, and Streaming bill sections.

- **BR-214 — Partial Action Visual Identification**  
  The Partial action shall use a yellow visual treatment wherever it appears, without changing the underlying Partial-payment behavior.

## Business Rules

- **RULE-001 — Bills Master Authority**  
  Bills Master remains the authoritative source for durable bill definitions.

- **RULE-002 — Database Persistence Required**  
  A bill or payment change is not complete until persistent storage confirms it.

- **RULE-003 — TCUB Classification**  
  Prefixes beginning with `TCUB` are Business.

- **RULE-004 — TCU Classification**  
  Prefixes beginning with `TCU`, after excluding `TCUB`, are Personal.

- **RULE-005 — Prefix Evaluation Order**  
  `TCUB` must be evaluated before `TCU`.

- **RULE-006 — Category Cannot Override Prefix**  
  A stale form category or client-side value cannot override canonical prefix-derived Type classification.

- **RULE-007 — Monthly Status Separation**  
  Month-specific status and occurrence fields must be stored separately from the durable Bills Master definition.

- **RULE-100 — Confirmed Payments as Source of Truth**  
  Confirmed payment records are the authoritative financial input for Submitted and Partial status derivation and for Remaining Balance and Credit Amount calculations.

- **RULE-101 — Occurrence Fresh-Start and Budget Snapshot**  
  Each new occurrence starts with blank Status, zero Payments Made, an occurrence Budget snapshot copied from the applicable Bills Master Budget unless explicitly overridden, and `actual_amount = null` unless an invoiced or confirmed Actual Bill Amount is already known. Prior occurrences must not be automatically rewritten by rollover, archive, recurrence, or later master edits.

- **RULE-102 — Period-Effective Archive/Retire**  
  Archive or retirement actions prevent new occurrences beginning with the effective period but do not rewrite or remove historical occurrences.

- **RULE-103 — Type Mapping and Editability**  
  When account/funding mapping determines Type through TCUB/TCU rules, Type must not be independently editable unless the mapping is explicitly cleared or overridden through an approved admin workflow.

- **RULE-104 — Overdue Precedence (amended)**  
  An occurrence may be classified Overdue only when Effective Amount is non-null, the due date has passed, and confirmed Payments Made are below Effective Amount. Overdue takes precedence over Partial when those conditions are met.

- **RULE-105 — Incomplete Active Bills (amended)**  
  Active occurrences that lack both occurrence Budget Amount and Actual Bill Amount are user-actionable missing-amount records, remain visible for editing, and are excluded from financial reconciliation and Headline Budget totals until corrected.

- **RULE-106 — Credit Synchronization**  
  Credit Amount is derived from confirmed Payments Made versus Effective Amount. Any persisted credit/overpayment materialization must be transactionally synchronized whenever a related payment, Actual Bill Amount, or occurrence Budget override changes.

- **RULE-107 — Historical Preservation on Delete**  
  A Bills Master record with historical occurrences, payments, credits, or reporting dependencies must not be hard-deleted through a cascading delete path.

- **RULE-108 — Historical Correction Governance**  
  A prior occurrence or payment may be corrected only through a deliberate Historical Correction action that records actor, timestamp, changed fields, prior values, and new values.

- **RULE-109 — Incomplete and Overdue Mutual Exclusivity**  
  An occurrence with no Effective Amount shall not be classified as Overdue. Missing-amount and Overdue conditions are mutually exclusive for user-facing status purposes.

- **RULE-110 — Missing Amount Definition**  
  An occurrence shall be considered to `need an amount` only when both occurrence Budget Amount and Actual Bill Amount are null.

- **RULE-111 — Data Quality Separation**  
  Migration-incomplete, provenance, legacy-allocation, or other technical data-quality conditions shall not cause an occurrence to be included in `Bills need an amount` unless RULE-110 is independently satisfied.

- **RULE-112 — Type and Category Separation**  
  `Business` and `Personal` are Type classifications and are not valid Category values.

- **RULE-113 — Type Mapping Authority**  
  Where account mapping determines Type through TCUB/TCU rules, Type remains derived and shall not be independently overridden through normal inline editing.

- **RULE-114 — Inline Editing Authority**  
  The selected bill row shall be the primary editing surface. The separate edit panel shall no longer be used.

- **RULE-115 — Editable Field Coverage**  
  Edit shall expose every field legitimately editable for the selected bill or occurrence, subject to existing classification, recurrence, persistence, and historical-correction rules.

- **RULE-116 — Payment Preservation After Actual Edit**  
  Changing Actual Bill Amount after Submit or Partial activity shall not alter, delete, replace, or recreate existing confirmed payment transactions.

- **RULE-117 — Actual Amount Precedence**  
  When Actual Bill Amount is populated, it becomes Effective Amount for the occurrence and supersedes occurrence Budget Amount for financial calculations.

- **RULE-118 — Recalculation on Financial Change**  
  A change to Actual Bill Amount, occurrence Budget Amount, due date, or confirmed payments shall trigger recalculation of Effective Amount, Remaining Balance, Credit Amount, and derived Status.

- **RULE-119 — Viewport Preservation**  
  Edit, Save, Cancel, Submit, and Partial actions shall not intentionally reposition the user to the top of the Bills workspace.

- **RULE-120 — Column Filter Scope**  
  Filtering is permitted on all displayed bill-data columns except Actions. Filters affect only the current view and do not modify persisted data.

- **RULE-121 — Partial Button Presentation**  
  The Partial button shall use a yellow visual treatment wherever displayed. This rule affects presentation only.

- **RULE-122 — Section Consistency**  
  Approved editing, filtering, status, viewport, and action behaviors shall apply consistently across Business, Personal, and Streaming bill sections.

- **RULE-123 — Title Presentation**  
  The Bills workspace heading shall display only the selected month and year and shall not append the word `Bills`.

## Functional Requirements

- **FR-001 — List Bills**  
  The Bills workspace must retrieve and display persisted Bills Master records and their occurrences.

- **FR-002 — Add Bill**  
  The user must be able to add a bill using approved editable fields.

- **FR-003 — Edit Bill (amended)**  
  Selecting Edit shall place the selected bill occurrence directly into inline edit mode. The separate edit panel shall be removed. All fields permitted for that bill/occurrence shall be editable directly within the row. Save and Cancel shall be available within the row. Master-level versus occurrence-level persistence semantics remain governed by existing rules, including Historical Correction for prior occurrences.

- **FR-004 — Persist Add and Edit**  
  Add and Edit operations must write through a server-side API or service to persistent storage.

- **FR-005 — Database-Confirmed Success**  
  A persistence action shall not be reported as successful until the database confirms it.

- **FR-006 — Refresh Retention**  
  Persisted changes shall survive refresh and subsequent retrieval.

- **FR-007 — Monthly Status Update (amended)**  
  Status shall be derived from confirmed payments and occurrence fields. An occurrence with no Effective Amount shall not be classified as Overdue. An occurrence qualifies as Overdue only when Effective Amount is known, its due date has passed, and confirmed Payments Made are below Effective Amount. Status shall be recalculated when Budget Amount, Actual Bill Amount, due date, or confirmed payments change.

- **FR-008 — Archive Bill**  
  Archiving may be master-level or period-effective and must not delete historical occurrences used for reporting.

- **FR-009 — Delete Bill**  
  Delete must preserve historical financial data. A master with occurrences, payments, credits, or prior reporting history must use soft delete/archive unless server-side validation proves hard delete is safe.

- **FR-010 — Active State**  
  Active/inactive state must be persisted and applied consistently to occurrence generation and views.

- **FR-101 — Payment Transactions**  
  Persisted payment records must include payment date, amount, funding_account, optional notes, and required metadata. Editing or deleting a payment must trigger recalculation of occurrence financials and status. Historical payment edits/deletes use Historical Correction.

- **FR-102 — Overpayment Handling and Credit Reconciliation**  
  Preserve payment transactions when Payments Made exceeds Effective Amount. Excess is Credit Amount. Any persisted credit materialization must remain synchronized when payments, Actual Bill Amount, or Budget overrides change.

- **FR-103 — Remaining and Credit Calculations**  
  Remaining Balance and Credit Amount shall be calculated at occurrence level using Effective Amount. Remaining must never be negative and Credit must be greater than or equal to zero.

- **FR-104 — funding_account & Notes Inclusion**  
  Payment workflows and APIs shall persist funding_account and optional notes.

- **FR-105 — Confirmed Payments Drive Status (amended)**  
  Submit, Bulk Submit, Partial, and Submitted status derivation shall use confirmed payment records only. `Submitted` is the canonical paid-in-full status. Actual Bill Amount shall remain editable after Submit, Partial, or other confirmed payment activity.

- **FR-106 — Next Due Editing Scope and Recurrence Semantics**  
  Editing Next Due on an occurrence changes only that occurrence by default. Explicit recurring-schedule propagation updates only applicable future recurrence fields. Bi-weekly schedules use a recurrence anchor and materialize every due-date-scoped installment independently.

- **FR-107 — Legacy Payment Migration and Backfill**  
  Before occurrence-based constraints or confirmed-only calculations are enforced, all legacy month rows and payment rows must be represented in the occurrence model with required funding-account, confirmation, provenance, and audit metadata. Unresolved migration records remain flagged for reviewed remediation and may not be silently dropped from historical totals.

- **FR-108 — Bills Need an Amount Alert**  
  The Bills workspace shall display a user-facing `Bills need an amount` alert. An occurrence is included only when occurrence Budget Amount is null and Actual Bill Amount is null. Migration/provenance/data-quality conditions alone shall not increase this count.

- **FR-109 — Data Quality Indicator Separation**  
  Migration-incomplete and other technical data-quality conditions shall be tracked separately from `Bills need an amount`.

- **FR-110 — Column Filtering**  
  The Bills workspace shall provide filtering for every displayed data column except Actions. Filtering applies to the selected reporting month, does not modify persisted data, and applies to displayed columns including Bill Name, Type, Category, Account, Budget, Actual, Next Due, and Status.

- **FR-111 — Category Validation**  
  The system shall prevent `Business` and `Personal` from being used as Category values. Existing records using those values as Category require remediation.

- **FR-112 — Inline Row Editing**  
  Selecting Edit shall place only the selected row into edit mode without navigating or scrolling the page. Editable controls shall replace applicable displayed values. Save persists changes before returning to display mode; Cancel discards unsaved changes.

- **FR-113 — Editable Row Fields**  
  Inline Edit shall allow modification of every field legitimately editable for the selected bill or occurrence, including applicable fields such as Bill Name, Category, Account, Budget Amount, Actual Bill Amount, Frequency, Next Due, and other approved attributes. Type remains governed by TCUB/TCU mapping where applicable.

- **FR-114 — Actual Amount After Submission**  
  Actual Bill Amount shall remain editable after Submit, Partial, or other confirmed payment activity. Updating Actual shall preserve all existing confirmed payment records and recalculate Effective Amount, Remaining Balance, Credit Amount, and derived Status.

- **FR-115 — Viewport Preservation**  
  The Bills workspace shall preserve the user's current working position when Edit, Save, Cancel, Submit, or Partial is selected. The system shall not automatically scroll to the top as a consequence of those actions.

- **FR-116 — Partial Button Visual State**  
  The Partial action button shall use a yellow visual treatment wherever it appears. Payment logic, persistence, and validation remain unchanged.

- **FR-117 — Bills Workspace Title**  
  The Bills workspace page heading shall display the selected month and year only, for example `April 2026`. The word `Bills` shall not be appended.

## Non-Functional Requirements — Bills Workspace Enhancements

The NFR-200 range is used to preserve uniqueness against earlier Phase 1 NFR identifiers.

- **NFR-200 — Performance:** Inline editing, filtering, Submit, Partial, Save, and Cancel shall not require unnecessary full-page reloads under normal conditions.
- **NFR-201 — Viewport Stability:** Row actions and data refreshes shall preserve scroll position and visual context.
- **NFR-202 — Data Integrity:** Editing financial or bill fields shall not corrupt, duplicate, remove, or overwrite confirmed payment transactions.
- **NFR-203 — Transactional Consistency:** Dependent financial calculations shall reflect a consistent persisted state.
- **NFR-204 — Persistence Reliability:** Save, Submit, or Partial shall not be treated as successful until persistence is confirmed.
- **NFR-205 — Filter Responsiveness:** Column filters shall respond without reloading the entire Bills workspace.
- **NFR-206 — Usability Consistency:** Inline editing, filtering, validation, and action behavior shall operate consistently across bill sections.
- **NFR-207 — Accessibility:** Inline fields, filters, and row actions shall remain keyboard accessible with clear labels and focus states.
- **NFR-208 — Visual Consistency:** Enhancements shall preserve the established Bills workspace design language; the yellow Partial button shall remain visually coherent with the interface.
- **NFR-209 — Auditability:** Persisted financial changes shall remain traceable through existing audit/Historical Correction mechanisms where applicable.
- **NFR-210 — Backward Compatibility:** Existing valid occurrences, payment records, recurrence behavior, and previously approved financial rules remain intact unless explicitly amended here.
- **NFR-211 — Data-Quality Isolation:** Technical data-quality flags shall remain distinguishable from user-correctable missing-amount conditions.

## Dependencies

- **D-001 — Supabase Environment**  
  Supabase remains the approved persistence platform.

- **D-002 — Server-Side Configuration and Payment Fields**  
  Server-side Supabase configuration must be valid in Vercel Preview and Production and support persisted payment records with payment_id, occurrence_id, payment_date, amount, funding_account, optional notes, created_by, created_at, and confirmed_flag.

- **D-003 — Bills Workspace API**  
  The Bills workspace must have a supported API/repository/service layer for occurrence-level operations and payment persistence.

- **D-004 — Dashboard Data Source**  
  Dashboard and Bills workspace totals must consume the same approved Bills Master + occurrences + payments data source where reconciliation is required.

- **D-005 — Legacy Data Migration**  
  Deployment of occurrence/payment constraints depends on validated migration/backfill of every legacy month row, installment, payment, funding account, confirmation field, and required audit/provenance metadata.

## Acceptance Criteria — Existing Occurrence/Payment Model

- **AC-015 — Month-specific status persists:** Confirmed payment status and Payments Made persist for the selected occurrence/month.
- **AC-016 — Master vs Occurrence:** Occurrence edits remain scoped to the selected occurrence unless recurring-schedule propagation is explicitly selected.
- **AC-017 — Dashboard/Bills reconciliation:** Dashboard and Bills totals for the same month reconcile to the same persisted source and approved financial rules.
- **AC-100 — Payment fields persisted:** A saved payment persists funding_account, optional notes, and required metadata and survives refresh.
- **AC-101 — Overpayment preserved and synchronized:** Payments exceeding Effective Amount produce synchronized Credit Amount without erasing payment history; subsequent amount/payment changes update the derived credit.
- **AC-102 — Incomplete active bills excluded:** An active occurrence with no occurrence Budget and no Actual is excluded from budget/financial totals until corrected.
- **AC-103 — Budget and Actual remain distinct:** Budget and Actual remain separately stored and reportable; Budget is the fallback until Actual is entered.
- **AC-104 — Submitted is canonical paid-in-full status:** Confirmed Payments Made reaching or exceeding Effective Amount derive `Submitted`; `Paid` is not introduced as a separate canonical status.
- **AC-105 — Historical corrections are explicit and audited:** Prior-period corrections record actor, timestamp, prior values, and new values.
- **AC-106 — Delete preserves history:** Historical occurrence/payment data is not removed by cascading master deletion.
- **AC-107 — Legacy payments survive migration:** Eligible legacy payments remain represented in historical totals after migration.
- **AC-108 — Overdue uses Budget fallback:** If Actual is null and occurrence Budget exists, a past-due underpaid occurrence uses Budget as Effective Amount for Overdue evaluation.
- **AC-109 — Next Due occurrence vs schedule behavior:** Occurrence-only changes remain occurrence-only unless recurring-schedule propagation is explicitly selected.
- **AC-110 — Bi-weekly installments remain distinct:** Each due-date-scoped bi-weekly installment has its own identifier, amount, payments, and status.
- **AC-111 — Every legacy month is backfilled:** Every source month row maps to a validated occurrence; unresolved provenance remains migration_incomplete rather than being silently rewritten.
- **AC-112 — Legacy funding accounts valid before enforcement:** Legacy payments receive a valid historical mapping or approved non-posting sentinel before required constraints are enabled.

## Acceptance Criteria — Bills Workspace Enhancements

The enhancement criteria use the AC-200 range to preserve uniqueness against existing Phase 1 and AC-100-series criteria.

- **AC-200 — Bills Workspace Title:** Given a reporting month is selected, when the Bills workspace loads, the page heading displays only the selected month and year and does not include `Bills`.
- **AC-201 — Incomplete Bill Not Overdue:** Given both occurrence Budget and Actual are null, when the due date has passed, the occurrence is not classified Overdue.
- **AC-202 — Valid Overdue Classification:** Given Effective Amount is known, due date has passed, and confirmed Payments Made are below Effective Amount, the occurrence is classified Overdue.
- **AC-203 — Bills Need an Amount Alert:** The user-facing alert counts only occurrences where both Budget Amount and Actual Bill Amount are null.
- **AC-204 — Data Quality Exclusion:** A migration/data-quality condition with a valid Budget or Actual does not increase the `Bills need an amount` count.
- **AC-205 — Column Filtering:** Applying a filter to any bill-data column except Actions restricts visible rows without modifying persisted data.
- **AC-206 — Actions Column Not Filterable:** Actions does not provide a filter control.
- **AC-207 — Category Validation:** `Business` and `Personal` are not accepted as Category values.
- **AC-208 — Type Classification Preservation:** TCUB/TCU-derived Type continues to be governed by account mapping during inline editing.
- **AC-209 — Inline Edit Activation:** Selecting Edit places that same row into edit mode without opening the separate edit panel.
- **AC-210 — Inline Editable Fields:** All fields permitted for the selected bill/occurrence are editable within the row subject to business rules.
- **AC-211 — Inline Save:** Save persists changes before the row returns to display mode.
- **AC-212 — Inline Cancel:** Cancel discards unsaved changes and restores prior persisted values.
- **AC-213 — No Automatic Scroll on Edit:** Selecting Edit does not move the viewport to the top.
- **AC-214 — No Automatic Scroll on Save/Cancel:** Save and Cancel preserve the working position.
- **AC-215 — No Automatic Scroll on Submit/Partial:** Submit and Partial preserve the working position.
- **AC-216 — Actual Editable After Submit:** Actual Bill Amount remains editable after confirmed payment activity.
- **AC-217 — Confirmed Payment Preservation:** Changing Actual does not delete, recreate, replace, or modify existing confirmed payment transactions.
- **AC-218 — Effective Amount Recalculation:** Saving Actual makes Actual the Effective Amount for that occurrence.
- **AC-219 — Remaining Balance Recalculation:** Saving a financial amount change recalculates Remaining Balance using current Effective Amount and confirmed Payments Made.
- **AC-220 — Credit Recalculation:** When Payments Made exceeds updated Effective Amount, Credit Amount is recalculated correctly.
- **AC-221 — Status Recalculation:** Changes to Actual, Budget, due date, or confirmed payments cause Status to be re-derived.
- **AC-222 — Cross-Section Consistency:** Approved row behavior is consistent across Business, Personal, and Streaming bill sections.
- **AC-223 — Partial Button Color:** Partial uses the approved yellow visual treatment wherever displayed.
- **AC-224 — Partial Logic Unchanged:** Changing the Partial button color does not alter Partial payment logic or persistence.

## Traceability Matrix — Bills Workspace Enhancements

| Business Requirement | Functional Requirement(s) | Non-Functional Requirement(s) | Business Rule(s) | Acceptance Criteria |
|---|---|---|---|---|
| BR-200 | FR-117 | NFR-208 | RULE-123 | AC-200 |
| BR-201 | FR-007 | NFR-203, NFR-211 | RULE-104, RULE-109, RULE-118 | AC-201, AC-202 |
| BR-202 | FR-108 | NFR-211 | RULE-105, RULE-110 | AC-203 |
| BR-203 | FR-109 | NFR-211 | RULE-111 | AC-204 |
| BR-204 | FR-110 | NFR-205, NFR-206 | RULE-120 | AC-205, AC-206 |
| BR-205 | FR-111, FR-113 | NFR-210 | RULE-112, RULE-113 | AC-207, AC-208 |
| BR-206 | FR-003, FR-112 | NFR-200, NFR-201, NFR-206 | RULE-114 | AC-209 |
| BR-207 | FR-113 | NFR-206, NFR-210 | RULE-115 | AC-210 |
| BR-208 | FR-112 | NFR-200, NFR-201, NFR-204 | RULE-114 | AC-211, AC-212 |
| BR-209 | FR-115 | NFR-201 | RULE-119 | AC-213, AC-214, AC-215 |
| BR-210 | FR-105, FR-114 | NFR-202, NFR-203 | RULE-116, RULE-117 | AC-216, AC-218 |
| BR-211 | FR-114 | NFR-202, NFR-209 | RULE-116 | AC-217 |
| BR-212 | FR-007, FR-114 | NFR-203 | RULE-117, RULE-118 | AC-218, AC-219, AC-220, AC-221 |
| BR-213 | FR-110, FR-112, FR-115 | NFR-206 | RULE-122 | AC-222 |
| BR-214 | FR-116 | NFR-208 | RULE-121 | AC-223, AC-224 |

## Definition of Done — Bills Workspace Enhancements

The DOD-200 range is used to preserve uniqueness against earlier project Definition of Done identifiers.

- **DOD-200 — Requirements Integration:** All approved enhancement requirements are incorporated into this authoritative README.
- **DOD-201 — Requirement Traceability:** All new/amended requirements have unique identifiers and are represented in the Traceability Matrix.
- **DOD-202 — Title Update Complete:** Bills workspace heading displays only selected month and year.
- **DOD-203 — Overdue Logic Corrected:** Occurrences without Effective Amount are not classified Overdue.
- **DOD-204 — Missing Amount Alert Corrected:** `Bills need an amount` counts only occurrences missing both Budget and Actual.
- **DOD-205 — Data Quality Separation Complete:** Technical data-quality conditions are tracked separately from the missing-amount alert.
- **DOD-206 — Filtering Implemented:** Every displayed bill-data column except Actions supports filtering.
- **DOD-207 — Type/Category Separation Complete:** Business and Personal are not valid Category values and Type mapping remains intact.
- **DOD-208 — Separate Edit Panel Removed:** The standalone bill-edit section is removed.
- **DOD-209 — Inline Editing Implemented:** Rows support in-place editing with Save and Cancel controls.
- **DOD-210 — Editable Field Coverage Verified:** Every field permitted by approved rules is available through inline editing.
- **DOD-211 — Viewport Preservation Verified:** Edit, Save, Cancel, Submit, and Partial do not automatically scroll to the top.
- **DOD-212 — Actual Amount Remains Editable:** Actual remains editable after confirmed payment activity.
- **DOD-213 — Payment Integrity Verified:** Actual changes do not modify, delete, duplicate, or recreate confirmed payment transactions.
- **DOD-214 — Financial Recalculation Verified:** Effective Amount, Remaining Balance, Credit Amount, and Status recalculate correctly.
- **DOD-215 — Partial Button Updated:** Partial uses the approved yellow visual treatment with unchanged business logic.
- **DOD-216 — Cross-Section Consistency Verified:** Approved behavior works consistently across Business, Personal, and Streaming sections.
- **DOD-217 — Persistence Validation:** Save/payment actions are not reported successful until persistent storage confirms them.
- **DOD-218 — Regression Testing Complete:** Existing Bills and Dashboard behavior is regression-tested.
- **DOD-219 — Automated Tests Updated:** Automated coverage is updated for status logic, alert logic, inline editing, filtering, Actual editing, financial recalculation, and viewport stability where testable.
- **DOD-220 — Production Build Validation:** Production build completes without new blocking errors.
- **DOD-221 — Acceptance Criteria Passed:** AC-200 through AC-224 pass before the enhancement is considered complete.
- **DOD-222 — Documentation Updated:** Version History, Approval, and Change Log record this enhancement set.

## Data Model Notes

- Occurrence records must remain due-date-scoped and independently identifiable.
- Master Budget remains a durable definition; new occurrences snapshot the applicable Budget into `occurrence_budget_amount`.
- `actual_amount` remains nullable until an invoiced/confirmed Actual is supplied.
- Confirmed payment records remain immutable financial evidence except through approved edit/delete/Historical Correction workflows.
- Legacy migration/backfill requirements remain mandatory before occurrence/payment constraints are treated as authoritative.
- Category remediation for legacy `Business`/`Personal` category values must preserve Type classification and historical financial records.

## UI & UX Notes

- The authoritative documentation pointer remains `Project-Ledger-Bills-Dashboard-README.md`.
- The separate edit panel is retired. Editing occurs in the selected row.
- Edit mode provides Save and Cancel within the row.
- Edit, Save, Cancel, Submit, and Partial preserve the user's viewport.
- Every displayed bill-data column except Actions supports filtering.
- Actual Bill Amount remains editable after payment activity.
- Partial uses a yellow visual treatment.
- The page heading displays only the selected month and year.
- `Bills need an amount` is user-actionable and must not be conflated with migration/data-quality alerts.
- Business/Personal are Type values, not Category values.

## Implementation Notes for Reviewers

- Implement against this README as the authoritative Bills/Dashboard requirements source.
- Do not reintroduce the separate edit panel.
- Do not use client-only state as the source of truth for financial status.
- Preserve confirmed payment transactions when Actual Bill Amount is changed.
- Preserve historical occurrence/payment data and Historical Correction safeguards.
- Apply the Overdue/missing-amount mutual-exclusivity rule consistently in Bills and Dashboard calculations where the same status is surfaced.
- Ensure filtering and inline editing do not introduce full-page navigation or unexpected scroll position changes.
- Regression-test existing occurrence, payment, recurrence, migration, and Dashboard reconciliation behavior.

## Approval

- **Approval Status:** Approved
- **Approved By:** Product Owner
- **Approval Date:** 2026-08-08
- **Approved Scope:** BR-200 through BR-214; FR-003, FR-007, FR-105 amendments; FR-108 through FR-117; NFR-200 through NFR-211; RULE-104 and RULE-105 amendments; RULE-109 through RULE-123; AC-200 through AC-224; Traceability Matrix; DOD-200 through DOD-222.

## Version History

- **v1.1.0 — 2026-08-07:** Added payment persistence requirements, occurrence definitions, Remaining/Credit formulas, funding_account and notes requirement, Next Due semantics, TCUB/TCU preservation, and Overdue precedence.
- **v1.1.1 — 2026-08-08:** Separated occurrence Budget from nullable Actual; synchronized overpayment credits; restored Budget fallback; retained Submitted as canonical paid-in-full status; added audited Historical Corrections; protected historical data from cascading delete; specified recurrence semantics; added legacy migration/backfill requirements.
- **v1.1.2 — 2026-08-08:** Required credit recalculation after Budget overrides; modeled every bi-weekly due date as a distinct installment; defined complete legacy month, occurrence, and funding-account backfills with validation gates.
- **v1.2.0 — 2026-08-08:** Integrated approved Bills workspace enhancements for title presentation, Overdue/missing-amount separation, user-facing missing-amount alert, technical data-quality separation, per-column filtering, Type/Category separation, inline row editing, viewport preservation, post-submission Actual editing, payment preservation, financial recalculation, cross-section consistency, and yellow Partial action treatment.

## Change Log

- 2026-08-07 — v1.1.0 — Established occurrence/payment financial rules and persistence requirements.
- 2026-08-08 — v1.1.1 — Resolved follow-up review findings and strengthened historical/migration governance.
- 2026-08-08 — v1.1.2 — Strengthened credit recalculation, bi-weekly installment modeling, and legacy backfill validation.
- 2026-08-08 — v1.2.0 — Integrated the fully approved Bills Workspace Enhancements into the authoritative requirements document. Draft enhancement identifiers were remapped only where necessary to preserve global uniqueness against legacy Phase 1 requirement IDs.