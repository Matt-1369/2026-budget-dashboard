import { reportConfig } from "./config";
import type {
  AnnualRollup,
  BudgetMasterRow,
  BudgetView,
  MappingTableRow,
  PeriodCalendarRow,
  ProgramDrilldown,
  RawActualDetailRow,
  TimeRollupRow,
  Token,
} from "./types";

interface NormalizedActual {
  id: string;
  token: Token | null;
  reporting_bucket: string;
  amount: number;
  month_label: string;
  period_id: string;
  mapped: boolean;
}

export interface ReportDataSet {
  summary: AnnualRollup[];
  drilldownByToken: Record<string, ProgramDrilldown>;
  unmappedCount: number;
}

function getVisibleMonthLabels(
  normalizedActuals: NormalizedActual[],
  periodCalendar: PeriodCalendarRow[],
): string[] {
  if (reportConfig.visible_month_labels !== null) {
    return reportConfig.visible_month_labels;
  }

  const monthLabels = new Set(periodCalendar.map((period) => period.month_label));

  for (const actual of normalizedActuals) {
    monthLabels.add(actual.month_label);
  }

  return Array.from(monthLabels);
}

function getVisiblePeriodIds(periodCalendar: PeriodCalendarRow[]): string[] {
  if (reportConfig.visible_period_ids !== null) {
    return reportConfig.visible_period_ids;
  }

  return periodCalendar.map((period) => period.period_id);
}

function isMappingMatch(rawValue: string, mappingValue: string | null): boolean {
  return mappingValue === null || rawValue === mappingValue;
}

function findMapping(
  actual: RawActualDetailRow,
  mappingTable: MappingTableRow[],
): MappingTableRow | undefined {
  return mappingTable.find((mapping) => {
    if (!mapping.active_flag) {
      return false;
    }

    return (
      isMappingMatch(actual.token_raw, mapping.token_raw) &&
      isMappingMatch(actual.program_raw, mapping.program_raw) &&
      isMappingMatch(actual.protocol_raw, mapping.protocol_raw) &&
      isMappingMatch(actual.pool_raw, mapping.pool_raw)
    );
  });
}

function buildBudgetView(
  budgetRow: BudgetMasterRow | undefined,
  periodCount: number,
): BudgetView {
  if (!budgetRow) {
    return {
      annual_budget: null,
      monthly_budget: null,
      period_budget: null,
      approval_status: "pending",
      notes: "Pending confirmation",
    };
  }

  const annualBudget = budgetRow.yearly_budget;

  return {
    annual_budget: annualBudget,
    monthly_budget: annualBudget === null ? null : annualBudget / 12,
    period_budget: annualBudget === null ? null : annualBudget / periodCount,
    approval_status: budgetRow.approval_status,
    notes: budgetRow.notes,
  };
}

