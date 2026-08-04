# Project Ledger — Bills Module

**Document:** Phase 1 Implementation Specification  
**Status:** Approved  
**Version:** 1.0.0  
**Approval Date:** August 3, 2026

## Purpose

Define the approved Phase 1 requirements for rebuilding the Project Ledger Bills module around a persistent Bills Master source of truth. This document governs implementation, validation, traceability, and completion criteria for the Phase 1 Bills redesign.

## Scope

Phase 1 includes:

- Bills Master as the authoritative source of bill records
- Permanent persistence for Add, Edit, Archive, Delete, and status changes
- Personal and Business classification derived from funding-account prefixes
- Monthly bill-status handling
- Validated server-side save operations
- Database-confirmed success responses
- Bills workspace data retrieval from persisted records
- Traceable requirements, tests, and acceptance criteria

Phase 1 excludes:

- Statement matching and reconciliation
- AI transaction matching
- Income and cash-flow calculations
- Savings Goals redesign
- Full occurrence and payment-history redesign beyond the approved monthly status model
- Broad redesign of unrelated application modules

## Business Requirements

**BR-001 — Bills Master Source of Truth**  
The application must use Bills Master as the authoritative source for bill definitions and bill-management activity.

**BR-002 — Persistent Bill Management**  
The user must be able to create, edit, archive, delete, activate, deactivate, and update approved bill information without losing changes after refresh.

**BR-003 — Accurate Ownership Classification**  
Bills must be classified as Personal or Business using the approved funding-account prefix rules.

**BR-004 — Monthly Bill Status**  
The application must support bill status in the context of the selected month without corrupting the underlying master bill definition.

**BR-005 — Reliable Save Confirmation**  
The user must receive a success response only after the database confirms the requested change.

**BR-006 — Consistent Bills Workspace**  
The Bills workspace and Dashboard must use the same persisted Bills Master records and approved business rules.

**BR-007 — Auditability and Traceability**  
Every Phase 1 behavior must be traceable to a requirement, acceptance criterion, test, and implementation result.

## Functional Requirements

**FR-001 — List Bills**  
The Bills workspace must retrieve and display persisted Bills Master records.

**FR-002 — Add Bill**  
The user must be able to add a bill using the approved editable fields.

**FR-003 — Edit Bill**  
The user must be able to edit every approved editable bill field.

**FR-004 — Persist Add and Edit**  
Add and Edit operations must write through a server-side API or service to persistent storage.

**FR-005 — Database-Confirmed Success**  
The application must not display a successful save until the database confirms the operation.

**FR-006 — Refresh Retention**  
After a successful save, refreshing the browser must return the saved record and values.

**FR-007 — Monthly Status Update**  
The user must be able to update the approved status for the selected month.

**FR-008 — Archive Bill**  
The user must be able to archive a bill using the approved archive behavior.

**FR-009 — Delete Bill**  
The user must be able to delete a bill using the approved delete behavior and safeguards.

**FR-010 — Active State**  
The user must be able to activate or deactivate a bill and retain that setting after refresh.

**FR-011 — Personal Classification**  
A funding-account prefix beginning with `TCU`, after excluding `TCUB`, must classify the bill as Personal.

**FR-012 — Business Classification**  
A funding-account prefix beginning with `TCUB` must classify the bill as Business.

**FR-013 — Classification Priority**  
`TCUB` must be evaluated before `TCU` so Business accounts are not misclassified as Personal.

**FR-014 — Classification Recalculation**  
Changing the funding account must recalculate the bill classification.

**FR-015 — Stale Category Protection**  
A stale or manually entered category must not override the approved account-prefix classification rule.

**FR-016 — Validation**  
The system must validate required fields, supported values, and data formats before persistence.

**FR-017 — Failed Save Handling**  
When a save fails, the application must display an error and must not present unsaved values as persisted.

**FR-018 — Reload Current Data**  
After a successful operation, the Bills workspace must display the persisted record returned by the application data source.

**FR-019 — Shared Totals**  
Bills workspace and Dashboard totals must be derived from the same persisted records and shared calculation rules where applicable.

**FR-020 — No Client-Only Records**  
The application must not create UI-only bill copies that disappear after navigation or refresh.

## Non-Functional Requirements

**NFR-001 — Data Integrity**  
Bill operations must preserve valid persisted records and must not silently discard user changes.

