# Project Ledger — Dashboard Enhancements

**Status:** Approved Requirements Baseline  
**Approval Date:** August 4, 2026

## Purpose

Improve the Project Ledger Dashboard by adding controlled month navigation, relocating the Active Bills summary into the **Bills Due in the Next 7 Days** section, correcting Dashboard spacing, and providing consistent navigation from Dashboard widgets to the Bills workspace.

## Scope

This enhancement includes:

- Dashboard month selector
- Active Bills summary card within the **Bills Due in the Next 7 Days** section
- Dashboard layout spacing
- Navigation from Dashboard widgets to the Bills workspace

This enhancement does not include:

- Cash Flow Summary calculations
- Transaction classification or reconciliation logic
- Income, expense, or net cash-flow reporting
- Changes to the Bills Master data model
- A redesign of the overall Bills workspace

## Business Requirements

**BR-001 — Month-Based Dashboard Review**  
The Dashboard must allow the user to review bill information for each available month from April 2026 through December 2026.

**BR-002 — Active Bills Visibility**  
The Dashboard must display the number of active bills within the **Bills Due in the Next 7 Days** section.

**BR-003 — Bills Workspace Access**  
The user must be able to navigate from applicable Dashboard widgets directly to the Bills workspace.

**BR-004 — Efficient Dashboard Layout**  
The Dashboard must use available screen space efficiently and eliminate unnecessary blank or unused areas.

**BR-005 — Consistent Bill Information**  
Bill counts and bill details displayed on the Dashboard must use the same persisted source of truth as the Bills workspace.

## Business Rules

**RULE-001 — Supported Month Range**  
The Dashboard month selector must support April 2026 through December 2026.

**RULE-002 — Default Month**  
When the Dashboard opens, it must default to the current calendar month when the current month is within the supported range.

**RULE-003 — Out-of-Range Default**  
When the current calendar month is outside the supported range, the Dashboard must default to the most recent available month.

**RULE-004 — Selected Month Context**  
The selected month must determine the monthly bill information displayed on the Dashboard.

**RULE-005 — Active Bill Definition**  
A bill is active for the selected month when:

- The bill is marked active.
- Its start month is on or before the selected month.
- It has not been discontinued or ended before the selected month.

**RULE-006 — Active Bills Data Source**  
The active-bill count must be calculated from persisted Bills Master records and must not use hard-coded, sample, or placeholder data.

**RULE-007 — Seven-Day Bill Window**  
The bill list within the **Bills Due in the Next 7 Days** section must continue to represent bills due during the next seven calendar days.

**RULE-008 — Month and Seven-Day Period Separation**  
The selected reporting month and the rolling seven-day due-date period are separate business concepts and must not be treated as the same date range.

**RULE-009 — Bills Workspace as Destination**  
Dashboard bill links and actions must navigate to the Bills workspace as the authoritative location for reviewing and managing bills.

**RULE-010 — No Duplicate Business Logic**  
Dashboard bill calculations must use shared rules or services where the same calculation is also used in the Bills workspace.

## Functional Requirements

### Dashboard Month Selector

**FR-001**  
The Dashboard must display a month selector in the upper-right area of the page.

**FR-002**  
The month selector must contain April 2026 through December 2026.

**FR-003**  
The currently selected month must be clearly visible in the selector.

**FR-004**  
Selecting a different month must update all Dashboard information that depends on the reporting month.

**FR-005**  
The month change must occur without requiring a manual browser refresh.

**FR-006**  
The selected month must remain consistent while the user remains on the Dashboard.

**FR-007**  
The Dashboard must not display a month outside the supported range unless the reporting period is intentionally expanded in a future enhancement.

### Active Bills Summary

**FR-008**  
The current separate top-level Active Bills summary card must be removed from the Dashboard statistics row.

**FR-009**  
An Active Bills summary must be added within the **Bills Due in the Next 7 Days** section.

**FR-010**  
The Active Bills summary must display the total number of active Bills Master records applicable to the selected month.

