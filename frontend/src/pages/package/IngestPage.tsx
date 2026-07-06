import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload, Cpu, FileSearch, ClipboardList, Users, FileText,
  GitMerge, AlertCircle, CheckCircle2, Loader2, Play,
  AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useShell } from '@/contexts/ShellContext';
import { io } from 'socket.io-client';
import ClassificationModal, { type ClassificationResult } from '@/components/ClassificationModal';

// ─── Step rail definition ─────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { key: 'upload',          label: 'File Upload & Receipt',                icon: Upload,        route: 'ingest'      },
  { key: 'classify',        label: 'Preliminary Classification',           icon: Cpu,           route: 'ingest'      },
  { key: 'extract_gc',      label: 'Extract GC Cover + G703',              icon: FileSearch,    route: 'cover'       },
  { key: 'plan',            label: 'Agent Plan: Sub-Contractors',          icon: ClipboardList, route: 'plan'        },
  { key: 'extract_subs',    label: 'Extract File 2: Sub-Contractors',      icon: Users,         route: 'file2'       },
  { key: 'extract_support', label: 'Extract File 3: Supporting Docs',      icon: FileText,      route: 'file2'       },
  { key: 'reconcile',       label: 'Cross-File Reconciliation',            icon: GitMerge,      route: 'exceptions'  },
  { key: 'exceptions',      label: 'Exception Assembly',                   icon: AlertCircle,   route: 'exceptions'  },
  { key: 'ready',           label: 'Ready for Review',                     icon: CheckCircle2,  route: 'hitl'        },
] as const;

type StepStatus = 'pending' | 'running' | 'complete' | 'paused' | 'error';

interface PipelineStatus {
  status: string;
  current_node: string | null;
  total_cost_usd: number | null;
  total_tokens: number | null;
  classifications?: ClassificationResult[];
}

interface Package {
  id: string;
  projectName: string;
  status: string;
}

interface StoredActivity {
  id: string;
  message: string;
  eventType: string;
  node: string | null;
  createdAt: string;
}

// ─── Map AI engine node names → step keys ─────────────────────────────────────
const NODE_TO_STEP: Record<string, string> = {
  ingest: 'upload',
  classify: 'classify',
  human_classify_gate: 'classify',
  extract_gc_header: 'extract_gc',
  extract_gc_sov: 'extract_gc',
  generate_plan: 'plan',
  human_plan_gate: 'plan',
  extract_subs: 'extract_subs',
  verify: 'extract_subs',
  retry: 'extract_subs',
  reconcile: 'reconcile',
  human_review_gate: 'exceptions',
  complete: 'ready',
};

function getStepStatuses(pkgStatus: string, currentNode: string | null): Record<string, StepStatus> {
  const statuses: Record<string, StepStatus> = {};
  const activeKey = currentNode ? (NODE_TO_STEP[currentNode] ?? null) : null;
  let found = false;

  for (const step of PIPELINE_STEPS) {
    if (pkgStatus === 'PENDING') {
      // Upload already happened — user arrived here after the intake form
      statuses[step.key] = step.key === 'upload' ? 'complete' : 'pending';
    } else if (pkgStatus === 'FAILED') {
      statuses[step.key] = found ? 'pending' : step.key === activeKey ? 'error' : 'complete';
      if (step.key === activeKey) found = true;
    } else if (pkgStatus === 'APPROVED' || pkgStatus === 'COMPLETED' || pkgStatus === 'REVIEW' || (activeKey === 'ready' && step.key === 'ready')) {
      statuses[step.key] = 'complete';
    } else {
      if (!found) {
        if (step.key === activeKey) {
          const isHumanGate = currentNode?.includes('human') || currentNode?.includes('gate');
          statuses[step.key] = isHumanGate ? 'paused' : 'running';
          found = true;
        } else if (activeKey === null) {
          // No active node yet — pipeline just started, only upload is running
          statuses[step.key] = step.key === 'upload' ? 'running' : 'pending';
        } else {
          statuses[step.key] = 'complete';
        }
      } else {
        statuses[step.key] = 'pending';
      }
    }
  }
  return statuses;
}

