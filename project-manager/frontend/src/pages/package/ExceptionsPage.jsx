import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { apiFetch } from '@/lib/api.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EvidenceViewer from '@/components/EvidenceViewer.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

export default function ExceptionsPage() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { pkg } = useOutletContext();
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [pdfUrl, setPdfUrl] = useState(null);

  const [overrideTarget, setOverrideTarget] = useState(null);
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeFileTab, setActiveFileTab] = useState('FILE_1');
  const [activeException, setActiveException] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Load all exceptions and group client-side
        const [allExceptions, pkgData] = await Promise.all([
          apiFetch(`/exceptions/${packageId}`),
          apiFetch(`/packages/${packageId}`),
        ]);
        // Build groups from exceptions
        const groupMap = {};
        (allExceptions || []).forEach(ex => {
          const key = ex.exceptionTypeCode || ex.exceptionType || 'OTHER';
          if (!groupMap[key]) {
            groupMap[key] = {
              id: key,
              exceptionType: key,
              displayName: ex.exceptionTypeName || key.replace(/_/g, ' '),
              totalCount: 0,
              resolvedCount: 0,
              totalAmountAtRisk: 0,
            };
          }
          groupMap[key].totalCount++;
          if (ex.status === 'RESOLVED' || ex.status === 'accepted' || ex.status === 'overridden') {
            groupMap[key].resolvedCount++;
          }
          groupMap[key].totalAmountAtRisk += parseFloat(ex.dollarAtRisk || ex.amountAtRisk || ex.varianceAmount || 0);
        });
        const grps = Object.values(groupMap);
        setGroups(grps);
        if (grps.length > 0) setActiveGroupId(grps[0].id);
        const file1Doc = pkgData.documents?.find(d => d.fileRole === 'FILE_1');
        if (file1Doc) setPdfUrl(`/api/packages/${packageId}/pdf/${file1Doc.id}`);
      } catch (e) {
        console.error('ExceptionsPage load error:', e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [packageId]);

  // Load exceptions for active group
  useEffect(() => {
    if (!activeGroupId) return;
    apiFetch(`/exceptions/${packageId}?groupId=${activeGroupId}`)
      .then(data => {
        // If API returns empty, fall back to filtering all exceptions by type
        if (!data || data.length === 0) {
          apiFetch(`/exceptions/${packageId}`)
            .then(all => setExceptions((all || []).filter(e => (e.exceptionTypeCode || e.exceptionType) === activeGroupId)))
            .catch(() => {});
        } else {
          setExceptions(data);
        }
      })
      .catch(() => {});
  }, [packageId, activeGroupId]);

  const totalExceptions = groups.reduce((s, g) => s + (g.totalCount || 0), 0);
  const resolvedExceptions = groups.reduce((s, g) => s + (g.resolvedCount || 0), 0);
  const allResolved = totalExceptions > 0 && resolvedExceptions >= totalExceptions;
  const progressPct = totalExceptions > 0 ? Math.round((resolvedExceptions / totalExceptions) * 100) : 0;

  const handleAccept = async (exceptionId) => {
    try {
      await apiFetch(`/exceptions/${exceptionId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'ACCEPTED', comment: '' }),
      });
      setExceptions(prev => prev.map(e => e.id === exceptionId ? { ...e, status: 'RESOLVED', resolution: 'ACCEPTED' } : e));
      refreshGroups();
    } catch (e) {
      console.error('Accept error:', e.message);
    }
  };

  const handleOverrideSubmit = async () => {
    if (!overrideReason.trim()) return;
    setOverrideSubmitting(true);
    try {
      await apiFetch(`/exceptions/${overrideTarget.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'OVERRIDDEN', comment: overrideReason, overrideValue }),
      });
      setExceptions(prev => prev.map(e => e.id === overrideTarget.id ? { ...e, status: 'RESOLVED', resolution: 'OVERRIDDEN' } : e));
      refreshGroups();
      setOverrideTarget(null);
      setOverrideValue('');
      setOverrideReason('');
    } catch (e) {
      console.error('Override error:', e.message);
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const refreshGroups = () => {
    apiFetch(`/exceptions/${packageId}`)
      .then(allExceptions => {
        const groupMap = {};
        (allExceptions || []).forEach(ex => {
          const key = ex.exceptionTypeCode || ex.exceptionType || 'OTHER';
          if (!groupMap[key]) {
            groupMap[key] = {
              id: key, exceptionType: key,
              displayName: ex.exceptionTypeName || key.replace(/_/g, ' '),
              totalCount: 0, resolvedCount: 0, totalAmountAtRisk: 0,
            };
          }
          groupMap[key].totalCount++;
          if (ex.status === 'RESOLVED') groupMap[key].resolvedCount++;
          groupMap[key].totalAmountAtRisk += parseFloat(ex.dollarAtRisk || ex.amountAtRisk || 0);
        });
        setGroups(Object.values(groupMap));
      }).catch(() => {});
  };

  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkAccept = async () => {
    for (const id of selectedIds) {
      await handleAccept(id);
    }
    setSelectedIds(new Set());
  };

  const switchFileTab = (tab) => {
    setActiveFileTab(tab);
    if (tab === 'FILE_2') {
      const file2Doc = pkg?.documents?.find(d => d.fileRole === 'FILE_2');
      if (file2Doc) setPdfUrl(`/api/packages/${packageId}/pdf/${file2Doc.id}`);
    } else if (tab === 'FILE_1') {
      const file1Doc = pkg?.documents?.find(d => d.fileRole === 'FILE_1');
      if (file1Doc) setPdfUrl(`/api/packages/${packageId}/pdf/${file1Doc.id}`);
    }
  };

  const isReadOnly = pkg?.packageStatus === 'APPROVED' || pkg?.packageStatus === 'REJECTED';

  if (loading) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2">
        <span className="text-xs text-[var(--color-muted-foreground)]">{resolvedExceptions} of {totalExceptions} resolved · {totalExceptions - resolvedExceptions} remaining</span>
        <button
          onClick={() => navigate(`/packages/${packageId}/hitl`)}
          className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
        >
          Mark Ready for Approval →
        </button>
      </div>

      {/* 3-pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Group navigator */}
        <aside className="w-[280px] shrink-0 overflow-auto border-r border-[var(--color-border)] bg-[var(--color-card)] p-3 space-y-2">
          {groups.map(g => {
            const isActive = activeGroupId === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setActiveGroupId(g.id)}
                className={`w-full rounded-md border text-left transition-colors ${
                  isActive
                    ? 'border-orange-200 border-l-[3px] border-l-orange-400 bg-orange-50/50'
                    : 'border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-muted)]/40'
                } p-3`}
              >
                <div className="text-sm font-medium">{g.displayName || g.exceptionType}</div>
                <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  {g.totalCount || 0} items · {fmtMoney(g.totalAmountAtRisk)}
                </div>
                {/* Severity dots — colored by exception type */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {Array.from({ length: Math.min(g.totalCount || 0, 10) }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-2 w-2 rounded-full ${
                        g.exceptionType === 'MATH_ERROR' || g.exceptionType === 'PERIOD_CONTINUITY' ? 'bg-red-500'
                        : g.exceptionType === 'CROSS_FILE_MISMATCH' ? 'bg-orange-500'
                        : 'bg-yellow-400'
                      }`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </aside>

        {/* Centre — Exception table */}
        <section className="flex-1 min-w-0 flex flex-col border-r border-[var(--color-border)]">
          {/* Select all / Bulk accept */}
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-muted)]/30 px-4 py-2">
            <div className="flex-1 text-sm font-semibold">
              {groups.find(g => g.id === activeGroupId)?.displayName || groups.find(g => g.id === activeGroupId)?.exceptionType || ''}
            </div>
            <button
              onClick={() => setSelectedIds(new Set(exceptions.filter(e => e.status !== 'RESOLVED').map(e => e.id)))}
              className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            >
              Select all
            </button>
            <button
              onClick={() => bulkAccept()}
              disabled={selectedIds.size === 0}
              className="text-xs rounded-md border border-[var(--color-border)] px-2 py-1 hover:bg-[var(--color-muted)] disabled:opacity-40"
            >
              Bulk accept
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--color-background)] text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                <tr className="border-b border-[var(--color-border)]">
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left">Sub</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right">File 1</th>
                  <th className="px-3 py-2 text-right">File 2</th>
                  <th className="px-3 py-2 text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map(ex => {
                  const resolved = ex.status === 'RESOLVED';
                  return (
                    <tr
                      key={ex.id}
                      onClick={() => { ex.sourcePage && setActivePage(ex.sourcePage); setActiveException(ex); }}
                      className={`border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-muted)]/40 ${
                        activeException?.id === ex.id ? 'bg-[var(--color-primary)]/5' : ''
                      } ${resolved ? 'opacity-50' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(ex.id)}
                          onChange={(e) => { e.stopPropagation(); toggleSelected(ex.id); }}
                          className="h-3.5 w-3.5"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {(ex.subContractorName || ex.subName || ex.lineRef || '').substring(0, 3).toUpperCase() || '—'}
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{ex.description || ex.exceptionType}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{ex.file1Value != null ? fmtMoney(ex.file1Value) : ex.gcAmount != null ? fmtMoney(ex.gcAmount) : (ex.file2Value != null && ex.variance != null ? fmtMoney(Number(ex.file2Value) - Number(ex.variance)) : '—')}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{ex.file2Value != null ? fmtMoney(ex.file2Value) : ex.subAmount != null ? fmtMoney(ex.subAmount) : '—'}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${ex.variance || ex.amountAtRisk ? 'text-orange-500' : 'text-[var(--color-muted-foreground)]'}`}>
                        {ex.variance ? fmtMoney(ex.variance) : ex.amountAtRisk ? fmtMoney(ex.amountAtRisk) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {exceptions.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-4 text-center text-[var(--color-muted-foreground)]">No exceptions in this group</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right — Evidence viewer with File tabs */}
        <aside className="w-[380px] shrink-0 flex flex-col bg-[var(--color-card)]">
          {/* File tabs */}
          <div className="flex border-b border-[var(--color-border)] text-xs">
            <button
              onClick={() => switchFileTab('FILE_1')}
              className={`flex-1 py-2 font-medium ${activeFileTab === 'FILE_1' ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}`}
            >File 1</button>
            <button
              onClick={() => switchFileTab('FILE_2')}
              className={`flex-1 py-2 font-medium ${activeFileTab === 'FILE_2' ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}`}
            >File 2</button>
            <button
              onClick={() => switchFileTab('FILE_3')}
              className={`flex-1 py-2 font-medium ${activeFileTab === 'FILE_3' ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}`}
            >File 3</button>
          </div>
          <div className="flex-1 relative">
            {activeFileTab === 'FILE_3' ? (
              <div className="flex h-full items-center justify-center text-xs text-[var(--color-muted-foreground)]">No File 3 evidence linked</div>
            ) : (
              <EvidenceViewer pdfUrl={pdfUrl} pageNumber={activePage} onPageChange={setActivePage} />
            )}
          </div>
        </aside>
      </div>

      {/* Override Dialog */}
      <Dialog open={!!overrideTarget} onOpenChange={(open) => !open && setOverrideTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Value</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--color-text-secondary)]">Current value</label>
              <p className="text-sm font-medium">{overrideTarget?.amountAtRisk != null ? fmtMoney(overrideTarget.amountAtRisk) : '—'}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">New value</label>
              <Input value={overrideValue} onChange={(e) => setOverrideValue(e.target.value)} placeholder="Enter corrected value" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Reason (required)</label>
              <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Reason for override" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOverrideTarget(null)}>Cancel</Button>
              <Button disabled={!overrideReason.trim() || overrideSubmitting} onClick={handleOverrideSubmit}>
                {overrideSubmitting && <Loader2 className="mr-2 size-3 animate-spin" />}
                Confirm Override
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fmtMoney(v) {
  const n = parseFloat(v || 0);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