**FR-011**  
The Active Bills summary must update when the selected month changes.

**FR-012**  
The Active Bills count must be retrieved or calculated from persisted bill records.

**FR-013**  
The Active Bills summary must include a clear label such as **Active Bills**.

**FR-014**  
The Active Bills summary may include supporting month context, such as **Applicable to August 2026**.

**FR-015**  
The Active Bills summary must not use wording that implies the count represents bills paid during the month.

**FR-016**  
Selecting the Active Bills summary must navigate the user to the Bills workspace.

**FR-017**  
When supported by the Bills workspace, navigation from the Active Bills summary should automatically apply an Active status filter.

### Bills Due in the Next 7 Days

**FR-018**  
The section must continue to display bills due within the next seven calendar days.

**FR-019**  
Each listed bill must display due date, vendor or bill name, amount, and status.

**FR-020**  
The section must include a visible action for navigating to the Bills workspace.

**FR-021**  
The existing **View All Bills** action must navigate to the full Bills workspace.

**FR-022**  
The **View All Bills** action must not limit the destination view to only bills due within seven days unless a seven-day filter is intentionally applied and clearly shown.

**FR-023**  
Selecting an individual bill should navigate to or open the corresponding bill record in the Bills workspace.

**FR-024**  
The Active Bills summary and the seven-day bill list must be visually distinguishable within the section.

### Dashboard Widget Navigation

**FR-025**  
Dashboard widgets related to bills must use consistent navigation behavior.

**FR-026**  
The following Dashboard elements must navigate to the Bills workspace:

- Active Bills summary
- **View All Bills** action
- Individual bill rows, where supported
- **View Bills** actions in other bill-related Dashboard widgets

**FR-027**  
Navigation must preserve the selected reporting month when the Bills workspace supports month-based filtering.

**FR-028**  
When a Dashboard element applies a destination filter, the Bills workspace must visibly indicate that the filter is active.

**FR-029**  
A user must be able to clear any automatically applied filter after reaching the Bills workspace.

**FR-030**  
Navigation must not lead to a blank page, missing route, or unrelated application section.

### Dashboard Layout Spacing

**FR-031**  
The excessive unused horizontal space between the left navigation and Dashboard content must be removed or materially reduced.

**FR-032**  
The Dashboard content container must expand to use the available width of the application viewport.

**FR-033**  
The left navigation must retain sufficient width for readable menu labels.

**FR-034**  
Dashboard cards must align consistently within a defined grid.

**FR-035**  
Spacing between cards must be consistent across the Dashboard.

**FR-036**  
Removing unused space must not cause content to overlap the left navigation.

**FR-037**  
The revised layout must not create unnecessary horizontal scrolling on supported desktop screen sizes.

**FR-038**  
Dashboard cards must reorganize appropriately for tablet and mobile screen widths.

**FR-039**  
Dashboard content must remain readable when the browser window is resized.

**FR-040**  
Existing Dashboard functionality must remain operational after the layout adjustment.

## Non-Functional Requirements

**NFR-001 — Performance**  
The Dashboard must load month-dependent bill information within two seconds under normal operating conditions.

**NFR-002 — Month Selection Performance**  
After the user selects a different month, the Dashboard must refresh applicable data within two seconds without requiring a full browser reload.

**NFR-003 — Data Accuracy**  
Active Bills counts and bill information must be calculated from persisted application data and must not rely on hard-coded, sample, stale cached, or placeholder values.

**NFR-004 — Data Consistency**  
The Dashboard and Bills workspace must use the same business rules and source-of-truth records when calculating Active Bills and displaying bill information.

**NFR-005 — Reliability**  
Dashboard widget navigation must consistently route the user to a valid Bills workspace page without broken links, blank screens, or application errors.

**NFR-006 — State Consistency**  
The selected reporting month must remain consistent across Dashboard widgets during the active Dashboard session.

**NFR-007 — Responsive Design**  
The Dashboard layout must remain usable and readable on supported desktop, tablet, and mobile screen sizes.

