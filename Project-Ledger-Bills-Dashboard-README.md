# Project Ledger — Bills & Dashboard Authoritative Requirements

**Document:** Project-Ledger-Bills-Dashboard-README (Authoritative)
**Status:** Approved (authoritative doc for bills + dashboard behavior)
**Version:** 1.1.0
**Approval Date:** 2026-08-07

## Purpose

This authoritative README consolidates the approved Phase 1 Bills requirements and Dashboard clarifications approved during review. It augments the Phase 1 specification where required and preserves existing requirement IDs where possible. Use this file as the single source of truth for implementation and review until a later merge updates other artifacts.

## Summary of Key Changes (applies to implementation and acceptance)

- Introduce distinct Budget Amount and Actual Bill Amount concepts per monthly bill occurrence.
- Allow Actual Bill Amount to be lower than cumulative payments and support overpayments preserved as credits.
- Define Remaining Balance and Credit Amount using explicit formulas and require preservation of payment transactions.
- Add funding_account and optional notes to server-side dependency D-002 and to all payment workflows and persisted payment records.
- Correct the handoff prompt and references to point to this file: Project-Ledger-Bills-Dashboard-README.md.
- Make confirmed payment records the financial source of truth for Submit, Bulk Submit, Partial, and Submitted/Paid derived statuses.
- Define monthly bill occurrences so each month starts with blank status, zero payments, and a fresh occurrence while preserving prior-month history and preventing historical rewrite.
- Define period-effective archive/retirement behavior and retention semantics so historical reporting is not rewritten.
- Preserve the TCUB = Business and TCU = Personal classification rules and enforce that Type must not be independently editable when account mapping applies.
- Clarify Next Due edit semantics to affect only the selected occurrence unless the user explicitly edits the recurring master schedule.
- Treat active bills with no Budget or Actual amount as incomplete records excluded from financial reconciliation until corrected.
- Enforce Overdue precedence consistently across Bills workspace and Dashboard for partially paid overdue bills.

## Definitions

- Budget Amount: The planned or budgeted amount for a bill occurrence in a reporting month. Stored on the master bill and copied to a new monthly occurrence when applicable unless explicitly overridden.

- Actual Bill Amount: The invoiced or confirmed dollar amount for a specific monthly occurrence. Actual Bill Amount may differ from Budget Amount and may be lower than cumulative payments.

- Payments Made: The sum of one or more confirmed payment transactions attached to a monthly occurrence. Each payment includes: payment date, amount, funding_account (required), and optional notes.

- Remaining Balance = max(Actual Bill Amount - Payments Made, 0)

- Credit Amount = max(Payments Made - Actual Bill Amount, 0)

- Confirmed Payment Record: A persisted payment transaction that has been saved and confirmed by the database; these records are the financial source of truth for status derivation.

- Monthly Occurrence: A period-scoped instance of a bill for a calendar month. An occurrence has its own Actual Bill Amount (nullable), Payments Made (zero or more persisted payment records), Status, and occurrence-level Next Due.

## Business Rules (preserve and extend)

- RULE-001 — Bills Master Authority (unchanged)
  - Bills Master remains the authoritative source for bill definitions.

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
  - Month-specific status and month-specific occurrence fields (Actual Bill Amount, occurrence-level Next Due, payments list) must be stored separately from the durable Bills Master definition.

- RULE-008 — Confirmed Payments as Source of Truth (new — RULE-100)
  - Confirmed payment records are the authoritative financial input for deriving Submitted, Partial, and Submitted/Paid statuses and for calculating Remaining Balance and Credit Amount. UI-only or unconfirmed entries must not influence canonical status.

- RULE-009 — Occurrence Fresh-Start (new — RULE-101)
  - Each month’s new occurrence starts with: blank Status (no implicit Submitted/Paid), zero Payments Made, and Actual Bill Amount copied from Budget (or left null if no Budget). Prior occurrences are preserved as immutable historical rows for reporting.

- RULE-010 — Period-Effective Archive/Retire (new — RULE-102)
  - Archive or retirement actions are period-effective: when an archive is applied with an effective period, it prevents new occurrences after that period but does not rewrite or remove historical occurrences used for prior reporting.

