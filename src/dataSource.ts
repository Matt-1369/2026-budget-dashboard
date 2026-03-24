import { dataSourceMode, type DataSourceMode } from "./config";
import {
  budgetMaster as mockBudgetMaster,
  mappingTable as mockMappingTable,
  periodCalendar as mockPeriodCalendar,
  rawActualDetail as mockRawActualDetail,
} from "./mockData";
import enterpriseReviewExport from "./sample-2026-dashboard.json";
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

const enterpriseReviewInput = enterpriseReviewExport as unknown as DashboardInputBundle;

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
    badgeLabel: "Truth-only review",
    budgetFallbackLabel: "Source blocked",
    footerPendingNote:
      "Still blocked: annual budget source, finance-confirmed actual spend, Walrus payout-readiness coverage",
    reviewNote: {
      title: "Enterprise staging truth-only review",
      bullets: [
        "Native calendar periods come from enterprise staging.",
        "Raw USD activity comes from incentive cache usd_value.",
        "Annual budget source is not available in enterprise staging.",
        "Finance-confirmed actual spend is not available in enterprise staging.",
        "Unmapped raw rows remain visible for review, including Deeptrade.",
      ],
    },
    input: enterpriseReviewInput,
  },
};

export const activeDataSource = dataSources[dataSourceMode];
