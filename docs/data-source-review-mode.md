# Data Source Review Mode

This dashboard now supports two local data-source modes:

- `mock`
  - uses `src/mockData.ts`
  - keeps the original skeleton/demo path
- `enterprise_review`
  - uses `src/sample-2026-dashboard.json`
  - intended for review of the exported enterprise staging contract

## How To Switch

Edit [config.ts](/Users/leowu/Projects/2026-budget-dashboard/src/config.ts) and change:

```ts
export const dataSourceMode: DataSourceMode = "enterprise_review";
```

Available values:

- `"mock"`
- `"enterprise_review"`

## Review Mode Notes

In `enterprise_review` mode:

- annual budgets remain source-blocked, so `yearly_budget` stays `null`
- actuals are loaded from the enterprise export and remain assumption-based
- enterprise-native periods are used, so the current sample aligns to:
  - `current_period_index = 5`
  - `current_month_label = "Mar"`
  - `default_period_count = 5`
- unmapped rows remain visible in the UI, including `Deeptrade`
