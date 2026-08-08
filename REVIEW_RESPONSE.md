# Comprehensive Review Response - PR #28

## Overview

This document addresses all review feedback from the automated code review. The PR has identified several categories of issues spanning data consistency, transaction safety, validation, and UI logic. Below is a prioritized action plan to address all findings.

---

## Critical Issues (P1 - Must Fix Before Production)

### 1. **Enforce Payment Limit Atomically** (R3740328662)
**Issue:** Concurrent partial-payment submissions can bypass overpayment protection through race conditions.

**Root Cause:** Read-check-write pattern without database-level constraints.

**Solution:**
- Add a database-level CHECK constraint on the `payments` table to prevent cumulative overpayment
- Implement Supabase transaction or use PostgreSQL trigger for atomic validation
- Add test coverage for concurrent submission scenarios

---

### 2. **Scope Payment Mutations to Selected Bill and Month** (R3740328666)
**Issue:** Payment mutations (`updatePayment`, `removePayment`) trust only client-provided `paymentId`, allowing cross-bill/cross-month tampering.

**Root Cause:** Missing bill_id and month validation in PATCH/DELETE filters.

**Solution:**
- Add `WHERE bill_id = $1 AND EXTRACT(MONTH FROM payment_date) = $2` conditions
- Validate both bill_id and month before executing mutations in server actions
- Update tests to verify scoped mutations

---

### 3. **Validate Budget Edits Against Every Affected Billing Month** (R3740328667)
**Issue:** Budget changes are applied retroactively across all months but validation only checks the current UI month.

**Root Cause:** `editBill` only scans the visible month's payments, not all months.

**Solution:**
- Query ALL payments across all months for the given bill when validating budget edits
- Use a helper function like `getAllBillPayments(billId)` instead of month-scoped lookup
- Ensure no month becomes overpaid retroactively

---

### 4. **Include Bills Due Today in the Seven-Day Window** (R3740328661)
**Issue:** Calendar-day comparison fails after midnight UTC; bills due today are excluded.

**Root Cause:** Subtracting timestamps instead of comparing calendar dates.

**Solution:**
- Replace `asDate(bill.nextDue) - now` with calendar-day comparison
- Use `startOfDay()` helper for both bill.nextDue and current date
- Ensure bills due today (through end of business day) remain in the window

---

### 5. **Load the Rolling Due-Soon Window Independently** (R3740328660)
**Issue:** When viewing a historical month, the due-soon widget shows only that month's data instead of a rolling 7-day window from today.

**Root Cause:** Single `getLedgerBills()` call filters by selected month; due-soon is a separate time window.

**Solution:**
- Make two separate queries: one for the selected reporting month, one for the rolling due-soon window
- Merge the results so due-soon always reflects current + near-future bills regardless of selected month
- Update Dashboard to maintain both datasets

---

## High-Priority Issues (P2 - Address in Next Phase)

### 6. **Count Only Current Partial Rows in the Partial Card** (R3740328668)
**Issue:** Overdue bills incorrectly remain in the Partial count due to status precedence violation.

**Root Cause:** Card counts `submitted > 0` without checking current status == "Partial".

**Solution:**
- Change condition to `status === 'partial'` instead of `submitted > 0`
- Ensure `classifyLedgerBill` runs before both card and overview calculations
- Add test for status precedence (Submitted → Overdue → Partial → Future)

---

### 7. **Handle Persisted-Ledger Failures Inside the Dashboard** (R3740328670)
**Issue:** Dashboard crashes entirely if `getLedgerBills()` throws; Bills workspace handles this gracefully.

**Root Cause:** No try-catch around ledger data retrieval in Dashboard.

**Solution:**
- Wrap `getLedgerBills()` call in try-catch
- Return graceful error state (render error cards instead of crashing)
- Match error handling pattern already in Bills workspace

---

### 8. **Preserve the Month When Editing a Due Date** (R3740328664)
**Issue:** Editing a bill's due date to another month silently discards the month; stored as day-only.

**Root Cause:** `editBill` persists only the day, ignoring month/year selection.

**Solution:**
- Extract full date (day, month, year) from the form input
- Update `start_month` when bill moves to a different calendar month
- For recurring bills, clarify intended behavior (does editing move the recurrence or just one instance?)

---

### 9. **Exclude Archived Bills from Bulk Submission** (R3740328665)
**Issue:** Bulk Submit can resurrect archived bills with new payments.

