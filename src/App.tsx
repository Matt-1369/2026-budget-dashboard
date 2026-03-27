import { useMemo, useState } from "react";
import { reportConfig } from "./config";
import { activeDataSource } from "./dataSource";
import { formatCurrency, formatPercent } from "./formatters";
import { buildReportDataSet } from "./rollups";
import type { AnnualRollup, MappingTableRow, RawActualDetailRow, TimeRollupRow, Token } from "./types";

// ─── Helper Components ───────────────────────────────────────────────────────

function isMappingMatch(rawValue: string, mappingValue: string | null): boolean {
  return mappingValue === null || rawValue === mappingValue;
}

function findMapping(
  actual: RawActualDetailRow,
  mappingRows: MappingTableRow[],
): MappingTableRow | undefined {
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

function StatusBadge({ value }: { value: string }) {
  const variant = value.toLowerCase().replace(/\s+/g, "-");
  return <span className={`badge badge-${variant}`}>{value}</span>;
}

function VarianceCell({
  value,
  pct,
  pendingLabel = "Pending confirmation",
}: {
  value: number | null;
  pct: number | null;
  pendingLabel?: string;
}) {
  if (value === null) {
    return (
      <td className="num-col">
        <PendingValue label={pendingLabel} />
      </td>
    );
  }
  const cls = value < 0 ? "variance-negative" : value > 0 ? "variance-positive" : "";
  return (
    <td className="num-col">
      <span className={cls}>{formatCurrency(value)}</span>
      {pct !== null && (
        <div className={`variance-pct ${cls}`}>{formatPercent(pct)}</div>
      )}
    </td>
  );
}

function PendingValue({ label = "Pending confirmation" }: { label?: string }) {
  return <em className="pending-value">{label}</em>;
}

function getExecutiveBudgetFallbackLabel(): string {
  return activeDataSource.budgetFallbackLabel === "Finance input not loaded"
    ? "Awaiting finance input"
    : activeDataSource.budgetFallbackLabel;
}

function CurrencyCell({
  value,
  pendingLabel = "Pending confirmation",
}: {
  value: number | null;
  pendingLabel?: string;
}) {
  if (value === null) {
    return (
      <td className="num-col">
        <PendingValue label={pendingLabel} />
      </td>
    );
  }
  return <td className="num-col">{formatCurrency(value)}</td>;
}

// ─── CollapsibleSection ──────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="collapsible">
      <button className="collapsible-toggle" onClick={() => setIsOpen(!isOpen)}>
        <span className="collapsible-icon">{isOpen ? "−" : "+"}</span>
        <span>{title}</span>
      </button>
      {isOpen && <div className="collapsible-content">{children}</div>}
    </div>
  );
}

