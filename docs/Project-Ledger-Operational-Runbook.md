# Project Ledger Operational Runbook

## Purpose

This runbook is the durable operational memory for Project Ledger. It records production defects, root causes, corrective actions, regression protections, deployment guardrails, and release evidence.

It complements the authoritative requirements and architecture documents. Requirements define intended behavior; this runbook records what failed in practice, why it failed, and how recurrence is prevented.

## Governing Use

Before modifying Bills, Accounts, Statements, Supabase schema, persistence, PWA behavior, or production deployment:

1. Read `Project-Ledger-Bills-Dashboard-README.md` for authoritative functional requirements.
2. Read `docs/issue-44-architecture-baseline.md` for canonical Bills architecture and mutation boundaries.
3. Read this runbook for known failure modes and regression traps.
4. Identify affected workflows, not only affected functions/files.
5. Add or update regression coverage for the exact business scenario being changed.
6. Do not declare a Bills change complete solely because a component or helper test passes.

## Regression Standard

Regression coverage must exercise the business workflow that previously failed. Unit, service, schema-contract, and source-contract tests are necessary but should protect the user-visible workflow and persistence semantics.

For production defects, record the trigger, observed failure, system layer, root cause, corrective change, data-preservation considerations, regression scenario, deployment evidence, and production validation result.

## Known Failure Modes and Lessons

### RL-001 — Statement reconciliation schema drift

**Observed behavior:** Statement upload failed before reconciliation because production Supabase schema and application code used different reconciliation column contracts.

**Root cause:** Application code queried/wrote canonical columns while production retained older reconciliation assumptions.

**Correction:** Production schema was aligned to the canonical statement-reconciliation contract and repository migrations were synchronized with production.

**Regression requirement:** Statement schema-contract tests must verify application columns and obsolete constraints.

**Lesson:** A migration in the repository is not proof that production schema matches it.

### RL-002 — Legacy NOT NULL constraints blocked canonical statement uploads

**Observed behavior:** Legacy reconciliation columns could block canonical inserts even after new columns were present.

**Root cause:** Forward schema alignment added canonical fields without fully releasing obsolete constraints.

**Correction:** Legacy NOT NULL constraints were removed while preserving reconciliation data.

**Regression requirement:** Schema tests must verify obsolete legacy constraints cannot block canonical inserts.

### RL-003 — Historical statement month falsely compared with current Bills month

**Observed behavior:** Uploading an April 2026 statement while viewing August 2026 triggered a server-action failure although April was correctly detected.

**Root cause:** Upload logic treated `viewedMonth !== detected statement month` as an error condition.

**Correction:** The detected statement period drives reconciliation. Confirmation is reserved for a genuinely cross-month statement or a manual override that conflicts with the detected month.

**Regression requirement:** Preserve the April-from-August scenario plus cross-month and override confirmation cases.

### RL-004 — Existing payment duplication risk during statement reconciliation

Historical submitted or partial payments must be matched and linked before new payments are created. Reconciliation must not overwrite `Actual Bill Amount`, and existing linked payment IDs must not be reused for different statement rows.

**Regression requirement:** Preserve full-payment, partial-payment, split-payment, and no-duplicate scenarios.

### RL-005 — Legacy Category values blocked Bills edits

**Observed behavior:** Editing the FedEx bill Category failed before persistence. The affected record had Type `Personal`, legacy Category `Business`, Account `TCU`, and Budget `$104.30`.

**Root cause:** The edit service validated the submitted Category value as though every edit were creating a new category. A legacy invalid Category such as `Business` or `Personal` therefore blocked unrelated or corrective edits before the change reached Supabase.

**Correction:** Existing legacy Category values no longer block an edit when the user leaves that legacy value unchanged, while attempts to introduce a new invalid Category remain rejected. A Category correction to a valid value persists through the canonical service/repository path. TCU/TCUB account-driven Type derivation remains authoritative.

**Regression requirement:** Preserve tests for legacy `Business`/`Personal` Category correction, unrelated edits on legacy records, submitted-bill edits, Actual-only edits, Budget-only edits, and account changes that derive Personal/Business Type.

**Lesson:** Validation for edits must distinguish existing legacy data from newly introduced invalid data. A single-field change must not null, rewrite, or invalidate unrelated persisted fields.

### RL-006 — Installed app must not serve stale financial data

**Risk:** A conventional offline-first PWA service worker can cache HTML, application bundles, API responses, or financial views and make an installed Project Ledger app appear out of date after a deployment or data change.

**Correction:** Project Ledger uses installability metadata and a service worker without application/data caching. Navigation, API, and application requests remain network-backed. No cache fallback is used for Bills or Statements data.

**Regression requirement:** Verify manifest installability, service-worker registration, 192x192 and 512x512 icons, standalone mode, and absence of `cache.put` / `caches.match` behavior.

**Lesson:** For this financial application, installability is valuable; offline financial-data caching is not.

## Bills Architectural Guardrails

- Bills Master is the canonical source of bill identity and recurring attributes.
- Business and Personal are Types, not Categories.
- TCU derives Personal; TCUB derives Business; Streaming is explicit where applicable.
- `Actual Bill Amount` is independent from payments and remains editable after submission.
- Submitted amount is the sum of payment records.
- Saving one editable field must not null or rewrite unrelated fields.
- Editing an existing bill must not discard payment history.
- No `Future` status/bucket.
- Selecting a month changes the monthly view immediately; no `View` button is required.
- Display/group order: Personal → Business → Streaming.
- Within a group, due date ascending, then bill name tie-break.
- Filters apply to supported columns except Actions.
- Bills mutations pass through the canonical service/repository path rather than ad hoc Supabase writes from UI code.

## PWA Guardrails

- Manifest name: Project Ledger; short name: Ledger.
- `display: standalone` and mobile viewport metadata are required.
- Service-worker registration must remain explicit and production-safe.
- Do not cache Bills, Statements, API responses, server actions, or deployment HTML/bundles in a way that can present stale financial information.
- PWA changes must not redesign the existing UI.

## Deployment Identity

- GitHub repository: `pnotarysvcs-bit/project-ledger`.
- Vercel project ID: `prj_uKSSmtrWFvrGi7rHz1Gnvo2Rf0HC`.
- Before production acceptance, verify the production deployment is tied to the expected `main` commit and the Project Ledger Vercel project, not an older or similarly named project.
- When the Vercel dashboard shows multiple deployments, confirm the commit SHA and Production environment rather than relying only on a generic Visit button.

## Release and Verification Checklist

Before merging a Bills/PWA change:

- Confirm requirements and architecture support the intended behavior.
- Add/update regression coverage for exact prior production scenarios.
- Confirm branch is not behind `main`.
- Validate Vercel Preview/build status for the branch head.
- Verify no destructive database migration or financial-data deletion is included.
- Verify no secrets/credentials are introduced in client-facing files.
- Review the complete branch diff for scope creep.
- Merge only when applicable checks are green.
- Confirm production deployment is based on the resulting `main` commit.
- Perform critical production smoke tests for month switching, due-date order, editing, submitted Actual editing, filters, Statements, and PWA installability.

## Change Log

### 2026-08-12

- Created the operational runbook after repeated UAT/production regressions.
- Captured statement schema drift, historical-month detection, duplicate-payment protections, and the FedEx Category failure.
- Finalized the FedEx root cause and correction: legacy Category values no longer block unrelated or corrective edits.
- Added PWA installability with network-backed behavior and no stale financial-data cache.
- Recorded canonical GitHub/Vercel deployment identity and production verification guardrails.
