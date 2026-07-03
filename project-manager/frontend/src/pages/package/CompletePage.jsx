import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { apiFetch } from '@/lib/api.js';
import { useShell } from '@/contexts/ShellContext.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Check } from 'lucide-react';

export default function CompletePage() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { pkg } = useOutletContext();
  const { setShellData } = useShell();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [extractedCount, setExtractedCount] = useState(null);

  useEffect(() => {
    setShellData({ statusLabel: 'Processing Complete', statusTone: 'success' });
  }, [setShellData]);

  useEffect(() => {
    // Fetch all exceptions and group client-side by exceptionTypeCode
    apiFetch(`/exceptions/${packageId}`)
      .then(data => {
        const exceptions = data || [];
        // Group by exceptionTypeCode
        const groupMap = {};
        exceptions.forEach(ex => {
          const key = ex.exceptionTypeCode || ex.exceptionType || 'OTHER';
          if (!groupMap[key]) {
            groupMap[key] = {
              exceptionType: key,
              displayName: ex.exceptionTypeName || key.replace(/_/g, ' '),
              totalCount: 0,
              resolvedCount: 0,
              totalAmountAtRisk: 0,
            };
          }
          groupMap[key].totalCount++;
          if (ex.status === 'resolved' || ex.status === 'accepted' || ex.status === 'overridden') {
            groupMap[key].resolvedCount++;
          }
          groupMap[key].totalAmountAtRisk += parseFloat(ex.dollarAtRisk || ex.amountAtRisk || ex.varianceAmount || ex.variance || 0);
        });
        setGroups(Object.values(groupMap));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [packageId]);

  // Fetch extracted counts if pkg.totalItemsExtracted is null
  useEffect(() => {
    if (pkg?.totalItemsExtracted != null) {
      setExtractedCount(pkg.totalItemsExtracted);
      return;
    }
    Promise.all([
      apiFetch(`/packages/${packageId}/gc-sov-lines`).then(d => (Array.isArray(d) ? d.length : 0)).catch(() => 0),
      apiFetch(`/packages/${packageId}/sub-headers`).then(d => (Array.isArray(d) ? d.length : 0)).catch(() => 0),
    ]).then(([gc, sub]) => setExtractedCount(gc + sub));
  }, [packageId, pkg?.totalItemsExtracted]);

  const totalExtracted = extractedCount ?? pkg?.totalItemsExtracted ?? 0;
  const totalExceptions = groups.reduce((s, g) => s + (g.totalCount || 0), 0);
  const autoCleared = Math.max(0, totalExtracted - totalExceptions);
  const autoClearedPct = totalExtracted > 0 ? Math.round((autoCleared / totalExtracted) * 100) : 0;
  const dollarAtRisk = groups.reduce((s, g) => s + (parseFloat(g.totalAmountAtRisk) || 0), 0);

  const contractName = pkg?.contract?.contractName || '';
  const periodLabel = pkg?.billingPeriodMonth
    ? new Date(pkg.billingPeriodYear, pkg.billingPeriodMonth - 1).toLocaleString('default', { month: 'short', year: 'numeric' })
    : '';

  if (loading) return <div className="p-8"><Skeleton className="mx-auto h-96 max-w-[820px]" /></div>;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-[820px]">
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
          {/* Card Header */}
          <div className="border-b border-[var(--color-border)] p-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              <Check className="h-3.5 w-3.5" /> All Steps Complete
            </div>
            <h1 className="mt-3 text-xl font-semibold tracking-tight">
              {contractName} · {periodLabel}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Ready for review. Auto-cleared items have been recorded to the audit trail.
            </p>
          </div>

          {/* 4-stat row */}
          <div className="grid grid-cols-4 border-b border-[var(--color-border)]">
            <StatCell label="Extracted" value={String(totalExtracted)} />
            <StatCell label="Auto-cleared" value={`${autoCleared} (${autoClearedPct}%)`} color="text-green-600" />
            <StatCell label="Exceptions" value={String(totalExceptions)} color={totalExceptions > 0 ? 'text-orange-500' : ''} />
            <StatCell label="$ at risk" value={fmtMoney(dollarAtRisk)} color={dollarAtRisk > 0 ? 'text-red-500' : ''} />
          </div>

          {/* Exception groups */}
          <div className="p-6">
            <div className="mb-3 text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">Exceptions by type</div>
            {groups.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">No exceptions found.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {groups.map(g => (
                  <li key={g.exceptionType} className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full ${
                      g.exceptionType === 'MATH_ERROR' || g.exceptionType === 'PERIOD_CONTINUITY' ? 'bg-red-500'
                      : g.exceptionType === 'CROSS_FILE_MISMATCH' ? 'bg-orange-500'
                      : 'bg-yellow-400'
                    }`} />
                    <span className="flex-1">{g.displayName || g.exceptionType?.replace(/_/g, ' ')}</span>
                    <span className="tabular-nums text-[var(--color-muted-foreground)]">{g.totalCount || 0} items</span>
                    <span className="w-28 text-right tabular-nums font-medium">{fmtMoney(g.totalAmountAtRisk)}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => navigate(`/packages/${packageId}/exceptions`)}
                className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
              >
                Begin Review →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, color = '' }) {
  return (
    <div className="border-r border-[var(--color-border)] p-4 last:border-0">
      <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function fmtMoney(v) {
  const n = parseFloat(v || 0);
  if (n === 0) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