function ReviewNotice() {
  if (!activeDataSource.reviewNote) {
    return null;
  }

  return (
    <section className="review-note">
      <div className="review-note-summary">
        <div>
          <div className="review-note-eyebrow">Source Context</div>
          <div className="review-note-title">{activeDataSource.reviewNote.title}</div>
        </div>
        <div className="context-chip-group">
          <span className="context-chip">{activeDataSource.reviewNote.bullets.length} review notes</span>
        </div>
      </div>
      <CollapsibleSection title="Review source assumptions" defaultOpen={false}>
        <ul className="review-note-list">
          {activeDataSource.reviewNote.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </CollapsibleSection>
    </section>
  );
}

// ─── KPI Hero Strip ───────────────────────────────────────────────────────────

interface KPIData {
  totalAnnualBudget: number | null;
  ytdActualSpend: number;
  remainingBudget: number | null;
  budgetUtilization: number | null;
  unmappedRows: number;
}

function KpiCard({
  label,
  value,
  valueClass,
  subtitle,
}: {
  label: string;
  value: string;
  valueClass?: string;
  subtitle?: string;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${valueClass ?? ""}`}>{value}</div>
      {subtitle && <div className="kpi-subtitle">{subtitle}</div>}
    </div>
  );
}

function KpiStrip({ kpis }: { kpis: KPIData }) {
  const compactBudgetFallbackLabel = getExecutiveBudgetFallbackLabel();
  const utilStr =
    kpis.budgetUtilization !== null
      ? `${formatPercent(kpis.budgetUtilization)} utilized`
      : undefined;
  const annualPending = kpis.totalAnnualBudget === null;
  const remainingPending = kpis.remainingBudget === null;
  const remainingStr =
    !remainingPending
      ? formatCurrency(kpis.remainingBudget)
      : compactBudgetFallbackLabel;
  const annualStr =
    !annualPending
      ? formatCurrency(kpis.totalAnnualBudget)
      : compactBudgetFallbackLabel;
  const remainingSubtitle =
    !remainingPending
      ? utilStr
      : "Awaiting local finance annual input for rows still missing a populated budget.";
  const annualSubtitle = annualPending
    ? "Totals stay conservative until missing annual inputs are populated locally."
    : "Current reporting total across rows with populated annual budgets.";

  return (
    <div className="kpi-strip">
      <KpiCard
        label="Annual Budget (Current)"
        value={annualStr}
        valueClass={annualPending ? "kpi-value-pending" : undefined}
        subtitle={annualSubtitle}
      />
      <div className="kpi-divider" />
      <KpiCard label="YTD Actual Spend" value={formatCurrency(kpis.ytdActualSpend)} />
      <div className="kpi-divider" />
      <KpiCard
        label="Remaining Budget"
        value={remainingStr}
        valueClass={remainingPending ? "kpi-value-pending" : undefined}
        subtitle={remainingSubtitle}
      />
    </div>
  );
}

// ─── Token Card Grid ──────────────────────────────────────────────────────────

function TokenCard({
  row,
  onSelect,
  isSelected,
}: {
  row: AnnualRollup;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const isPending = row.annual_budget === null;
  const compactBudgetFallbackLabel = getExecutiveBudgetFallbackLabel();
  const utilization =
    row.annual_budget !== null && row.annual_budget > 0
      ? Math.min(row.actual_ytd / row.annual_budget, 1)
      : null;
  const utilizationPct =
    row.annual_budget !== null && row.annual_budget > 0
      ? row.actual_ytd / row.annual_budget
      : null;

  const currentPeriodLabel = `P${String(reportConfig.current_period_index).padStart(2, "0")}`;

  const varianceClass =
    row.variance !== null
      ? row.variance < 0
        ? "variance-negative"
        : row.variance > 0
        ? "variance-positive"
        : ""
      : "";

  return (
    <div
      className={`token-card${isSelected ? " selected" : ""}${isPending ? " pending-state" : ""}`}
    >
      <div className="token-card-header">
        <button className="link-button token-card-token" onClick={onSelect} type="button">
          {row.token}
        </button>
        <StatusBadge value={row.approval_status} />
      </div>

      {isPending ? (
        <div className="token-card-pending-msg">
          <div className="token-card-pending-label">
            <PendingValue label={compactBudgetFallbackLabel} />
          </div>
          <div className="token-card-pending-summary">
            Annual budget remains unfilled in the local finance input for this row.
          </div>
          <div className="token-card-inline-metrics">
            <span>YTD {formatCurrency(row.actual_ytd)}</span>
            <span>{reportConfig.current_month_label} {formatCurrency(row.current_month_actual)}</span>
            <span>{currentPeriodLabel} {formatCurrency(row.current_period_actual)}</span>
          </div>
          <div className="note token-card-note">
            Actuals still follow the confirmed SQL source used in enterprise review mode.
          </div>
        </div>
      ) : (
        <>
          <div className="token-card-metrics">
            <div className="token-card-metric">
              <div className="token-card-metric-label">Annual Budget</div>
              <div className="token-card-metric-value">
                {formatCurrency(row.annual_budget)}
              </div>
            </div>
            <div className="token-card-metric">
              <div className="token-card-metric-label">Remaining</div>
              <div className="token-card-metric-value">
                {row.remaining_budget !== null
                  ? formatCurrency(row.remaining_budget)
                  : compactBudgetFallbackLabel}
              </div>
            </div>
            <div className="token-card-metric">
              <div className="token-card-metric-label">YTD Actual</div>
              <div className="token-card-metric-value">
                {formatCurrency(row.actual_ytd)}
              </div>
            </div>
          </div>

          {utilization !== null && (
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${(utilization * 100).toFixed(1)}%` }}
              />
            </div>
          )}

          <div className="token-card-period-line">
            {reportConfig.current_month_label} actual:{" "}
            {formatCurrency(row.current_month_actual)} · {currentPeriodLabel} actual:{" "}
            {formatCurrency(row.current_period_actual)}
          </div>

          {row.variance !== null && (
            <div className={`token-card-variance ${varianceClass}`}>
              Variance:{" "}
              {formatCurrency(row.variance)}
              {utilizationPct !== null && (
                <span className="token-card-util-pct">
                  {" "}
                  · {formatPercent(utilizationPct)} utilized
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TokenCardGrid({
  rows,
  selectedToken,
  onSelectToken,
}: {
  rows: AnnualRollup[];
  selectedToken: Token;
  onSelectToken: (token: Token) => void;
}) {
  return (
    <div className="token-card-grid">
      {rows.map((row) => (
        <TokenCard
          key={row.key}
          row={row}
          onSelect={() => onSelectToken(row.token)}
          isSelected={row.token === selectedToken}
        />
      ))}
    </div>
  );
}

// ─── Time Rollup Table ────────────────────────────────────────────────────────

function TimeRollupTable({
  title,
  rows,
  recentCount,
  currentTimeKey,
  embedded = false,
}: {
  title: string;
  rows: TimeRollupRow[];
  recentCount?: number;
  currentTimeKey?: string;
  embedded?: boolean;
}) {
  const compactBudgetFallbackLabel = getExecutiveBudgetFallbackLabel();
  const [showAll, setShowAll] = useState(false);

  const allTimeKeys = useMemo(() => {
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const r of rows) {
      if (!seen.has(r.time_key)) {
        seen.add(r.time_key);
        keys.push(r.time_key);
      }
    }
    return keys;
  }, [rows]);

  const visibleTimeKeys = useMemo(() => {
    if (!recentCount || showAll) return allTimeKeys;
    // Anchor to the current time key so the default window reflects the reporting context
    const anchorIdx = currentTimeKey
      ? allTimeKeys.indexOf(currentTimeKey)
      : -1;
    const endIdx = anchorIdx >= 0 ? anchorIdx + 1 : allTimeKeys.length;
    const startIdx = Math.max(0, endIdx - recentCount);
    return allTimeKeys.slice(startIdx, endIdx);
  }, [allTimeKeys, recentCount, showAll, currentTimeKey]);

  const visibleRows = useMemo(() => {
    if (!recentCount || showAll) return rows;
    const keySet = new Set(visibleTimeKeys);
    return rows.filter((r) => keySet.has(r.time_key));
  }, [rows, recentCount, showAll, visibleTimeKeys]);

  const hiddenCount = allTimeKeys.length - visibleTimeKeys.length;
  const timeUnitLabel = title === "Monthly View" ? "months" : "periods";
  const tableMeta = recentCount
    ? `Showing ${visibleTimeKeys.length} recent ${timeUnitLabel}${hiddenCount > 0 ? ` of ${allTimeKeys.length}` : ""}`
    : `${allTimeKeys.length} ${timeUnitLabel}`;

  return (
    <section className={`time-panel${embedded ? " time-panel-embedded" : " panel"}`}>
      <div className="panel-header">
        <div>
          <h3>{title}</h3>
          <div className="table-meta">{tableMeta}</div>
        </div>
      </div>
      <div className="table-scroll table-scroll-soft">
        <table className="data-table time-rollup-table">
          <thead>
            <tr>
              <th>Program</th>
              <th>{title === "Monthly View" ? "Month" : "Period"}</th>
              <th className="num-col">Budget</th>
              <th className="num-col">Actual</th>
              <th className="num-col">Variance</th>
              <th className="num-col">Variance %</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.key}>
                <td>{row.reporting_bucket}</td>
                <td>{row.time_key}</td>
                <CurrencyCell
                  value={row.budget}
                  pendingLabel={compactBudgetFallbackLabel}
                />
                <td className="num-col">{formatCurrency(row.actual)}</td>
                <VarianceCell
                  value={row.variance}
                  pct={null}
                  pendingLabel={compactBudgetFallbackLabel}
                />
                <td className="num-col">
                  {row.variance_pct !== null ? (
                    <span
                      className={
                        row.variance_pct < 0
                          ? "variance-negative"
                          : row.variance_pct > 0
                            ? "variance-positive"
                            : ""
                      }
                    >
                      {formatPercent(row.variance_pct)}
                    </span>
                  ) : (
                    <PendingValue label={compactBudgetFallbackLabel} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {recentCount && hiddenCount > 0 && (
        <button
          className="show-more-btn"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? "Show fewer"
            : `Show all ${allTimeKeys.length} periods/months`}
        </button>
      )}
    </section>
  );
}

// ─── Drilldown Table ──────────────────────────────────────────────────────────

function DrilldownTable({ rows }: { rows: AnnualRollup[] }) {
  const compactBudgetFallbackLabel = getExecutiveBudgetFallbackLabel();
  return (
    <div className="table-scroll table-scroll-soft">
      <table className="data-table drilldown-table">
        <thead>
          <tr>
            <th>Program</th>
            <th className="num-col">Annual</th>
            <th className="num-col">YTD</th>
            <th className="num-col">Remaining</th>
            <th className="num-col">Month Budget</th>
            <th className="num-col">Month Actual</th>
            <th className="num-col">Period Budget</th>
            <th className="num-col">Period Actual</th>
            <th className="num-col">Variance</th>
            <th className="col-note">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.reporting_bucket}</td>
              <CurrencyCell
                value={row.annual_budget}
                pendingLabel={compactBudgetFallbackLabel}
              />
              <td className="num-col">{formatCurrency(row.actual_ytd)}</td>
              <CurrencyCell
                value={row.remaining_budget}
                pendingLabel={compactBudgetFallbackLabel}
              />
              <CurrencyCell
                value={row.monthly_budget}
                pendingLabel={compactBudgetFallbackLabel}
              />
              <td className="num-col">{formatCurrency(row.current_month_actual)}</td>
              <CurrencyCell
                value={row.period_budget}
                pendingLabel={compactBudgetFallbackLabel}
              />
              <td className="num-col">{formatCurrency(row.current_period_actual)}</td>
              <VarianceCell
                value={row.variance}
                pct={row.variance_pct}
                pendingLabel={compactBudgetFallbackLabel}
              />
              <td>{row.notes[0]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Executive Insights ───────────────────────────────────────────────────────

function ExecInsights({
  summary,
  kpis,
}: {
  summary: AnnualRollup[];
  kpis: KPIData;
}) {
  const compactBudgetFallbackLabel = getExecutiveBudgetFallbackLabel();
  const confirmedTokens = summary
    .filter((r) => r.approval_status === "confirmed")
    .map((r) => r.token);
  const draftTokens = summary
    .filter((r) => r.approval_status === "draft")
    .map((r) => r.token);
  const pendingTokens = summary
    .filter((r) => r.approval_status === "pending")
    .map((r) => r.token);
  const includedTokens = summary
    .filter((r) => r.annual_budget !== null)
    .map((r) => r.token);

  const utilPct =
    kpis.budgetUtilization !== null
      ? formatPercent(kpis.budgetUtilization)
      : null;

  return (
    <div className="exec-insights">
      <div className="exec-insights-title">Executive Readout</div>
      <ul className="exec-insights-list">
        {includedTokens.length > 0 ? (
          <li>
            Current reporting total across {includedTokens.length} token
            {includedTokens.length !== 1 ? "s" : ""} ({includedTokens.join(", ")}
            ): <strong>{kpis.totalAnnualBudget !== null ? formatCurrency(kpis.totalAnnualBudget) : compactBudgetFallbackLabel}</strong>.
            {confirmedTokens.length > 0 && (
              <>{" "}Confirmed: {confirmedTokens.join(", ")}.</>
            )}
            {draftTokens.length > 0 && (
              <>{" "}Draft: {draftTokens.join(", ")}.</>
            )}
          </li>
        ) : (
          <li>
            Annual budgets are still absent from the local finance input, while actuals remain sourced from the confirmed SQL export.
          </li>
        )}
        {pendingTokens.length > 0 && (
          <li>
            Missing local annual inputs for <strong>{pendingTokens.join(", ")}</strong> keep those rows visible but excluded from current totals.
          </li>
        )}
        {includedTokens.length === 0 && (
          <li>
            Actuals in this mode follow the confirmed SQL source that is internally aligned with OBL All Historical Summary.
          </li>
        )}
        {utilPct && (
          <li>
            YTD utilization: <strong>{utilPct}</strong> of current reporting total,
            with <strong>{kpis.remainingBudget !== null ? formatCurrency(kpis.remainingBudget) : "—"}</strong>{" "}
            remaining.
          </li>
        )}
      </ul>
    </div>
  );
}

function UnmappedRowsPanel({ rows }: { rows: RawActualDetailRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  const totalUnmappedActual = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <section className="panel panel-quiet">
      <div className="panel-header">
        <div>
          <h2>Unmapped Raw Activity</h2>
          <p className="panel-sub">
            These rows stay visible because they do not have an active mapping match.
          </p>
        </div>
        <div className="context-chip-group">
          <span className="context-chip">Not in totals</span>
          <span className="context-chip">{formatCurrency(totalUnmappedActual)}</span>
        </div>
      </div>
      <CollapsibleSection title={`Review ${rows.length} unmapped row${rows.length !== 1 ? "s" : ""}`} defaultOpen={false}>
        <div className="table-scroll table-scroll-soft">
          <table className="data-table unmapped-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Program Raw</th>
                <th>Protocol</th>
                <th>Pool</th>
                <th>Period</th>
                <th className="num-col">Actual</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.token_raw}</td>
                  <td>{row.program_raw}</td>
                  <td>{row.protocol_raw}</td>
                  <td>{row.pool_raw}</td>
                  <td>{row.period_id}</td>
                  <td className="num-col">{formatCurrency(row.amount)}</td>
                  <td>{row.metadata.unmapped_reason ?? row.metadata.issue ?? "Pending mapping review"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>
    </section>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [selectedToken, setSelectedToken] = useState<Token>(
    reportConfig.enabled_program_breakdown[0] ?? "SUI",
  );
  const { budgetMaster, mappingTable, periodCalendar, rawActualDetail } = activeDataSource.input;

  const report = useMemo(
    () =>
      buildReportDataSet(
        budgetMaster,
        rawActualDetail,
        mappingTable,
        periodCalendar,
      ),
    [],
  );

  const unmappedRows = useMemo(
    () =>
      rawActualDetail.filter((row) => !findMapping(row, mappingTable)),
    [mappingTable, rawActualDetail],
  );

  const drilldown = report.drilldownByToken[selectedToken];

  // Aggregate KPIs from report.summary
  const kpis = useMemo<KPIData>(() => {
    const confirmedRows = report.summary.filter(
      (r) => r.annual_budget !== null,
    );
    const totalAnnualBudget =
      confirmedRows.length > 0
        ? confirmedRows.reduce((acc, r) => acc + (r.annual_budget ?? 0), 0)
        : null;
    const ytdActualSpend = report.summary.reduce((acc, r) => acc + r.actual_ytd, 0);
    const remainingBudget =
      totalAnnualBudget !== null ? totalAnnualBudget - ytdActualSpend : null;
    const budgetUtilization =
      totalAnnualBudget !== null && totalAnnualBudget > 0
        ? ytdActualSpend / totalAnnualBudget
        : null;

    return {
      totalAnnualBudget,
      ytdActualSpend,
      remainingBudget,
      budgetUtilization,
      unmappedRows: report.unmappedCount,
    };
  }, [report]);

  const currentPeriodLabel = `P${String(reportConfig.current_period_index).padStart(2, "0")}`;

  return (
    <main className="app-shell">
      {/* ── Executive Header ── */}
      <header className="exec-header">
        <div className="exec-header-title-block">
          <p className="eyebrow">2026 Budget Report</p>
          <h1>Budget vs Actual Dashboard</h1>
          <p className="exec-header-summary">
            Executive desktop view for current budget coverage, actual spend, and drilldown risk without changing reporting semantics.
          </p>
        </div>
        <div className="exec-header-meta">
          <span className="meta-pill">
            <span className="meta-label">Year</span>
            <strong>{reportConfig.report_year}</strong>
          </span>
          <span className="meta-pill">
            <span className="meta-label">Month</span>
            <strong>{reportConfig.current_month_label}</strong>
          </span>
          <span className="meta-pill">
            <span className="meta-label">Period</span>
            <strong>{currentPeriodLabel}</strong>
          </span>
          <StatusBadge value={activeDataSource.badgeLabel} />
          {report.unmappedCount > 0 && (
            <span className="badge badge-unmapped">
              {report.unmappedCount} unmapped row{report.unmappedCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </header>

      {/* ── KPI Hero Strip ── */}
      <KpiStrip kpis={kpis} />

      {/* ── Token Summary ── */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Token Summary</h2>
            <p className="panel-sub">
              Current month: <strong>{reportConfig.current_month_label}</strong>&ensp;·&ensp;
              Current period: <strong>{currentPeriodLabel}</strong>
            </p>
          </div>
        </div>
        <TokenCardGrid
          rows={report.summary}
          selectedToken={selectedToken}
          onSelectToken={setSelectedToken}
        />
      </section>

      {/* ── Token Drilldown ── */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Token Drilldown</h2>
            <p className="panel-sub">
              Program-level breakdown for{" "}
              <strong>{reportConfig.enabled_program_breakdown.join(", ")}</strong>
            </p>
          </div>
          <div className="tab-bar">
            {reportConfig.enabled_program_breakdown.map((token) => (
              <button
                key={token}
                className={token === selectedToken ? "tab active" : "tab"}
                onClick={() => setSelectedToken(token)}
                type="button"
              >
                {token}
              </button>
            ))}
          </div>
        </div>

        {drilldown ? (
          <>
            <ExecInsights summary={report.summary} kpis={kpis} />

            <CollapsibleSection title="Current Monthly View" defaultOpen={true}>
              <TimeRollupTable
                title="Monthly View"
                rows={drilldown.monthly}
                recentCount={3}
                currentTimeKey={reportConfig.current_month_label}
                embedded={true}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Annual Breakdown" defaultOpen={false}>
              <DrilldownTable rows={drilldown.annual} />
            </CollapsibleSection>

            <CollapsibleSection title="OBL Period View" defaultOpen={false}>
              <TimeRollupTable
                title="OBL Period View"
                rows={drilldown.period}
                recentCount={4}
                currentTimeKey={currentPeriodLabel}
                embedded={true}
              />
            </CollapsibleSection>
          </>
        ) : (
          <p className="muted">No drilldown configured for this token yet.</p>
        )}
      </section>

      <ReviewNotice />

      <UnmappedRowsPanel rows={unmappedRows} />

      {/* ── Status Footer ── */}
      <div className="status-footer">
        <span className="status-footer-label">Budget status:</span>
        {(() => {
          const confirmed = report.summary.filter((r) => r.approval_status === "confirmed").map((r) => r.token);
          const draft = report.summary.filter((r) => r.approval_status === "draft").map((r) => r.token);
          const pending = report.summary.filter((r) => r.approval_status === "pending").map((r) => r.token);
          return (
            <>
              {confirmed.length > 0 && (
                <span><strong>Confirmed:</strong> {confirmed.join(", ")}</span>
              )}
              {draft.length > 0 && (
                <><span className="status-footer-sep">·</span><span><strong>Draft:</strong> {draft.join(", ")}</span></>
              )}
              {pending.length > 0 && (
                <><span className="status-footer-sep">·</span><span><strong>Pending:</strong> {pending.join(", ")}</span></>
              )}
              <span className="status-footer-sep">·</span>
              <span className="status-footer-also-pending">Context: {activeDataSource.footerPendingNote}</span>
            </>
          );
        })()}
      </div>
    </main>
  );
}
