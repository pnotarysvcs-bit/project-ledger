# Project Ledger — Bills Workspace Phase 2

**Status:** In implementation  
**Date:** August 4, 2026

## Purpose

Implement the database-backed Bills workspace required by Issue #10 and replace the legacy four-record client dataset.

## Scope

- Read active Bills Master records from Supabase `ledger_bills`.
- Use the selected month when retrieving applicable bills, monthly status, and payment totals.
- Display the April 2026 baseline of 48 bills.
- Apply Monthly, Bi-Weekly, Quarterly, Annual, and One-Time scheduling rules.
- Display Bill, Type, Category, Account, Budget, Frequency, Next Due, Status, and Actions columns.
- Sort bills alphabetically by Bill name.
- Calculate Due Soon, Overdue, Partial, and Submitted from selected-month data.

## Requirements

**BR-BILL-P2-001 — Persisted Bills Source**  
The Bills workspace must use Supabase Bills Master records rather than hard-coded application arrays.

**FR-BILL-P2-001 — Selected Month Retrieval**  
The workspace must accept a selected month and retrieve applicable active bills for that month.

**FR-BILL-P2-002 — April Baseline**  
Selecting April 2026 must return all 48 seeded active bills before any user archive or delete actions are applied.

**FR-BILL-P2-003 — Scheduling**  
Quarterly, Annual, and One-Time bills must appear only in applicable scheduled months.

**FR-BILL-P2-004 — Monthly Activity**  
Monthly status and payment totals must be retrieved from `ledger_bill_months` and `ledger_bill_payments` for the selected month.

**FR-BILL-P2-005 — Status Calculation**  
Submitted applies when payments meet or exceed Budget. Partial applies when at least one payment exists below Budget. Overdue applies when no payment exists and the due date has passed. Due Soon applies otherwise.

## Acceptance Criteria

**AC-BILL-P2-001**  
Given April 2026 is selected, the workspace displays 48 active seeded bills.

**AC-BILL-P2-002**  
Bills are displayed alphabetically and include the approved columns.

**AC-BILL-P2-003**  
Refresh returns the same Supabase-backed list.

**AC-BILL-P2-004**  
The legacy four-record dataset is not used by the Bills page.

**AC-BILL-P2-005**  
Automated tests cover April retrieval and frequency scheduling.

## Definition of Done

- Issue #10 acceptance criteria are verified.
- Tests and production build pass.
- Vercel Preview displays all 48 April bills.
- README, code, tests, and migration references are included in the same pull request.
