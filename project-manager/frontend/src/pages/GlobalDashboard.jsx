import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api.js';
import { useShell } from '@/contexts/ShellContext.jsx';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, FileStack, AlertTriangle, TrendingUp, Clock } from 'lucide-react';

const packageRoute = (status) => {
  const map = {
    INGESTING: 'ingest',
    FILE_1_PROCESSING: 'file1',
    AWAITING_PLAN_CONFIRMATION: 'plan',
    FILE_2_PROCESSING: 'file2',
    EXCEPTION_REVIEW: 'exceptions',
    READY_FOR_APPROVAL: 'hitl',
    APPROVED: 'hitl',
  };
  return map[status] ?? 'ingest';
};

const extractedOutputRoute = (status) => {
  const map = {
    DRAFT: 'ingest',
    INGESTING: 'ingest',
    FILE_1_PROCESSING: 'file1',
    AWAITING_PLAN_CONFIRMATION: 'plan',
    FILE_2_PROCESSING: 'file2',
    EXTRACTED: 'file2',
    EXCEPTION_REVIEW: 'file2',
    READY_FOR_APPROVAL: 'file2',
    APPROVED: 'file2',
    REJECTED: 'file2',
  };
  return map[status] ?? 'file2';
};

function StatusPill({ pkg }) {
  const statusConfig = {
    DRAFT: { dot: 'bg-gray-400', label: 'Awaiting upload', bg: 'bg-gray-50 border-gray-200 text-gray-600' },
    INGESTING: { dot: 'bg-blue-500', label: 'Processing · Ingesting', bg: 'bg-blue-50 border-blue-200 text-blue-600' },
    FILE_1_PROCESSING: { dot: 'bg-blue-500', label: 'Processing · File 1', bg: 'bg-blue-50 border-blue-200 text-blue-600' },
    FILE_2_PROCESSING: { dot: 'bg-blue-500', label: `Processing · File 2`, bg: 'bg-blue-50 border-blue-200 text-blue-600' },
    EXTRACTED: { dot: 'bg-blue-500', label: 'Processing · Complete', bg: 'bg-blue-50 border-blue-200 text-blue-600' },
    AWAITING_PLAN_CONFIRMATION: { dot: 'bg-orange-500', label: 'Plan Review · Awaiting confirmation', bg: 'bg-orange-50 border-orange-200 text-orange-600' },
    EXCEPTION_REVIEW: { dot: 'bg-orange-500', label: `In Review · ${pkg.exceptionsCount || 0} exceptions remain`, bg: 'bg-orange-50 border-orange-200 text-orange-600' },
    READY_FOR_APPROVAL: { dot: 'bg-green-500', label: 'Complete · Approved', bg: 'bg-green-50 border-green-200 text-green-700' },
    APPROVED: { dot: 'bg-green-500', label: 'Complete · Approved', bg: 'bg-green-50 border-green-200 text-green-700' },
    REJECTED: { dot: 'bg-red-500', label: 'Rejected', bg: 'bg-red-50 border-red-200 text-red-600' },
  };
  const cfg = statusConfig[pkg.packageStatus] || { dot: 'bg-gray-400', label: pkg.packageStatus, bg: 'bg-gray-50 border-gray-200 text-gray-600' };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function formatCurrency(val) {
  if (!val || val === 0) return '—';
  return `$${Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function GlobalDashboard() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { clearShell } = useShell();

  useEffect(() => { clearShell(); }, [clearShell]);

  useEffect(() => {
    apiFetch('/packages')
      .then(data => setPackages(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // KPI computations
  const openCount = packages.filter(p => p.packageStatus !== 'APPROVED' && p.packageStatus !== 'REJECTED').length;
  const exceptionsTotal = packages.reduce((sum, p) => sum + (p.exceptionsCount || 0), 0);
  const dollarAtRisk = packages.reduce((sum, p) => sum + (p.dollarAtRisk || 0), 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Package Queue</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Monthly invoice packages across all contracts.</p>
        </div>
        <Button onClick={() => navigate('/packages/new')}>
          <Plus className="mr-1.5 size-4" /> New Package
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <KPICard icon={FileStack} label="Open packages" value={openCount} />
        <KPICard icon={AlertTriangle} label="Exceptions to resolve" value={exceptionsTotal} valueColor="text-orange-500" />
        <KPICard icon={TrendingUp} label="$ at risk" value={formatCurrency(dollarAtRisk)} valueColor="text-red-500" />
        <KPICard icon={Clock} label="SLA breaches" value={0} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : packages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-12 text-center">
          <p className="text-[var(--color-muted-foreground)]">No packages yet. Create your first package to get started.</p>
          <Button className="mt-4" onClick={() => navigate('/packages/new')}>
            <Plus className="mr-1.5 size-4" /> New Package
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Contract</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Extracted</th>
                <th className="px-4 py-3 font-medium text-right">Exceptions</th>
                <th className="px-4 py-3 font-medium text-right">$ at risk</th>
                <th className="px-4 py-3 font-medium text-right">SLA</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {packages.map(pkg => (
                <tr
                  key={pkg.id}
                  className="cursor-pointer transition-colors hover:bg-[var(--color-muted)]/40"
                  onClick={() => navigate(`/packages/${pkg.id}/${packageRoute(pkg.packageStatus)}`)}
                >
                  <td className="px-4 py-4 font-medium max-w-[180px] truncate">{pkg.contract?.contractName || '—'}</td>
                  <td className="px-4 py-4 text-[var(--color-muted-foreground)]">
                    {pkg.billingPeriodMonth
                      ? new Date(pkg.billingPeriodYear, pkg.billingPeriodMonth - 1).toLocaleString('default', { month: 'short', year: 'numeric' })
                      : pkg.billingPeriodLabel || '—'}
                  </td>
                  <td className="px-4 py-4"><StatusPill pkg={pkg} /></td>
                  <td className="px-4 py-4 text-right tabular-nums">{pkg.totalItemsExtracted || '—'}</td>
                  <td className={`px-4 py-4 text-right tabular-nums ${pkg.exceptionsCount > 0 ? 'font-semibold text-orange-500' : 'text-[var(--color-muted-foreground)]'}`}>
                    {pkg.exceptionsCount > 0 ? pkg.exceptionsCount : '—'}
                  </td>
                  <td className={`px-4 py-4 text-right tabular-nums ${pkg.dollarAtRisk > 0 ? 'font-semibold text-red-500' : 'text-[var(--color-muted-foreground)]'}`}>
                    {pkg.dollarAtRisk > 0 ? formatCurrency(pkg.dollarAtRisk) : '—'}
                  </td>
                  <td className="px-4 py-4 text-right text-[var(--color-muted-foreground)]">—</td>
                  <td className="px-4 py-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/packages/${pkg.id}/${extractedOutputRoute(pkg.packageStatus)}`);
                      }}
                    >
                      See Extracted Output
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KPICard({ icon: Icon, label, value, valueColor = '' }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--color-muted-foreground)]" />
        <span className="text-sm text-[var(--color-muted-foreground)]">{label}</span>
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</div>
    </div>
  );
}