**NFR-002 — Reliability**  
Successful operations must remain successful after refresh, navigation, and a new application session.

**NFR-003 — Performance**  
Normal Bills workspace reads and writes should complete within two seconds under standard operating conditions.

**NFR-004 — Security**  
Bill persistence must use approved server-side access controls and must not expose privileged database credentials to the browser.

**NFR-005 — Authorization**  
Users may access only bill records permitted by the application’s authorization model.

**NFR-006 — Maintainability**  
Classification, validation, persistence, and monthly-status rules must be centralized and reusable where practical.

**NFR-007 — Testability**  
Add, Edit, refresh retention, classification, status, Archive, Delete, and failure handling must be verifiable through automated or documented testing.

**NFR-008 — Accessibility**  
Bills controls and dialogs must be keyboard operable and must expose clear labels and focus states.

**NFR-009 — Observability**  
Persistence failures must be logged or surfaced through the application’s approved monitoring mechanism.

**NFR-010 — Regression Protection**  
Phase 1 must not break Dashboard, Accounts, Statements, transaction import, or Savings Goals functionality.

## Business Rules

**RULE-001 — Bills Master Authority**  
Bills Master is the authoritative source for bill definitions.

**RULE-002 — Database Persistence Required**  
A bill change is not complete until persistent storage confirms it.

**RULE-003 — TCUB Classification**  
Prefixes beginning with `TCUB` are Business.

**RULE-004 — TCU Classification**  
Prefixes beginning with `TCU`, after excluding `TCUB`, are Personal.

**RULE-005 — Prefix Evaluation Order**  
`TCUB` must be evaluated before `TCU`.

**RULE-006 — Category Cannot Override Prefix**  
A stale form category or client-side value cannot override the canonical prefix-derived classification.

**RULE-007 — Monthly Status Separation**  
Month-specific status must be stored separately from the durable master bill definition where required by the approved data model.

**RULE-008 — Failed Writes Do Not Mutate UI State**  
A failed save must leave the last confirmed record unchanged.

**RULE-009 — Refresh Is a Persistence Test**  
A successful record must remain visible with the same values after refresh.

**RULE-010 — Shared Source of Truth**  
Dashboard and Bills views must not maintain conflicting bill datasets.

## Assumptions

**A-001**  
The existing Supabase environment is the approved persistence platform for Project Ledger.

**A-002**  
Bills Master records contain or can support the approved editable fields and active state.

**A-003**  
Month-specific bill status can be associated with a selected period without duplicating the master bill.

**A-004**  
The application remains a single-user or appropriately authenticated ledger during Phase 1.

## Constraints

**C-001**  
Phase 1 must use the existing Project Ledger architecture and deployment pipeline.

**C-002**  
No successful save may depend solely on client-side arrays, component state, cookies, or browser storage.

**C-003**  
Phase 1 must not introduce statement-matching or reconciliation scope.

**C-004**  
Implementation must preserve approved Personal and Business classification behavior.

## Dependencies

**D-001**  
Supabase schema and migrations required by Bills Master must be available in the target environment.

**D-002**  
Server-side Supabase configuration must be valid in Vercel Preview and Production.

**D-003**  
The Bills workspace must have a supported API, repository, or service layer for persistence.

**D-004**  
The Dashboard must consume the same approved Bills Master data source where bill totals are displayed.

## Risks

**R-001 — Client-Only Persistence**  
Risk that UI state appears saved but disappears after refresh. Mitigation: database-confirmed writes and refresh tests.

**R-002 — Classification Collision**  
Risk that `TCUB` is incorrectly matched as `TCU`. Mitigation: evaluate `TCUB` first and test both prefixes.

**R-003 — Schema Drift**  
Risk that Preview or Production does not match repository migrations. Mitigation: validate the target schema before merge or deployment.

**R-004 — Stale Client State**  
Risk that refreshed server data is not reflected in mounted client components. Mitigation: update client state from confirmed server responses or remount/refetch correctly.

**R-005 — Destructive Delete**  
Risk of unintended loss from Delete. Mitigation: confirmation, approved delete semantics, and test coverage.

**R-006 — Cross-Module Regression**  
Risk that Bills changes disrupt Dashboard, Accounts, Statements, or Savings Goals. Mitigation: regression testing before merge.

## Traceability Matrix

