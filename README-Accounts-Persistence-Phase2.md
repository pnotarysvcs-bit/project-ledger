# Project Ledger — Accounts Persistence Phase 2

**Status:** In implementation  
**Date:** August 4, 2026

## Purpose

Resolve Issue #11 by replacing browser-only account storage with persistent Supabase records.

## Requirements

**BR-ACC-P2-001 — Persistent Accounts**  
Confirmed bank accounts must survive refreshes, navigation, deployments, and unrelated application changes.

**FR-ACC-P2-001 — Server Retrieval**  
The Accounts workspace must load active accounts from Supabase `ledger_accounts`.

**FR-ACC-P2-002 — Database-Confirmed Add**  
A new account must not be shown as saved until the server confirms the database insert.

**FR-ACC-P2-003 — Legacy Migration**  
Valid accounts previously stored in browser local storage must be migrated to Supabase when they are not already present.

**FR-ACC-P2-004 — Archive Preservation**  
Removing an account from the active list must archive it rather than delete the record.

**NFR-ACC-P2-001 — Security**  
Privileged Supabase credentials must remain server-side.

## Acceptance Criteria

**AC-ACC-P2-001**  
A saved account remains visible after refresh and navigation.

**AC-ACC-P2-002**  
A deployment does not remove previously persisted accounts.

**AC-ACC-P2-003**  
Legacy valid local accounts are imported without creating active duplicates.

**AC-ACC-P2-004**  
A failed database write displays an error and does not create a client-only account.

## Definition of Done

- Issue #11 acceptance criteria are verified.
- The `ledger_accounts` migration is committed and applied.
- Vercel Preview confirms account persistence across refresh and navigation.
- README, code, migration, and validation evidence are included in the same pull request.
