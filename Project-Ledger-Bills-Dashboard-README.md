# Project Ledger — Bills & Dashboard Authoritative Requirements

**Document:** Project-Ledger-Bills-Dashboard-README (Authoritative)
**Status:** Approved (authoritative doc for bills + dashboard behavior)
**Version:** 1.1.1
**Approval Date:** 2026-08-08

## Purpose

This authoritative README consolidates the approved Phase 1 Bills requirements and Dashboard clarifications approved during review. It augments the Phase 1 specification where required and preserves existing requirement IDs where possible. Use this file as the single source of truth for implementation and review until a later merge updates other artifacts.

## Summary of Key Changes (applies to implementation and acceptance)

- Introduce distinct Budget Amount and Actual Bill Amount concepts per monthly bill occurrence.
- Snapshot the applicable Budget Amount into each monthly occurrence while leaving Actual Bill Amount nullable until an invoiced or confirmed amount exists.
- Allow Actual Bill Amount to be lower than cumulative payments and support overpayments preserved as synchronized credits.
- Define Remaining Balance and Credit Amount using explicit formulas and require preservation of payment transactions.
- Add funding_account and optional notes to server-side dependency D-002 and to all payment workflows and persisted payment records.
- Correct the handoff prompt and references to point to this file: Project-Ledger-Bills-Dashboard-README.md.
- Make confirmed payment records the financial source of truth for Submit, Bulk Submit, Partial, and Submitted derived statuses.
- Define monthly bill occurrences so each month starts with blank status, zero payments, a Budget snapshot, and a fresh occurrence while preserving prior-month history and preventing automatic historical rewrite.
- Define period-effective archive/retirement behavior and retention semantics so historical reporting is not rewritten.
- Preserve the TCUB = Business and TCU = Personal classification rules and enforce that Type must not be independently editable when account mapping applies.
- Clarify Next Due edit semantics to affect only the selected occurrence unless the user explicitly edits the recurring master schedule.
- Treat active bills with no Budget or Actual amount as incomplete records excluded from financial reconciliation until corrected.
- Enforce Overdue precedence consistently across Bills workspace and Dashboard for partially paid overdue bills, including the Budget fallback when Actual is null.
- Require soft-delete/restricted-delete safeguards so Bills Master deletion cannot cascade away historical occurrences or payment records.
- Require migration and backfill of legacy payment rows before occurrence-based constraints and confirmed-payment calculations are enforced.

## Definitions

- Budget Amount: The planned or budgeted amount for a bill occurrence in a reporting month. The durable planned amount is stored on the Bills Master. Each monthly occurrence stores its own `occurrence_budget_amount` snapshot copied from the applicable master Budget when the occurrence is created, unless the occurrence Budget is explicitly overridden.

- Actual Bill Amount: The invoiced or confirmed dollar amount for a specific monthly occurrence. It is stored separately from the occurrence Budget snapshot, remains nullable until an invoiced or confirmed amount exists, may differ from Budget Amount, and may be lower than cumulative payments.

- Payments Made: The sum of one or more confirmed payment transactions attached to a monthly occurrence. Each payment includes: payment date, amount, funding_account (required), and optional notes.

- Effective Amount: The Actual Bill Amount when the Actual Bill Amount field for the occurrence is non-null and has been explicitly set; otherwise the occurrence Budget Amount. Financial status, Remaining Balance, overdue evaluation, and Submit calculations use Effective Amount unless a requirement explicitly states otherwise.

- Remaining Balance = max(Effective Amount - Payments Made, 0)

- Credit Amount = max(Payments Made - Effective Amount, 0)

- Confirmed Payment Record: A persisted payment transaction that has been saved and confirmed by the database; these records are the financial source of truth for status derivation.

- Monthly Occurrence: A period-scoped instance of a bill for a calendar month. An occurrence has its own Budget snapshot, Actual Bill Amount (nullable), Payments Made (zero or more persisted payment records), Status, and occurrence-level Next Due.

- Historical Correction: An explicit, user-initiated correction to a prior occurrence or payment that is persisted with an audit trail. Historical corrections are distinct from automatic rollover, archive, recurrence, or migration behavior and must never occur implicitly.

## Business Rules (preserve and extend)

- RULE-001 — Bills Master Authority (unchanged)
  - Bills Master remains the authoritative source for durable bill definitions.

- RULE-002 — Database Persistence Required (unchanged)
  - A bill or payment change is not complete until persistent storage confirms it.

- RULE-003 — TCUB Classification (preserved)
  - Prefixes beginning with `TCUB` are Business.

- RULE-004 — TCU Classification (preserved)
  - Prefixes beginning with `TCU`, after excluding `TCUB`, are Personal.

