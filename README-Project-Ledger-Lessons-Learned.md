# Project Ledger — Lessons Learned & Release Governance

**Document:** README-Project-Ledger-Lessons-Learned  
**Status:** Active Governance Reference  
**Version:** 1.1  
**Date:** August 8, 2026  
**Origin:** PR #34 Bills/Supabase alignment, regression, and production release

## Purpose

This document captures the lessons learned from the Project Ledger Bills/Supabase correction and release cycle. Its purpose is to convert those lessons into durable engineering and release-governance practices for future Project Ledger changes.

## Lessons Learned

- Never treat a green checkmark as proof that testing occurred. A CI job must be inspected to confirm it actually runs the intended tests and build steps.
- CI must enforce the real release gate. Every pull request should install dependencies, execute the regression suite, and perform a production build before merge.
- Regression testing must occur before merging to `main`, not after production release.
- Regression testing is not complete when it validates only code, fixtures, and Preview environments. Production database compatibility must be verified after deployment whenever the release changes persistence or schema.
- A successful Preview migration does not prove that the same migration reached Production. Preview and Production Supabase migration histories must be verified independently.
- A successful Vercel Production deployment proves that the application built and deployed; it does not prove that an external production database contains the schema required by that application.
- A failed regression test does not automatically mean the application is wrong. Determine whether the failure is a product defect or an outdated test expectation before changing production code.
- Regression tests must evolve with approved business rules while preserving meaningful controls.
- Recurring Bills Master data and month-specific transactional occurrence data are different business objects and must be persisted separately.
- Editing one month must not silently change future months. Occurrence Budget, Actual Amount, and due-date changes apply only to the selected occurrence unless the user explicitly elects to update the recurring master schedule.
- Historical financial information requires stronger controls than current-period information. Prior-period corrections must be deliberate, traceable, and auditable.
- Never manufacture historical financial data during migration. When trustworthy historical source data is unavailable, mark the record incomplete rather than inferring a value from the current master.
- Migration provenance matters. A technically successful migration is not sufficient if the origin of historical values cannot be defended.
- Bi-weekly bills must be represented as one installment occurrence per 14-day due date, including months containing three installments.
- Payments must attach to the correct occurrence. Bill-level payment association is insufficient when multiple installments can exist in the same reporting month.
- Partial payments are first-class financial transactions and must contribute to Total Paid even when the obligation is not yet fully Submitted.
- Overpayments must be preserved. The payment transaction remains intact and excess is represented as Credit rather than being truncated or discarded.
- Dashboard and Bills workspace financial metrics must use the same underlying persisted calculation model to avoid reconciliation differences.
- Presentation defects can create operational risk even when calculations are correct. Dashboard values, chart categories, status colors, and sorting must be regression-tested along with backend logic.
- “Bills Due in the Next 7 Days” must be ordered by due date and urgency, not alphabetically by vendor.
- Status definitions require deterministic precedence so Bills and Dashboard cannot classify the same occurrence differently.
- Critical financial controls should be enforced at the database boundary where appropriate, not exclusively in the user interface.
- Review comments should be corrected individually, answered with the implemented resolution, and marked resolved only after the underlying issue is actually fixed.
- Preview environments are required for meaningful database migration validation before production.
- Application deployment and database deployment are separate release gates. Vercel success does not prove Supabase success, and Supabase success does not prove the application build is healthy.
- A pull request being technically mergeable does not mean it is release-ready.
- Release decisions must be based on evidence: tests, build, Preview migration status, Production migration status, deployment status, review resolution, and mergeability.
- Production must be verified again after merge using the exact `main` merge commit.
- After a schema-changing release, Production must be queried to confirm required tables, columns, constraints, indexes, and migration records exist before the release is declared operational.
- A live Production smoke test must exercise Dashboard, Bills, and Accounts against familiar persisted data after the Production schema check passes.
- Approved requirements and traceability must take precedence over technically convenient shortcuts.
- Engineering controls should be permanent. The release process should not depend on one-time manual intervention or individual memory.
- Protect the financial data model first. UI defects are usually recoverable; corrupted historical transactions, propagated recurring values, or fabricated financial history can compromise ledger integrity.

## Release Governance Standard

Future Project Ledger changes should follow this release path:

1. Approved requirements and traceability are established before implementation.
2. Implementation occurs on an isolated development or correction branch.
3. A pull request is opened against `main`.
4. Automated CI runs `npm ci`, the complete regression suite, and the production build.
5. Vercel Preview deployment is validated.
6. Supabase Preview migrations and database health are validated when schema or persistence changes are included.
7. Review findings are corrected, documented, and resolved individually.
8. The pull request must be mergeable with all required checks green.
9. The pull request is merged into `main` only after the pre-production release gate is satisfied.
10. The exact `main` merge commit is verified in CI and Vercel Production.
11. When schema or persistence changes are included, the Production Supabase migration history is verified against the migrations required by the deployed `main` commit.
12. Production schema compatibility is verified directly, including all required tables, columns, constraints, indexes, and other database objects used by the deployed application.
13. Production data-preservation controls are verified by reconciling critical row counts or other approved control totals before and after migration when applicable.
14. A live Production smoke test is performed for Dashboard, Bills, and Accounts using familiar persisted data.
15. The release is declared operational only after both application and Production database validation pass.

## Required Release Gate

A Project Ledger release is ready for production use only when all applicable controls are satisfied:

- Regression test suite: PASS
- Production build: PASS
- Vercel Preview: READY
- Supabase Preview database/migrations: PASS when applicable
- Review threads: RESOLVED
- Pull request: MERGEABLE
- Production deployment from `main`: SUCCESS
- Post-merge CI: PASS
- Production Supabase migration history: MATCHES DEPLOYED RELEASE when applicable
- Production schema compatibility: VERIFIED when applicable
- Production data-preservation/control totals: VERIFIED when applicable
- Dashboard Production smoke test: PASS
- Bills Production smoke test: PASS
- Accounts Production smoke test: PASS
- Business-user smoke check: COMPLETE

A single green platform indicator must never substitute for the complete release gate. A release is not operationally complete when application code and Production database schema are on different release levels.

## Governance Outcome

The primary improvement from the PR #34 release cycle is not only the corrected Bills implementation. Project Ledger now has a clearer operating model for requirements, migration safety, regression testing, release validation, and production verification. These controls should be treated as part of the product architecture rather than optional project administration.

The August 8, 2026 post-release incident established an additional control: schema-changing releases require explicit Production Supabase migration verification and a live Production smoke test. Preview success alone is insufficient evidence of Production database readiness.

## Version History

| Version | Date | Description |
| --- | --- | --- |
| 1.0 | 2026-08-08 | Initial lessons learned and release-governance baseline following PR #34 Bills/Supabase alignment and regression release. |
| 1.1 | 2026-08-08 | Added Production Supabase migration/schema verification, data-preservation controls, and mandatory post-deployment Production smoke testing following detection of a Preview-to-Production schema mismatch. |
