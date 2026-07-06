/**
 * HitlPage — Sprint 8.
 * Final human review + approval gate. Shows summary stats, open exceptions,
 * and approve/reject controls. Active when pipeline is at human_review_gate.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  FileText, Users, AlertCircle, ShieldCheck, Clock,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Package {
  id: string;
  projectName: string;
  status: string;
  gcHeader?: {
    originalContractSum: string | null;
    contractSumToDate: string | null;
    currentPaymentDue: string | null;
    applicationNo: string | null;
  } | null;
  documents?: Array<{ id: string; filename: string; fileType: string | null }>;
}

interface ReconException {
  id: string;
  type: string;
  severity: string;
  subName: string | null;
  delta: string | null;
  evidence: string | null;
  status: string;
}

interface AiStatus {
  status: string;
  current_node: string | null;
  review_summary?: {
    open_exceptions: number;
    high_exceptions: number;
    sov_line_count: number;
    sub_count: number;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(v: string | null): string {
  if (!v) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls: Record<string, string> = {
    HIGH:   'bg-red-100 text-red-700',
    MEDIUM: 'bg-orange-100 text-orange-700',
    LOW:    'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls[severity] ?? 'bg-gray-100 text-gray-600'}`}>
      {severity}
    </span>
  );
}

// ─── HitlPage ─────────────────────────────────────────────────────────────────

export default function HitlPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [reason, setReason] = useState('');

  // Fetch package details
  const { data: pkg, isLoading: pkgLoading } = useQuery<Package>({
    queryKey: ['package', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}`) as Promise<Package>,
    staleTime: 10_000,
    enabled: !!packageId,
  });

  // Fetch open exceptions
  const { data: exceptions = [] } = useQuery<ReconException[]>({
    queryKey: ['exceptions', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}/exceptions`) as Promise<ReconException[]>,
    staleTime: 10_000,
    enabled: !!packageId,
  });

  // Poll AI status for review_summary and gate state
  const { data: aiStatus } = useQuery<AiStatus>({
    queryKey: ['ai-status', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}/ai-status`) as Promise<AiStatus>,
    refetchInterval: 4000,
    enabled: !!packageId,
  });

  // Review mutation (approve or reject)
  const { mutate: submitReview, isPending, error: reviewError } = useMutation({
    mutationFn: () =>
      apiFetch(`/packages/${packageId}/review`, {
        method: 'POST',
        body: JSON.stringify({ action, reason: reason.trim() || undefined }),
      }) as Promise<{ accepted: boolean; newStatus: string }>,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['package', packageId] });
      queryClient.invalidateQueries({ queryKey: ['ai-status', packageId] });
      if (data.newStatus === 'APPROVED') {
        navigate(`/packages/${packageId}/complete`);
      }
    },
  });

  const openExceptions = exceptions.filter((e) => e.status === 'OPEN');
  const highExceptions = openExceptions.filter((e) => e.severity === 'HIGH');
  const isAtGate = aiStatus?.current_node === 'human_review_gate' && aiStatus?.status === 'AWAITING_INPUT';
  const isAlreadyApproved = pkg?.status === 'APPROVED';
  const canApprove = openExceptions.length === 0;

  const summary = aiStatus?.review_summary;

  if (pkgLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-primary)]" />
      </div>
    );
  }

  if (isAlreadyApproved) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <ShieldCheck className="h-16 w-16 text-[var(--color-valid)]" />
        <h2 className="text-xl font-semibold">Package Approved</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          This pay application has been reviewed and approved.
        </p>
        <button onClick={() => navigate(`/packages/${packageId}/complete`)}
          className="rounded-md bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          View Completion Summary
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Final Human Review</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {isAtGate
            ? 'Pipeline complete. Review summary below and approve or reject this pay application.'
            : 'This page becomes active when the pipeline reaches the final review gate.'}
        </p>
      </div>

      {/* Pipeline not yet at gate */}
      {!isAtGate && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white p-12 text-center">
          <Clock className="h-10 w-10 opacity-20 text-[var(--color-text-secondary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Pipeline status: <span className="font-medium">{aiStatus?.status ?? pkg?.status ?? '—'}</span>
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Waiting for reconciliation to complete before the review gate opens.
          </p>
        </div>
      )}

      {isAtGate && (
        <>
          {/* GC Header summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Application No.', value: pkg?.gcHeader?.applicationNo ?? '—', icon: FileText },
              { label: 'Contract Sum', value: fmtCurrency(pkg?.gcHeader?.contractSumToDate ?? null), icon: FileText },
              { label: 'Payment Due', value: fmtCurrency(pkg?.gcHeader?.currentPaymentDue ?? null), icon: FileText },
              { label: 'Sub-Contractors', value: String(summary?.sub_count ?? '—'), icon: Users },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-lg border border-[var(--color-border)] bg-white p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
                  <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
                </div>
                <p className="text-sm font-semibold truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Exception summary */}
          <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-semibold">Reconciliation Summary</h3>
              <button
                onClick={() => navigate(`/packages/${packageId}/exceptions`)}
                className="text-xs text-[var(--color-brand-primary)] hover:underline"
              >
                View all exceptions →
              </button>
            </div>
            <div className="grid grid-cols-3 divide-x divide-[var(--color-border)]">
              {[
                { label: 'Total Exceptions', value: exceptions.length, cls: '' },
                { label: 'Open', value: openExceptions.length, cls: openExceptions.length > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-valid)]' },
                { label: 'High Severity', value: highExceptions.length, cls: highExceptions.length > 0 ? 'text-[var(--color-error)]' : 'text-[var(--color-valid)]' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="p-4 text-center">
                  <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
                  <p className={`text-2xl font-bold mt-0.5 ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Open exceptions list */}
          {openExceptions.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />
                <p className="text-sm font-medium text-[var(--color-warning)]">
                  {openExceptions.length} unresolved exception{openExceptions.length !== 1 ? 's' : ''} must be resolved before approval
                </p>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {openExceptions.slice(0, 5).map((ex) => (
                  <div key={ex.id} className="flex items-start gap-3 px-4 py-3">
                    <SeverityBadge severity={ex.severity} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{ex.type.replace(/_/g, ' ')}</p>
                      {ex.subName && <p className="text-xs text-[var(--color-text-secondary)]">{ex.subName}</p>}
                      {ex.evidence && (
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 font-mono truncate">{ex.evidence}</p>
                      )}
                    </div>
                    {ex.delta && (
                      <p className="text-xs font-mono text-[var(--color-error)] shrink-0">
                        ${Math.abs(parseFloat(ex.delta)).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
                {openExceptions.length > 5 && (
                  <div className="px-4 py-2 text-xs text-[var(--color-text-secondary)] text-center">
                    +{openExceptions.length - 5} more — <button onClick={() => navigate(`/packages/${packageId}/exceptions`)} className="text-[var(--color-brand-primary)] hover:underline">view all</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All clear */}
          {openExceptions.length === 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-valid)] bg-green-50 px-4 py-3">
              <ShieldCheck className="h-5 w-5 text-[var(--color-valid)] shrink-0" />
              <p className="text-sm font-medium text-[var(--color-valid)]">
                All exceptions resolved — ready for approval
              </p>
            </div>
          )}

          {/* Approve / Reject controls */}
          <div className="rounded-xl border border-[var(--color-border)] bg-white p-5">
            <h3 className="text-sm font-semibold mb-4">Decision</h3>

            {/* Action selector */}
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setAction('APPROVE')}
                disabled={!canApprove}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors
                  ${!canApprove ? 'opacity-40 cursor-not-allowed border-[var(--color-border)]' :
                    action === 'APPROVE'
                      ? 'border-[var(--color-valid)] bg-green-50 text-[var(--color-valid)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-valid)] hover:bg-green-50 hover:text-[var(--color-valid)]'
                  }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </button>
              <button
                onClick={() => setAction('REJECT')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors
                  ${action === 'REJECT'
                    ? 'border-[var(--color-error)] bg-red-50 text-[var(--color-error)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-error)] hover:bg-red-50 hover:text-[var(--color-error)]'
                  }`}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
            </div>

            {/* Cannot approve warning */}
            {!canApprove && action !== 'REJECT' && (
              <p className="text-xs text-[var(--color-warning)] mb-3 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Resolve all open exceptions before approving
              </p>
            )}

            {/* Reason input (required for REJECT, optional for APPROVE) */}
            {action && (
              <div className="mb-4">
                <label className="block text-xs font-medium mb-1.5">
                  {action === 'REJECT' ? 'Rejection reason *' : 'Approval note (optional)'}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder={action === 'REJECT' ? 'Explain why this application is being rejected…' : 'Optional note for the record…'}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)] resize-none"
                />
              </div>
            )}

            {/* Submit button */}
            {action && (
              <button
                onClick={() => void submitReview()}
                disabled={isPending || (action === 'REJECT' && !reason.trim())}
                className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity
                  ${action === 'APPROVE' ? 'bg-[var(--color-valid)]' : 'bg-[var(--color-error)]'}`}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> :
                  action === 'APPROVE' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {isPending ? 'Submitting…' : action === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            )}

            {reviewError && (
              <p className="mt-3 text-xs text-[var(--color-error)]">
                {reviewError instanceof Error ? reviewError.message : 'Submission failed. Please try again.'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

