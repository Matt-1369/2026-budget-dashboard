import { dataSourceMode, type DataSourceMode } from "./config";
import {
  budgetMaster as mockBudgetMaster,
  mappingTable as mockMappingTable,
  periodCalendar as mockPeriodCalendar,
  rawActualDetail as mockRawActualDetail,
} from "./mockData";
import enterpriseActualExport from "./enterprise-v1-actuals.json";
import financeBudgetInput from "./finance-v1-budget-input.json";
import type {
  BudgetMasterRow,
  MappingTableRow,
  PeriodCalendarRow,
  RawActualDetailRow,
} from "./types";

interface DashboardInputBundle {
  budgetMaster: BudgetMasterRow[];
  periodCalendar: PeriodCalendarRow[];
  rawActualDetail: RawActualDetailRow[];
  mappingTable: MappingTableRow[];
}

interface FinanceBudgetInputRow {
  id: string;
  year: number;
  token: BudgetMasterRow["token"];
  budget_program: string;
  incentive_program: string | null;
  yearly_budget: number | null;
  active_flag: boolean;
  approval_status: BudgetMasterRow["approval_status"];
  notes?: string;
}

interface FinanceBudgetInputFile {
  sourceNotes: {
    budget_source: string;
    monthly_budget_formula: string;
    period_budget_formula: string;
    report_year: number;
    generated_at_utc: string;
    instructions: string;
  };
  tokenBudgets: FinanceBudgetInputRow[];
  programBudgets: FinanceBudgetInputRow[];
}

interface EnterpriseActualSummaryRow {
  token: string;
  program?: string;
  month_label?: string;
  period_id?: string;
  mapping_status: string;
  actual?: number;
  actual_ytd?: number;
  row_count: number;
}

interface EnterpriseActualExportFile {
  sourceNotes: {
    report_year: number;
    actual_source: string;
    database: string;
    generated_at_utc: string;
    native_period_alignment: string;
  };
  periodCalendar: PeriodCalendarRow[];
  rawActualDetail: RawActualDetailRow[];
  mappingTable: MappingTableRow[];
  summaries: {
    monthlyByTokenProgram: EnterpriseActualSummaryRow[];
    periodByTokenProgram: EnterpriseActualSummaryRow[];
    ytdByToken: EnterpriseActualSummaryRow[];
  };
}

interface ReviewNote {
  title: string;
  bullets: string[];
}

export interface DashboardDataSource {
  mode: DataSourceMode;
  badgeLabel: string;
  budgetFallbackLabel: string;
  footerPendingNote: string;
  reviewNote: ReviewNote | null;
  input: DashboardInputBundle;
}

const mockInput: DashboardInputBundle = {
  budgetMaster: mockBudgetMaster,
  periodCalendar: mockPeriodCalendar,
  rawActualDetail: mockRawActualDetail,
  mappingTable: mockMappingTable,
};

function buildBudgetMasterFromFinanceInput(
  input: FinanceBudgetInputFile,
): BudgetMasterRow[] {
  return [...input.tokenBudgets, ...input.programBudgets].map((row) => ({
    id: row.id,
    year: row.year,
    token: row.token,
    budget_program: row.budget_program,
    incentive_program: row.incentive_program,
    yearly_budget: row.yearly_budget,
    active_flag: row.active_flag,
    budget_version: "v1_edwin_finance_confirmed_input",
    approval_status: row.approval_status,
    notes: row.notes,
  }));
}

const typedEnterpriseActualExport =
  enterpriseActualExport as unknown as EnterpriseActualExportFile;
const typedFinanceBudgetInput =
  financeBudgetInput as unknown as FinanceBudgetInputFile;

const enterpriseReviewInput: DashboardInputBundle = {
  budgetMaster: buildBudgetMasterFromFinanceInput(typedFinanceBudgetInput),
  periodCalendar: typedEnterpriseActualExport.periodCalendar,
  rawActualDetail: typedEnterpriseActualExport.rawActualDetail,
  mappingTable: typedEnterpriseActualExport.mappingTable,
};

const confirmedTokenBudgetCount = typedFinanceBudgetInput.tokenBudgets.filter(
  (row) => row.yearly_budget !== null,
).length;
const confirmedProgramBudgetCount = typedFinanceBudgetInput.programBudgets.filter(
  (row) => row.yearly_budget !== null,
).length;

const dataSources: Record<DataSourceMode, DashboardDataSource> = {
  mock: {
    mode: "mock",
    badgeLabel: "Mock data",
    budgetFallbackLabel: "Pending confirmation",
    footerPendingNote: "Also pending: period count, DEEP hierarchy, OBL mappings",
    reviewNote: null,
    input: mockInput,
  },
  enterprise_review: {
    mode: "enterprise_review",
    badgeLabel: "Enterprise review",
    budgetFallbackLabel: "Finance input not loaded",
    footerPendingNote:
      "Confirmed v1 model: budget = Edwin / Finance confirmed input; actual = SQL equivalent to OBL All Historical Summary.",
    reviewNote: {
      title: "Enterprise staging review with v1 confirmed sources",
      bullets: [
        `Budget source for 2026 is Edwin / Finance confirmed input via src/finance-v1-budget-input.json.`,
        `Actual source for 2026 is SQL via src/enterprise-v1-actuals.json, internally confirmed equivalent to OBL All Historical Summary.`,
        "Monthly budget is derived as annual budget / 12, and period budget is derived as annual budget / 26.",
        `Enterprise-native periods remain aligned through ${typedEnterpriseActualExport.sourceNotes.native_period_alignment}.`,
        "Deeptrade remains visible as unmapped raw activity.",
        `Confirmed budgets loaded locally: ${confirmedTokenBudgetCount} token-level, ${confirmedProgramBudgetCount} program-level.`,
      ],
    },
    input: enterpriseReviewInput,
  },
};

export const activeDataSource = dataSources[dataSourceMode];
