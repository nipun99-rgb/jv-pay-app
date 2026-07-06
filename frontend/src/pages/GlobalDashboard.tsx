import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileStack, AlertTriangle, Clock, Trash2, X } from 'lucide-react';
import { useShell } from '@/contexts/ShellContext';
import { apiFetch } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Package {
  id: string;
  projectName: string;
  status: string;
  createdBy: string;
  createdAt: string;
  contractId: string | null;
  contract: { id: string; name: string; client: { id: string; name: string } } | null;
  totalCostUsd: number | null;
  totalTokens: number | null;
  documents: { id: string; filename: string; fileType: string | null }[];
  exceptions: { id: string; type: string; severity: string }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function packageRoute(status: string): string {
  const map: Record<string, string> = {
    INGESTING: 'ingest',
    CLASSIFYING: 'ingest',
    EXTRACTING: 'file1',
    AWAITING_PLAN: 'plan',
    VERIFYING: 'file2',
    RECONCILING: 'exceptions',
    REVIEW: 'hitl',
    APPROVED: 'hitl',
    FAILED: 'ingest',
  };
  return map[status] ?? 'ingest';
}

const STATUS_CONFIG: Record<string, { dot: string; label: string; bg: string }> = {
  PENDING:   { dot: 'bg-gray-400',   label: 'Pending upload',           bg: 'bg-gray-50 border-gray-200 text-gray-600' },
  INGESTING: { dot: 'bg-blue-500',   label: 'Processing · Ingesting',   bg: 'bg-blue-50 border-blue-200 text-blue-600' },
  CLASSIFYING: { dot: 'bg-blue-500', label: 'Processing · Classifying', bg: 'bg-blue-50 border-blue-200 text-blue-600' },
  EXTRACTING:  { dot: 'bg-blue-500', label: 'Processing · Extracting',  bg: 'bg-blue-50 border-blue-200 text-blue-600' },
  AWAITING_PLAN: { dot: 'bg-orange-500', label: 'Awaiting plan confirmation', bg: 'bg-orange-50 border-orange-200 text-orange-600' },
  VERIFYING:   { dot: 'bg-blue-500', label: 'Processing · Verifying',   bg: 'bg-blue-50 border-blue-200 text-blue-600' },
  RECONCILING: { dot: 'bg-blue-500', label: 'Processing · Reconciling', bg: 'bg-blue-50 border-blue-200 text-blue-600' },
  REVIEW:      { dot: 'bg-orange-500', label: 'Awaiting review',         bg: 'bg-orange-50 border-orange-200 text-orange-600' },
  APPROVED:    { dot: 'bg-green-500', label: 'Approved',                 bg: 'bg-green-50 border-green-200 text-green-700' },
  COMPLETED:   { dot: 'bg-green-500', label: 'Completed',                bg: 'bg-green-50 border-green-200 text-green-700' },
  FAILED:      { dot: 'bg-red-500',   label: 'Failed',                   bg: 'bg-red-50 border-red-200 text-red-600' },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { dot: 'bg-gray-400', label: status, bg: 'bg-gray-50 border-gray-200 text-gray-600' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 flex items-start gap-4">
      <div className={`rounded-lg p-2 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
        <p className="text-xl font-semibold mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ───────────────────────────────────────────────
function DeleteConfirmModal({ pkg, onCancel, onConfirm, isPending }: {
  pkg: Package; onCancel: () => void; onConfirm: () => void; isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-base font-semibold text-red-600">Delete Package</h2>
          <button onClick={onCancel} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Permanently delete <span className="font-semibold text-[var(--color-text-primary)]">{pkg.projectName}</span>?
          </p>
          <p className="mt-1 text-xs text-red-500">
            This removes all SQL records and blob files. This cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
          <button onClick={onCancel} className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function GlobalDashboard() {
  const navigate = useNavigate();
  const { clearShell } = useShell();
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = useState<Package | null>(null);

  useEffect(() => { clearShell(); }, [clearShell]);

  const { mutate: deletePackage, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => apiFetch(`/packages/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      setToDelete(null);
    },
  });

  const { data: packages = [], isLoading } = useQuery<Package[]>({
    queryKey: ['packages'],
    queryFn: () => apiFetch('/packages') as Promise<Package[]>,
  });

  const openCount = packages.filter(
    (p) => p.status !== 'APPROVED' && p.status !== 'FAILED'
  ).length;
  const openExceptions = packages.reduce((sum, p) => sum + (p.exceptions?.length ?? 0), 0);
  const awaitingReview = packages.filter((p) => p.status === 'REVIEW').length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Package Queue</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Monthly invoice packages across all contracts.
          </p>
        </div>
        <button
          onClick={() => navigate('/packages/new')}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-primary-hover)] transition-colors"
        >
          <Plus className="h-4 w-4" /> New Package
        </button>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <KpiCard label="Open Packages" value={openCount} icon={FileStack} color="bg-blue-50 text-blue-600" />
        <KpiCard label="Open Exceptions" value={openExceptions} icon={AlertTriangle} color="bg-orange-50 text-orange-600" />
        <KpiCard label="Awaiting Review" value={awaitingReview} icon={Clock} color="bg-purple-50 text-purple-600" />
      </div>

      {/* Package table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-[var(--color-surface)] animate-pulse" />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-16 text-center">
          <FileStack className="mx-auto h-8 w-8 text-[var(--color-text-disabled)] mb-3" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            No packages yet.
          </p>
          <button
            onClick={() => navigate('/packages/new')}
            className="mt-4 text-sm text-[var(--color-brand-primary)] hover:underline"
          >
            Create your first package
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text-secondary)]">
                <th className="px-4 py-3 text-left font-medium">Project</th>
                <th className="px-4 py-3 text-left font-medium">Contract</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Documents</th>
                <th className="px-4 py-3 text-left font-medium">Exceptions</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {packages.map((pkg) => (
                <tr
                  key={pkg.id}
                  onClick={() => navigate(`/packages/${pkg.id}/${packageRoute(pkg.status)}`)}
                  className="cursor-pointer hover:bg-[var(--color-surface)] transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                    {pkg.projectName}
                  </td>
                  <td className="px-4 py-3">
                    {pkg.contract ? (
                      <div className="flex flex-col">
                        <span className="text-xs font-medium truncate max-w-[160px]" title={pkg.contract.name}>{pkg.contract.name}</span>
                        <span className="text-[10px] text-[var(--color-text-secondary)] truncate max-w-[160px]">{pkg.contract.client.name}</span>
                      </div>
                    ) : (
                      <span className="text-[var(--color-text-disabled)] text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={pkg.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {pkg.documents?.length ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    {(pkg.exceptions?.length ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-orange-600">
                        <AlertTriangle className="h-3 w-3" />
                        {pkg.exceptions.length}
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-disabled)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">
                    {new Date(pkg.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setToDelete(pkg)}
                      title="Delete package"
                      className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {toDelete && (
        <DeleteConfirmModal
          pkg={toDelete}
          onCancel={() => setToDelete(null)}
          onConfirm={() => deletePackage(toDelete.id)}
          isPending={isDeleting}
        />
      )}
    </div>
  );
}
