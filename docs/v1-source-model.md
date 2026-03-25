# 2026 Dashboard V1 Source Model

## Confirmed Sources

- Budget source = Edwin / Finance confirmed input
- Actual source = SQL, internally confirmed equivalent to OBL All Historical Summary

## Confirmed Budget Formulas

- Monthly budget = annual budget / 12
- Period budget = annual budget / 26

## Dashboard Interpretation

- The dashboard should use true Budget vs Actual framing for v1
- Annual budget, remaining budget, and variance are valid dashboard concepts for v1
- Enterprise-native periods remain aligned through `P05` in the current enterprise review export
- Deeptrade remains visible as unmapped raw activity

## Local Budget Input Note

The checked-in
[finance-v1-budget-input.json](/Users/leowu/Projects/2026-budget-dashboard/src/finance-v1-budget-input.json)
is now the local budget input layer for enterprise review mode.

If a row still shows an empty annual budget in the dashboard, that means the local Finance input file has not yet been populated for that row. It does not change the confirmed v1 source model.
