# Project Ledger Operational Runbook

## Purpose

This runbook is the durable operational memory for Project Ledger. It captures production defects, root causes, corrective actions, regression gaps, verification evidence, and guardrails that future changes must consult before implementation.

It complements, but does not replace, the authoritative requirements and architecture documents. Requirements define intended behavior; this runbook records what has failed in practice, why it failed, how it was corrected, and what must be re-tested to prevent recurrence.

## Governing Use

Before modifying Bills, Accounts, Statements, Supabase schema, persistence, or production deployment behavior:

1. Read `Project-Ledger-Bills-Dashboard-README.md` for authoritative functional requirements.
2. Read `docs/issue-44-architecture-baseline.md` for canonical Bills architecture and mutation boundaries.
3. Read this runbook for known failure modes and regression traps.
4. Identify affected workflows, not only affected functions/files.
5. Add or update regression coverage for the exact business scenario being changed.
6. Do not declare regression complete solely because unit/service tests pass; verify the end-to-end user behavior represented by the prior defect.

## Regression Standard

A regression suite is considered adequate only when it exercises the business workflow that previously failed. Helper-function, schema-contract, and service-level tests remain necessary but are not sufficient on their own.

For every production defect, capture:

- User action that triggered the defect.
- Exact observed failure or digest/error code when available.
- System layer where the failure occurred: UI, Next.js/server action, service/domain, repository, Supabase, deployment, or integration.
- Root cause.
- Corrective change.
- Data-preservation considerations.
- Exact regression scenario added.
- CI/build/deployment evidence.
- Production validation result.

## Known Failure Modes and Lessons

### RL-001 — Statement reconciliation schema drift

**Observed behavior:** Statement upload failed before reconciliation because production Supabase schema and application code used different reconciliation column contracts.

**Root cause:** Application code queried/wrote canonical columns while production retained older reconciliation schema assumptions.

**Correction:** Production schema was aligned to the canonical statement-reconciliation contract and repository migrations were synchronized with production.

**Regression requirement:** Statement upload schema-contract tests must verify every application column exists in the canonical migrations and that legacy column names do not return.

**Lesson:** A migration file existing in the repository is not proof that production schema matches it. Schema/app contract validation must be part of release verification.

### RL-002 — Legacy NOT NULL constraints blocked canonical statement uploads

**Observed behavior:** Even after canonical columns were present, uploads could still fail because legacy columns such as `statement_hash`, `file_name`, and `transaction_key` remained `NOT NULL`.

**Root cause:** Forward schema alignment added canonical fields but did not fully release obsolete constraints.

**Correction:** Legacy NOT NULL constraints were removed while preserving existing reconciliation data.

**Regression requirement:** Schema tests must verify obsolete legacy columns cannot block canonical inserts.

**Lesson:** Schema compatibility requires validating constraints as well as column presence.

### RL-003 — Historical statement month falsely compared with current Bills month

**Observed behavior:** Uploading an April 2026 statement while the application was displaying August 2026 triggered a server-action failure even though April was correctly detected from the statement.

**Root cause:** Upload logic treated `viewedMonth !== detected statement month` as a confirmation/error condition.

**Correction:** The detected statement period now drives reconciliation. A different Bills screen month is not an exception. Confirmation is reserved for a genuinely cross-month statement or a deliberate override that conflicts with the detected month.

**Regression requirement:** Explicitly test: April statement detected as April while the surrounding app context is August; no false warning; cross-month statements still require confirmation; same-month overrides pass; conflicting manual overrides require confirmation.

**Lesson:** Historical reconciliation must be driven by source-document period, not transient UI context.

### RL-004 — Existing payment duplication risk during statement reconciliation

**Observed behavior addressed during design:** Historical bills may already have submitted or partial payments before a statement is imported.

**Required behavior:**

- Existing $100 submitted payment + statement $100 → link existing payment, create no duplicate.
- Existing $40 payment + statement $40 and $60 → link $40 and create only missing $60.
- Split statement rows already represented by one existing $100 payment → mark as covered; create no duplicate.
- Existing linked payment IDs must not be reused for a different row.
- `Actual Bill Amount` remains independent and must not be overwritten by reconciliation.

**Regression requirement:** Preserve dedicated tests for all scenarios above.

**Lesson:** Reconciliation is a matching/linking workflow first; payment creation is only the fallback for genuinely missing payment history.

### RL-005 — Bills edit workflow can fail when changing only Category

**Observed behavior:** Editing the FedEx bill Category produced a Next.js/server-action error before the change reached Supabase. The production FedEx record remained unchanged.

**Production data observed at failure:** Fedex; Type `Personal`; Category `Business`; Account `TCU`; Budget `$104.30`.

**Root cause under investigation:** The edit workflow submits and validates the full bill identity even when the user changes one field. This allows unrelated validation or derived-field logic to block a Category-only correction before persistence.

**Required correction:** Category-only edits must be able to persist without rewriting or unnecessarily validating unrelated fields beyond what is required to maintain record integrity. Existing payment history and unrelated bill fields must remain unchanged.

**Regression requirement:** Add exact production-behavior tests for:

- Legacy/invalid Category `Business` → user edits only Category → Save succeeds → new Category persists → page reloads normally → unrelated fields unchanged → payments unchanged.
- Category-only edit on a submitted bill remains permitted where the requirements allow editing.
- Budget-only edit changes Budget and nothing else.
- Actual-only edit changes Actual and nothing else.
- A single-field edit must not null/rewrite unrelated values.

**Lesson:** Mutation tests must verify partial user intent, not only successful full-form submissions.

## Bills Architectural Guardrails

- Bills Master is the canonical source of bill identity and recurring attributes.
- Business and Personal are Types, not Categories.
- TCU derives Personal; TCUB derives Business; Streaming is explicit where applicable.
- `Actual Bill Amount` is independent from payments.
- Submitted amount is the sum of payment records.
- Saving one editable field must not null or rewrite unrelated fields.
- Editing an existing bill must not discard payment history.
- No `Future` status/bucket.
- Display/group order: Personal → Business → Streaming.
- Within a group, due date ascending, then bill name tie-break.
- Bills mutations should pass through the canonical service/repository path rather than ad hoc Supabase writes from UI code.

## Statement Reconciliation Guardrails

- The statement itself determines the reporting month whenever the printed period is detectable.
- The current Bills month must not override or invalidate a correctly detected historical statement month.
- Cross-month statements require explicit confirmation.
- Manual overrides that conflict with detected period require confirmation.
- Duplicate statement hashes must return the existing import rather than create another import.
- Existing submitted/partial payments must be linked or credited before creating new payment rows.
- Reconciliation must not overwrite Actual.
- Completion must block unresolved `NEW` and `Unmatched` rows.

## Release and Verification Checklist

Before merging a change that touches a known failure mode:

- Confirm the requirements document and architecture baseline still support the intended behavior.
- Add/update a regression test for the exact prior production scenario.
- Run full regression suite.
- Run production build.
- Verify schema migrations and production schema contract when database fields/constraints are involved.
- Confirm Vercel preview/deployment checks.
- For high-risk persistence changes, validate that unrelated records and payment history remain unchanged.
- Record the resulting PR/commit and production validation in this runbook.

## Change Log

### 2026-08-12

- Created operational runbook after repeated production/UAT failures exposed gaps between implementation-level regression testing and actual workflow behavior.
- Captured statement schema drift, legacy constraint failure, historical-month detection defect, payment-duplication safeguards, and the FedEx Category edit failure.
- Established rule that future regression testing must include the exact business workflow that previously failed, not only unit/helper/service tests.
