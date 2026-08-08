# Project Ledger — Bills & Dashboard Authoritative Requirements

**Document:** Project-Ledger-Bills-Dashboard-README (Authoritative)
**Status:** Approved (authoritative doc for bills + dashboard behavior)
**Version:** 1.1.4
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
- Represent every bi-weekly due date as its own installment occurrence, including months with two or three installments.
- Backfill every legacy month row and every required payment funding account before enforcing the new constraints.

## Definitions

- Budget Amount: The planned or budgeted amount for a bill occurrence in a reporting month. The durable planned amount is stored on the Bills Master. Each monthly occurrence stores its own `occurrence_budget_amount` snapshot copied from the applicable master Budget when the occurrence is created, unless the occurrence Budget is explicitly overridden.

- Actual Bill Amount: The invoiced or confirmed dollar amount for a specific monthly occurrence. It is stored separately from the occurrence Budget snapshot, remains nullable until an invoiced or confirmed amount exists, may differ from Budget Amount, and may be lower than cumulative payments.

- Payments Made: The sum of one or more confirmed payment transactions attached to a monthly occurrence. Each payment includes: payment date, amount, funding_account (required), and optional notes.

- Effective Amount: The Actual Bill Amount when the Actual Bill Amount field for the occurrence is non-null and has been explicitly set; otherwise the occurrence Budget Amount. Financial status, Remaining Balance, overdue evaluation, and Submit calculations use Effective Amount unless a requirement explicitly states otherwise.

- Remaining Balance = max(Effective Amount - Payments Made, 0)

- Credit Amount = max(Payments Made - Effective Amount, 0)

- Confirmed Payment Record: A persisted payment transaction that has been saved and confirmed by the database; these records are the financial source of truth for status derivation.

- Reporting Month: A calendar-month grouping used by Bills and Dashboard totals. It may contain more than one installment occurrence for a recurring bill and is not itself the unit to which a payment or overdue decision is attached.

- Installment Occurrence: A due-date-scoped instance of a bill. It has exactly one `due_date`, its own Budget snapshot, Actual Bill Amount (nullable), Payments Made (zero or more persisted payment records), Status, and stable occurrence identifier. Monthly, quarterly, annual, and one-time schedules ordinarily create at most one installment occurrence in a reporting month. A bi-weekly schedule creates one installment occurrence for every 14-day due date, so the same bill can have two or three occurrences in one reporting month.

- Monthly Occurrence: The single installment occurrence produced by a monthly cadence. References in this document to occurrence-level calculations apply independently to every Installment Occurrence; implementations must not collapse multiple bi-weekly installments into one monthly row.

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
  - Credit Amount is a derived financial result of confirmed Payments Made versus Effective Amount. If a materialized credit/overpayment record is persisted for accounting or audit purposes, it must be transactionally upserted, reduced, or removed whenever a related payment, Actual Bill Amount, or occurrence Budget override is created, edited, deleted, confirmed, cleared, or otherwise changed. This includes a Budget override while `actual_amount` is null because that override changes Effective Amount. A stale credit record must never survive when recalculation produces a smaller or zero Credit Amount.
  - Every mutation that can change Credit Amount—including payment creation, confirmation, unconfirmation, edit, or deletion and Actual Bill Amount or effective occurrence Budget creation, edit, or clearing—must use the same occurrence-level serialization protocol. The transaction must acquire the affected occurrence lock (and lock any materialized credit row in a consistent order) before reading the confirmed-payment set and Effective Amount, then calculate and persist the payment/occurrence mutation, derived status, and credit upsert/reduction/removal atomically. Implementations may use an equivalently strong database serialization mechanism, but no credit-changing write path may bypass it.