- RULE-011 — Type Mapping and Editability (new — RULE-103)
  - When account/funding mapping determines Type (Business/Personal) via TCUB/TCU rules, the Type field must not be independently editable in the UI unless the mapping is explicitly cleared or overridden through an approved admin workflow.

- RULE-012 — Overdue Precedence (new — RULE-104)
  - Overdue status takes precedence for a monthly occurrence when the due date has passed and Submitted Total (sum of confirmed payment records) is below the Actual Bill Amount (or Budget if Actual is null). This precedence must be applied consistently in both Bills and Dashboard calculations.

- RULE-013 — Incomplete Active Bills (new — RULE-105)
  - Active bills that lack both Budget and Actual Bill Amount for the occurrence are treated as incomplete records and are excluded from financial reconciliation and Headline Budget totals until corrected; they remain visible to users for editing.

## Functional Requirements (additions and clarifications)

- FR-001 — List Bills (unchanged)
  - The Bills workspace must retrieve and display persisted Bills Master records and their occurrences.

- FR-002 — Add Bill (unchanged)
  - The user must be able to add a bill using the approved editable fields.

- FR-003 — Edit Bill (clarified)
  - Edits to the master bill alter the durable Bills Master. Edits to occurrence fields (Actual Bill Amount, occurrence-level Next Due, payments) must affect only the selected occurrence unless the user explicitly elects to update the master recurring schedule.

- FR-004 — Persist Add and Edit (unchanged)
  - Add and Edit operations must write through a server-side API or service to persistent storage.

- FR-005 — Database-Confirmed Success (unchanged)

- FR-006 — Refresh Retention (unchanged)

- FR-007 — Monthly Status Update (clarified)
  - Status updates for a selected month must be derived from confirmed payments and occurrence fields; manual status overrides are disallowed except where explicitly approved and traceably audited.

- FR-008 — Archive Bill (clarified)
  - Archiving operations may be master-level (affects future occurrences) or period-effective (retire occurrences after an effective date) and must not delete historical occurrences used for reporting.

- FR-009 — Delete Bill (unchanged — maintain safeguards)

- FR-010 — Active State (unchanged)

- FR-011 — Payment Transactions (new — FR-101)
  - Persisted payment records must include: payment date, amount, funding_account (required), optional notes. Payment records must be editable and deletable with the same persistence guarantees as bills.

- FR-102 — Overpayment Handling (new)
  - Preserve payment transactions when total Payments Made exceeds Actual Bill Amount. Excess must be recorded as an overpayment/account credit on the bill occurrence and as a persisted credit record linked to the funding_account and the bill occurrence.

- FR-103 — Remaining and Credit Calculations (new)
  - Implement Remaining Balance and Credit Amount calculations at occurrence level using the formulas in Definitions. Remaining must never be negative; Credit must be >= 0.

- FR-104 — funding_account & notes Inclusion (update — D-002 & FR list)
  - Add funding_account and optional notes to the server-side dependency D-002 and to all payment workflows, persisted payment records, and API contracts.

- FR-105 — Confirmed Payments Drive Status (new)
  - Status derivation for Submit, Bulk Submit, Partial, and Submitted/Paid must use confirmed payment records only. Submitted status (or Paid equivalent in computed UI) is true when Payments Made >= Actual Bill Amount (or Budget if Actual is null) and confirmed payment records support the amount.

- FR-106 — Next Due Editing Scope (new)
  - Editing Next Due on an occurrence changes only that occurrence’s Next Due unless the user selects an explicit option to propagate the date change to the recurring master schedule and future occurrences.

## Dependencies (update)

- D-001 — Supabase environment (unchanged)
  - The existing Supabase environment is the approved persistence platform.

- D-002 — Server-side configuration and payment fields (updated)
  - Server-side Supabase configuration must be valid in Vercel Preview and Production and must include schema support for persisted payment records with at least: payment_id, occurrence_id, payment_date, amount, funding_account (required), notes (optional), created_by, created_at, confirmed_flag. Ensure API routes accept and validate funding_account and notes in payment workflows.

- D-003 — Bills workspace API (unchanged but extended)
  - The Bills workspace must have a supported API, repository, or service layer for persistence that supports occurrence-level operations and payment transaction persistence.

- D-004 — Dashboard data source (unchanged)
  - The Dashboard must consume the same approved Bills Master + occurrences + payments persisted data source where totals are displayed.

