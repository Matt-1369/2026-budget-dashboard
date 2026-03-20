export type Token = "SUI" | "DEEP" | "NS" | "Walrus";

export type ApprovalStatus = "confirmed" | "draft" | "pending";
export type MappingConfidence = "high" | "medium" | "low" | "pending";

export interface BudgetMasterRow {
  id: string;
  year: number;
  token: Token;
  budget_program: string;
  incentive_program: string | null;
  yearly_budget: number | null;
  active_flag: boolean;
  budget_version: string;
  approval_status: ApprovalStatus;
  notes?: string;
}

export interface PeriodCalendarRow {
  period_id: string;
  year: number;
  period_index: number;
  label: string;
  start_date: string;
  end_date: string;
  month_label: string;
}

export interface RawActualDetailRow {
  id: string;
  token_raw: string;
  program_raw: string;
  protocol_raw: string;
  pool_raw: string;
  amount: number;
  period_id: string;
  period_start: string;
  period_end: string;
  transaction_date: string;
  metadata: Record<string, string>;
}

export interface MappingTableRow {
  id: string;
  token_raw: string | null;
  program_raw: string | null;
  protocol_raw: string | null;
  pool_raw: string | null;
  mapped_token: Token | null;
  mapped_budget_program: string | null;
  mapped_incentive_program: string | null;
  mapped_reporting_bucket: string | null;
  active_flag: boolean;
  confidence: MappingConfidence;
  notes?: string;
}

export interface ReportConfig {
  report_year: number;
  default_period_count: number;
  in_scope_tokens: Token[];
  pending_tokens: Token[];
  enabled_program_breakdown: Token[];
  visible_month_labels: string[] | null;
  visible_period_ids: string[] | null;
  current_month_label: string;
  current_period_index: number;
}

export interface BudgetView {
  annual_budget: number | null;
  monthly_budget: number | null;
  period_budget: number | null;
  approval_status: ApprovalStatus;
  notes?: string;
}

export interface AnnualRollup {
  key: string;
  token: Token;
  reporting_bucket: string;
  annual_budget: number | null;
  actual_ytd: number;
  remaining_budget: number | null;
  variance: number | null;
  variance_pct: number | null;
  current_month_actual: number;
  current_period_actual: number;
  monthly_budget: number | null;
  period_budget: number | null;
  approval_status: ApprovalStatus;
  notes: string[];
}

export interface TimeRollupRow {
  key: string;
  token: Token;
  reporting_bucket: string;
  time_key: string;
  budget: number | null;
  actual: number;
  variance: number | null;
  variance_pct: number | null;
}

export interface ProgramDrilldown {
  annual: AnnualRollup[];
  monthly: TimeRollupRow[];
  period: TimeRollupRow[];
}
