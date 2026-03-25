# Data Source Review Mode

This dashboard now supports two local data-source modes:

- `mock`
  - uses `src/mockData.ts`
  - keeps the original skeleton/demo path
- `enterprise_review`
  - uses `src/enterprise-v1-actuals.json` plus `src/finance-v1-budget-input.json`
  - intended for review of the enterprise staging export under the confirmed v1 source model

## How To Switch

Edit [config.ts](/Users/leowu/Projects/2026-budget-dashboard/src/config.ts) and change:

```ts
export const dataSourceMode: DataSourceMode = "enterprise_review";
```

Available values:

- `"mock"`
- `"enterprise_review"`

## How To Refresh The Enterprise Review Inputs

Run:

```bash
npm run export:v1:data
```

This read-only local script will:

- query `postgres_staging` actuals from SQL
- regenerate [enterprise-v1-actuals.json](/Users/leowu/Projects/2026-budget-dashboard/src/enterprise-v1-actuals.json)
- preserve and extend [finance-v1-budget-input.json](/Users/leowu/Projects/2026-budget-dashboard/src/finance-v1-budget-input.json)
- regenerate [v1-budget-status.md](/Users/leowu/Projects/2026-budget-dashboard/docs/v1-budget-status.md)

## Review Mode Notes

In `enterprise_review` mode:

- budget source-of-truth for 2026 is Edwin / Finance confirmed input
- actual source-of-truth for 2026 is SQL, internally confirmed equivalent to OBL All Historical Summary
- monthly budget is derived as `annual / 12`
- period budget is derived as `annual / 26`
- enterprise-native periods are used, so the current sample aligns to:
  - `current_period_index = 5`
  - `current_month_label = "Mar"`
  - `default_period_count = 5`
- unmapped rows remain visible in the UI, including `Deeptrade`

## Local Budget Caveat

Empty budget cells in enterprise review mode now mean the local
[finance-v1-budget-input.json](/Users/leowu/Projects/2026-budget-dashboard/src/finance-v1-budget-input.json)
has not yet been populated for that row.
