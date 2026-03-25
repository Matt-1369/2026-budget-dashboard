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
      <div className="review-note-title">{activeDataSource.reviewNote.title}</div>
      <ul className="review-note-list">
        {activeDataSource.reviewNote.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
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
  const utilStr =
    kpis.budgetUtilization !== null
      ? `${formatPercent(kpis.budgetUtilization)} utilized`
      : undefined;
  const remainingStr =
    kpis.remainingBudget !== null
      ? formatCurrency(kpis.remainingBudget)
      : activeDataSource.budgetFallbackLabel;
  const annualStr =
    kpis.totalAnnualBudget !== null
      ? formatCurrency(kpis.totalAnnualBudget)
      : activeDataSource.budgetFallbackLabel;
  const remainingSubtitle =
    kpis.remainingBudget !== null
      ? utilStr
      : "Remaining budget is unavailable until the Finance input file is populated for those rows.";

  return (
    <div className="kpi-strip">
      <KpiCard label="Annual Budget (Current)" value={annualStr} />
      <div className="kpi-divider" />
      <KpiCard label="YTD Actual Spend" value={formatCurrency(kpis.ytdActualSpend)} />
      <div className="kpi-divider" />
      <KpiCard
        label="Remaining Budget"
        value={remainingStr}
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
        <button className="link-button" onClick={onSelect}>
          {row.token}
        </button>
        <StatusBadge value={row.approval_status} />
      </div>

      {isPending ? (
        <div className="token-card-pending-msg">
          <PendingValue label={activeDataSource.budgetFallbackLabel} />
          <div className="token-card-pending-summary">
            YTD actual: {formatCurrency(row.actual_ytd)} · {reportConfig.current_month_label} actual:{" "}
            {formatCurrency(row.current_month_actual)} · {currentPeriodLabel} actual:{" "}
            {formatCurrency(row.current_period_actual)}
          </div>
          <div className="note">
            Budget source-of-truth is confirmed for v1, but the local Finance input file does not yet include an annual value for this row.
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
              <div className="token-card-metric-label">YTD Actual</div>
              <div className="token-card-metric-value">
                {formatCurrency(row.actual_ytd)}
              </div>
            </div>
              <div className="token-card-metric">
                <div className="token-card-metric-label">Remaining</div>
                <div className="token-card-metric-value">
                  {row.remaining_budget !== null
                    ? formatCurrency(row.remaining_budget)
                    : activeDataSource.budgetFallbackLabel}
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
}: {
  title: string;
  rows: TimeRollupRow[];
  recentCount?: number;
  currentTimeKey?: string;
}) {
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

  return (
    <section className="panel time-panel">
      <div className="panel-header">
        <h3>{title}</h3>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Program</th>
              <th>Period</th>
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
                  pendingLabel={activeDataSource.budgetFallbackLabel}
                />
                <td className="num-col">{formatCurrency(row.actual)}</td>
                <VarianceCell
                  value={row.variance}
                  pct={null}
                  pendingLabel={activeDataSource.budgetFallbackLabel}
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
                    <PendingValue label={activeDataSource.budgetFallbackLabel} />
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
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Program</th>
            <th className="num-col">Annual Budget</th>
            <th className="num-col">YTD Actual</th>
            <th className="num-col">Remaining</th>
            <th className="num-col">Monthly Budget</th>
            <th className="num-col">Cur. Month Actual</th>
            <th className="num-col">Period Budget</th>
            <th className="num-col">Cur. Period Actual</th>
            <th className="num-col">Variance</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.reporting_bucket}</td>
              <CurrencyCell
                value={row.annual_budget}
                pendingLabel={activeDataSource.budgetFallbackLabel}
              />
              <td className="num-col">{formatCurrency(row.actual_ytd)}</td>
              <CurrencyCell
                value={row.remaining_budget}
                pendingLabel={activeDataSource.budgetFallbackLabel}
              />
              <CurrencyCell
                value={row.monthly_budget}
                pendingLabel={activeDataSource.budgetFallbackLabel}
              />
              <td className="num-col">{formatCurrency(row.current_month_actual)}</td>
              <CurrencyCell
                value={row.period_budget}
                pendingLabel={activeDataSource.budgetFallbackLabel}
              />
              <td className="num-col">{formatCurrency(row.current_period_actual)}</td>
              <VarianceCell
                value={row.variance}
                pct={row.variance_pct}
                pendingLabel={activeDataSource.budgetFallbackLabel}
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
      <div className="exec-insights-title">Key Observations</div>
      <ul className="exec-insights-list">
        {includedTokens.length > 0 ? (
          <li>
            Current reporting total across {includedTokens.length} token
            {includedTokens.length !== 1 ? "s" : ""} ({includedTokens.join(", ")}
            ): <strong>{kpis.totalAnnualBudget !== null ? formatCurrency(kpis.totalAnnualBudget) : activeDataSource.budgetFallbackLabel}</strong>.
            {confirmedTokens.length > 0 && (
              <>{" "}Confirmed: {confirmedTokens.join(", ")}.</>
            )}
            {draftTokens.length > 0 && (
              <>{" "}Draft: {draftTokens.join(", ")}.</>
            )}
          </li>
        ) : (
          <li>
            Budget source-of-truth is confirmed for v1, but the local Finance input file does not yet include populated annual budget rows.
          </li>
        )}
        {pendingTokens.length > 0 && (
          <li>
            Annual budget values are not populated in the local Finance input file for{" "}
            <strong>{pendingTokens.join(", ")}</strong> — not included in totals.
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

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Unmapped Raw Activity</h2>
          <p className="panel-sub">
            These rows stay visible because they do not have an active mapping match.
          </p>
        </div>
      </div>
      <div className="table-scroll">
        <table>
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

      <ReviewNotice />

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

      <UnmappedRowsPanel rows={unmappedRows} />

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
              >
                {token}
              </button>
            ))}
          </div>
        </div>

        {drilldown ? (
          <>
            <CollapsibleSection title="Annual Breakdown" defaultOpen={false}>
              <DrilldownTable rows={drilldown.annual} />
            </CollapsibleSection>

            <div className="two-column">
              <TimeRollupTable
                title="Monthly View"
                rows={drilldown.monthly}
                recentCount={3}
                currentTimeKey={reportConfig.current_month_label}
              />
              <TimeRollupTable
                title="OBL Period View"
                rows={drilldown.period}
                recentCount={4}
                currentTimeKey={currentPeriodLabel}
              />
            </div>

            <ExecInsights summary={report.summary} kpis={kpis} />
          </>
        ) : (
          <p className="muted">No drilldown configured for this token yet.</p>
        )}
      </section>

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
              <span className="status-footer-also-pending">{activeDataSource.footerPendingNote}</span>
            </>
          );
        })()}
      </div>
    </main>
  );
}