- RULE-107 — Historical Preservation on Delete
  - A Bills Master record with any historical occurrence, payment, credit, or reporting dependency must not be hard-deleted through a cascading delete path. Delete must be implemented as a soft delete/archive, or hard delete must be restricted to master records that have no historical occurrences or financial history. Historical rows and payment transactions must be preserved. Database foreign keys on occurrences, payments, credits, and audit/reporting records must use restrictive/no-action deletion semantics (not `ON DELETE CASCADE`) wherever a master deletion could erase that history; the service must verify the no-history condition in the same transaction as any permitted hard delete.

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
  - Creating, confirming, unconfirming, editing, or deleting a payment must atomically trigger recalculation of Payments Made, Remaining Balance, Credit Amount, and derived status for the affected occurrence. Every such path must use the occurrence-level serialization protocol in RULE-106. The recalculation must read the post-mutation set of confirmed payments only after acquiring the required concurrency protection and must commit the payment mutation, derived values, and credit upsert/reduction/deletion together; a failure rolls back all of them.
  - Historical payment edits or deletions must use the audited Historical Correction workflow.

- FR-102 — Overpayment Handling and Credit Reconciliation
  - Preserve payment transactions when total Payments Made exceeds Effective Amount. Excess must be represented as Credit Amount on the bill occurrence. If a separate persisted credit record is used, it must be linked to the occurrence and funding_account and treated as a synchronized materialization of the derived Credit Amount, not an independent source of truth.
  - Whenever confirmed payments, Actual Bill Amount, or an occurrence Budget override change, the system must use the occurrence-level serialization protocol in RULE-106 to recalculate Effective Amount, Remaining Balance, Credit Amount, and derived status and atomically create, update, reduce, or remove the materialized credit record so it exactly matches the current derived credit. This applies to creation, confirmation, unconfirmation, editing, clearing, and deletion as applicable. Budget changes must follow this path whenever `actual_amount` is null; they must not leave a credit calculated from the prior Budget.

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
  - Bi-weekly recurrence: persist and use a recurrence anchor date; future due dates are calculated at 14-day intervals from that anchor and must not be derived from `due_day` alone. Materialize a separate Installment Occurrence for every due date, including all two or three installments that fall in the same reporting month. The master Budget for a bi-weekly bill is the per-installment Budget unless the master explicitly stores a separately named monthly aggregate; never duplicate a monthly aggregate onto every installment.
  - Each payment and occurrence edit must identify a specific `occurrence_id`. Status, Remaining Balance, Credit Amount, and Overdue are derived independently per installment and then summed for reporting-month totals. A payment must not implicitly satisfy a different installment; an explicit audited allocation or reallocation is required.
  - The UI must clearly distinguish “Change only this occurrence” (default) from “Also update recurring schedule” (opt-in), and schedule propagation must be auditable.

