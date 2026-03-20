# 2026 Budget Reporting Dashboard Skeleton
## Implementation Brief

### Goal

Build the internal skeleton for a 2026 Budget Reporting Dashboard.

This is not the final production-ready version.
This phase is only for the internal implementation foundation, including:

1. data model
2. page skeleton
3. mock data
4. rollup logic

The output should be structured so that unresolved business assumptions can be filled in later without major refactor.

### Business Context

We need a dashboard for leadership to view Budget vs Actual for 2026 token spending.

The reporting needs to support 3 time views:

1. annual
2. monthly
3. OBL period

The main business question is:

How much budget is remaining for the year?

Actuals will eventually come from the current OBL data flow after the "numbers ready" process.

Version 1 scope is 2026 only.
Do not build historical backfill logic now.

In-scope tokens for version 1:

- SUI
- DEEP
- NS
- Walrus

Known confirmed example inputs:

- SUI annual DeFi incentives budget: 21.6M
- DEEP DeFi incentives budget: 200M
- Moonshots is a confirmed active DEEP program with budget 91.67M

Unconfirmed items must remain configurable or marked as pending:

- NS final budget
- Walrus final budget
- final 2026 period count
- DEEP budget hierarchy details
- legacy program active/inactive status
- final mapping from raw OBL tags to reporting categories

### Hard Rules

Do not hardcode unresolved business assumptions.

Specifically:

- do not hardcode DEEP budget hierarchy as final truth
- do not hardcode all legacy programs as active
- do not assume NS and Walrus budgets are final
- do not assume final period count is guaranteed unless configured
- do not tightly couple raw OBL field names to reporting output without a mapping layer

The implementation should be configuration-friendly.

Where business truth is unknown, use:
- config
- placeholders
- pending states
- mock mappings

### Deliverables for This Phase

Build the following:

1. internal data model or types
2. mock seed data
3. rollup utilities
4. dashboard page skeleton
5. README or implementation note explaining structure and pending assumptions

Do not wait for real backend integration to complete the skeleton.

### Required Data Structures

Create these core structures.

#### 1. budget_master

Purpose:
Store approved or draft reporting budgets for 2026.

Suggested fields:

- id
- year
- token
- budget_program
- incentive_program
- yearly_budget
- monthly_budget
- period_budget
- active_flag
- budget_version
- approval_status
- notes

Requirements:

- must support token-level rows
- must support program-level rows
- must allow DEEP to have multiple budget layers
- monthly_budget can be derived from yearly_budget / 12
- period_budget should be derived from yearly_budget / configurable_period_count

#### 2. period_calendar

Purpose:
Represent the 2026 OBL operating periods.

Suggested fields:

- period_id
- year
- period_index
- label
- start_date
- end_date
- month_label

Requirements:

- generate from config if needed
- make period count configurable
- do not hardcode final business truth if not confirmed

#### 3. raw_actual_detail

Purpose:
Hold raw actual records from OBL-like source data.

Suggested fields:

- id
- token_raw
- program_raw
- protocol_raw
- pool_raw
- amount
- period_id
- period_start
- period_end
- transaction_date
- metadata

Requirements:

- keep raw fields raw
- do not directly use raw values in UI summary without mapping

#### 4. mapping_table

Purpose:
Map raw OBL-like fields into reporting categories.

Suggested fields:

- id
- token_raw
- program_raw
- protocol_raw
- pool_raw
- mapped_token
- mapped_budget_program
- mapped_incentive_program
- mapped_reporting_bucket
- active_flag
- confidence
- notes

Requirements:

- this layer must exist
- rollup logic must depend on this layer
- unknown mappings should be supported as pending or unmapped

### Derived Metrics / Rollup Logic

Build reusable rollup functions for the following.

#### Annual level
For each token or reporting bucket:

- annual_budget
- actual_ytd
- remaining_budget = annual_budget - actual_ytd
- variance = actual_ytd - annual_budget
- variance_pct

