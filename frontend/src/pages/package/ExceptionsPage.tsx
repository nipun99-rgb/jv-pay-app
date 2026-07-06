/**
 * ExceptionsPage — Sprint 7.
 * Reconciliation exceptions: filterable table, severity badges, resolve/dismiss inline.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, XCircle, Loader2, ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReconException {
  id: string;
  packageId: string;
  type: string;
  severity: string;
  subName: string | null;
  delta: string | null;
  evidence: string | null;
  status: string;
  resolution: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { label: string; cls: string; icon: typeof AlertTriangle }> = {
  HIGH:   { label: 'High',   cls: 'bg-red-100 text-red-700',    icon: AlertTriangle },
  MEDIUM: { label: 'Medium', cls: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  LOW:    { label: 'Low',    cls: 'bg-blue-100 text-blue-700',   icon: Info },
};

const TYPE_LABELS: Record<string, string> = {
  MATH_ERROR: 'Math Error',
  RETAINAGE_DEVIATION: 'Retainage Deviation',
  CROSS_FILE_MISMATCH: 'Cross-File Mismatch',
  PERIOD_CONTINUITY: 'Period Continuity',
};

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.MEDIUM;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function fmtDelta(v: string | null): string {
  if (!v) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// ─── Exception Row ────────────────────────────────────────────────────────────

function ExceptionRow({ ex, packageId, onChanged }: {
  ex: ReconException; packageId: string; onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [resolveMode, setResolveMode] = useState<null | 'RESOLVED' | 'DISMISSED'>(null);
  const [resolution, setResolution] = useState('');

  const { mutate: patch, isPending } = useMutation({
    mutationFn: ({ status, res }: { status: string; res?: string }) =>
      apiFetch(`/packages/${packageId}/exceptions/${ex.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, resolution: res }),
      }) as Promise<unknown>,
    onSuccess: () => { setResolveMode(null); onChanged(); },
  });

  const isOpen = ex.status === 'OPEN';

  return (
    <>
      <tr
        className={`border-b border-[var(--color-border)] hover:bg-gray-50 cursor-pointer ${!isOpen ? 'opacity-50' : ''}`}
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="px-4 py-3"><SeverityBadge severity={ex.severity} /></td>
        <td className="px-4 py-3 text-sm font-medium">{TYPE_LABELS[ex.type] ?? ex.type}</td>
        <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)] max-w-[180px] truncate">
          {ex.subName ?? '—'}
        </td>
        <td className="px-4 py-3 text-sm text-right font-mono">{fmtDelta(ex.delta)}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            ex.status === 'OPEN' ? 'bg-yellow-100 text-yellow-700'
            : ex.status === 'RESOLVED' ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-500'
          }`}>
            {ex.status}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {isOpen && (
            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setResolveMode('RESOLVED')}
                className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
              >
                Resolve
              </button>
              <button
                onClick={() => setResolveMode('DISMISSED')}
                className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
              >
                Dismiss
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b border-[var(--color-border)] bg-gray-50">
          <td colSpan={6} className="px-4 py-3">
            {ex.evidence && (
              <p className="text-xs font-mono text-[var(--color-text-secondary)] mb-2 bg-gray-100 rounded px-3 py-2 whitespace-pre-wrap">
                {ex.evidence}
              </p>
            )}
            {ex.resolution && (
              <p className="text-xs text-[var(--color-text-secondary)]">
                <span className="font-medium">Resolution: </span>{ex.resolution}
              </p>
            )}
          </td>
        </tr>
      )}

      {/* Resolve/dismiss form */}
      {resolveMode && (
        <tr className="border-b border-[var(--color-border)] bg-blue-50">
          <td colSpan={6} className="px-4 py-3">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1">
                  {resolveMode === 'RESOLVED' ? 'Resolution note (optional)' : 'Dismissal reason (optional)'}
                </label>
                <input
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder={resolveMode === 'RESOLVED' ? 'e.g. Verified with GC invoice' : 'e.g. Within tolerance'}
                  className="w-full rounded border border-[var(--color-border)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]"
                />
              </div>
              <button
                onClick={() => void patch({ status: resolveMode, res: resolution || undefined })}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-brand-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Confirm
              </button>
              <button
                onClick={() => setResolveMode(null)}
                className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-white"
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── ExceptionsPage ───────────────────────────────────────────────────────────

export default function ExceptionsPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');

  const { data: exceptions = [], isLoading } = useQuery<ReconException[]>({
    queryKey: ['exceptions', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}/exceptions`) as Promise<ReconException[]>,
    staleTime: 10_000,
    enabled: !!packageId,
  });

  const filtered = exceptions.filter((e) => {
    if (severityFilter !== 'ALL' && e.severity !== severityFilter) return false;
    if (typeFilter !== 'ALL' && e.type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
    return true;
  });

  const openCount = exceptions.filter((e) => e.status === 'OPEN').length;
  const highCount = exceptions.filter((e) => e.severity === 'HIGH' && e.status === 'OPEN').length;

  const onChanged = () => { queryClient.invalidateQueries({ queryKey: ['exceptions', packageId] }); };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Reconciliation Exceptions</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {exceptions.length === 0
              ? 'No exceptions found — reconciliation may not have run yet.'
              : `${openCount} open · ${highCount} high severity`}
          </p>
        </div>
        {exceptions.length > 0 && openCount === 0 && (
          <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 text-sm font-medium text-green-700">
            <ShieldCheck className="h-4 w-4" />
            All exceptions resolved
          </span>
        )}
      </div>

      {/* Summary KPI row */}
      {exceptions.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total', value: exceptions.length, cls: 'text-[var(--color-text-primary)]' },
            { label: 'Open', value: openCount, cls: 'text-[var(--color-warning)]' },
            { label: 'High Severity', value: highCount, cls: 'text-[var(--color-error)]' },
            { label: 'Resolved', value: exceptions.filter((e) => e.status !== 'OPEN').length, cls: 'text-[var(--color-valid)]' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="rounded-lg border border-[var(--color-border)] bg-white p-4">
              <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
              <p className={`mt-0.5 text-2xl font-bold ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {exceptions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {/* Severity filter */}
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-xs">
            {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  severityFilter === s ? 'bg-[var(--color-brand-primary)] text-white' : 'bg-white hover:bg-gray-50'
                }`}
              >
                {s === 'ALL' ? 'All Severities' : s}
              </button>
            ))}
          </div>
          {/* Status filter */}
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-xs">
            {['OPEN', 'RESOLVED', 'DISMISSED', 'ALL'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  statusFilter === s ? 'bg-[var(--color-brand-primary)] text-white' : 'bg-white hover:bg-gray-50'
                }`}
              >
                {s === 'ALL' ? 'All Status' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-medium focus:outline-none"
          >
            <option value="ALL">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-primary)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white p-16 text-center">
          {exceptions.length === 0
            ? <><AlertTriangle className="h-10 w-10 opacity-20" /><p className="text-sm text-[var(--color-text-secondary)]">Reconciliation has not run yet. Complete the pipeline to generate exceptions.</p></>
            : <><XCircle className="h-10 w-10 opacity-20" /><p className="text-sm text-[var(--color-text-secondary)]">No exceptions match the current filters.</p></>
          }
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-[var(--color-border)]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)]">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)]">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)]">Sub-Contractor</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--color-text-secondary)]">Delta</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)]">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--color-text-secondary)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ex) => (
                <ExceptionRow key={ex.id} ex={ex} packageId={packageId!} onChanged={onChanged} />
              ))}
            </tbody>
          </table>
          <div className="border-t border-[var(--color-border)] bg-gray-50 px-4 py-2 text-xs text-[var(--color-text-secondary)]">
            Showing {filtered.length} of {exceptions.length} exceptions · Click any row to view evidence
          </div>
        </div>
      )}
    </div>
  );
}