- RULE-005 — Prefix Evaluation Order (preserved)
  - `TCUB` must be evaluated before `TCU`.

- RULE-006 — Category Cannot Override Prefix (preserved)
  - A stale form category or client-side value cannot override the canonical prefix-derived classification.

- RULE-007 — Monthly Status Separation (clarified)
  - Month-specific status and month-specific occurrence fields (occurrence Budget snapshot, Actual Bill Amount, occurrence-level Next Due, payments list) must be stored separately from the durable Bills Master definition.

- RULE-100 — Confirmed Payments as Source of Truth
  - Confirmed payment records are the authoritative financial input for deriving Submitted and Partial statuses and for calculating Remaining Balance and Credit Amount. UI-only or unconfirmed entries must not influence canonical status.

- RULE-101 — Occurrence Fresh-Start and Budget Snapshot
  - Each new monthly occurrence starts with blank Status, zero Payments Made, an `occurrence_budget_amount` copied from the applicable Bills Master Budget unless explicitly overridden, and `actual_amount = null` unless an invoiced or confirmed Actual Bill Amount is already known. Creating a new occurrence must never copy a prior month’s payment status or payment records.
  - Prior occurrences must not be automatically recalculated, rewritten, or deleted by rollover, archive, recurrence, or later master edits. An explicit Historical Correction is allowed only through an audited correction workflow.

- RULE-102 — Period-Effective Archive/Retire
  - Archive or retirement actions are period-effective: when an archive is applied with an effective period, it prevents new occurrences beginning with that period but does not rewrite or remove historical occurrences used for prior reporting.

- RULE-103 — Type Mapping and Editability
  - When account/funding mapping determines Type (Business/Personal) via TCUB/TCU rules, the Type field must not be independently editable in the UI unless the mapping is explicitly cleared or overridden through an approved admin workflow.

- RULE-104 — Overdue Precedence
  - Overdue status takes precedence for a monthly occurrence when the due date has passed and Submitted Total (sum of confirmed payment records) is below the Effective Amount. Effective Amount means Actual Bill Amount when present, otherwise occurrence Budget Amount. This precedence must be applied consistently in both Bills and Dashboard calculations.

- RULE-105 — Incomplete Active Bills
  - Active bills that lack both occurrence Budget Amount and Actual Bill Amount are treated as incomplete records and are excluded from financial reconciliation and Headline Budget totals until corrected; they remain visible to users for editing.

- RULE-106 — Credit Synchronization
  - Credit Amount is a derived financial result of confirmed Payments Made versus Effective Amount. If a materialized credit/overpayment record is persisted for accounting or audit purposes, it must be transactionally upserted, reduced, or removed whenever a related payment or Actual Bill Amount is created, edited, deleted, confirmed, or otherwise changed. A stale credit record must never survive when recalculation produces a smaller or zero Credit Amount.

- RULE-107 — Historical Preservation on Delete
  - A Bills Master record with any historical occurrence, payment, credit, or reporting dependency must not be hard-deleted through a cascading delete path. Delete must be implemented as a soft delete/archive, or hard delete must be restricted to master records that have no historical occurrences or financial history. Historical rows and payment transactions must be preserved.

- RULE-108 — Historical Correction Governance
  - Historical immutability prevents automatic or incidental rewrites; it does not prohibit explicit corrections. A prior occurrence’s Actual Bill Amount, Next Due, Budget override, payment, funding account, or notes may be corrected only through a deliberate Historical Correction action that records the actor, timestamp, changed fields, prior values, and new values.

## Functional Requirements (additions and clarifications)

- FR-001 — List Bills (unchanged)
  - The Bills workspace must retrieve and display persisted Bills Master records and their occurrences.

- FR-002 — Add Bill (unchanged)
  - The user must be able to add a bill using the approved editable fields.

- FR-003 — Edit Bill (clarified)
  - Edits to the master bill alter the durable Bills Master. Edits to occurrence fields (occurrence Budget override, Actual Bill Amount, occurrence-level Next Due, payments) must affect only the selected occurrence unless the user explicitly elects to update the master recurring schedule.
  - When the selected occurrence is historical, the edit must use the audited Historical Correction workflow defined by RULE-108.

- FR-004 — Persist Add and Edit (unchanged)
  - Add and Edit operations must write through a server-side API or service to persistent storage.

- FR-005 — Database-Confirmed Success (unchanged)

- FR-006 — Refresh Retention (unchanged)

- FR-007 — Monthly Status Update (clarified)
  - Status updates for a selected month must be derived from confirmed payments and occurrence fields; manual status overrides are disallowed except where explicitly approved and traceably audited.

