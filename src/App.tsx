import { useMemo, useState } from "react";
import { reportConfig } from "./config";
import { formatCurrency, formatPercent } from "./formatters";
import { budgetMaster, mappingTable, periodCalendar, rawActualDetail } from "./mockData";
import { buildReportDataSet } from "./rollups";
import type { AnnualRollup, TimeRollupRow, Token } from "./types";

// ─── Helper Components ───────────────────────────────────────────────────────

function StatusBadge({ value }: { value: string }) {
  const variant = value.toLowerCase().replace(/\s+/g, "-");
  return <span className={`badge badge-${variant}`}>{value}</span>;
}

function VarianceCell({ value, pct }: { value: number | null; pct: number | null }) {
  if (value === null) {
    return (
      <td className="num-col">
        <PendingValue />
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

function PendingValue() {
  return <em className="pending-value">Pending confirmation</em>;
}

function CurrencyCell({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <td className="num-col">
        <PendingValue />
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
    kpis.remainingBudget !== null ? formatCurrency(kpis.remainingBudget) : "—";
  const annualStr =
    kpis.totalAnnualBudget !== null ? formatCurrency(kpis.totalAnnualBudget) : "—";

  return (
    <div className="kpi-strip">
      <KpiCard label="Annual Budget (Current)" value={annualStr} />
      <div className="kpi-divider" />
      <KpiCard label="YTD Actual Spend" value={formatCurrency(kpis.ytdActualSpend)} />
      <div className="kpi-divider" />
      <KpiCard
        label="Remaining Budget"
        value={remainingStr}
        subtitle={utilStr}
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
          <PendingValue />
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
                  : "—"}
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
                <CurrencyCell value={row.budget} />
                <td className="num-col">{formatCurrency(row.actual)}</td>
                <VarianceCell value={row.variance} pct={null} />
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
                    <PendingValue />
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
              <CurrencyCell value={row.annual_budget} />
              <td className="num-col">{formatCurrency(row.actual_ytd)}</td>
              <CurrencyCell value={row.remaining_budget} />
              <CurrencyCell value={row.monthly_budget} />
              <td className="num-col">{formatCurrency(row.current_month_actual)}</td>
              <CurrencyCell value={row.period_budget} />
              <td className="num-col">{formatCurrency(row.current_period_actual)}</td>
              <VarianceCell value={row.variance} pct={row.variance_pct} />
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
        <li>
          Current reporting total across {includedTokens.length} token
          {includedTokens.length !== 1 ? "s" : ""} ({includedTokens.join(", ")}
          ): <strong>{kpis.totalAnnualBudget !== null ? formatCurrency(kpis.totalAnnualBudget) : "—"}</strong>.
          {confirmedTokens.length > 0 && (
            <>{" "}Confirmed: {confirmedTokens.join(", ")}.</>
          )}
          {draftTokens.length > 0 && (
            <>{" "}Draft: {draftTokens.join(", ")}.</>
          )}
        </li>
        {pendingTokens.length > 0 && (
          <li>
            Budget not yet available for{" "}
            <strong>{pendingTokens.join(", ")}</strong> — not included in totals.
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

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [selectedToken, setSelectedToken] = useState<Token>("DEEP");

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
          <StatusBadge value="Mock data" />
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
              <span className="status-footer-also-pending">Also pending: period count, DEEP hierarchy, OBL mappings</span>
            </>
          );
        })()}
      </div>
    </main>
  );
}