**Root Cause:** `bulkSubmit` eligibility check missing `archive_date IS NULL` condition.

**Solution:**
- Add `AND archive_date IS NULL` to bulk submit eligibility query
- Only submit active (non-archived) bills
- Add test covering archived bill exclusion

---

### 10. **Disable Partial When Bill Amount is Incomplete** (R3740328672)
**Issue:** Partial button remains enabled for bills with `null` budget, leading to rejected submissions.

**Root Cause:** `remaining === 0` allows `null` to pass; should require valid budget.

**Solution:**
- Change condition: `remaining !== null && remaining > 0`
- Disable Partial button if budget is missing (same as Submit button)
- Provide user feedback explaining why the action is disabled

---

### 11. **Record the Actual Due Date for Bulk Payments** (R3740328673)
**Issue:** Bulk Submit caps all payment days at 28, fabricating invalid dates for month-end bills.

**Root Cause:** Unconditional `Math.min(bill.day, 28)` without considering month length.

**Solution:**
- Compute actual month length: `new Date(year, month, 0).getDate()`
- Use `Math.min(bill.day, maxDayOfMonth)` for clamped due date
- Add test for February, April, June, September, November edge cases

---

## Data Consistency Issues

### 12. **Nondeterministic Due-Soon Calculation** (R3740320021)
**Issue:** `summarizeLedgerBills` bakes `new Date()` at runtime, ignoring test/historical `asOf` parameter.

**Root Cause:** Accumulator initializes its own `asOf` instead of using passed parameter.

**Solution:**
- Accept `asOf` as a parameter to `summarizeLedgerBills`
- Use parameter throughout (don't reinitialize inside the function)
- Ensures deterministic test results and correct historical reporting

---

### 13. **Due-Soon Calculation Compares Time Against Midnight** (R3740320015)
**Issue:** Dashboard "due soon" comparison uses timestamps instead of calendar dates.

**Root Cause:** Same as issue #4 (Include bills due today).

**Solution:**
- Implement calendar-day boundary comparison across all due-soon logic
- Ensure consistency between Bills workspace and Dashboard

---

### 14. **Validate Payment Date and ID in updatePayment** (R3740320027)
**Issue:** `updatePayment` can persist invalid dates (e.g., `"undefined"`) and doesn't validate the `paymentId`.

**Root Cause:** Missing nullability checks and ID validation.

**Solution:**
- Check `paymentDate !== null && paymentDate !== undefined && paymentDate.trim() !== ''`
- Validate `paymentId` exists and belongs to the correct bill
- Add database constraint to prevent NULL payment_date
- Add test for rejected updates with missing/invalid data

---

## Implementation Roadmap

### Immediate (Critical P1 items):
1. Atomic payment limit enforcement (database constraints + transactions)
2. Scoped payment mutations (add bill_id + month filters)
3. Multi-month budget validation
4. Calendar-date comparisons for due windows
5. Independent due-soon query

### Short-term (P2 items):
6. Status precedence in partial counting
7. Dashboard error handling
8. Date editing with month preservation
9. Archived bill exclusion
10. Null budget handling
11. Month-end date clamping for bulk submissions

### Data Quality (foundational):
12. Deterministic `asOf` parameter threading
13. Calendar-based UTC midnight handling
14. Payment date/ID validation

---

## Testing Strategy

All changes should include:
- Unit tests for business logic (status classification, budget validation, date calculations)
- Integration tests for server actions (payment mutations, multi-bill scenarios)
- Concurrent/race-condition tests (payment limits, simultaneous submissions)
- Edge-case tests (month-end dates, archived bills, null budgets, timezone handling)

Update `test/ledger-bills-framework.test.js` and `test/ledger-bills-data.test.js` to cover all scenarios above.

---

## Summary

This PR establishes the foundation for a persisted ledger system but requires critical fixes to data safety and consistency before production deployment. The identified issues span three areas:

1. **Transaction Safety** (P1): Payment limit atomicity, scoped mutations, multi-month validation
2. **Data Consistency** (P1-P2): Deterministic calculations, calendar-date handling, status precedence
3. **Validation & Completeness** (P2): Input validation, null handling, error recovery

All 14 findings should be addressed in the order outlined above. Recommend using this response as a tracking document for follow-up PRs.