- FR-008 — Archive Bill (clarified)
  - Archiving operations may be master-level (affects future occurrences) or period-effective (retire occurrences beginning with an effective date) and must not delete historical occurrences used for reporting.

- FR-009 — Delete Bill (clarified)
  - Delete must preserve historical financial data. A master with occurrences, payments, credits, or prior reporting history must use soft delete/archive and must not invoke cascading hard deletes. Hard delete may be permitted only for a master record with no historical or financial dependencies and only after server-side validation confirms that condition.

- FR-010 — Active State (unchanged)

- FR-101 — Payment Transactions
  - Persisted payment records must include: payment date, amount, funding_account (required), optional notes. Payment records must be editable and deletable with the same persistence guarantees as bills.
  - Editing or deleting a payment must atomically trigger recalculation of Payments Made, Remaining Balance, Credit Amount, and derived status for the affected occurrence. Any persisted credit/overpayment record must be synchronized in the same transaction or equivalent atomic operation.
  - Historical payment edits or deletions must use the audited Historical Correction workflow.

- FR-102 — Overpayment Handling and Credit Reconciliation
  - Preserve payment transactions when total Payments Made exceeds Effective Amount. Excess must be represented as Credit Amount on the bill occurrence. If a separate persisted credit record is used, it must be linked to the occurrence and funding_account and treated as a synchronized materialization of the derived Credit Amount, not an independent source of truth.
  - Whenever confirmed payments or Actual Bill Amount change, the system must recalculate Credit Amount and atomically create, update, reduce, or remove the materialized credit record so it exactly matches the current derived credit.

- FR-103 — Remaining and Credit Calculations
  - Implement Remaining Balance and Credit Amount calculations at occurrence level using Effective Amount. Remaining must never be negative; Credit must be >= 0.

- FR-104 — funding_account & notes Inclusion (update — D-002 & FR list)
  - Add funding_account and optional notes to the server-side dependency D-002 and to all payment workflows, persisted payment records, and API contracts.

- FR-105 — Confirmed Payments Drive Status
  - Status derivation for Submit, Bulk Submit, Partial, and Submitted must use confirmed payment records only.
  - `Submitted` is the canonical persisted and displayed status representing paid-in-full/completed submission. `Paid` is not a separate supported UI or persisted status.
  - Submitted is true when Payments Made >= Effective Amount and confirmed payment records support the amount.

- FR-106 — Next Due Editing Scope and Recurrence Semantics
  - Editing Next Due on an occurrence changes only that occurrence’s persisted `due_date` by default. It must not automatically modify the master recurrence configuration or future occurrences.
  - If the user explicitly selects an option to update the recurring schedule, the system must update only the applicable durable recurrence fields and future occurrences; prior occurrences remain unchanged except through Historical Correction.
  - Monthly recurrence: update `due_day`; future monthly occurrences use the new day.
  - Quarterly recurrence: update `due_day` and update the quarterly cadence anchor/start month only when the user explicitly changes the anchor.
  - Annual recurrence: update the annual due month/day or recurrence anchor explicitly selected by the user.
  - Bi-weekly recurrence: persist and use a recurrence anchor date; future due dates are calculated at 14-day intervals from that anchor and must not be derived from `due_day` alone.
  - The UI must clearly distinguish “Change only this occurrence” (default) from “Also update recurring schedule” (opt-in), and schedule propagation must be auditable.

- FR-107 — Legacy Payment Migration and Backfill
  - Before enforcing occurrence-based payment constraints or confirmed-only status calculations, migrate legacy `ledger_bill_payments` rows that use `bill_id` and `payment_month` into the occurrence model.
  - For each legacy bill/month combination, create or resolve the matching monthly occurrence and populate the payment’s `occurrence_id`.
  - Backfill required confirmation metadata so previously valid persisted payments remain included in historical totals. Legacy persisted payments that represent completed historical transactions must receive an explicit confirmed value according to the approved migration rule rather than being left null.
  - Backfill `created_by` with a documented migration/system actor when an original actor is unavailable, preserving original timestamps and payment data wherever present.
  - Constraints that require `occurrence_id`, `created_by`, or `confirmed_flag` must not be enforced until the backfill has completed and migration validation confirms that no eligible historical payment would be dropped from reporting.

## Dependencies (update)

- D-001 — Supabase environment (unchanged)
  - The existing Supabase environment is the approved persistence platform.

- D-002 — Server-side configuration and payment fields (updated)
  - Server-side Supabase configuration must be valid in Vercel Preview and Production and must include schema support for persisted payment records with at least: payment_id, occurrence_id, payment_date, amount, funding_account (required), notes (optional), created_by, created_at, confirmed_flag. Ensure API routes accept and validate funding_account and notes in payment workflows.

