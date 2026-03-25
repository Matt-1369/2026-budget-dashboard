# Enterprise Review Handoff

## Overview

This branch now reflects the confirmed v1 source-of-truth model for the 2026 dashboard.

- Data source: enterprise staging export
- Budget source: Edwin / Finance confirmed input
- Actual source: SQL, internally confirmed equivalent to OBL All Historical Summary
- Budget formulas: monthly = `annual / 12`, period = `annual / 26`
- Calendar source: enterprise-native periods aligned through `P05`
- Deeptrade: still visible as unmapped raw activity

This branch restores true Budget vs Actual framing in the dashboard while keeping enterprise-native periods and unmapped raw-row visibility.

## Branch Metadata

- Branch name: `truth-review-enterprise-export`

## What This Branch Adds

- Restores Budget vs Actual framing in the dashboard repo
- Keeps the existing data source mode wiring so reviewers can still switch between mock mode and enterprise review mode
- Uses enterprise staging export as the local review data source
- Treats annual budget as Edwin / Finance confirmed input for v1
- Treats actuals as SQL-source values internally confirmed equivalent to OBL All Historical Summary
- Derives monthly budget as `annual / 12`
- Derives period budget as `annual / 26`
- Aligns native periods to the enterprise calendar through `P05`
- Restores annual budget, remaining budget, and variance framing in enterprise review mode
- Keeps Deeptrade visible as unmapped raw activity

## Confirmed In This Branch

- Enterprise review mode reads from the exported enterprise staging JSON
- Budget source-of-truth for 2026 is Edwin / Finance confirmed input
- Actual source-of-truth for 2026 is SQL, internally confirmed equivalent to OBL All Historical Summary
- Monthly budget is derived as annual budget divided by 12
- Period budget is derived as annual budget divided by 26
- The dashboard period configuration is aligned to enterprise-native periods through `P05`
- The current month is aligned to `Mar`
- The current period is aligned to `P05`
- Unmapped raw rows remain visible, including Deeptrade

## Current Local Sample Limitation

- The local budget input layer now lives in `src/finance-v1-budget-input.json`
- Empty budget cells indicate a missing Finance value in the local input file, not blocked source truth
- Walrus payout-readiness coverage is still incomplete in staging and should not be treated as complete operational coverage

## Files Changed On This Branch

- [src/App.tsx](/Users/leowu/Projects/2026-budget-dashboard/src/App.tsx)
- [src/config.ts](/Users/leowu/Projects/2026-budget-dashboard/src/config.ts)
- [src/dataSource.ts](/Users/leowu/Projects/2026-budget-dashboard/src/dataSource.ts)
- [src/enterprise-v1-actuals.json](/Users/leowu/Projects/2026-budget-dashboard/src/enterprise-v1-actuals.json)
- [src/finance-v1-budget-input.json](/Users/leowu/Projects/2026-budget-dashboard/src/finance-v1-budget-input.json)
- [src/styles.css](/Users/leowu/Projects/2026-budget-dashboard/src/styles.css)
- [docs/data-source-review-mode.md](/Users/leowu/Projects/2026-budget-dashboard/docs/data-source-review-mode.md)

## What Owners Need To Provide Next

- Provide the row-level Edwin / Finance annual budget values that should populate the local budget input file
- Decide whether Walrus staging coverage is sufficient for the same review treatment as SUI
- Confirm the enterprise-to-dashboard mapping policy for any remaining unmapped rows beyond Deeptrade
- Decide whether the local budget input file should remain hand-maintained or be generated from a separate Finance export step

## Suggested PR Summary

This branch updates the dashboard to the confirmed v1 source model. Budgets now follow Edwin / Finance confirmed input, actuals follow the SQL source internally confirmed equivalent to OBL All Historical Summary, monthly and period budgets derive from annual values, native periods remain aligned through `P05`, and Deeptrade remains visible as unmapped raw activity.