// ─── StepRail ─────────────────────────────────────────────────────────────────
function StepRail({ packageStatus, currentNode, activity, packageId }: { packageStatus: string; currentNode: string | null; activity: ActivityItem[]; packageId: string }) {
  const statuses = getStepStatuses(packageStatus, currentNode);

  // Get the last activity message relevant to each step
  const lastMsgForStep = (stepKey: string): string | null => {
    const nodeKeys = Object.entries(NODE_TO_STEP)
      .filter(([, v]) => v === stepKey)
      .map(([k]) => k);
    // Find last activity that looks relevant to this step
    const nodeLabel = PIPELINE_STEPS.find(s => s.key === stepKey)?.label ?? stepKey;
    for (let i = activity.length - 1; i >= 0; i--) {
      const msg = activity[i].message;
      if (nodeKeys.some(n => msg.toLowerCase().includes(n.replace(/_/g, ' '))) ||
          msg.toLowerCase().includes(stepKey.replace(/_/g, ' '))) {
        return msg.length > 55 ? msg.slice(0, 55) + '…' : msg;
      }
      // For upload step, look for "Ingesting"
      if (stepKey === 'upload' && msg.toLowerCase().includes('ingest')) {
        return msg.length > 55 ? msg.slice(0, 55) + '…' : msg;
      }
    }
    return null;
  };

  const statusMeta: Record<StepStatus, { iconBg: string; label: string; labelColor: string }> = {
    pending: { iconBg: 'bg-[var(--color-surface)] border-2 border-[var(--color-border)] text-[var(--color-text-disabled)]', label: 'text-[var(--color-text-disabled)]', labelColor: 'text-[var(--color-text-disabled)]' },
    running: { iconBg: 'bg-[var(--color-brand-primary)] text-white', label: 'text-[var(--color-brand-primary)] font-semibold', labelColor: 'text-[var(--color-brand-primary)]' },
    complete: { iconBg: 'bg-[var(--color-valid)] text-white', label: 'text-[var(--color-text-primary)]', labelColor: 'text-green-600' },
    paused: { iconBg: 'bg-[var(--color-warning)] text-white', label: 'text-[var(--color-warning)] font-semibold', labelColor: 'text-amber-600' },
    error: { iconBg: 'bg-[var(--color-error)] text-white', label: 'text-[var(--color-error)] font-semibold', labelColor: 'text-red-600' },
  };

  return (
    <ol className="relative space-y-0">
      {PIPELINE_STEPS.map((step, idx) => {
        const status = statuses[step.key] ?? 'pending';
        const Icon = step.icon;
        const isLast = idx === PIPELINE_STEPS.length - 1;
        const meta = statusMeta[status];
        const hint = (status === 'running' || status === 'complete') ? lastMsgForStep(step.key) : null;

        return (
          <li key={step.key} className={`flex gap-3 ${status === 'running' ? 'bg-blue-50/60 -mx-3 px-3 rounded-lg py-1' : ''}`}>
            <div className="flex flex-col items-center shrink-0">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.iconBg}`}>
                {status === 'running' ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : status === 'paused' ? <AlertTriangle className="h-3.5 w-3.5" />
                  : <Icon className="h-3.5 w-3.5" />}
              </div>
              {!isLast && <div className="mt-1 w-px flex-1 bg-[var(--color-border)]" style={{ minHeight: 16 }} />}
            </div>
            <div className={`pb-4 pt-1 flex-1 min-w-0 ${meta.label}`}>
              <div className="flex items-center gap-2">
                {(status === 'complete' || status === 'paused') && step.route !== 'ingest' ? (
                  <Link
                    to={`/packages/${packageId}/${step.route}`}
                    className="text-xs font-medium leading-tight hover:underline"
                    title={`Open ${step.label}`}
                  >
                    {step.label} ↗
                  </Link>
                ) : (
                  <p className="text-xs font-medium leading-tight">{step.label}</p>
                )}
                {status === 'complete' && <span className="shrink-0 text-[9px] font-bold text-green-600 bg-green-50 border border-green-200 rounded px-1">✓</span>}
                {status === 'paused' && <span className="shrink-0 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1">WAIT</span>}
                {status === 'error' && <span className="shrink-0 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1">ERR</span>}
              </div>
              {hint && <p className="mt-0.5 text-[10px] text-gray-400 leading-snug truncate" title={hint}>{hint}</p>}
              {status === 'running' && !hint && <p className="mt-0.5 text-[10px] text-blue-400 animate-pulse">Processing…</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Agent color registry ─────────────────────────────────────────────────────
const AGENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'GC Cover Extractor':    { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
  'Vision Tool':           { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'  },
  'SOV Parser':            { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200'},
  'pdfplumber':            { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  'Database':              { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200'},
  'Verifier':              { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200'   },
  'Classifier':            { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200'},
};
const DEFAULT_COLOR = { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };

function parseAgentMessage(message: string): { from: string; to: string; body: string } | null {
  // Match: [AgentName → Recipient]: message body
  const match = message.match(/^\[([^\]]+)\s*→\s*([^\]]+)\]:\s*(.+)$/s);
  if (match) return { from: match[1].trim(), to: match[2].trim(), body: match[3].trim() };
  return null;
}

// ─── ActivityFeed ─────────────────────────────────────────────────────────────
interface ActivityItem { time: Date; message: string; type?: 'info' | 'success' | 'error' | 'warn' }

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [items]);

  const dot: Record<string, string> = {
    success: 'bg-green-500', error: 'bg-red-500', warn: 'bg-amber-400', info: 'bg-blue-400',
  };

  return (
    <div className="h-full overflow-y-auto">
      {items.length === 0 ? (
        <div className="flex h-full items-center justify-center p-6">
          <p className="text-sm text-[var(--color-text-secondary)]">Waiting for pipeline to start…</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {items.map((item, i) => {
            const agentMsg = parseAgentMessage(item.message);
            if (agentMsg) {
              const fromColor = AGENT_COLORS[agentMsg.from] ?? DEFAULT_COLOR;
              const toColor = AGENT_COLORS[agentMsg.to] ?? DEFAULT_COLOR;
              return (
                <div key={i} className={`px-3 py-2 ${fromColor.bg} border-l-2 ${fromColor.border}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${fromColor.bg} ${fromColor.text} border ${fromColor.border}`}>
                      {agentMsg.from}
                    </span>
                    <span className="text-[10px] text-gray-400">→</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${toColor.bg} ${toColor.text} border ${toColor.border}`}>
                      {agentMsg.to}
                    </span>
                    <span className="ml-auto text-[9px] text-gray-400 tabular-nums shrink-0">
                      {item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className={`text-[11px] leading-relaxed ${fromColor.text}`}>{agentMsg.body}</p>
                </div>
              );
            }
            // Regular activity message
            return (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[item.type ?? 'info'] ?? dot.info}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed text-[var(--color-text-primary)]">{item.message}</p>
                </div>
                <span className="shrink-0 text-[10px] text-[var(--color-text-secondary)] tabular-nums">
                  {item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ─── IngestPage ───────────────────────────────────────────────────────────────
export default function IngestPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const navigate = useNavigate();
  const { setShellData } = useShell();
  const queryClient = useQueryClient();
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activitySeeded, setActivitySeeded] = useState(false);

  const addActivity = (message: string, type: ActivityItem['type'] = 'info') =>
    setActivity((prev) => [...prev, { time: new Date(), message, type }]);

  // Fetch persisted activity log on mount (shows history if user navigates back)
  const { data: persistedActivity } = useQuery<StoredActivity[]>({
    queryKey: ['activity', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}/activity`) as Promise<StoredActivity[]>,
    enabled: !!packageId,
    staleTime: 30_000,
  });

  // Seed activity state from DB on first load
  useEffect(() => {
    if (!activitySeeded && persistedActivity && persistedActivity.length > 0) {
      setActivity(persistedActivity.map((e) => ({
        time: new Date(e.createdAt),
        message: e.message,
        type: e.eventType as ActivityItem['type'],
      })));
      setActivitySeeded(true);
    }
  }, [persistedActivity, activitySeeded]);

  // Fetch package
  const { data: pkg } = useQuery<Package>({
    queryKey: ['package', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}`) as Promise<Package>,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status && ['APPROVED', 'FAILED', 'REVIEW'].includes(status) ? false : 3000;
    },
  });

  // Poll AI status
  const { data: aiStatus } = useQuery<PipelineStatus>({
    queryKey: ['ai-status', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}/ai-status`) as Promise<PipelineStatus>,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      // Stop polling only on terminal states; keep polling for AWAITING_INPUT so modal appears
      return s && ['COMPLETE', 'FAILED', 'UNKNOWN'].includes(s) ? false : 2000;
    },
    enabled: !!packageId && !!pkg && !['PENDING', 'APPROVED'].includes(pkg.status),
  });

  // Socket.io for real-time updates
  useEffect(() => {
    if (!packageId) return;
    const socket = io('http://localhost:3001', { withCredentials: true });
    socket.emit('join', `package:${packageId}`);
    socket.on('status_update', (data: { status?: string; current_node?: string; error_message?: string }) => {
      if (data.current_node) addActivity(`Node: ${data.current_node} → ${data.status ?? '…'}`);
      if (data.error_message) addActivity(`Error: ${data.error_message}`, 'error');
      if (data.status === 'APPROVED') addActivity('Pipeline complete!', 'success');
      queryClient.invalidateQueries({ queryKey: ['package', packageId] });
      queryClient.invalidateQueries({ queryKey: ['ai-status', packageId] });
    });
    socket.on('activity', (entry: { message: string; eventType: string; createdAt: string }) => {
      addActivity(entry.message, entry.eventType as ActivityItem['type']);
    });
    return () => { socket.disconnect(); };
  }, [packageId, queryClient]);

  // Update shell breadcrumb
  useEffect(() => {
    if (pkg) {
      const tone = pkg.status === 'APPROVED' ? 'success' : pkg.status === 'PENDING' ? 'neutral' : 'warn';
      setShellData({ contractName: pkg.projectName, statusLabel: pkg.status, statusTone: tone });
    }
  }, [pkg, setShellData]);

  // Start processing mutation
  const { mutate: startRun, isPending: starting } = useMutation({
    mutationFn: () => apiFetch(`/packages/${packageId}/run`, { method: 'POST' }) as Promise<unknown>,
    onSuccess: () => {
      addActivity('Pipeline started — ingesting documents…', 'info');
      queryClient.invalidateQueries({ queryKey: ['package', packageId] });
    },
    onError: (err) => addActivity(`Failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error'),
  });

  const packageStatus = pkg?.status ?? 'PENDING';
  const currentNode = aiStatus?.current_node ?? null;
  const isIdle = packageStatus === 'PENDING';
  const isFailed = packageStatus === 'FAILED';
  const isCompleted = packageStatus === 'COMPLETED' || packageStatus === 'APPROVED';
  const isRunning = !isIdle && !isFailed && !isCompleted;
  const costDisplay = aiStatus?.total_cost_usd != null && aiStatus.total_cost_usd > 0
    ? `$${aiStatus.total_cost_usd.toFixed(4)}`
    : '—';

  // Classification gate: AI engine paused for human confirmation
  const isAwaitingClassification =
    aiStatus?.status === 'AWAITING_INPUT' && aiStatus?.current_node === 'human_classify_gate';
  const pendingClassifications: ClassificationResult[] = aiStatus?.classifications ?? [];

  // Plan gate: AI engine paused waiting for sub-contractor plan confirmation
  const isAwaitingPlan =
    aiStatus?.status === 'AWAITING_INPUT' && aiStatus?.current_node === 'human_plan_gate';

  // Auto-navigate to cover page once GC extraction is done (plan gate fires)
  const navigatedRef = useRef(false);
  useEffect(() => {
    if (isAwaitingPlan && !navigatedRef.current && packageId) {
      navigatedRef.current = true;
      navigate(`/packages/${packageId}/cover`);
    }
  }, [isAwaitingPlan, packageId, navigate]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Classification gate modal */}
      {isAwaitingClassification && pendingClassifications.length > 0 && (
        <ClassificationModal
          packageId={packageId!}
          classifications={pendingClassifications}
          onConfirmed={() => {
            addActivity('Classification confirmed — resuming pipeline…', 'info');
            queryClient.invalidateQueries({ queryKey: ['ai-status', packageId] });
            queryClient.invalidateQueries({ queryKey: ['package', packageId] });
          }}
        />
      )}

      {/* Header bar */}
      <div className="shrink-0 flex items-center gap-4 px-6 py-3 bg-white border-b border-[var(--color-border)]">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-gray-900 leading-tight">Processing Pipeline</h2>
          <p className="text-xs text-[var(--color-text-secondary)] truncate">{pkg?.projectName}</p>
        </div>

        {/* Inline status pills */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            packageStatus === 'APPROVED' ? 'bg-green-100 text-green-700' :
            packageStatus === 'FAILED'   ? 'bg-red-100 text-red-700' :
            isRunning                    ? 'bg-blue-100 text-[var(--color-brand-primary)]' :
                                           'bg-gray-100 text-gray-600'
          }`}>
            {isRunning && <Loader2 className="h-3 w-3 animate-spin" />}
            {packageStatus}
          </span>
          {currentNode && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 font-mono">
              {currentNode}
            </span>
          )}
          {aiStatus?.total_cost_usd != null && aiStatus.total_cost_usd > 0 && (
            <span className="text-xs text-gray-400">Cost: ${aiStatus.total_cost_usd.toFixed(4)}</span>
          )}
        </div>

        {/* Action button */}
        {isIdle && (
          <button onClick={() => { void startRun(); }} disabled={starting}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 shrink-0">
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Start Processing
          </button>
        )}
        {isFailed && (
          <button onClick={() => { void startRun(); }} disabled={starting}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 shrink-0">
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Retry
          </button>
        )}
      </div>

      {/* Plan gate banner */}
      {isAwaitingPlan && (
        <div className="shrink-0 flex items-center justify-between border-b border-orange-200 bg-orange-50 px-6 py-3">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-orange-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Sub-Contractor Plan Ready for Review</p>
              <p className="text-xs text-orange-600">Review the agent's extraction plan before processing begins.</p>
            </div>
          </div>
          <a href={`/packages/${packageId}/plan`}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
            Review Plan →
          </a>
        </div>
      )}

      {/* Main two-panel body */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Step Rail */}
        <div className="w-[260px] shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-white px-4 py-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Pipeline Steps</p>
          <StepRail packageStatus={packageStatus} currentNode={currentNode} activity={activity} packageId={packageId!} />
        </div>

        {/* MIDDLE — Activity Log (full height) */}
        <div className="flex flex-1 flex-col overflow-hidden bg-[var(--color-surface)] px-6 py-4">
          <div className="mb-3 flex items-center justify-between shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Activity Log</p>
            <span className="text-[10px] text-gray-400">{activity.length} events</span>
          </div>
          <div className="flex-1 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white">
            {activity.length === 0 ? (
              <div className="flex h-full items-center justify-center p-8">
                <p className="text-sm text-[var(--color-text-secondary)]">Waiting for pipeline to start…</p>
              </div>
            ) : (
              <ActivityFeed items={activity} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