- D-003 — Bills workspace API (unchanged but extended)
  - The Bills workspace must have a supported API, repository, or service layer for persistence that supports occurrence-level operations and payment transaction persistence.

- D-004 — Dashboard data source (unchanged)
  - The Dashboard must consume the same approved Bills Master + occurrences + payments persisted data source where totals are displayed.

- D-005 — Legacy Data Migration
  - Deployment of the occurrence/payment model depends on a validated migration that creates or resolves occurrences for legacy payment months, links legacy payments to those occurrences, and backfills required confirmation/audit metadata before new non-null constraints or confirmed-only calculations are enabled.

## Acceptance Criteria (clarifications and additions)

- AC-015 — Month-specific status persists (clarified)
  - Given a selected month, when the user updates or creates confirmed payment records, the occurrence’s status and Payments Made persist for that month. Status is derived from confirmed payments and Effective Amount.

- AC-016 — Master vs Occurrence (clarified)
  - Given a monthly status update or Next Due edit, when a different month is selected, the master bill definition remains intact and the correct month-specific occurrence is shown. Next Due edits affect only the selected occurrence unless recurring-schedule propagation is explicitly selected.

- AC-017 — Dashboard/Bills reconciliation (updated)
  - Given Dashboard and Bills workspace display bill totals for the same month, when both load, then totals reconcile to the same persisted Bills Master + occurrences + confirmed payments source and rule-set, including Effective Amount, Remaining and Credit calculations, Budget fallback, and Overdue precedence.

- AC-100 — Payment fields persisted
  - Given a user adds a payment with funding_account and optional notes, when the payment is saved, then the persisted payment record contains funding_account, notes (nullable), and all required metadata and survives refresh.

- AC-101 — Overpayment preserved and synchronized
  - Given Payments Made > Effective Amount, when payments are confirmed, then excess is represented as Credit Amount linked to the occurrence and funding_account without erasing payment history.
  - Given a payment or Actual Bill Amount is subsequently edited or deleted, when recalculation reduces or removes the overpayment, then any persisted credit record is atomically updated or removed to match the newly derived Credit Amount.

- AC-102 — Incomplete active bills excluded
  - Given an active bill occurrence with no occurrence Budget Amount and no Actual Bill Amount, when the month is included in a reconciliation, then the occurrence is excluded from budget and financial totals and flagged to the user as incomplete until corrected.

- AC-103 — Budget and Actual remain distinct
  - Given a bill has a master Budget but no confirmed invoice amount, when a monthly occurrence is created, then the occurrence stores the Budget in `occurrence_budget_amount`, leaves `actual_amount` null, and uses the Budget fallback for applicable calculations until Actual is entered.
  - Given Actual is later entered and differs from Budget, both values remain independently available for reporting and audit.

- AC-104 — Submitted is the canonical paid-in-full status
  - Given confirmed Payments Made reach or exceed Effective Amount, when status is derived, then the displayed and persisted status is `Submitted`; `Paid` is not introduced as a separate status value.

- AC-105 — Historical corrections are explicit and audited
  - Given a user corrects a prior month’s occurrence or payment, when the correction is saved, then only the selected historical record is changed and an audit record identifies the actor, timestamp, prior values, and new values. Automatic rollover, archive, or recurrence operations do not rewrite prior occurrences.

- AC-106 — Delete preserves history
  - Given a Bills Master has any historical occurrence, payment, credit, or reporting dependency, when Delete is requested, then the system prevents cascading hard deletion and uses the approved soft-delete/archive behavior. Historical occurrence and payment data remain queryable for prior-period reporting.

- AC-107 — Legacy payments survive migration
  - Given legacy payment rows exist before the occurrence model is enforced, when migration completes, then each eligible legacy payment is linked to a valid occurrence, receives required confirmation/audit metadata according to the migration rule, and remains included in the same historical financial totals it contributed to before migration.

- AC-108 — Overdue uses Budget fallback
  - Given a past-due occurrence has `actual_amount = null`, a non-null occurrence Budget, and confirmed Payments Made below that Budget, when Bills and Dashboard render the occurrence, then both classify it as Overdue using the occurrence Budget as Effective Amount.

- AC-109 — Next Due occurrence vs schedule behavior
  - Given the user changes Next Due and leaves “Change only this occurrence” selected, when saved, then only the selected occurrence `due_date` changes and future recurrence fields remain unchanged.
  - Given the user explicitly selects “Also update recurring schedule,” when saved, then only the applicable recurrence fields for monthly, quarterly, annual, or bi-weekly cadence are updated for future generation, with bi-weekly schedules anchored to a persisted recurrence anchor date.