**NFR-008 — Layout Stability**  
Dashboard cards, labels, controls, and navigation elements must not overlap, become clipped, or extend outside their assigned containers when the viewport changes.

**NFR-009 — Horizontal Scrolling**  
The Dashboard must not create unnecessary horizontal scrolling at supported viewport widths.

**NFR-010 — Visual Consistency**  
Dashboard cards and sections must use consistent spacing, alignment, typography, borders, and control placement in accordance with the existing Project Ledger design system.

**NFR-011 — Accessibility**  
The month selector, Active Bills summary, bill rows, and navigation actions must be operable using a keyboard.

**NFR-012 — Accessible Labels**  
Interactive controls must include clear visible labels or accessible names that describe their purpose.

**NFR-013 — Focus Visibility**  
Keyboard focus must be visibly identifiable on all interactive Dashboard controls.

**NFR-014 — Color Independence**  
Bill status and interactive state must not be communicated through color alone.

**NFR-015 — Maintainability**  
Month-range configuration, Active Bills calculation logic, and Dashboard-to-Bills routing logic must be centralized or reusable where practical.

**NFR-016 — Separation of Concerns**  
Dashboard presentation components must not independently recreate Bills workspace business logic when a shared service, repository, or calculation utility is available.

**NFR-017 — Error Handling**  
When Dashboard bill data cannot be retrieved, the affected widget must display a clear error state without causing the entire Dashboard to fail.

**NFR-018 — Empty-State Handling**  
When no active bills or upcoming bills exist, the relevant section must display a clear empty-state message rather than a blank area or misleading zero-value presentation.

**NFR-019 — Security**  
Dashboard navigation and bill-data retrieval must respect the application’s existing authentication and authorization controls.

**NFR-020 — Data Isolation**  
The Dashboard must display only bill records associated with the authenticated user or authorized account context.

**NFR-021 — Browser Compatibility**  
The enhancement must function in the current supported versions of Chrome, Edge, Safari, and Firefox.

**NFR-022 — Regression Protection**  
The enhancement must not disrupt existing Dashboard widgets, Bills workspace functionality, account navigation, or savings-goal functionality.

**NFR-023 — Testability**  
The month selector, Active Bills calculation, widget navigation, empty states, and responsive layout behavior must be verifiable through automated or documented functional testing.

**NFR-024 — Production Readiness**  
No development-only labels, test values, placeholder content, or diagnostic controls may appear in the production Dashboard.

**NFR-025 — Observability**  
Failures involving Dashboard data retrieval or Dashboard-to-Bills navigation must be recorded through the application’s approved logging or monitoring mechanism.

## Traceability Matrix

| Business Requirement | Supporting Business Rules | Supporting Functional Requirements | Supporting Non-Functional Requirements |
|---|---|---|---|
| BR-001 — Month-Based Dashboard Review | RULE-001, RULE-002, RULE-003, RULE-004 | FR-001–FR-007 | NFR-001, NFR-002, NFR-006, NFR-015 |
| BR-002 — Active Bills Visibility | RULE-005, RULE-006, RULE-007, RULE-008 | FR-008–FR-019 | NFR-003, NFR-004, NFR-017, NFR-018 |
| BR-003 — Bills Workspace Access | RULE-009 | FR-016, FR-020–FR-030 | NFR-005, NFR-011–NFR-013, NFR-019, NFR-020 |
| BR-004 — Efficient Dashboard Layout | — | FR-031–FR-040 | NFR-007–NFR-010, NFR-021, NFR-022 |
| BR-005 — Consistent Bill Information | RULE-005, RULE-006, RULE-010 | FR-010–FR-012, FR-018–FR-019, FR-025–FR-029 | NFR-003, NFR-004, NFR-015, NFR-016, NFR-023–NFR-025 |

## Acceptance Criteria

### Month Selector

**AC-001**  
Given the user opens the Dashboard, when the month selector is displayed, then it contains every month from April 2026 through December 2026.

**AC-002**  
Given the current month is August 2026, when the Dashboard opens, then August 2026 is selected by default.

