import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { apiFetch } from '@/lib/api.js';
import { Check, Loader2, Pause } from 'lucide-react';

const DISPLAY_STEPS = [
  { stepName: 'INGEST', title: 'File Upload & Receipt' },
  { stepName: 'CLASSIFY', title: 'Preliminary Classification' },
  { stepName: 'EXTRACT_FILE1', title: 'Extract GC Cover + G703' },
  { stepName: 'AGENT_PLAN', title: 'Agent Plan: Sub-Contractors' },
  { stepName: 'EXTRACT_FILE2', title: 'Extract File 2: Sub-Contractors' },
  { stepName: 'EXTRACT_FILE3', title: 'Extract File 3: Supporting Docs' },
  { stepName: 'RECONCILE', title: 'Cross-File Reconciliation' },
  { stepName: 'VALIDATE', title: 'Exception Assembly' },
  { stepName: 'REVIEW', title: 'Ready for Review' },
];

export default function IngestPage() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { steps, pkg } = useOutletContext();
  const [logs, setLogs] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const feedRef = useRef(null);
  const sinceRef = useRef(null);

  // Poll activity feed every 2s
  useEffect(() => {
    const poll = async () => {
      try {
        const url = sinceRef.current
          ? `/activity/${packageId}?since=${sinceRef.current}`
          : `/activity/${packageId}`;
        const data = await apiFetch(url);
        if (data.length > 0) {
          setLogs(prev => [...prev, ...data]);
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

  const classifyStep = steps?.find(s => s.stepName === 'CLASSIFY');
  const extractFile1Step = steps?.find(s => s.stepName === 'EXTRACT_FILE1');
  const showConfirmCard = classifyStep?.status === 'paused';
  const classifyDone = classifyStep?.status === 'complete' || classifyStep?.status === 'confirmed';
  const extractFile1Done = extractFile1Step?.status === 'complete' || extractFile1Step?.status === 'confirmed';

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await apiFetch(`/pipeline/${packageId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ stepName: 'CLASSIFY' }),
      });
      setTimeout(() => navigate(`/packages/${packageId}/file1`), 800);
    } catch (err) {
      console.error(err);
    } finally {
      setConfirming(false);
    }
  };

  const periodLabel = pkg?.billingPeriodMonth
    ? new Date(pkg.billingPeriodYear, pkg.billingPeriodMonth - 1).toLocaleString('default', { month: 'short', year: 'numeric' })
    : '';

  // Map backend steps to display steps
  const displaySteps = DISPLAY_STEPS.map((ds, idx) => {
    const backendStep = steps?.find(s => s.stepName === ds.stepName);
    let status = 'pending';
    if (backendStep) {
      if (backendStep.status === 'complete' || backendStep.status === 'confirmed') status = 'done';
      else if (backendStep.status === 'running') status = 'running';
      else if (backendStep.status === 'paused') status = 'pause';
      else if (backendStep.status === 'error') status = 'error';
    }
    return {
      n: idx + 1,
      title: ds.title,
      status,
      detail: backendStep?.subProgressLabel || undefined,
      progress: parseProgress(backendStep?.subProgressLabel),
    };
  });

  return (
    <div className="flex h-full">
      {/* Left: Step Rail */}
      <aside className="w-[380px] shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="mb-5">
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">Processing</div>
          <div className="mt-0.5 text-sm font-semibold">{periodLabel} · {pkg?.contract?.contractName || ''}</div>
        </div>

        <ol className="space-y-2">
          {displaySteps.map((step) => {
            const isDone = step.status === 'done';
            const isRunning = step.status === 'running';
            const isPause = step.status === 'pause';

            return (
              <li
                key={step.n}
                className={`rounded-md border p-3 transition-colors ${
                  isRunning ? 'border-l-[3px] border-blue-500 bg-blue-50/40 border-t-blue-200 border-r-blue-200 border-b-blue-200'
                  : isPause ? 'border-orange-300/40 bg-orange-50'
                  : isDone ? 'border-[var(--color-border)] bg-[var(--color-background)]'
                  : 'border-dashed border-[var(--color-border)] bg-[var(--color-background)]/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[11px] font-medium text-[var(--color-muted-foreground)]">Step {step.n}</span>
                  {isDone && <Check className="h-3.5 w-3.5 text-green-600" />}
                  {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-primary)]" />}
                  {isPause && <Pause className="h-3.5 w-3.5 text-orange-500" />}
                  {step.status === 'pending' && <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-border)]" />}
                </div>
                <div className={`mt-1 text-sm ${step.status === 'pending' ? 'text-[var(--color-muted-foreground)]' : ''}`}>
                  {step.title}
                </div>
                {step.detail && !step.progress && (
                  <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    {(() => {
                      const d = step.detail;
                      if (d && d.startsWith('[{')) {
                        try { const arr = JSON.parse(d); return `${arr.length} sub-contractors identified`; } catch { return d; }
                      }
                      return d;
                    })()}
                  </div>
                )}
                {step.progress && (
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
                      <div
                        className="h-full bg-[var(--color-primary)] transition-all"
                        style={{ width: `${(step.progress.current / step.progress.total) * 100}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-[var(--color-muted-foreground)]">
                      <span>{step.progress.label}</span>
                      <span>{step.progress.current}/{step.progress.total}</span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </aside>

      {/* Right: Activity Feed + Contextual Card */}
      <section className="flex-1 min-w-0 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-sm font-semibold">Activity</h2>
          <ol ref={feedRef} className="space-y-3">
            {logs.length === 0 && (
              <li className="text-xs text-[var(--color-muted-foreground)]">Waiting for activity...</li>
            )}
            {logs.map((log, i) => (
              <li key={`${log.id}-${i}`} className="flex gap-3 text-sm">
                <span className="w-14 shrink-0 pt-0.5 text-[11px] tabular-nums text-[var(--color-muted-foreground)]">
                  {log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : ''}
                </span>
                <span className="mt-0.5 flex-shrink-0 pt-0.5">
                  {log.level === 'warning' && <span className="block h-2 w-2 rounded-full bg-orange-500 mt-1" />}
                  {log.level === 'error' && <span className="block h-2 w-2 rounded-full bg-red-500 mt-1" />}
                  {log.level === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 mt-0.5" />}
                  {(!log.level || log.level === 'success' || log.level === 'info') && <Check className="h-3.5 w-3.5 text-green-600 mt-0.5" />}
                </span>
                <div className="min-w-0">
                  <div>{log.message}</div>
                </div>
              </li>
            ))}
          </ol>

          {/* Contextual Card: Classify confirmation */}
          {showConfirmCard && (
            <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="text-sm font-medium">Preliminary check complete</div>
              <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                All files parsed. Detected G702/G703 in File 1. Ready to extract.
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
                >
                  {confirming && <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />}
                  Confirm & Continue →
                </button>
              </div>
            </div>
          )}

          {/* Contextual Card: Extract done → go to plan/file1 */}
          {classifyDone && extractFile1Done && (
            <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="text-sm font-medium">Extraction Complete</div>
              <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                G702 cover and G703 SOV lines have been extracted.
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => navigate(`/packages/${packageId}/plan`)}
                  className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
                >
                  Continue to Agent Plan →
                </button>
              </div>
            </div>
          )}

          {classifyDone && !extractFile1Done && (
            <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="text-sm font-medium">Classification Confirmed</div>
              <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                Extraction is running. This view auto-advances when complete.
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => navigate(`/packages/${packageId}/file1`)}
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  Skip to File 1 →
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function parseProgress(label) {
  if (!label) return null;
  const match = label.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  return { current: parseInt(match[1]), total: parseInt(match[2]), label };
}