function normalizeActuals(
  actuals: RawActualDetailRow[],
  mappingTable: MappingTableRow[],
  periodCalendar: PeriodCalendarRow[],
): { rows: NormalizedActual[]; unmappedCount: number } {
  const periodsById = new Map(periodCalendar.map((period) => [period.period_id, period]));

  const rows = actuals.map((actual) => {
    const mapping = findMapping(actual, mappingTable);
    const period = periodsById.get(actual.period_id);

    return {
      id: actual.id,
      token: mapping?.mapped_token ?? null,
      reporting_bucket: mapping?.mapped_reporting_bucket ?? "Unmapped",
      amount: actual.amount,
      month_label: period?.month_label ?? "Unknown",
      period_id: actual.period_id,
      mapped: Boolean(mapping?.mapped_token),
    };
  });

  return {
    rows,
    unmappedCount: rows.filter((row) => !row.mapped).length,
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function ratio(numerator: number, denominator: number | null): number | null {
  if (denominator === null || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

function buildSummaryRollups(
  budgets: BudgetMasterRow[],
  normalizedActuals: NormalizedActual[],
): AnnualRollup[] {
  return reportConfig.in_scope_tokens.map((token) => {
    const tokenBudgetRows = budgets.filter(
      (budget) => budget.token === token && budget.active_flag,
    );
    const tokenBudgetRow = tokenBudgetRows.find((budget) => budget.incentive_program === null);
    const fallbackBudgetRow = tokenBudgetRow ?? tokenBudgetRows[0];
    const budgetView = buildBudgetView(
      fallbackBudgetRow,
      reportConfig.default_period_count,
    );

    const tokenActualRows = normalizedActuals.filter((actual) => actual.token === token);
    const actualYtd = sum(tokenActualRows.map((row) => row.amount));
    const currentMonthActual = sum(
      tokenActualRows
        .filter((row) => row.month_label === reportConfig.current_month_label)
        .map((row) => row.amount),
    );
    const currentPeriodActual = sum(
      tokenActualRows
        .filter((row) => row.period_id === `P${String(reportConfig.current_period_index).padStart(2, "0")}`)
        .map((row) => row.amount),
    );

    return {
      key: token,
      token,
      reporting_bucket: token,
      annual_budget: budgetView.annual_budget,
      actual_ytd: actualYtd,
      remaining_budget:
        budgetView.annual_budget === null ? null : budgetView.annual_budget - actualYtd,
      variance:
        budgetView.annual_budget === null ? null : actualYtd - budgetView.annual_budget,
      variance_pct: ratio(
        actualYtd - (budgetView.annual_budget ?? 0),
        budgetView.annual_budget,
      ),
      current_month_actual: currentMonthActual,
      current_period_actual: currentPeriodActual,
      monthly_budget: budgetView.monthly_budget,
      period_budget: budgetView.period_budget,
      approval_status: budgetView.approval_status,
      notes: [budgetView.notes ?? "Pending confirmation"],
    };
  });
}

function buildTimeRollupRows(
  token: Token,
  buckets: string[],
  budgetMap: Map<string, BudgetMasterRow>,
  normalizedActuals: NormalizedActual[],
  timeKeys: string[],
  keyField: "month_label" | "period_id",
): TimeRollupRow[] {
  return buckets.flatMap((bucket) => {
    const budgetView = buildBudgetView(
      budgetMap.get(bucket),
      reportConfig.default_period_count,
    );

    return timeKeys.map((timeKey) => {
      const actual = sum(
        normalizedActuals
          .filter(
            (row) =>
              row.token === token &&
              row.reporting_bucket === bucket &&
              row[keyField] === timeKey,
          )
          .map((row) => row.amount),
      );

      const budget =
        keyField === "month_label" ? budgetView.monthly_budget : budgetView.period_budget;

      return {
        key: `${bucket}-${timeKey}`,
        token,
        reporting_bucket: bucket,
        time_key: timeKey,
        budget,
        actual,
        variance: budget === null ? null : actual - budget,
        variance_pct: ratio(actual - (budget ?? 0), budget),
      };
    });
  });
}

function buildDrilldown(
  budgets: BudgetMasterRow[],
  normalizedActuals: NormalizedActual[],
  periodCalendar: PeriodCalendarRow[],
): Record<string, ProgramDrilldown> {
  const result: Record<string, ProgramDrilldown> = {};
  const visibleMonthLabels = getVisibleMonthLabels(normalizedActuals, periodCalendar);
  const visiblePeriodIds = getVisiblePeriodIds(periodCalendar);

  for (const token of reportConfig.enabled_program_breakdown) {
    const tokenBudgets = budgets.filter((budget) => budget.token === token && budget.active_flag);
    const programBudgets = tokenBudgets.filter((budget) => budget.incentive_program !== null);
    const budgetMap = new Map(
      programBudgets.map((budget) => [budget.incentive_program ?? budget.token, budget]),
    );
    const buckets = Array.from(
      new Set([
        ...programBudgets.map((budget) => budget.incentive_program ?? budget.token),
        ...normalizedActuals
          .filter((actual) => actual.token === token && actual.reporting_bucket !== token)
          .map((actual) => actual.reporting_bucket),
      ]),
    );

    const annual = buckets.map((bucket) => {
      const budgetView = buildBudgetView(
        budgetMap.get(bucket),
        reportConfig.default_period_count,
      );
      const bucketActuals = normalizedActuals.filter(
        (actual) => actual.token === token && actual.reporting_bucket === bucket,
      );
      const actualYtd = sum(bucketActuals.map((row) => row.amount));
      const currentMonthActual = sum(
        bucketActuals
          .filter((row) => row.month_label === reportConfig.current_month_label)
          .map((row) => row.amount),
      );
      const currentPeriodActual = sum(
        bucketActuals
          .filter(
            (row) =>
              row.period_id === `P${String(reportConfig.current_period_index).padStart(2, "0")}`,
          )
          .map((row) => row.amount),
      );

      return {
        key: `${token}-${bucket}`,
        token,
        reporting_bucket: bucket,
        annual_budget: budgetView.annual_budget,
        actual_ytd: actualYtd,
        remaining_budget:
          budgetView.annual_budget === null ? null : budgetView.annual_budget - actualYtd,
        variance:
          budgetView.annual_budget === null ? null : actualYtd - budgetView.annual_budget,
        variance_pct: ratio(
          actualYtd - (budgetView.annual_budget ?? 0),
          budgetView.annual_budget,
        ),
        current_month_actual: currentMonthActual,
        current_period_actual: currentPeriodActual,
        monthly_budget: budgetView.monthly_budget,
        period_budget: budgetView.period_budget,
        approval_status: budgetView.approval_status,
        notes: [budgetView.notes ?? "Pending confirmation"],
      };
    });

    result[token] = {
      annual,
      monthly: buildTimeRollupRows(
        token,
        buckets,
        budgetMap,
        normalizedActuals,
        visibleMonthLabels,
        "month_label",
      ),
      period: buildTimeRollupRows(
        token,
        buckets,
        budgetMap,
        normalizedActuals,
        visiblePeriodIds,
        "period_id",
      ),
    };
  }

  return result;
}

export function buildReportDataSet(
  budgets: BudgetMasterRow[],
  actuals: RawActualDetailRow[],
  mappingTable: MappingTableRow[],
  periodCalendar: PeriodCalendarRow[],
): ReportDataSet {
  const normalized = normalizeActuals(actuals, mappingTable, periodCalendar);

  return {
    summary: buildSummaryRollups(budgets, normalized.rows),
    drilldownByToken: buildDrilldown(budgets, normalized.rows, periodCalendar),
    unmappedCount: normalized.unmappedCount,
  };
}