## Data Model Notes (developer guidance)

- Occurrence table (example fields): occurrence_id, bill_master_id, occurrence_month (YYYY-MM), occurrence_budget_amount (nullable), actual_amount (nullable), status, due_date (nullable), created_at, updated_at.

- Payments table (example fields): payment_id, occurrence_id, payment_date, amount, funding_account, notes (nullable), created_by, created_at, confirmed_flag.

- Credits/Overpayments table, if materialized (example fields): credit_id, occurrence_id, amount, funding_account, created_at, updated_at, reason. This table is a synchronized materialization of derived Credit Amount and must not become an independent source of truth.

- Audit/history table or equivalent audit mechanism must support Historical Correction traceability for prior values, new values, actor, timestamp, and affected record.

- Master bill retains the durable Budget and recurring schedule fields. When a new occurrence is created for a month, copy the applicable master Budget into `occurrence_budget_amount`; do not copy Budget into `actual_amount`. Leave `actual_amount` null until an invoiced or confirmed Actual Bill Amount is provided.

- Legacy payment migration must create/resolve occurrence rows before setting payment `occurrence_id` constraints and must backfill confirmation/audit fields before confirmed-only calculations become authoritative.

## UI & UX Notes

- The handoff prompt, documentation pointers, and any automated messages must reference this file: Project-Ledger-Bills-Dashboard-README.md.

- When editing Next Due from the occurrence UI, show a clear control: “Change only this occurrence” (default) and “Also update recurring schedule” (opt-in). Provide an audit trail for propagation.

- When a payment is added, require selection of funding_account. Allow optional free-text notes on the payment record.

- When Payments Made exceed Effective Amount, show Credit Amount beside Remaining (0) and link to the synchronized overpayment/account-credit record when one is materialized.

- Overdue precedence: if due date has passed and Submitted Total < Effective Amount, mark Overdue, even if partial payments exist. Effective Amount is Actual Bill Amount when non-null; otherwise use occurrence Budget Amount.

- Use `Submitted` as the canonical displayed paid-in-full status. Do not introduce `Paid` as an additional UI status.

- Historical records may display an explicit correction action where permitted; automatic workflows must never mutate historical occurrence or payment values.

## Traceability and Changed Sections

The following existing sections/IDs in the Phase 1 baseline are updated or supplemented by this authoritative README. Implementers should treat these IDs as changed in-place for the purpose of the current feature branch and testing:

- Dependencies: D-002 updated to require funding_account and optional notes persisted for payments; D-005 added for legacy occurrence/payment migration and backfill.
- Business Rules: RULE-007 clarified monthly separation; RULE-100 through RULE-108 added for confirmed-payment source of truth, occurrence Budget/Actual separation, period-effective archive, type mapping editability, overdue precedence, incomplete bills, credit synchronization, historical preservation on delete, and audited historical corrections.
- Functional Requirements: FR-007 clarified status derivation; FR-009 clarified delete safeguards; FR-101 through FR-107 added or clarified for payment persistence, synchronized overpayment handling, calculations, funding_account requirement, confirmed payments driving canonical Submitted status, Next Due recurrence semantics, and legacy payment migration.
- Acceptance Criteria: AC-015, AC-016, AC-017 clarified; new criteria use the unused AC-100 through AC-109 range to avoid collisions with existing Phase 1 acceptance-criteria identifiers.

## Implementation notes for reviewers

- Do not change application code in this commit. Update only this authoritative README file in the feature branch.
- Preserve existing requirement IDs where possible; new IDs in the 100+ range are used for additions to avoid collisions.
- The master bill schema must not be rewritten to retroactively change closed prior occurrences used for historical reporting.
- Historical immutability applies to automatic/system behavior; explicit audited Historical Corrections remain permitted where authorized.
- Do not enforce occurrence-based non-null payment constraints until legacy data migration and validation are complete.

## Change Log

- 2026-08-07 — v1.1.0 — Added payment persistence requirements, occurrence definitions, Remaining/Credit formulas, funding_account and notes requirement, clarified Next Due semantics, preserved TCUB/TCU rules, and defined Overdue precedence.
- 2026-08-08 — v1.1.1 — Resolved follow-up review findings: separated occurrence Budget from nullable Actual; synchronized overpayment credits; restored Budget fallback in Overdue rules; moved new acceptance criteria to AC-100+; retained Submitted as the canonical status; defined audited historical corrections; protected history from cascading delete; specified recurrence field semantics; and added legacy payment migration/backfill requirements.
