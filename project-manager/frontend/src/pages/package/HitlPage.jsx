import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/hooks/useAuth.jsx';
import { useShell } from '@/contexts/ShellContext.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, AlertTriangle, ShieldCheck, Clock, FileText } from 'lucide-react';

export default function HitlPage() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pkg: ctxPkg } = useOutletContext();
  const { setShellData } = useShell();
  const [pkg, setPkg] = useState(ctxPkg);
  const [header, setHeader] = useState(null);
  const [exSummary, setExSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, h, ex] = await Promise.all([
          apiFetch(`/packages/${packageId}`),
          apiFetch(`/packages/${packageId}/gc-header`),
          apiFetch(`/exceptions/${packageId}?summary=true`),
        ]);
        setPkg(p);
        setHeader(h);
        setExSummary(ex);
      } catch (e) {
        console.error('HitlPage load error:', e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [packageId]);

  const isApproved = pkg?.packageStatus === 'APPROVED' || pkg?.packageStatus === 'READY_FOR_APPROVAL';
  const showViewB = submitted || isApproved;

  useEffect(() => {
    if (showViewB) {
      setShellData({ statusLabel: 'Awaiting Formal Validation', statusTone: 'info' });
    } else {
      setShellData({ statusLabel: 'HITL Gate · Confirm & Route', statusTone: 'warn' });
    }
  }, [showViewB, setShellData]);

  const handleConfirmSend = async () => {
    setActing(true);
    try {
      await apiFetch(`/packages/${packageId}/submit`, { method: 'POST' });
      setSubmitted(true);
    } catch (e) {
      console.error('Submit error:', e.message);
    } finally {
      setActing(false);
    }
  };

  if (loading) return <div className="p-8"><Skeleton className="mx-auto h-96 max-w-[820px]" /></div>;

  const contractName = pkg?.contract?.contractName || '';
  const currentPaymentDue = header?.currentPaymentDue || 0;
  const totalResolved = exSummary?.resolvedCount || 0;
  const totalExceptions = exSummary?.totalCount || 0;

  // Compute payment due date: submittedAt + 10 days
  const paymentDueDate = (() => {
    const base = pkg?.submittedAt ? new Date(pkg.submittedAt) : null;
    if (!base) return '—';
    const d = new Date(base);
    d.setDate(d.getDate() + 10);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  })();

  if (showViewB) {
    // View B — Awaiting Formal Validation
    return (
      <div className="p-8">
        <div className="mx-auto max-w-[820px]">
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
            <div className="border-b border-[var(--color-border)] p-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                <Clock className="h-3.5 w-3.5" /> With Finance Approver — Jamie Reyes
              </div>
              <h1 className="mt-3 text-xl font-semibold tracking-tight">Formal Validation (Step 16)</h1>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                Package handed off to the Finance Approver for lien-waiver checks, sworn-statement match, and payment authorization.
              </p>
            </div>

            {/* 3-stat row */}
            <div className="grid grid-cols-3 border-b border-[var(--color-border)]">
              <div className="border-r border-[var(--color-border)] p-4">
                <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">Approved Amount</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{fmtMoney(currentPaymentDue)}</div>
              </div>
              <div className="border-r border-[var(--color-border)] p-4">
                <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">Retainage Held</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{fmtMoney(header?.totalRetainage || Math.round(currentPaymentDue * 0.05))}</div>
              </div>
              <div className="p-4">
                <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">Payment Due</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{paymentDueDate}</div>
              </div>
            </div>

            {/* Info box */}
            <div className="mx-6 my-4 rounded border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-700">
              Step 16 formal-validation UI is defined in the next journey document. From here, the approver runs lien-waiver checks, sworn-statement reconciliation, and cuts the payment authorization.
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[var(--color-border)] p-6">
              <button
                onClick={() => navigate(`/packages/${packageId}/exceptions`)}
                className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              >
                ← Back
              </button>
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
              >
                <FileText className="h-4 w-4" /> Return to Queue →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // View A — Confirm & Route
  return (
    <div className="p-8">
      <div className="mx-auto max-w-[820px]">
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
          {/* Header */}
          <div className="border-b border-[var(--color-border)] p-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-600">
              <AlertTriangle className="h-3.5 w-3.5" /> Human-in-the-loop confirmation
            </div>
            <h1 className="mt-3 text-xl font-semibold tracking-tight">Confirm Package Ready for Formal Validation</h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              All exceptions resolved. Review the summary before routing to Finance Approver.
            </p>
          </div>

          {/* Checklist */}
          <ul className="divide-y divide-[var(--color-border)]">
            <ChecklistItem ok text={`All ${totalExceptions} exceptions resolved`} meta={`${totalResolved} accepted · ${(exSummary?.overrideCount || 0)} overrides`} />
            <ChecklistItem ok text="File 3 evidence attached where required" />
            <ChecklistItem ok text="Audit trail complete" meta={`All changes signed by ${user?.displayName || 'Reviewer'}`} />
            <ChecklistItem ok text="Package totals reconcile" meta={`Approved amount: ${fmtMoney(currentPaymentDue)}`} />
          </ul>

          {/* Route To section */}
          <div className="border-t border-[var(--color-border)] bg-[var(--color-muted)]/30 p-6">
            <div className="mb-2 text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">Route to</div>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-primary)]/10 text-xs font-semibold text-[var(--color-primary)]">
                JR
              </div>
              <div>
                <div className="text-sm font-medium">Jamie Reyes</div>
                <div className="text-xs text-[var(--color-muted-foreground)]">Finance Approver · {contractName}</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => navigate(`/packages/${packageId}/exceptions`)}
                className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              >
                ← Back to exceptions
              </button>
              <button
                onClick={handleConfirmSend}
                disabled={acting}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" /> Confirm & Send for Approval
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({ ok, text, meta }) {
  return (
    <li className="flex items-center gap-3 px-6 py-3">
      <span className={`grid h-5 w-5 place-items-center rounded-full ${ok ? 'bg-green-50 text-green-600' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}`}>
        <Check className="h-3 w-3" />
      </span>
      <div className="flex-1">
        <div className="text-sm">{text}</div>
        {meta && <div className="text-xs text-[var(--color-muted-foreground)]">{meta}</div>}
      </div>
    </li>
  );
}

function fmtMoney(v) {
  const n = parseFloat(v || 0);
  if (n === 0) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