**AC-003**  
Given the user selects June 2026, when the selection is completed, then all month-dependent Dashboard information updates to June 2026.

**AC-004**  
Given the user changes the selected month, when the Dashboard updates, then a manual browser refresh is not required.

**AC-005**  
Given the user opens the month selector, when reviewing the choices, then no month outside April through December 2026 is displayed for this release.

### Active Bills Summary

**AC-006**  
Given the Dashboard loads, when the statistics row is displayed, then the separate top-level Active Bills card is no longer present.

**AC-007**  
Given the Dashboard loads, when the **Bills Due in the Next 7 Days** section is displayed, then an Active Bills summary appears within that section.

**AC-008**  
Given four Bills Master records are active for August 2026, when August 2026 is selected, then the Active Bills summary displays `4`.

**AC-009**  
Given a bill begins in September 2026, when August 2026 is selected, then that bill is not included in the August Active Bills count.

**AC-010**  
Given a bill is marked inactive, when the Active Bills count is calculated, then that bill is excluded.

**AC-011**  
Given the user changes the selected month, when the Dashboard updates, then the Active Bills count is recalculated for the newly selected month.

**AC-012**  
Given the Active Bills summary is displayed, when the user reads its supporting text, then the text does not describe the value as bills paid during the month.

### Bills Workspace Navigation

**AC-013**  
Given the user selects the Active Bills summary, when navigation completes, then the Bills workspace opens.

**AC-014**  
Given the user selects **View All Bills**, when navigation completes, then the full Bills workspace opens.

**AC-015**  
Given the user selects an individual bill row, when record-level navigation is supported, then the corresponding bill record opens or is highlighted.

**AC-016**  
Given a Dashboard link applies an Active filter, when the Bills workspace opens, then the active filter is visibly identified.

**AC-017**  
Given an automatic filter is applied, when the user selects the clear-filter control, then the full Bills Master list is displayed.

**AC-018**  
Given a reporting month is selected on the Dashboard, when the user navigates to the Bills workspace, then the selected month is preserved where month-based routing is supported.

### Layout Spacing

**AC-019**  
Given the Dashboard is displayed on a standard desktop screen, when the page renders, then the excessive blank space between navigation and Dashboard content is removed or materially reduced.

**AC-020**  
Given the layout is revised, when the Dashboard renders, then the content does not overlap the left navigation.

**AC-021**  
Given the Dashboard is displayed at a supported desktop width, when the page renders, then no unnecessary horizontal scrollbar appears.

**AC-022**  
Given the browser window is resized, when the screen width decreases, then Dashboard cards reorganize without becoming unreadable.

**AC-023**  
Given the spacing enhancement is deployed, when existing Dashboard actions are tested, then the month selector, bill links, and navigation controls remain functional.

**AC-024**  
Given multiple Dashboard cards appear in the same row, when the page renders, then the cards have consistent alignment and spacing.

## Approved Implementation Decisions

**ID-001 — Central Time Greeting**  
Dashboard greeting logic must use the `America/Chicago` time zone so morning, afternoon, and evening reflect the user’s Central Time location, including daylight-saving transitions.

**ID-002 — Transaction Action Deferred**  
The nonfunctional **Add Transaction** button must be removed until a dedicated manual transaction-entry workflow and valid route are implemented.

**ID-003 — Simplified Account Entry**  
Account entry must capture only the bank name and whether the account is Checking or Savings. Account name, full account number, last four digits, and Credit Card account type are not required for this workflow.

**ID-004 — Requirements Synchronization**  
Any approved behavioral or scope change must update the applicable README in the same branch and pull request as the code and tests.

## Approval

All requirements sections in this document have been reviewed and approved by the product owner.

## Change Log

| Version | Date | Change | Status |
|---|---|---|---|
| 1.0 | August 4, 2026 | Consolidated approved Dashboard enhancement requirements | Approved |
| 1.1 | August 4, 2026 | Added approved Central Time, transaction-action, simplified account-entry, and README synchronization decisions | Approved |