- FR-107 — Legacy Payment Migration and Backfill
  - Before the backfill begins, the rollout must either quiesce every legacy application and writer that can create or update month/payment rows for the entire backfill-through-cutover window, or first deploy backward-compatible dual-write code that populates both the legacy fields and all new occurrence, confirmation, actor, and funding-account fields. With dual writing, the migration must run a repeatable catch-up pass for writes committed during the initial backfill and keep dual writing enabled until cutover completes; legacy-only writes are prohibited after the catch-up validation starts.
  - Before enforcing occurrence-based payment constraints or confirmed-only status calculations, migrate all existing `ledger_bill_months` rows and all legacy `ledger_bill_payments` rows that use `bill_id` and `payment_month` into the occurrence model. The month-row pass runs first and creates or resolves an occurrence for every legacy month row, including rows with no payment. The payment pass then links every payment to a due-date-scoped occurrence.
  - Backfill each legacy month occurrence’s Budget, Actual, and due date from immutable contemporaneous data, in priority order: values already stored with the month row; an audit/version snapshot effective for that month; or an explicit reviewed migration override recorded with source and approver. The current Bills Master value must not be silently copied into a closed historical month. If no trustworthy value exists, retain the occurrence, mark it `migration_incomplete`, and require reviewed correction before migration validation can pass; do not omit it or silently exclude it from finalized historical totals.
  - For bi-weekly legacy months, generate every due-date-scoped installment from the persisted recurrence anchor and allocate payments deterministically by an explicit migration rule (payment-supplied installment reference first, otherwise due-date ordering), recording the allocation provenance. Ambiguous allocations are marked `migration_incomplete` for review rather than assigned to a monthly aggregate.
  - Backfill required confirmation metadata so previously valid persisted payments remain included in historical totals. Legacy persisted payments that represent completed historical transactions must receive an explicit confirmed value according to the approved migration rule rather than being left null.
  - Backfill `created_by` with a documented migration/system actor when an original actor is unavailable, preserving original timestamps and payment data wherever present.
  - Backfill `funding_account` before making it required. Use the payment’s existing nonblank value first; otherwise use the bill/account mapping only when that mapping is uniquely and historically valid for the payment date. When neither source is reliable, assign a dedicated non-posting `Legacy — Unspecified` funding-account record, preserve the payment in historical totals, and flag it for remediation. This sentinel must not be treated as a real cash account or used for new payments.
  - Constraints that require `occurrence_id`, `created_by`, `confirmed_flag`, or `funding_account` must not be enforced until the backfill and any catch-up pass have completed and validation confirms that every legacy month row has been represented, every payment is linked and funded, no `migration_incomplete` occurrence remains, and no eligible historical row would be dropped from reporting. The rollout order is mandatory: add new columns as nullable; establish write quiescence or deploy dual writing; create/backfill occurrences; populate every payment field; catch up concurrent writes when applicable; compare pre- and post-migration row counts and confirmed historical totals; and then perform final validation and constraint activation in one atomic cutover transaction (or under one exclusive database lock that prevents intervening legacy writes). That cutover must recheck for null/invalid new fields and unmigrated legacy rows immediately before enabling `NOT NULL`/foreign-key constraints and confirmed-only calculations. Any failed validation rolls back or aborts constraint activation, and legacy writers must not resume unless they remain schema-compatible; remove legacy-write behavior only after the new constraints and application version are active.

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
  - Deployment of the occurrence/payment model depends on a validated migration that represents every legacy month row (whether or not it has payments), creates every due-date-scoped bi-weekly installment, links legacy payments to specific occurrences, and backfills required funding-account, confirmation, and audit metadata before new non-null constraints or confirmed-only calculations are enabled.

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
  - Given `actual_amount` is null and an occurrence Budget override changes Effective Amount, when the override is saved, then Remaining Balance, Credit Amount, derived status, and any materialized credit are atomically recalculated from the new Budget.
  - Given any two concurrent mutations that can change an occurrence's Credit Amount, when they complete, then both use the same occurrence-level serialization protocol and the committed credit equals the confirmed-payment set and Effective Amount after the last serialized mutation.

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
  - Given legacy writers can remain live during migration, when the backfill and constraint cutover run, then backward-compatible dual writing and a catch-up pass represent every intervening write, and final validation plus constraint activation occur atomically without a legacy-only write entering between them. Alternatively, all legacy writers remain quiesced until the compatible application and constraints are active.

- AC-108 — Overdue uses Budget fallback
  - Given a past-due occurrence has `actual_amount = null`, a non-null occurrence Budget, and confirmed Payments Made below that Budget, when Bills and Dashboard render the occurrence, then both classify it as Overdue using the occurrence Budget as Effective Amount.

- AC-109 — Next Due occurrence vs schedule behavior
  - Given the user changes Next Due and leaves “Change only this occurrence” selected, when saved, then only the selected occurrence `due_date` changes and future recurrence fields remain unchanged.
  - Given the user explicitly selects “Also update recurring schedule,” when saved, then only the applicable recurrence fields for monthly, quarterly, annual, or bi-weekly cadence are updated for future generation, with bi-weekly schedules anchored to a persisted recurrence anchor date.

- AC-110 — Bi-weekly installments remain distinct
  - Given a bi-weekly bill has two or three anchor-derived due dates in a reporting month, when occurrences are generated, then each due date has a distinct occurrence identifier, amount, due date, payment allocation, and derived status. Passing one installment’s due date cannot mark a later installment Overdue, and editing or paying one installment does not mutate another.

- AC-111 — Every legacy month is backfilled
  - Given `ledger_bill_months` contains rows both with and without payments, when migration completes, then every source row maps to a validated occurrence and retains traceable Budget, Actual, and due-date provenance. Rows lacking trustworthy historical values block completion as `migration_incomplete`; current master values are not silently used to rewrite them.

