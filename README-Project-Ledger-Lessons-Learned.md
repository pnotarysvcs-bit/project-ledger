# Project Ledger — Lessons Learned & Release Governance

**Document:** README-Project-Ledger-Lessons-Learned  
**Status:** Active Governance Reference  
**Version:** 1.0  
**Date:** August 8, 2026  
**Origin:** PR #34 Bills/Supabase alignment, regression, and production release

## Purpose

This document captures the lessons learned from the Project Ledger Bills/Supabase correction and release cycle. Its purpose is to convert those lessons into durable engineering and release-governance practices for future Project Ledger changes.

## Lessons Learned

- Never treat a green checkmark as proof that testing occurred. A CI job must be inspected to confirm it actually runs the intended tests and build steps.
- CI must enforce the real release gate. Every pull request should install dependencies, execute the regression suite, and perform a production build before merge.
- Regression testing must occur before merging to `main`, not after production release.
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
- Release decisions must be based on evidence: tests, build, migration status, deployment status, review resolution, and mergeability.
- Production must be verified again after merge using the exact `main` merge commit.
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
9. The pull request is merged into `main` only after the release gate is satisfied.
10. The exact `main` merge commit is verified in CI and Vercel Production.
11. A short business-user smoke test is performed against familiar data before normal operational use resumes.

## Required Release Gate

A Project Ledger release is ready for production only when all applicable controls are satisfied:

- Regression test suite: PASS
- Production build: PASS
- Vercel Preview: READY
- Supabase Preview database/migrations: PASS when applicable
- Review threads: RESOLVED
- Pull request: MERGEABLE
- Production deployment from `main`: SUCCESS
- Post-merge CI: PASS
- Business-user smoke check: COMPLETE

A single green platform indicator must never substitute for the complete release gate.

## Governance Outcome

The primary improvement from the PR #34 release cycle is not only the corrected Bills implementation. Project Ledger now has a clearer operating model for requirements, migration safety, regression testing, release validation, and production verification. These controls should be treated as part of the product architecture rather than optional project administration.

## Version History

| Version | Date | Description |
| --- | --- | --- |
| 1.0 | 2026-08-08 | Initial lessons learned and release-governance baseline following PR #34 Bills/Supabase alignment and regression release. |
