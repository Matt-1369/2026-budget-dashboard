import type { ReportConfig } from "./types";

export type DataSourceMode = "mock" | "enterprise_review";

export const dataSourceMode: DataSourceMode = "enterprise_review";

const mockReportConfig: ReportConfig = {
  report_year: 2026,
  default_period_count: 26,
  in_scope_tokens: ["SUI", "DEEP", "NS", "Walrus"],
  pending_tokens: ["NS", "Walrus"],
  enabled_program_breakdown: ["DEEP"],
  visible_month_labels: null,
  visible_period_ids: null,
  current_month_label: "Mar",
  current_period_index: 6,
};

const enterpriseReviewReportConfig: ReportConfig = {
  report_year: 2026,
  default_period_count: 5,
  in_scope_tokens: ["SUI", "DEEP", "NS", "Walrus"],
  pending_tokens: ["SUI", "DEEP", "NS", "Walrus"],
  enabled_program_breakdown: ["DEEP"],
  visible_month_labels: ["Jan", "Feb", "Mar"],
  visible_period_ids: ["P01", "P02", "P03", "P04", "P05"],
  current_month_label: "Mar",
  current_period_index: 5,
};

export const reportConfig: ReportConfig =
  dataSourceMode === "enterprise_review"
    ? enterpriseReviewReportConfig
    : mockReportConfig;
