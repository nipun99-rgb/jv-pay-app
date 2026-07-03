import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { apiFetch } from '@/lib/api.js';
import ValidationBadge from '@/components/shared/ValidationBadge.jsx';
import EvidenceViewer from '@/components/EvidenceViewer.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Info, AlertTriangle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';

const SEVERITY_ICON = { info: Info, warning: AlertTriangle, error: XCircle };

export default function File2Page() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { steps, pkg: ctxPkg } = useOutletContext();
  const [logs, setLogs] = useState([]);
  const [subLines, setSubLines] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [sovLinesByHeader, setSovLinesByHeader] = useState({});
  const [activePage, setActivePage] = useState(1);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const sinceRef = useRef(null);
  const feedRef = useRef(null);

  // Gate check: redirect back to plan if AGENT_PLAN not confirmed
  const agentPlanStep = steps?.find(s => s.stepName === 'AGENT_PLAN');
  useEffect(() => {
    if (steps?.length > 0 && agentPlanStep && agentPlanStep.status === 'pending') {
      navigate(`/packages/${packageId}/plan`, { replace: true });
    }
  }, [steps, agentPlanStep, packageId, navigate]);

  // Poll activity
  useEffect(() => {
    const poll = async () => {
      try {
        const url = sinceRef.current
          ? `/activity/${packageId}?since=${sinceRef.current}`
          : `/activity/${packageId}`;
        const data = await apiFetch(url);
        if (data.length > 0) {
          setLogs(prev => {
            const seenIds = new Set(prev.map(l => l.id));
            const newEntries = data.filter(l => !seenIds.has(l.id));
            return newEntries.length > 0 ? [...prev, ...newEntries] : prev;
          });
          sinceRef.current = data[data.length - 1].createdAt;
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [packageId]);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [logs]);

  // Load sub-contractor data only after EXTRACT_FILE2 is actually complete.
  // Do NOT gate on any-step-done — that fires far too early (e.g. after INGEST).
  const extractFile2 = steps?.find(s => s.stepName === 'EXTRACT_FILE2');
  const extractFile3 = steps?.find(s => s.stepName === 'EXTRACT_FILE3');
  const DONE_STATUSES = ['complete', 'confirmed', 'done', 'skipped'];
  const extractionDone =
    // If steps are temporarily unavailable, still allow loading extracted output data.
    !steps || steps.length === 0 ||
    DONE_STATUSES.includes(extractFile2?.status) ||
    // Fallback: if EXTRACT_FILE2 step doesn't exist yet, check EXTRACT_FILE3
    (!extractFile2 && DONE_STATUSES.includes(extractFile3?.status));

  // Always load the PDF URL as soon as the package is known — independent of extraction status.
  useEffect(() => {
    const loadPdf = async () => {
      try {
        const pkg = ctxPkg || await apiFetch(`/packages/${packageId}`);
        const file2Doc = pkg.documents?.find(d => d.fileRole === 'FILE_2');
        if (file2Doc) setPdfUrl(`/api/packages/${packageId}/pdf/${file2Doc.id}`);
      } catch {}
    };
    loadPdf();
  }, [packageId, ctxPkg]);

  // Load sub-header data only once extraction is done.
  useEffect(() => {
    if (!extractionDone) return;
    let cancelled = false;
    let retryTimer;
    let attempts = 0;
    const MAX_ATTEMPTS = 8;

    const load = async () => {
      attempts += 1;
      try {
        const [headers, pkg] = await Promise.all([
          apiFetch(`/packages/${packageId}/sub-headers`).catch(() => []),
          apiFetch(`/packages/${packageId}`).catch(() => null),
        ]);

        if (cancelled) return;

        const nextHeaders = headers || [];
        // Keep prior good data on transient empty responses during warm-up/retries.
        setSubLines(prev => (nextHeaders.length > 0 ? nextHeaders : prev));

        const resolvedPkg = pkg || ctxPkg || null;
        const file2Doc = resolvedPkg?.documents?.find(d => d.fileRole === 'FILE_2');
        if (file2Doc) setPdfUrl(`/api/packages/${packageId}/pdf/${file2Doc.id}`);

        const hasHeaders = nextHeaders.length > 0;
        const hasDoc = !!file2Doc;

        // Retry briefly if data has not surfaced yet, while preserving loading state.
        if (!hasHeaders || !hasDoc) {
          if (attempts < MAX_ATTEMPTS) {
            setLoading(true);
            retryTimer = setTimeout(load, 1500);
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error('File2Page load error:', e.message);
        if (!cancelled) {
          if (attempts < MAX_ATTEMPTS) {
            setLoading(true);
            retryTimer = setTimeout(load, 1500);
          } else {
            setLoading(false);
          }
        }
      }
    };
    setLoading(true);
    load();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [packageId, extractionDone, ctxPkg]);

  // Group lines by sub-contractor
  const grouped = {};
  subLines.forEach(line => {
    const key = line.subContractorName || line.subContractorId || 'Unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(line);
  });

  const toggleExpand = async (headerId, startPage) => {
    const isOpen = !!expanded[headerId];
    setExpanded(prev => ({ ...prev, [headerId]: !prev[headerId] }));
    if (startPage) setActivePage(startPage);
    // Fetch SOV lines the first time we expand this row
    if (!isOpen && sovLinesByHeader[headerId] === undefined) {
      try {
        const lines = await apiFetch(`/packages/${packageId}/sub-sov-lines?headerId=${headerId}`);
        setSovLinesByHeader(prev => ({ ...prev, [headerId]: lines || [] }));
      } catch {
        setSovLinesByHeader(prev => ({ ...prev, [headerId]: [] }));
      }
    }
  };

  return (
    <div className="flex h-full">
      {/* Left — Activity + Sub table */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Activity feed (top) */}
        <div className="h-48 shrink-0 border-b border-border p-3">
          <h3 className="mb-2 text-xs font-semibold text-[var(--color-text-primary)]">Processing Log</h3>
          <div ref={feedRef} className="h-32 overflow-auto space-y-1 rounded border border-border bg-[var(--color-surface)] p-2">
            {logs.filter(l => l.stepNo >= 5).map((log, i) => {
              const Icon = SEVERITY_ICON[log.level] || Info;
              return (
                <div key={log.id || i} className="flex items-start gap-1.5 text-xs">
                  <Icon className="mt-0.5 size-3 shrink-0" style={{ color: log.level === 'error' ? 'var(--color-error)' : 'var(--color-text-secondary)' }} />
                  <span className="flex-1 text-[var(--color-text-primary)]">{log.message}</span>
                </div>
              );
            })}
            {!extractionDone && <p className="text-xs text-[var(--color-text-secondary)]">Extraction in progress...</p>}
            {extractionDone && loading && <p className="text-xs text-[var(--color-text-secondary)]">Loading extracted output...</p>}
          </div>
        </div>

        {/* Sub-contractor table (bottom) */}
        <div className="flex-1 overflow-auto p-3">
          {!extractionDone || loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <>
              <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
                Sub-Contractor Applications ({subLines.length})
              </h3>
              {subLines.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)]">No sub-contractor data extracted yet.</p>
              ) : (
                <div className="space-y-1">
                  {subLines.map(h => {
                    const name = h.subcontractorName || h.subContractorName || '—';
                    const isOpen = !!expanded[h.id];
                    const sovLines = sovLinesByHeader[h.id];
                    return (
                      <div key={h.id} className="rounded border border-border overflow-hidden">
                        {/* Header row — click to expand */}
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-surface)] transition-colors"
                          onClick={() => toggleExpand(h.id, h.startPage)}
                        >
                          {isOpen
                            ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-secondary)]" />
                            : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-secondary)]" />}
                          <span className="flex-1 text-xs font-medium">{name}</span>
                          <span className="text-xs tabular-nums text-[var(--color-text-secondary)]">
                            {fmtMoney(h.completedWorkThisPeriod)}
                          </span>
                          <ValidationBadge status={h.validationStatus || 'unchecked'} />
                        </button>

                        {/* Expandable detail */}
                        {isOpen && (
                          <div className="border-t border-border bg-gray-50/60 px-4 py-3 space-y-4">
                            {/* G702 Cover Page Summary */}
                            <div>
                              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">G702 — Cover Page Summary</p>
                              <table className="w-full text-xs">
                                <tbody className="divide-y divide-gray-100">
                                  <DetailRow label="Original Contract Sum" value={fmtMoney(h.originalContractSum)} />
                                  <DetailRow label="Net Change Orders" value={fmtMoney(h.netChangeOrders)} />
                                  <DetailRow label="Contract Sum to Date" value={fmtMoney(h.contractSumToDate)} bold />
                                  <DetailRow label="Total Completed & Stored" value={fmtMoney(h.totalCompletedStored)} />
                                  <DetailRow label="Work Completed This Period" value={fmtMoney(h.completedWorkThisPeriod)} highlight />
                                  <DetailRow label="Total Retainage" value={fmtMoney(h.totalRetainage)} />
                                  <DetailRow label="Retainage %" value={h.retainagePercent ? `${h.retainagePercent}%` : '—'} />
                                  <DetailRow label="Total Earned Less Retainage" value={fmtMoney(h.totalEarnedLessRetainage)} />
                                  <DetailRow label="Less Previous Certificates" value={fmtMoney(h.lessPrevCertificates)} />
                                  <DetailRow label="Current Payment Due" value={fmtMoney(h.currentPaymentDue)} bold highlight />
                                  <DetailRow label="Balance to Finish" value={fmtMoney(h.balanceToFinish)} />
                                </tbody>
                              </table>
                              {h.periodTo && (
                                <p className="mt-1.5 text-[11px] text-[var(--color-text-secondary)]">Period to: {h.periodTo} · App #{h.applicationNo || '—'}</p>
                              )}
                            </div>

                            {/* G703 Continuation Sheet — grand totals */}
                            {(h.g703ScheduledValue || h.g703WorkThisPeriod || h.g703TotalCompleted) && (
                              <div>
                                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">G703 — Continuation Sheet Totals</p>
                                <table className="w-full text-xs">
                                  <tbody className="divide-y divide-gray-100">
                                    <DetailRow label="Scheduled Value" value={fmtMoney(h.g703ScheduledValue)} />
                                    <DetailRow label="Work Completed Previous" value={fmtMoney(h.g703WorkPrev)} />
                                    <DetailRow label="Work Completed This Period" value={fmtMoney(h.g703WorkThisPeriod)} highlight />
                                    <DetailRow label="Materials Stored" value={fmtMoney(h.g703MaterialsStored)} />
                                    <DetailRow label="Total Completed & Stored" value={fmtMoney(h.g703TotalCompleted)} bold />
                                    <DetailRow label="Retainage" value={fmtMoney(h.g703Retainage)} />
                                    <DetailRow label="Earned Less Retainage" value={fmtMoney(h.g703EarnedLessRet)} />
                                    <DetailRow label="Balance to Finish" value={fmtMoney(h.g703BalanceToFinish)} />
                                  </tbody>
                                </table>
                                {h.reconFlag && (
                                  <p className={`mt-1 text-[11px] font-medium ${h.reconFlag === 'MATCH' ? 'text-green-600' : 'text-red-600'}`}>
                                    G702 vs G703 Recon: {h.reconFlag}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* G703 Individual SOV Line Items */}
                            {sovLines === undefined && (
                              <p className="text-[11px] text-[var(--color-text-secondary)]">Loading line items...</p>
                            )}
                            {sovLines && sovLines.length > 0 && (
                              <div>
                                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">G703 — Schedule of Values Line Items ({sovLines.length})</p>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-[11px]">
                                    <thead>
                                      <tr className="border-b border-gray-200 text-left text-[var(--color-text-secondary)]">
                                        <th className="pb-1 pr-2">#</th>
                                        <th className="pb-1 pr-2">Description</th>
                                        <th className="pb-1 pr-2 text-right">Scheduled Value</th>
                                        <th className="pb-1 pr-2 text-right">This Period</th>
                                        <th className="pb-1 pr-2 text-right">Total Completed</th>
                                        <th className="pb-1 text-right">% Complete</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {sovLines.map((line, i) => (
                                        <tr key={line.id || i} className="hover:bg-white/70">
                                          <td className="py-0.5 pr-2 text-[var(--color-text-secondary)]">{line.itemNo || i + 1}</td>
                                          <td className="py-0.5 pr-2 max-w-[200px] truncate">{line.description || '—'}</td>
                                          <td className="py-0.5 pr-2 text-right tabular-nums">{fmtMoney(line.scheduledValue)}</td>
                                          <td className="py-0.5 pr-2 text-right tabular-nums text-blue-700">{fmtMoney(line.workCompletedThis)}</td>
                                          <td className="py-0.5 pr-2 text-right tabular-nums">{fmtMoney(line.totalCompleted)}</td>
                                          <td className="py-0.5 text-right tabular-nums">{line.pctComplete != null ? `${line.pctComplete}%` : '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                            {sovLines && sovLines.length === 0 && (
                              <p className="text-[11px] text-[var(--color-text-secondary)] italic">No G703 line items extracted yet. Re-run extraction to populate.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right — Evidence Viewer */}
      <div className="w-[360px] shrink-0 border-l border-border">
        <EvidenceViewer pdfUrl={pdfUrl} pageNumber={activePage} onPageChange={setActivePage} />
      </div>
    </div>
  );
}

function fmtMoney(v) {
  const n = parseFloat(v || 0);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function DetailRow({ label, value, bold, highlight }) {
  return (
    <tr>
      <td className="py-1 pr-4 text-[var(--color-text-secondary)]">{label}</td>
      <td className={`py-1 text-right tabular-nums ${
        bold ? 'font-semibold' : ''
      } ${
        highlight ? 'text-blue-700' : 'text-[var(--color-text-primary)]'
      }`}>{value}</td>
    </tr>
  );
}