| Business Requirement | Functional Requirements | Business Rules | Acceptance Criteria |
|---|---|---|---|
| BR-001 | FR-001, FR-004, FR-018, FR-020 | RULE-001, RULE-002 | AC-001, AC-002, AC-006 |
| BR-002 | FR-002–FR-010, FR-016–FR-018 | RULE-002, RULE-008, RULE-009 | AC-002–AC-009 |
| BR-003 | FR-011–FR-015 | RULE-003–RULE-006 | AC-010–AC-014 |
| BR-004 | FR-007 | RULE-007 | AC-015, AC-016 |
| BR-005 | FR-004–FR-006, FR-017–FR-018 | RULE-002, RULE-008, RULE-009 | AC-003–AC-006 |
| BR-006 | FR-001, FR-019 | RULE-010 | AC-017 |
| BR-007 | FR-016–FR-020 | RULE-001–RULE-010 | AC-018, AC-019 |

## Acceptance Criteria

**AC-001**  
Given the Bills workspace loads, when records are displayed, then they are retrieved from the persisted Bills Master source.

**AC-002**  
Given valid bill information, when the user saves a new bill, then the database stores it and the Bills workspace displays it.

**AC-003**  
Given an existing bill, when the user edits an approved field and saves, then the persisted record contains the updated value.

**AC-004**  
Given a successful Add or Edit, when the browser is refreshed, then the saved record and values remain visible.

**AC-005**  
Given the database rejects a save, when the operation completes, then the application displays an error and does not report success.

**AC-006**  
Given a failed save, when the Bills workspace remains open, then the last confirmed persisted record remains unchanged.

**AC-007**  
Given a bill is archived, when the operation is confirmed, then the approved archive state persists after refresh.

**AC-008**  
Given a bill is deleted using the approved delete behavior, when the operation is confirmed, then the record no longer appears where deleted records are excluded.

**AC-009**  
Given a bill is activated or deactivated, when the browser is refreshed, then the selected active state remains.

**AC-010**  
Given an account prefix beginning with `TCUB`, when classification runs, then the bill is Business.

**AC-011**  
Given an account prefix beginning with `TCU` but not `TCUB`, when classification runs, then the bill is Personal.

**AC-012**  
Given a `TCUB` account, when both prefix rules could superficially match, then the Business rule takes precedence.

**AC-013**  
Given the funding account changes from a TCU account to a TCUB account, when the bill is saved, then classification changes from Personal to Business.

**AC-014**  
Given a stale client category conflicts with the account prefix, when the bill is saved, then the persisted classification follows the account prefix.

**AC-015**  
Given a selected month, when the user updates a supported monthly bill status, then the status persists for that month.

**AC-016**  
Given a monthly status update, when a different month is selected, then the master bill definition remains intact and the correct month-specific status is shown.

**AC-017**  
Given the Dashboard and Bills workspace display bill totals for the same month, when both load, then their totals reconcile to the same persisted source and rules.

**AC-018**  
Given Phase 1 implementation is complete, when the test suite runs, then Add, Edit, persistence, classification, status, Archive, Delete, and failure-path tests pass.

**AC-019**  
Given the pull request is reviewed, when code changes are compared with this README, then implemented behavior and documented requirements are aligned.

## Definition of Done

Phase 1 is done when:

- The approved requirements are committed to GitHub in this README.
- Bills Master is the active source of truth.
- Add and Edit use persistent server-side writes.
- Success is shown only after database confirmation.
- Saved records survive refresh.
- TCUB and TCU classification rules work in the approved order.
- Monthly status behavior is implemented as approved.
- Archive, Delete, Active, and failure behaviors are verified.
- Dashboard and Bills totals reconcile where applicable.
- Automated tests and the production build pass.
- Vercel Preview is reviewed and approved.
- Code, tests, and README are included in the same pull request.
- No critical acceptance criterion remains open.

## Version History

| Version | Date | Change | Status |
|---|---|---|---|
| 1.0.0 | 2026-08-03 | Initial approved Phase 1 specification | Approved |

## Approval

The Product Owner approved the Phase 1 requirements, implementation sequencing, acceptance criteria, and Definition of Done on August 3, 2026.

## Change Log

| Date | Change | Approved By |
|---|---|---|
| 2026-08-03 | Approved Phase 1 Bills requirements baseline | Product Owner |
| 2026-08-04 | Created repository copy of the approved Phase 1 specification and added it to the active pull-request branch | Product Owner direction |