## Acceptance Criteria (clarifications and additions)

- AC-015 — Month-specific status persists (clarified)
  - Given a selected month, when the user updates or creates confirmed payment records, the occurrence’s status and Payments Made persist for that month. Status is derived from confirmed payments and occurrence Actual Bill Amount.

- AC-016 — Master vs Occurrence (clarified)
  - Given a monthly status update or Next Due edit, when a different month is selected, the master bill definition remains intact and the correct month-specific occurrence is shown. Next Due edits affect only the selected occurrence unless explicitly propagated.

- AC-017 — Dashboard/Bills reconciliation (updated)
  - Given Dashboard and Bills workspace display bill totals for the same month, when both load, then totals reconcile to the same persisted Bills Master + occurrences + confirmed payments source and rule-set (including Remaining and Credit calculations and Overdue precedence).

- AC-020 — Payment fields persisted (new)
  - Given a user adds a payment with funding_account and optional notes, when the payment is saved, then the persisted payment record contains funding_account, notes (nullable), and all required metadata and survives refresh.

- AC-021 — Overpayment preserved (new)
  - Given Payments Made > Actual Bill Amount, when payments are confirmed, then excess is preserved as an overpayment/account credit linked to the occurrence and funding_account and does not erase payment transaction history.

- AC-022 — Incomplete active bills excluded (new)
  - Given an active bill occurrence with no Budget and no Actual Bill Amount, when the month is included in a reconciliation, then the occurrence is excluded from budget totals and flagged to the user as incomplete until corrected.

## Data Model Notes (developer guidance)

- Occurrence table (example fields): occurrence_id, bill_master_id, occurrence_month (YYYY-MM), actual_amount (nullable), status, next_due (nullable), created_at.

- Payments table (example fields): payment_id, occurrence_id, payment_date, amount, funding_account, notes (nullable), created_by, created_at, confirmed_flag.

- Credits/Overpayments table (example fields): credit_id, occurrence_id, amount, funding_account, created_at, reason.

- Master bill must retain Budget and recurring schedule fields. When a new occurrence is created for a month, copy Budget into occurrence.actual_amount unless a separate Actual amount is provided or Budget is intentionally left null.

## UI & UX Notes

- The handoff prompt, documentation pointers, and any automated messages must reference this file: Project-Ledger-Bills-Dashboard-README.md.

- When editing Next Due from the occurrence UI, show a clear control: "Change only this occurrence" (default) and "Also update recurring schedule" (opt-in). Provide an audit trail for propagation.

- When a payment is added, require selection of funding_account. Allow optional free-text notes on the payment record.

- When Payments Made exceed the Actual Bill Amount, show Credit Amount beside Remaining (0) and link to the overpayment account credit record.

- Overdue precedence: if due date passed and Submitted Total < Actual Bill Amount, mark Overdue, even if partial payments exist.

## Traceability and Changed Sections

The following existing sections/IDs in the Phase 1 baseline are updated or supplemented by this authoritative README. Implementers should treat these IDs as changed in-place for the purpose of the current feature branch and testing:

- Dependencies: D-002 (updated to require funding_account and optional notes persisted for payments)
- Business Rules: RULE-007 (clarified monthly separation); new RULE-100..RULE-105 added (payments source-of-truth, occurrence fresh-start, period-effective archive, type mapping editability, overdue precedence, incomplete bills)
- Functional Requirements: FR-007 (clarified status derivation); new FR-101..FR-106 added (payment persistence, overpayment handling, calculations, funding_account requirement, confirmed payments drive status, Next Due editing scope)
- Acceptance Criteria: AC-015, AC-016, AC-017 (clarified to reference confirmed payments and occurrence-level fields); new AC-020..AC-022 added

## Implementation notes for reviewers

- Do not change application code in this commit. Update only this authoritative README file in the feature branch.
- Preserve existing requirement IDs where possible; new IDs in the 100+ range are used for additions to avoid collisions.
- The master bill schema must not be rewritten to retroactively change closed, prior occurrences used for historical reporting.

## Change Log

- 2026-08-07 — v1.1.0 — Added payment persistence requirements, occurrence definitions, Remaining/Credit formulas, funding_account and notes requirement, clarified Next Due semantics, preserved TCUB/TCU rules, and defined Overdue precedence.
