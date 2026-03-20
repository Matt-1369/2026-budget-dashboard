# 2026 Budget Reporting Dashboard Skeleton

Minimal React + TypeScript scaffold for the internal 2026 budget reporting dashboard described in [2026_budget_dashboard_skeleton_brief.md](./2026_budget_dashboard_skeleton_brief.md).

## File Structure

- `src/config.ts`: configurable reporting inputs such as year, period count, in-scope tokens, and drilldown-enabled tokens
- `src/types.ts`: core data structures for `budget_master`, `period_calendar`, `raw_actual_detail`, and `mapping_table`
- `src/periods.ts`: configurable 2026 period calendar generator
- `src/mockData.ts`: mock budgets, raw actuals, mapping rows, and generated period calendar
- `src/rollups.ts`: mapping-aware annual, monthly, and period rollup utilities
- `src/App.tsx`: table-first token summary and DEEP drilldown UI

## Run Locally

1. Install dependencies with `npm install`
2. Start the local app with `npm run dev`
3. Build for production-style output with `npm run build`

## Confirmed Inputs

- SUI annual DeFi incentives budget: `21.6M`
- DEEP DeFi incentives budget example: `200M`
- Moonshots confirmed active DEEP program: `91.67M`
- Mock period calendar defaults to `26` periods, but remains configurable

## Pending or Configurable Inputs

- NS final budget
- Walrus final budget
- Final 2026 period count
- DEEP hierarchy details beyond the example rows
- Final raw OBL to reporting category mapping
- Legacy program active/inactive treatment

## Implementation Notes

- Unresolved business truth is not hardcoded as final truth; pending values render as `Pending confirmation`.
- Actuals are rolled up through `mapping_table` before they appear in summary or drilldown views.
- One mock raw actual row is intentionally left unmapped so pending mapping behavior stays visible.
