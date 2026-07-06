import { Outlet, useParams, useLocation, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useShell } from '@/contexts/ShellContext';
import { apiFetch } from '@/lib/api';
import { CheckCircle2, Loader2, Clock, AlertCircle, X, Layers } from 'lucide-react';

interface Package { id: string; projectName: string; status: string }
interface AiStatus { status: string; current_node: string | null; total_cost_usd: number | null }

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warn' | 'success'> = {
  PENDING: 'neutral', INGESTING: 'info', CLASSIFYING: 'info', EXTRACTING: 'info',
  AWAITING_PLAN: 'warn', VERIFYING: 'info', RECONCILING: 'warn',
  REVIEW: 'warn', APPROVED: 'success', FAILED: 'neutral',
};

// Pipeline step definitions
const STEPS = [
  { key: 'upload',     label: 'File Upload & Receipt',        node: null,                     route: 'ingest' },
  { key: 'classify',   label: 'Preliminary Classification',   node: 'human_classify_gate',    route: 'ingest' },
  { key: 'cover',      label: 'G702 Cover Sheet',             node: 'extract_gc_header',      route: 'cover' },
  { key: 'sov',        label: 'G703 Continuation Sheet',      node: 'extract_gc_sov',         route: 'cover' },
  { key: 'plan',       label: 'Sub-Contractor Plan',          node: 'human_plan_gate',        route: 'plan' },
  { key: 'subs',       label: 'Sub-Contractor Extraction',    node: 'extract_subs',           route: 'file2' },
  { key: 'reconcile',  label: 'Reconciliation',               node: 'reconcile',              route: 'exceptions' },
  { key: 'review',     label: 'Final Human Review',           node: 'human_review_gate',      route: 'hitl' },
  { key: 'complete',   label: 'Approved',                     node: 'complete',               route: 'complete' },
];

const NODE_TO_STEP: Record<string, string> = {
  ingest: 'upload', classify: 'classify',
  human_classify_gate: 'classify', extract_gc_header: 'cover',
  extract_gc_sov: 'sov', generate_plan: 'plan', human_plan_gate: 'plan',
  extract_subs: 'subs', verify: 'subs', retry: 'subs',
  reconcile: 'reconcile', human_review_gate: 'review', complete: 'complete',
};

function PipelinePopup({ packageId, onClose }: { packageId: string; onClose: () => void }) {
  const { data: aiStatus } = useQuery<AiStatus>({
    queryKey: ['ai-status', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}/ai-status`) as Promise<AiStatus>,
    refetchInterval: 3000,
  });
  const { data: pkg } = useQuery<Package>({
    queryKey: ['package', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}`) as Promise<Package>,
    staleTime: 5000,
  });

  const currentStepKey = aiStatus?.current_node ? (NODE_TO_STEP[aiStatus.current_node] ?? null) : null;
  const isApproved = pkg?.status === 'APPROVED';
  const location = useLocation();

  // Determine which steps are complete
  const currentIdx = STEPS.findIndex(s => s.key === currentStepKey);

  function getStatus(i: number): 'complete' | 'active' | 'paused' | 'pending' {
    if (isApproved) return 'complete';
    if (i < currentIdx) return 'complete';
    if (i === currentIdx) {
      return aiStatus?.status === 'AWAITING_INPUT' ? 'paused' : 'active';
    }
    // upload is always complete if we're past PENDING
    if (STEPS[i].key === 'upload' && pkg?.status !== 'PENDING') return 'complete';
    return 'pending';
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 w-72 rounded-2xl border border-[var(--color-border)] bg-white shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-brand-primary)] text-white">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4" />
          <span className="text-sm font-semibold">Pipeline Steps</span>
        </div>
        <button onClick={onClose} className="hover:bg-white/20 rounded p-0.5 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-3 space-y-1 max-h-80 overflow-y-auto">
        {STEPS.map((step, i) => {
          const status = getStatus(i);
          const isCurrentPage = location.pathname.includes(step.route);
          return (
            <Link
              key={step.key}
              to={`/packages/${packageId}/${step.route}`}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors ${
                isCurrentPage ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
              }`}
            >
              <span className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full ${
                status === 'complete' ? 'bg-green-500 text-white' :
                status === 'active'   ? 'bg-blue-500 text-white animate-pulse' :
                status === 'paused'   ? 'bg-amber-400 text-white' :
                'bg-gray-100 text-gray-400'
              }`}>
                {status === 'complete' ? <CheckCircle2 className="h-3 w-3" /> :
                 status === 'active'   ? <Loader2 className="h-3 w-3 animate-spin" /> :
                 status === 'paused'   ? <AlertCircle className="h-3 w-3" /> :
                 <Clock className="h-3 w-3" />}
              </span>
              <span className={`flex-1 font-medium ${
                status === 'complete' ? 'text-green-700 line-through decoration-green-400' :
                status === 'active'   ? 'text-blue-700' :
                status === 'paused'   ? 'text-amber-700' :
                'text-gray-400'
              }`}>
                {step.label}
              </span>
              {status === 'paused' && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded">REVIEW</span>}
              {isCurrentPage && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1 rounded">HERE</span>}
            </Link>
          );
        })}
      </div>
      {aiStatus?.total_cost_usd != null && aiStatus.total_cost_usd > 0 && (
        <div className="border-t border-[var(--color-border)] px-4 py-2 text-[10px] text-gray-400 flex justify-between">
          <span>AI Cost</span>
          <span className="font-mono">${aiStatus.total_cost_usd.toFixed(4)}</span>
        </div>
      )}
    </div>
  );
}

export default function PackageLayout() {
  const { packageId } = useParams<{ packageId: string }>();
  const { setShellData, clearShell } = useShell();
  const [showPipeline, setShowPipeline] = useState(false);

  const { data: pkg } = useQuery<Package>({
    queryKey: ['package', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}`) as Promise<Package>,
    enabled: !!packageId,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (pkg) {
      setShellData({
        contractName: pkg.projectName,
        statusLabel: pkg.status,
        statusTone: STATUS_TONE[pkg.status] ?? 'neutral',
      });
    } else {
      setShellData({ contractName: packageId ?? 'Package', statusLabel: 'Loading…', statusTone: 'neutral' });
    }
    return () => clearShell();
  }, [pkg, packageId, setShellData, clearShell]);

  return (
    <>
      <Outlet />

      {/* Floating pipeline steps button */}
      {packageId && (
        <>
          <button
            onClick={() => setShowPipeline(v => !v)}
            className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 ${
              showPipeline ? 'bg-gray-700' : 'bg-[var(--color-brand-primary)]'
            }`}
          >
            <Layers className="h-4 w-4" />
            Pipeline Steps
          </button>

          {showPipeline && (
            <PipelinePopup packageId={packageId} onClose={() => setShowPipeline(false)} />
          )}
        </>
      )}
    </>
  );
}