#### Monthly level
For each token or reporting bucket by month:

- monthly_budget
- monthly_actual
- monthly_variance
- monthly_variance_pct

#### Period level
For each token or reporting bucket by OBL period:

- period_budget
- period_actual
- period_variance
- period_variance_pct

Requirements:

- actuals must be rolled up from raw_actual_detail through mapping_table
- support token summary first
- support program-level breakdown where mapping exists
- do not fail if some rows are unmapped
- expose unmapped count or pending state where useful

### Mock Data Requirements

Create mock data sufficient to render the skeleton UI and test rollups.

Include at least:

#### budget_master mock rows
- SUI / DeFi incentives / 21.6M
- DEEP / DeFi incentives / 200M
- DEEP / Moonshots / 91.67M
- NS / pending budget
- Walrus / pending budget

#### period_calendar
- generate a sample 2026 period calendar
- keep period count configurable
- default can be 26 for mock purposes, but clearly mark as configurable

#### raw_actual_detail
Create sample actual records across several periods for:
- SUI
- DEEP Main
- Moonshots

Include enough rows to prove rollups work.

#### mapping_table
Map sample raw rows into:
- SUI
- DEEP Main
- Moonshots

Also include at least one unmapped example row to show pending behavior.

### UI Requirements

Build a simple internal dashboard skeleton.

No need for polished final design yet.

#### Page 1: Token Summary

Show one row or card per token.

Minimum fields:

- Token
- Annual Budget
- YTD Actual
- Remaining Budget
- Monthly Budget
- Current Month Actual
- Current Period Budget
- Current Period Actual
- Variance
- Status / Notes

Requirements:

- must render with mock data
- must handle pending budget values gracefully
- if value is unconfirmed, show "Pending confirmation"

#### Page 2: Token Drilldown

Allow viewing one selected token in more detail.

Show:

- program-level rows
- annual / monthly / period budget vs actual
- notes or comments placeholder

For now, use DEEP as the main drilldown example.

Moonshots should appear as a program example.

If program allocation is not confirmed, show placeholder state instead of fake precision.

### Notes / Commentary Support

Add a notes field or commentary placeholder in the UI.

Reason:
leadership may ask why spend increased or decreased for a specific month or period.

Even if the first pass only shows static placeholder text or empty note slots, the structure should be present.

### Configuration Requirements

Create a small config layer for at least:

- report_year
- default_period_count
- in_scope_tokens
- pending_tokens
- enabled_program_breakdown

Do not bury these values deep inside UI components.

### Technical Expectations

Before coding, inspect the existing repo and adapt to the current stack.

Follow the project’s existing conventions for:
- framework
- routing
- styling
- types
- file organization

Do not introduce large new infrastructure unless clearly necessary.

Prefer simple, maintainable implementation.

If the repo already has:
- React / Next.js
- TypeScript
- table components
- chart components

reuse them.

If charts are not already present, tables are enough for this phase.

### Suggested Implementation Order

1. inspect repo structure and identify framework conventions
2. create core types or interfaces
3. create mock seed data
4. create period calendar generator
5. create mapping-aware rollup utilities
6. build token summary page
7. build token drilldown page
8. add pending or unmapped states
9. add README explaining what is confirmed vs configurable

### Acceptance Criteria

This phase is complete when:

1. the app can render a 2026 token summary view from mock data
2. the app can render a token drilldown view for DEEP
3. rollup logic can compute annual, monthly, and period budget vs actual
4. raw actual records are rolled up through mapping_table instead of directly
5. unresolved business items are clearly configurable or marked pending
6. the code structure does not require major refactor once final business inputs arrive

### Nice-to-Have

If easy, add:

- basic unmapped records count
- basic data source status badge
- clear placeholder labels for unconfirmed budgets
- simple filters for token or period

But do not block core progress on these.

### Final Instruction

Prioritize a clean internal skeleton over business completeness.

The main goal is to make the system ready to receive final confirmed inputs later without changing the overall architecture.
