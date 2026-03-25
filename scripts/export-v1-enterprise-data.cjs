#!/usr/bin/env node

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const DASHBOARD_ROOT = path.join(__dirname, "..");
const ENTERPRISE_BACKEND_ROOT = "/Applications/enterprise/backend";
const dotenv = require(path.join(ENTERPRISE_BACKEND_ROOT, "node_modules/dotenv"));
const { Client } = require(path.join(ENTERPRISE_BACKEND_ROOT, "node_modules/pg"));

const REPORT_YEAR = 2026;
const DASHBOARD_TOKEN_ORDER = ["SUI", "DEEP", "NS", "Walrus"];
const SOURCE_CONFIGS = [
  {
    key: "sui",
    cacheTable: "sui_incentives_cache",
    mappingTable: "sui_incentives_protocol_organization_mappings",
  },
  {
    key: "walrus",
    cacheTable: "walrus_incentives_cache",
    mappingTable: "walrus_incentives_protocol_organization_mappings",
  },
];

const OUTPUT_ACTUALS_PATH = path.join(
  DASHBOARD_ROOT,
  "src",
  "enterprise-v1-actuals.json",
);
const OUTPUT_BUDGET_INPUT_PATH = path.join(
  DASHBOARD_ROOT,
  "src",
  "finance-v1-budget-input.json",
);
const OUTPUT_BUDGET_STATUS_PATH = path.join(
  DASHBOARD_ROOT,
  "docs",
  "v1-budget-status.md",
);

dotenv.config({ path: path.join(ENTERPRISE_BACKEND_ROOT, ".env") });

function sanitizeIdPart(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown"
  );
}

