/**
 * ReportsPage — Sprint 12.
 * Period-comparison line chart + portfolio summary + CSV export.
 * Uses pure SVG (no external charting library required).
 */
import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Download, BarChart3, TrendingUp, Loader2, FileText, Building2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PeriodPoint {
  index: number;
  packageId: string;
  projectName: string;
  applicationNo: string | null;
  period: string | null;
  createdAt: string;
  contract: { id: string; name: string; client: { name: string } } | null;
  contractSumToDate: number | null;
  totalCompletedStored: number | null;
  currentPaymentDue: number | null;
  balanceToFinish: number | null;
  totalRetainage: number | null;
}

interface Contract { id: string; name: string; client: { id: string; name: string } }

interface ReportSummary {
  totalPackages: number;
  totalPaymentDue: number;
  totalContractSum: number;
  openExceptions: number;
  byStatus: Record<string, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(v: number | null): string {
  if (v == null) return '—';
  if (Math.abs(v) >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtFull(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

const CHART_SERIES = [
  { key: 'contractSumToDate',   label: 'Contract Sum to Date', color: '#6366f1' },  // indigo
  { key: 'totalCompletedStored', label: 'Total Completed',      color: '#22c55e' },  // green
  { key: 'currentPaymentDue',   label: 'Current Payment Due',  color: '#f59e0b' },  // amber
  { key: 'balanceToFinish',     label: 'Balance to Finish',    color: '#ef4444' },  // red
] as const;

interface TooltipData {
  x: number; y: number;
  point: PeriodPoint;
}

function LineChart({ data }: { data: PeriodPoint[] }) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const navigate = useNavigate();

  if (data.length === 0) return (
    <div className="flex h-64 items-center justify-center text-sm text-[var(--color-text-secondary)]">
      No period data to chart.
    </div>
  );

  // Chart geometry
  const VB_W = 700; const VB_H = 320;
  const ML = 90; const MR = 24; const MT = 20; const MB = 52;
  const PW = VB_W - ML - MR;
  const PH = VB_H - MT - MB;
  const N = data.length;

  // Find global max across all series for y-scale
  let maxVal = 0;
  data.forEach((d) => {
    CHART_SERIES.forEach(({ key }) => { const v = d[key]; if (v != null && v > maxVal) maxVal = v; });
  });
  maxVal = maxVal * 1.1 || 1; // add 10% headroom

  const xOf = (i: number) => ML + (N === 1 ? PW / 2 : (i / (N - 1)) * PW);
  const yOf = (v: number | null) => v == null ? null : MT + PH - (v / maxVal) * PH;

  // Y-axis grid ticks (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => (maxVal / 4) * i);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * VB_W;
    const plotX = svgX - ML;
    if (plotX < -20 || plotX > PW + 20) { setTooltip(null); return; }
    // Find nearest point
    const idx = Math.min(N - 1, Math.max(0, Math.round((plotX / PW) * (N - 1))));
    const pointX = rect.left + (xOf(idx) / VB_W) * rect.width;
    setTooltip({ x: pointX - rect.left, y: 0, point: data[idx] });
  }, [data, N, PW, ML]);

  return (
    <div className="relative" onMouseLeave={() => setTooltip(null)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        onMouseMove={handleMouseMove}
        style={{ cursor: 'crosshair' }}
      >
        {/* Grid lines */}
        {yTicks.map((tick) => {
          const y = yOf(tick)!;
          return (
            <g key={tick}>
              <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke="#e5e7eb" strokeWidth="1" />
              <text x={ML - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
                {fmtCurrency(tick)}
              </text>
            </g>
          );
        })}

        {/* Vertical period lines (hover indicator) */}
        {tooltip && data.map((d, i) => {
          const px = xOf(i);
          const isActive = d.packageId === tooltip.point.packageId;
          return isActive ? (
            <line key={i} x1={px} y1={MT} x2={px} y2={MT + PH} stroke="#6366f1" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
          ) : null;
        })}

        {/* Series lines + dots */}
        {CHART_SERIES.map(({ key, color }) => {
          const points = data.map((d, i) => {
            const y = yOf(d[key]);
            return y == null ? null : `${xOf(i)},${y}`;
          }).filter(Boolean);

          if (points.length < 2) return null;

          return (
            <g key={key}>
              <polyline
                points={points.join(' ')}
                fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
              />
              {data.map((d, i) => {
                const y = yOf(d[key]);
                if (y == null) return null;
                return (
                  <circle
                    key={i} cx={xOf(i)} cy={y} r={tooltip?.point.packageId === d.packageId ? 5 : 3}
                    fill={color} stroke="white" strokeWidth="1.5"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/packages/${d.packageId}/file1`)}
                  />
                );
              })}
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={i} x={xOf(i)} y={MT + PH + 18} textAnchor="middle" fontSize="9" fill="#6b7280"
          >
            {d.applicationNo ? `App ${d.applicationNo}` : `#${d.index}`}
          </text>
        ))}
        {data.map((d, i) => (
          <text key={`d${i}`} x={xOf(i)} y={MT + PH + 30} textAnchor="middle" fontSize="8" fill="#9ca3af">
            {new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
          </text>
        ))}

        {/* Axes */}
        <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#d1d5db" strokeWidth="1" />
        <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="#d1d5db" strokeWidth="1" />
      </svg>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute top-4 z-20 min-w-[180px] rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-lg text-xs"
          style={{ left: Math.min(tooltip.x, window.innerWidth - 200) }}
        >
          <p className="font-semibold mb-1.5 truncate">{tooltip.point.projectName}</p>
          {CHART_SERIES.map(({ key, label, color }) => {
            const v = tooltip.point[key];
            return v != null ? (
              <div key={key} className="flex justify-between gap-4">
                <span className="flex items-center gap-1" style={{ color }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                  {label}
                </span>
                <span className="font-mono">{fmtCurrency(v)}</span>
              </div>
            ) : null;
          })}
          <p className="mt-1.5 text-[10px] text-[var(--color-text-secondary)] text-center">Click dot → open package</p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap justify-center gap-4">
        {CHART_SERIES.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
            <span className="h-2.5 w-5 rounded-sm" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ReportsPage ──────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const navigate = useNavigate();
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [exportingPkgId, setExportingPkgId] = useState<string | null>(null);

  // Fetch contracts for the selector
  const { data: contracts = [] } = useQuery<Contract[]>({
    queryKey: ['contracts'],
    queryFn: () => apiFetch('/contracts') as Promise<Contract[]>,
    staleTime: 60_000,
  });

  // Fetch period comparison data
  const { data: periodData = [], isLoading: chartLoading } = useQuery<PeriodPoint[]>({
    queryKey: ['period-comparison', selectedContractId],
    queryFn: () => apiFetch(
      `/reports/period-comparison${selectedContractId ? `?contractId=${selectedContractId}` : ''}`
    ) as Promise<PeriodPoint[]>,
    staleTime: 30_000,
  });

  // Portfolio summary
  const { data: summary } = useQuery<ReportSummary>({
    queryKey: ['report-summary'],
    queryFn: () => apiFetch('/reports/summary') as Promise<ReportSummary>,
    staleTime: 30_000,
  });

  // CSV export for a specific package
  const handleExport = async (pkgId: string, projectName: string) => {
    setExportingPkgId(pkgId);
    try {
      const resp = await fetch(`/api/packages/${pkgId}/gc-sov.csv`, { credentials: 'include' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_gc-sov.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('CSV export failed:', e);
    } finally {
      setExportingPkgId(null);
    }
  };

  // Latest package for quick export
  const latestPackage = periodData[periodData.length - 1];

  return (
    <div className="p-8 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Period-over-period trends and portfolio overview.
          </p>
        </div>
        {latestPackage && (
          <button
            onClick={() => void handleExport(latestPackage.packageId, latestPackage.projectName)}
            disabled={!!exportingPkgId}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {exportingPkgId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export Latest SOV (CSV)
          </button>
        )}
      </div>

      {/* Portfolio KPI cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Packages', value: summary.totalPackages, icon: FileText, color: 'text-blue-600 bg-blue-50' },
            { label: 'Total Contract Value', value: fmtFull(summary.totalContractSum), icon: Building2, color: 'text-indigo-600 bg-indigo-50' },
            { label: 'Total Payments Due', value: fmtFull(summary.totalPaymentDue), icon: TrendingUp, color: 'text-green-600 bg-green-50' },
            { label: 'Open Exceptions', value: summary.openExceptions, icon: BarChart3, color: 'text-orange-600 bg-orange-50' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-[var(--color-border)] bg-white p-5 flex items-start gap-4">
              <div className={`rounded-lg p-2 ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
                <p className="text-xl font-semibold mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Period comparison chart */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold">Period-over-Period Trend</h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Key financials across payment application periods. Click any data point to open that package.
            </p>
          </div>
          {/* Contract filter */}
          <select
            value={selectedContractId}
            onChange={(e) => setSelectedContractId(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]"
          >
            <option value="">All Contracts</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>{c.client.name} · {c.name}</option>
            ))}
          </select>
        </div>

        {chartLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-primary)]" />
          </div>
        ) : periodData.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
            <BarChart3 className="h-10 w-10 opacity-20 text-[var(--color-text-secondary)]" />
            <div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">No extracted data yet</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Run the pipeline on at least one package to see trends.
              </p>
            </div>
          </div>
        ) : (
          <LineChart data={periodData} />
        )}
      </div>

      {/* Package data table */}
      {periodData.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)]">
            <h2 className="text-sm font-semibold">Period Data Table</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-[var(--color-border)]">
                  {['Period', 'Project', 'Contract Sum', 'Total Completed', 'Payment Due', 'Balance', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {periodData.map((d) => (
                  <tr key={d.packageId} className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/packages/${d.packageId}/file1`)}>
                    <td className="px-4 py-2.5 font-mono font-medium">App {d.applicationNo ?? d.index}</td>
                    <td className="px-4 py-2.5 max-w-[200px] truncate">{d.projectName}</td>
                    <td className="px-4 py-2.5 font-mono">{fmtCurrency(d.contractSumToDate)}</td>
                    <td className="px-4 py-2.5 font-mono">{fmtCurrency(d.totalCompletedStored)}</td>
                    <td className="px-4 py-2.5 font-mono text-[var(--color-valid)]">{fmtCurrency(d.currentPaymentDue)}</td>
                    <td className="px-4 py-2.5 font-mono">{fmtCurrency(d.balanceToFinish)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleExport(d.packageId, d.projectName); }}
                        disabled={exportingPkgId === d.packageId}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-[var(--color-brand-primary)] hover:bg-blue-50 disabled:opacity-50"
                      >
                        {exportingPkgId === d.packageId
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Download className="h-3 w-3" />}
                        CSV
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