- AC-112 — Legacy funding accounts are valid before enforcement
  - Given a legacy payment has null or blank `funding_account`, when migration runs, then it receives a uniquely valid historical mapping or the `Legacy — Unspecified` sentinel, remains in historical totals, and is flagged when remediation is required. Only after validation finds no null or blank values may the required constraint be enabled.

## Data Model Notes (developer guidance)

- Occurrence table (example fields): occurrence_id, bill_master_id, reporting_month (YYYY-MM), installment_sequence, occurrence_budget_amount (nullable), actual_amount (nullable), status, due_date (required), migration_state, migration_provenance, created_at, updated_at. Uniqueness must identify a due-date-scoped installment (for example, bill_master_id + due_date), not bill_master_id + reporting_month alone.

- Payments table (example fields): payment_id, occurrence_id, payment_date, amount, funding_account, notes (nullable), created_by, created_at, confirmed_flag.

- Credits/Overpayments table, if materialized (example fields): credit_id, occurrence_id, amount, funding_account, created_at, updated_at, reason. This table is a synchronized materialization of derived Credit Amount and must not become an independent source of truth.

- Audit/history table or equivalent audit mechanism must support Historical Correction traceability for prior values, new values, actor, timestamp, and affected record.

- Master bill retains the durable Budget and recurring schedule fields. When a new occurrence is created for a month, copy the applicable master Budget into `occurrence_budget_amount`; do not copy Budget into `actual_amount`. Leave `actual_amount` null until an invoiced or confirmed Actual Bill Amount is provided.

- Legacy migration must create/resolve every source month and installment occurrence before setting payment `occurrence_id` constraints, and must backfill funding-account, confirmation, and audit fields before required constraints or confirmed-only calculations become authoritative.

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

- Dependencies: D-002 requires funding_account and optional notes persisted for payments; D-005 requires complete month-row, installment, payment, and funding-account migration before enforcement.
- Business Rules: RULE-007 clarified monthly separation; RULE-100 through RULE-108 added for confirmed-payment source of truth, occurrence Budget/Actual separation, period-effective archive, type mapping editability, overdue precedence, incomplete bills, credit synchronization, historical preservation on delete, and audited historical corrections.
- Functional Requirements: FR-007 clarified status derivation; FR-009 clarified delete safeguards; FR-101 through FR-107 added or clarified for payment persistence, synchronized overpayment handling, calculations, funding_account requirement, confirmed payments driving canonical Submitted status, Next Due recurrence semantics, and legacy payment migration.
- Acceptance Criteria: AC-015, AC-016, AC-017 clarified; new criteria use the unused AC-100 through AC-112 range to avoid collisions with existing Phase 1 acceptance-criteria identifiers.

## Implementation notes for reviewers

- Do not change application code in this commit. Update only this authoritative README file in the feature branch.
- Preserve existing requirement IDs where possible; new IDs in the 100+ range are used for additions to avoid collisions.
- The master bill schema must not be rewritten to retroactively change closed prior occurrences used for historical reporting.
- Historical immutability applies to automatic/system behavior; explicit audited Historical Corrections remain permitted where authorized.
- Do not enforce occurrence-based non-null payment constraints until legacy data migration and validation are complete.
- Migration validation must reconcile source and target counts and financial totals, cover paymentless legacy month rows, and report zero unresolved `migration_incomplete` occurrences and zero null/blank required payment fields before enforcement.

## Change Log

- 2026-08-07 — v1.1.0 — Added payment persistence requirements, occurrence definitions, Remaining/Credit formulas, funding_account and notes requirement, clarified Next Due semantics, preserved TCUB/TCU rules, and defined Overdue precedence.
- 2026-08-08 — v1.1.1 — Resolved follow-up review findings: separated occurrence Budget from nullable Actual; synchronized overpayment credits; restored Budget fallback in Overdue rules; moved new acceptance criteria to AC-100+; retained Submitted as the canonical status; defined audited historical corrections; protected history from cascading delete; specified recurrence field semantics; and added legacy payment migration/backfill requirements.
- 2026-08-08 — v1.1.2 — Required credit recalculation after Budget overrides; modeled every bi-weekly due date as a distinct installment; and defined complete legacy month, occurrence, and funding-account backfills with validation gates.