function monthLabelFromDate(dateString) {
  return new Date(`${dateString}T00:00:00Z`).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

function mapDashboardToken(rawToken) {
  const upper = String(rawToken || "").trim().toUpperCase();

  if (upper === "SUI") return "SUI";
  if (upper === "DEEP") return "DEEP";
  if (upper === "NS" || upper === "SUINS") return "NS";
  if (upper === "WAL") return "Walrus";
  return null;
}

function getProgramRaw(incentiveProgram, budgetProgram) {
  if (incentiveProgram && incentiveProgram.trim()) {
    return {
      value: incentiveProgram.trim(),
      source: "incentive_program",
    };
  }

  if (budgetProgram && budgetProgram.trim()) {
    return {
      value: budgetProgram.trim(),
      source: "fallback_budget_program",
    };
  }

  return {
    value: "Unknown",
    source: "fallback_unknown",
  };
}

function getProtocolRaw(parentProtocolName, protocolName) {
  if (parentProtocolName && parentProtocolName.trim()) {
    return parentProtocolName.trim();
  }

  if (protocolName && protocolName.trim()) {
    return protocolName.trim();
  }

  return "Unknown";
}

function getPoolRaw(protocolName, protocolRaw) {
  if (protocolName && protocolName.trim()) {
    return protocolName.trim();
  }

  return protocolRaw;
}

function buildNativePeriod(start, end) {
  return `${start}_${end}`;
}

function sortDashboardTokens(tokens) {
  const unique = Array.from(new Set(tokens));
  return unique.sort(
    (left, right) =>
      DASHBOARD_TOKEN_ORDER.indexOf(left) - DASHBOARD_TOKEN_ORDER.indexOf(right),
  );
}

function isMappingMatch(rawValue, mappingValue) {
  return mappingValue === null || rawValue === mappingValue;
}

function findMapping(actual, mappingRows) {
  return mappingRows.find((mapping) => {
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

async function getProgramMetadataByTable(client, cacheTables) {
  const query = `
    SELECT
      p.id::text AS program_id,
      p.name AS program_name,
      pds.table_name
    FROM programs p
    INNER JOIN program_data_sources pds
      ON p.id = pds.program_id
    WHERE pds.data_source_type = 'incentive_data'
      AND pds.table_name = ANY($1::text[])
  `;

  const result = await client.query(query, [cacheTables]);
  const tableToProgram = new Map();

  for (const row of result.rows) {
    tableToProgram.set(row.table_name, {
      programId: row.program_id,
      programName: row.program_name,
    });
  }

  return tableToProgram;
}

async function getMappedProtocolSet(client, sourceConfig, programId) {
  const query = `
    SELECT DISTINCT TRIM(parent_protocol_name) AS parent_protocol_name
    FROM ${sourceConfig.mappingTable}
    WHERE program_id = $1::uuid
      AND parent_protocol_name IS NOT NULL
      AND TRIM(parent_protocol_name) <> ''
  `;

  const result = await client.query(query, [programId]);
  return new Set(result.rows.map((row) => row.parent_protocol_name));
}

async function getCacheRows(client, sourceConfig) {
  const query = `
    SELECT
      c.id::text AS source_row_id,
      c.budget_program,
      c.incentive_program,
      c.protocol_name,
      c.parent_protocol_name,
      c.token_symbol,
      c.usd_value::text AS usd_value,
      TO_CHAR(c.start_timestamp::date, 'YYYY-MM-DD') AS period_start,
      TO_CHAR(c.end_timestamp::date, 'YYYY-MM-DD') AS period_end
    FROM ${sourceConfig.cacheTable} c
    WHERE c.start_timestamp >= DATE '${REPORT_YEAR}-01-01'
      AND c.start_timestamp < DATE '${REPORT_YEAR + 1}-01-01'
    ORDER BY
      c.start_timestamp,
      c.end_timestamp,
      COALESCE(c.parent_protocol_name, c.protocol_name),
      c.protocol_name,
      c.token_symbol,
      c.id
  `;

  const result = await client.query(query);
  return result.rows;
}

function prepareRows(sourceConfig, programMetadata, mappedProtocols, cacheRows) {
  return cacheRows.map((row) => {
    const tokenRaw = String(row.token_symbol || "UNKNOWN").trim();
    const { value: programRaw, source: programRawSource } = getProgramRaw(
      row.incentive_program,
      row.budget_program,
    );
    const protocolRaw = getProtocolRaw(row.parent_protocol_name, row.protocol_name);
    const poolRaw = getPoolRaw(row.protocol_name, protocolRaw);
    const nativePeriod = buildNativePeriod(row.period_start, row.period_end);
    const mappedTokenCandidate = mapDashboardToken(tokenRaw);
    const isProtocolMapped =
      protocolRaw !== "Unknown" && mappedProtocols.has(protocolRaw);

    let unmappedReason = "none";
    if (protocolRaw === "Unknown") {
      unmappedReason = "unknown_protocol";
    } else if (!mappedTokenCandidate) {
      unmappedReason = "unsupported_token_symbol";
    } else if (!isProtocolMapped) {
      unmappedReason = "missing_protocol_organization_mapping";
    }

    return {
      sourceKey: sourceConfig.key,
      sourceTable: sourceConfig.cacheTable,
      enterpriseProgram: programMetadata.programName,
      sourceRowId: row.source_row_id,
      tokenRaw,
      budgetProgram: row.budget_program,
      incentiveProgram: row.incentive_program,
      programRaw,
      programRawSource,
      protocolRaw,
      poolRaw,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      nativePeriod,
      amount: Number.parseFloat(row.usd_value || "0"),
      mappedTokenCandidate,
      isProtocolMapped,
      mappingStatus:
        mappedTokenCandidate && isProtocolMapped ? "mapped" : "unmapped",
      unmappedReason,
    };
  });
}

function buildPeriodCalendar(rows) {
  const uniquePeriods = new Map();

  for (const row of rows) {
    if (!uniquePeriods.has(row.nativePeriod)) {
      uniquePeriods.set(row.nativePeriod, {
        start: row.periodStart,
        end: row.periodEnd,
      });
    }
  }

  const sortedPeriods = Array.from(uniquePeriods.entries())
    .sort((left, right) => {
      const [, leftValue] = left;
      const [, rightValue] = right;

      if (leftValue.start !== rightValue.start) {
        return leftValue.start.localeCompare(rightValue.start);
      }

      if (leftValue.end !== rightValue.end) {
        return leftValue.end.localeCompare(rightValue.end);
      }

      return left[0].localeCompare(right[0]);
    })
    .map(([nativePeriod, value], index) => {
      const periodId = `P${String(index + 1).padStart(2, "0")}`;

      return {
        nativePeriod,
        periodRow: {
          period_id: periodId,
          year: Number.parseInt(value.start.slice(0, 4), 10),
          period_index: index + 1,
          label: `Period ${index + 1}`,
          start_date: value.start,
          end_date: value.end,
          month_label: monthLabelFromDate(value.start),
        },
      };
    });

  return {
    periodCalendar: sortedPeriods.map((entry) => entry.periodRow),
    periodIdByNativePeriod: new Map(
      sortedPeriods.map((entry) => [entry.nativePeriod, entry.periodRow.period_id]),
    ),
  };
}

function buildRawActualDetail(rows, periodIdByNativePeriod) {
  return rows.map((row) => {
    const periodId = periodIdByNativePeriod.get(row.nativePeriod);

    if (!periodId) {
      throw new Error(`Missing period_id for native period ${row.nativePeriod}`);
    }

    const metadata = {
      source_table: row.sourceTable,
      source_row_id: row.sourceRowId,
      enterprise_program: row.enterpriseProgram,
      budget_program: row.budgetProgram || "null",
      incentive_program: row.incentiveProgram || "null",
      program_raw_source: row.programRawSource,
      protocol_variant: row.poolRaw,
      protocol_raw_source: "coalesce(parent_protocol_name,protocol_name)",
      pool_raw_source: "protocol_name",
      native_period: row.nativePeriod,
      period_id_source: "enterprise_native_period_sorted_2026",
      amount_source: "usd_value",
      actual_definition: "v1_sql_confirmed_equivalent_to_obl_all_historical_summary",
      actual_source: "sql_confirmed_equivalent_to_obl_all_historical_summary",
      transaction_date_source: "placeholder_period_end",
      transaction_date_confirmed: "false",
      mapping_status: row.mappingStatus,
      organization_mapping_confirmed: row.isProtocolMapped ? "true" : "false",
      payout_readiness_coverage:
        row.sourceKey === "walrus"
          ? "staging_export_visibility_only_incomplete_payout_readiness"
          : "staging_export_visibility_only",
    };

    if (row.unmappedReason !== "none") {
      metadata.unmapped_reason = row.unmappedReason;
    }

    if (row.sourceKey === "walrus" && row.tokenRaw.toUpperCase() === "WAL") {
      metadata.dashboard_token_mapping = "WAL_to_Walrus";
    }

    return {
      id: `${row.sourceTable}:${row.sourceRowId}`,
      token_raw: row.tokenRaw,
      program_raw: row.programRaw,
      protocol_raw: row.protocolRaw,
      pool_raw: row.poolRaw,
      amount: row.amount,
      period_id: periodId,
      period_start: row.periodStart,
      period_end: row.periodEnd,
      transaction_date: row.periodEnd,
      metadata,
    };
  });
}

function getMappingConfidence(row) {
  if (row.sourceKey === "walrus") {
    return "low";
  }

  if (row.programRawSource !== "incentive_program") {
    return "low";
  }

  return "medium";
}

function buildMappingNote(row, mappedReportingBucket) {
  const parts = [
    "confirmed_protocol_mapping=true",
    `source_table=${row.sourceTable}`,
    "program_raw_source=incentive_program_or_budget_program_fallback",
    "mapped_budget_program=raw_budget_program_passthrough",
    "mapped_incentive_program=raw_incentive_program_passthrough",
    `mapped_reporting_bucket=${mappedReportingBucket === (row.incentiveProgram || "") ? "mapped_incentive_program" : "mapped_token"}`,
  ];

  if (row.programRawSource !== "incentive_program") {
    parts.push(`program_raw_fallback=${row.programRawSource}`);
  }

  if (row.sourceKey === "walrus") {
    parts.push("warning_walrus_payout_readiness=incomplete_staging");
  }

  if (row.tokenRaw.toUpperCase() === "WAL") {
    parts.push("dashboard_token_mapping=WAL_to_Walrus");
  }

  return parts.join("; ");
}

function buildMappingTable(rows) {
  const mappingRows = new Map();

  for (const row of rows) {
    if (!row.mappedTokenCandidate || !row.isProtocolMapped) {
      continue;
    }

    const mappedBudgetProgram = row.budgetProgram && row.budgetProgram.trim()
      ? row.budgetProgram.trim()
      : "Pending";
    const mappedIncentiveProgram =
      row.incentiveProgram && row.incentiveProgram.trim()
        ? row.incentiveProgram.trim()
        : null;
    const mappedReportingBucket =
      mappedIncentiveProgram || row.mappedTokenCandidate;
    const key = [
      row.tokenRaw,
      row.programRaw,
      row.protocolRaw,
      row.poolRaw,
    ].join("|");

    if (!mappingRows.has(key)) {
      mappingRows.set(key, {
        id: `map:${sanitizeIdPart(key)}`,
        token_raw: row.tokenRaw,
        program_raw: row.programRaw,
        protocol_raw: row.protocolRaw,
        pool_raw: row.poolRaw,
        mapped_token: row.mappedTokenCandidate,
        mapped_budget_program: mappedBudgetProgram,
        mapped_incentive_program: mappedIncentiveProgram,
        mapped_reporting_bucket: mappedReportingBucket,
        active_flag: true,
        confidence: getMappingConfidence(row),
        notes: buildMappingNote(row, mappedReportingBucket),
      });
    }
  }

  return Array.from(mappingRows.values()).sort((left, right) => {
    const leftKey = [
      left.mapped_token || "",
      left.mapped_budget_program || "",
      left.mapped_incentive_program || "",
      left.protocol_raw || "",
      left.pool_raw || "",
    ].join("|");
    const rightKey = [
      right.mapped_token || "",
      right.mapped_budget_program || "",
      right.mapped_incentive_program || "",
      right.protocol_raw || "",
      right.pool_raw || "",
    ].join("|");
    return leftKey.localeCompare(rightKey);
  });
}

function buildActualSummaries(rawActualDetail, mappingTable, periodCalendar) {
  const periodsById = new Map(
    periodCalendar.map((period) => [period.period_id, period]),
  );
  const monthlyMap = new Map();
  const periodMap = new Map();
  const ytdMap = new Map();

  for (const row of rawActualDetail) {
    const mapping = findMapping(row, mappingTable);
    const period = periodsById.get(row.period_id);
    const token = mapping && mapping.mapped_token ? mapping.mapped_token : "Unmapped";
    const program =
      mapping && mapping.mapped_reporting_bucket
        ? mapping.mapped_reporting_bucket
        : "Unmapped";
    const mappingStatus = mapping ? "mapped" : "unmapped";
    const monthLabel = period ? period.month_label : "Unknown";

    const monthlyKey = [token, program, monthLabel, mappingStatus].join("|");
    if (!monthlyMap.has(monthlyKey)) {
      monthlyMap.set(monthlyKey, {
        token,
        program,
        month_label: monthLabel,
        mapping_status: mappingStatus,
        actual: 0,
        row_count: 0,
      });
    }
    const monthlyEntry = monthlyMap.get(monthlyKey);
    monthlyEntry.actual += row.amount;
    monthlyEntry.row_count += 1;

    const periodKey = [token, program, row.period_id, mappingStatus].join("|");
    if (!periodMap.has(periodKey)) {
      periodMap.set(periodKey, {
        token,
        program,
        period_id: row.period_id,
        period_start: row.period_start,
        period_end: row.period_end,
        mapping_status: mappingStatus,
        actual: 0,
        row_count: 0,
      });
    }
    const periodEntry = periodMap.get(periodKey);
    periodEntry.actual += row.amount;
    periodEntry.row_count += 1;

    const ytdKey = [token, mappingStatus].join("|");
    if (!ytdMap.has(ytdKey)) {
      ytdMap.set(ytdKey, {
        token,
        mapping_status: mappingStatus,
        actual_ytd: 0,
        row_count: 0,
      });
    }
    const ytdEntry = ytdMap.get(ytdKey);
    ytdEntry.actual_ytd += row.amount;
    ytdEntry.row_count += 1;
  }

  const monthOrder = new Map();
  for (const period of periodCalendar) {
    if (!monthOrder.has(period.month_label)) {
      monthOrder.set(period.month_label, monthOrder.size + 1);
    }
  }

  const tokenWeight = (token) => {
    const idx = DASHBOARD_TOKEN_ORDER.indexOf(token);
    return idx === -1 ? 999 : idx;
  };

  return {
    monthlyByTokenProgram: Array.from(monthlyMap.values()).sort((left, right) => {
      return (
        tokenWeight(left.token) - tokenWeight(right.token) ||
        left.program.localeCompare(right.program) ||
        (monthOrder.get(left.month_label) || 999) -
          (monthOrder.get(right.month_label) || 999) ||
        left.mapping_status.localeCompare(right.mapping_status)
      );
    }),
    periodByTokenProgram: Array.from(periodMap.values()).sort((left, right) => {
      return (
        tokenWeight(left.token) - tokenWeight(right.token) ||
        left.program.localeCompare(right.program) ||
        left.period_id.localeCompare(right.period_id) ||
        left.mapping_status.localeCompare(right.mapping_status)
      );
    }),
    ytdByToken: Array.from(ytdMap.values()).sort((left, right) => {
      return (
        tokenWeight(left.token) - tokenWeight(right.token) ||
        left.mapping_status.localeCompare(right.mapping_status)
      );
    }),
  };
}

async function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(await fsp.readFile(filePath, "utf8"));
}

function mergeBudgetRows(scaffoldRows, existingRows, keyFn) {
  const existingMap = new Map((existingRows || []).map((row) => [keyFn(row), row]));

  return scaffoldRows.map((row) => {
    const existing = existingMap.get(keyFn(row));
    if (!existing) {
      return row;
    }

    return {
      ...row,
      ...existing,
    };
  });
}

function buildBudgetInput(mappingTable, existingBudgetInput) {
  const mappedTokens = sortDashboardTokens(
    mappingTable
      .map((row) => row.mapped_token)
      .filter((token) => token !== null),
  );

  const tokenBudgets = mappedTokens.map((token) => ({
    id: `budget-token-${sanitizeIdPart(token)}`,
    year: REPORT_YEAR,
    token,
    budget_program: "All Programs",
    incentive_program: null,
    yearly_budget: null,
    active_flag: true,
    approval_status: "pending",
    notes: "Fill from Edwin / Finance confirmed annual budget input.",
  }));

  const programBudgets = mappingTable
    .filter(
      (row) =>
        row.mapped_token !== null &&
        row.mapped_budget_program !== null &&
        row.mapped_incentive_program !== null,
    )
    .map((row) => ({
      id: `budget-program-${sanitizeIdPart(
        [row.mapped_token, row.mapped_budget_program, row.mapped_incentive_program].join(":"),
      )}`,
      year: REPORT_YEAR,
      token: row.mapped_token,
      budget_program: row.mapped_budget_program,
      incentive_program: row.mapped_incentive_program,
      yearly_budget: null,
      active_flag: true,
      approval_status: "pending",
      notes: "Optional program-level budget. Populate only when Finance confirms a program allocation.",
    }));

  const dedupedProgramBudgets = Array.from(
    new Map(programBudgets.map((row) => [row.id, row])).values(),
  ).sort((left, right) => {
    return (
      DASHBOARD_TOKEN_ORDER.indexOf(left.token) -
        DASHBOARD_TOKEN_ORDER.indexOf(right.token) ||
      left.budget_program.localeCompare(right.budget_program) ||
      left.incentive_program.localeCompare(right.incentive_program)
    );
  });

  const mergedTokenBudgets = mergeBudgetRows(
    tokenBudgets,
    existingBudgetInput ? existingBudgetInput.tokenBudgets : [],
    (row) => row.token,
  );
  const mergedProgramBudgets = mergeBudgetRows(
    dedupedProgramBudgets,
    existingBudgetInput ? existingBudgetInput.programBudgets : [],
    (row) => `${row.token}|${row.budget_program}|${row.incentive_program || ""}`,
  );

  return {
    sourceNotes: {
      budget_source: "Edwin / Finance confirmed input",
      monthly_budget_formula: "annual / 12",
      period_budget_formula: "annual / 26",
      report_year: REPORT_YEAR,
      generated_at_utc: new Date().toISOString(),
      instructions:
        "Populate yearly_budget only with Edwin / Finance confirmed values. Token-level rows are first-class. Program-level rows are optional and should remain null until confirmed.",
    },
    tokenBudgets: mergedTokenBudgets,
    programBudgets: mergedProgramBudgets,
  };
}

function formatBudgetCurrency(value) {
  return typeof value === "number"
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value)
    : "Pending";
}

function buildBudgetStatusMarkdown(budgetInput, actualExport) {
  const confirmedTokenBudgets = budgetInput.tokenBudgets.filter(
    (row) => row.yearly_budget !== null,
  );
  const pendingTokenBudgets = budgetInput.tokenBudgets.filter(
    (row) => row.yearly_budget === null,
  );
  const confirmedProgramBudgets = budgetInput.programBudgets.filter(
    (row) => row.yearly_budget !== null,
  );
  const pendingProgramBudgets = budgetInput.programBudgets.filter(
    (row) => row.yearly_budget === null,
  );

  const lines = [
    "# V1 Budget Status",
    "",
    "## Source Model",
    "",
    "- Budget source = Edwin / Finance confirmed input",
    "- Actual source = SQL, internally confirmed equivalent to OBL All Historical Summary",
    "- Monthly budget = annual / 12",
    "- Period budget = annual / 26",
    "",
    "## Actual Export",
    "",
    `- Actual rows exported: ${actualExport.rawActualDetail.length}`,
    `- Mapped rows: ${actualExport.rawActualDetail.filter((row) => row.metadata.mapping_status === "mapped").length}`,
    `- Unmapped rows: ${actualExport.rawActualDetail.filter((row) => row.metadata.mapping_status === "unmapped").length}`,
    `- Native periods exported: ${actualExport.periodCalendar.length}`,
    "",
    "## Confirmed Token-Level Budgets Loaded",
    "",
  ];

  if (confirmedTokenBudgets.length === 0) {
    lines.push("- None loaded in the local Finance input file yet.");
  } else {
    for (const row of confirmedTokenBudgets) {
      lines.push(`- ${row.token}: ${formatBudgetCurrency(row.yearly_budget)}`);
    }
  }

  lines.push("", "## Pending Token-Level Budgets", "");

  if (pendingTokenBudgets.length === 0) {
    lines.push("- None.");
  } else {
    for (const row of pendingTokenBudgets) {
      lines.push(`- ${row.token}`);
    }
  }

  lines.push("", "## Confirmed Program-Level Budgets Loaded", "");

  if (confirmedProgramBudgets.length === 0) {
    lines.push("- None loaded in the local Finance input file yet.");
  } else {
    for (const row of confirmedProgramBudgets) {
      lines.push(
        `- ${row.token} / ${row.budget_program} / ${row.incentive_program}: ${formatBudgetCurrency(row.yearly_budget)}`,
      );
    }
  }

  lines.push("", "## Pending Program-Level Budgets", "");

  if (pendingProgramBudgets.length === 0) {
    lines.push("- None.");
  } else {
    for (const row of pendingProgramBudgets) {
      lines.push(`- ${row.token} / ${row.budget_program} / ${row.incentive_program}`);
    }
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- Deeptrade remains visible as unmapped raw activity.",
    "- Empty budget cells in the dashboard now mean the local Finance input file has not been populated for that row yet.",
  );

  return lines.join("\n") + "\n";
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();

  try {
    const programMetadataByTable = await getProgramMetadataByTable(
      client,
      SOURCE_CONFIGS.map((source) => source.cacheTable),
    );
    const preparedRows = [];

    for (const source of SOURCE_CONFIGS) {
      const programMetadata = programMetadataByTable.get(source.cacheTable);

      if (!programMetadata) {
        continue;
      }

      const [mappedProtocols, cacheRows] = await Promise.all([
        getMappedProtocolSet(client, source, programMetadata.programId),
        getCacheRows(client, source),
      ]);

      preparedRows.push(
        ...prepareRows(source, programMetadata, mappedProtocols, cacheRows),
      );
    }

    if (preparedRows.length === 0) {
      throw new Error("No 2026 incentive rows found in postgres_staging.");
    }

    const { periodCalendar, periodIdByNativePeriod } = buildPeriodCalendar(preparedRows);
    const rawActualDetail = buildRawActualDetail(preparedRows, periodIdByNativePeriod);
    const mappingTable = buildMappingTable(preparedRows);
    const summaries = buildActualSummaries(
      rawActualDetail,
      mappingTable,
      periodCalendar,
    );

    const actualExport = {
      sourceNotes: {
        report_year: REPORT_YEAR,
        actual_source:
          "SQL, internally confirmed equivalent to OBL All Historical Summary",
        database: process.env.DB_NAME,
        generated_at_utc: new Date().toISOString(),
        native_period_alignment: `P01-P${String(periodCalendar.length).padStart(2, "0")}`,
      },
      periodCalendar,
      rawActualDetail,
      mappingTable,
      summaries,
    };

    const existingBudgetInput = await readJsonIfExists(OUTPUT_BUDGET_INPUT_PATH);
    const budgetInput = buildBudgetInput(mappingTable, existingBudgetInput);
    const budgetStatusMarkdown = buildBudgetStatusMarkdown(
      budgetInput,
      actualExport,
    );

    await fsp.mkdir(path.dirname(OUTPUT_ACTUALS_PATH), { recursive: true });
    await fsp.mkdir(path.dirname(OUTPUT_BUDGET_STATUS_PATH), { recursive: true });

    await fsp.writeFile(
      OUTPUT_ACTUALS_PATH,
      JSON.stringify(actualExport, null, 2) + "\n",
      "utf8",
    );
    await fsp.writeFile(
      OUTPUT_BUDGET_INPUT_PATH,
      JSON.stringify(budgetInput, null, 2) + "\n",
      "utf8",
    );
    await fsp.writeFile(OUTPUT_BUDGET_STATUS_PATH, budgetStatusMarkdown, "utf8");

    console.log(
      JSON.stringify(
        {
          database: process.env.DB_NAME,
          actualExportPath: OUTPUT_ACTUALS_PATH,
          budgetInputPath: OUTPUT_BUDGET_INPUT_PATH,
          budgetStatusPath: OUTPUT_BUDGET_STATUS_PATH,
          actualRows: rawActualDetail.length,
          mappingRows: mappingTable.length,
          periodRows: periodCalendar.length,
          monthlySummaryRows: summaries.monthlyByTokenProgram.length,
          periodSummaryRows: summaries.periodByTokenProgram.length,
          ytdSummaryRows: summaries.ytdByToken.length,
          confirmedTokenBudgetsLoaded: budgetInput.tokenBudgets.filter(
            (row) => row.yearly_budget !== null,
          ).length,
          confirmedProgramBudgetsLoaded: budgetInput.programBudgets.filter(
            (row) => row.yearly_budget !== null,
          ).length,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
