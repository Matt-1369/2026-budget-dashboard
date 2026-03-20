import { useMemo, useState } from "react";
import { reportConfig } from "./config";
import { formatCurrency, formatPercent } from "./formatters";
import { budgetMaster, mappingTable, periodCalendar, rawActualDetail } from "./mockData";
import { buildReportDataSet } from "./rollups";
import type { AnnualRollup, TimeRollupRow, Token } from "./types";

function StatusBadge({ value }: { value: string }) {
  const variant = value.toLowerCase().replace(/\s+/g, "-");

  return <span className={`badge badge-${variant}`}>{value}</span>;
}

function SummaryTable({
  rows,
  onSelectToken,
}: {
  rows: AnnualRollup[];
  onSelectToken: (token: Token) => void;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Token</th>
          <th>Annual Budget</th>
          <th>YTD Actual</th>
          <th>Remaining Budget</th>
          <th>Monthly Budget</th>
          <th>Current Month Actual</th>
          <th>Current Period Budget</th>
          <th>Current Period Actual</th>
          <th>Variance</th>
          <th>Status / Notes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>
              <button className="link-button" onClick={() => onSelectToken(row.token)}>
                {row.token}
              </button>
            </td>
            <td>{formatCurrency(row.annual_budget)}</td>
            <td>{formatCurrency(row.actual_ytd)}</td>
            <td>{formatCurrency(row.remaining_budget)}</td>
            <td>{formatCurrency(row.monthly_budget)}</td>
            <td>{formatCurrency(row.current_month_actual)}</td>
            <td>{formatCurrency(row.period_budget)}</td>
            <td>{formatCurrency(row.current_period_actual)}</td>
            <td>
              <div>{formatCurrency(row.variance)}</div>
              <div className="muted">{formatPercent(row.variance_pct)}</div>
            </td>
            <td>
              <StatusBadge value={row.approval_status} />
              <div className="note">{row.notes[0]}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TimeRollupTable({
  title,
  rows,
}: {
  title: string;
  rows: TimeRollupRow[];
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
      </div>
      <table>
        <thead>
          <tr>
            <th>Program</th>
            <th>Time</th>
            <th>Budget</th>
            <th>Actual</th>
            <th>Variance</th>
            <th>Variance %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.reporting_bucket}</td>
              <td>{row.time_key}</td>
              <td>{formatCurrency(row.budget)}</td>
              <td>{formatCurrency(row.actual)}</td>
              <td>{formatCurrency(row.variance)}</td>
              <td>{formatPercent(row.variance_pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DrilldownTable({ rows }: { rows: AnnualRollup[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Program</th>
          <th>Annual Budget</th>
          <th>YTD Actual</th>
          <th>Remaining Budget</th>
          <th>Monthly Budget</th>
          <th>Current Month Actual</th>
          <th>Current Period Budget</th>
          <th>Current Period Actual</th>
          <th>Variance</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>{row.reporting_bucket}</td>
            <td>{formatCurrency(row.annual_budget)}</td>
            <td>{formatCurrency(row.actual_ytd)}</td>
            <td>{formatCurrency(row.remaining_budget)}</td>
            <td>{formatCurrency(row.monthly_budget)}</td>
            <td>{formatCurrency(row.current_month_actual)}</td>
            <td>{formatCurrency(row.period_budget)}</td>
            <td>{formatCurrency(row.current_period_actual)}</td>
            <td>
              <div>{formatCurrency(row.variance)}</div>
              <div className="muted">{formatPercent(row.variance_pct)}</div>
            </td>
            <td>{row.notes[0]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Internal skeleton</p>
          <h1>2026 Budget Reporting Dashboard</h1>
          <p className="lede">
            Mock-driven budget vs actual reporting for annual, monthly, and OBL-period
            views. Unconfirmed business inputs remain configurable or clearly pending.
          </p>
        </div>
        <div className="status-grid">
          <div className="stat-card">
            <span>Report year</span>
            <strong>{reportConfig.report_year}</strong>
          </div>
          <div className="stat-card">
            <span>Configured periods</span>
            <strong>{reportConfig.default_period_count}</strong>
          </div>
          <div className="stat-card">
            <span>Unmapped raw rows</span>
            <strong>{report.unmappedCount}</strong>
          </div>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Token Summary</h2>
            <p>
              Current month is {reportConfig.current_month_label}; current period is P
              {String(reportConfig.current_period_index).padStart(2, "0")}.
            </p>
          </div>
          <StatusBadge value="Mock data" />
        </div>
        <SummaryTable rows={report.summary} onSelectToken={setSelectedToken} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Token Drilldown</h2>
            <p>
              Program-level breakdown is enabled for {reportConfig.enabled_program_breakdown.join(", ")}.
            </p>
          </div>
          <div className="token-selector">
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
            <DrilldownTable rows={drilldown.annual} />
            <div className="two-column">
              <TimeRollupTable title="Monthly View" rows={drilldown.monthly} />
              <TimeRollupTable title="OBL Period View" rows={drilldown.period} />
            </div>
            <section className="commentary">
              <h3>Leadership Commentary Placeholder</h3>
              <p>
                Notes can explain why spend increased or decreased for a given month or
                period. This skeleton keeps commentary as a placeholder rather than
                hardcoding business interpretation.
              </p>
            </section>
          </>
        ) : (
          <p>No drilldown configured for this token yet.</p>
        )}
      </section>

      <section className="panel assumptions">
        <div className="panel-header">
          <h2>Confirmed vs Pending</h2>
        </div>
        <ul>
          <li>Confirmed examples: SUI annual DeFi budget, DEEP DeFi budget, Moonshots active program.</li>
          <li>Pending items: NS budget, Walrus budget, final period count, DEEP hierarchy details, OBL mapping finalization.</li>
          <li>Rollups use the mapping table. Unmapped rows remain visible through the unmapped count instead of being silently dropped.</li>
        </ul>
      </section>
    </main>
  );
}
