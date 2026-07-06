/**
 * CompletePage — Sprint 8.
 * Success confirmation shown after a package is approved.
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, FileText, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Package {
  id: string;
  projectName: string;
  status: string;
  updatedAt: string;
  gcHeader?: { applicationNo: string | null; currentPaymentDue: string | null } | null;
  documents?: Array<{ id: string }>;
}

interface SubHeader { id: string }
interface Exception { id: string; status: string }

function fmtCurrency(v: string | null): string {
  if (!v) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function CompletePage() {
  const { packageId } = useParams<{ packageId: string }>();
  const navigate = useNavigate();

  const { data: pkg, isLoading } = useQuery<Package>({
    queryKey: ['package', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}`) as Promise<Package>,
    staleTime: 60_000,
    enabled: !!packageId,
  });

  const { data: subHeaders = [] } = useQuery<SubHeader[]>({
    queryKey: ['sub-headers', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}/sub-headers`) as Promise<SubHeader[]>,
    staleTime: 60_000,
    enabled: !!packageId,
  });

  const { data: exceptions = [] } = useQuery<Exception[]>({
    queryKey: ['exceptions', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}/exceptions`) as Promise<Exception[]>,
    staleTime: 60_000,
    enabled: !!packageId,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-primary)]" />
      </div>
    );
  }

  const approvedAt = pkg?.updatedAt
    ? new Date(pkg.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—';

  const resolvedExceptions = exceptions.filter((e) => e.status !== 'OPEN').length;

  return (
    <div className="flex flex-col items-center justify-center gap-8 p-12">
      {/* Icon + title */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <ShieldCheck className="h-10 w-10 text-[var(--color-valid)]" />
        </div>
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Application Approved
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {pkg?.projectName} · Application {pkg?.gcHeader?.applicationNo ?? '—'}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">Approved on {approvedAt}</p>
      </div>

      {/* Summary stats */}
      <div className="grid w-full max-w-lg grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: 'Payment Due',
            value: fmtCurrency(pkg?.gcHeader?.currentPaymentDue ?? null),
            icon: FileText,
            color: 'text-[var(--color-brand-primary)]',
          },
          {
            label: 'Documents',
            value: String(pkg?.documents?.length ?? '—'),
            icon: FileText,
            color: 'text-[var(--color-text-primary)]',
          },
          {
            label: 'Sub-Contractors',
            value: String(subHeaders.length || '—'),
            icon: Users,
            color: 'text-[var(--color-text-primary)]',
          },
          {
            label: 'Exceptions Resolved',
            value: String(resolvedExceptions),
            icon: AlertTriangle,
            color: resolvedExceptions > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-secondary)]',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-[var(--color-border)] bg-white p-4 text-center">
            <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
            <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
            <p className={`mt-0.5 text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="rounded-md bg-[var(--color-brand-primary)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Return to Dashboard
        </button>
        <button
          onClick={() => navigate(`/packages/${packageId}/exceptions`)}
          className="rounded-md border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium hover:bg-gray-50"
        >
          View Exception Log
        </button>
      </div>
    </div>
  );
}

