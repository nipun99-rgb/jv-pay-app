import { Outlet, useParams, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { usePipelineSteps } from '@/hooks/usePipelineSteps.js';
import { usePackage } from '@/hooks/usePackage.js';
import { useShell } from '@/contexts/ShellContext.jsx';

export default function PackageLayout() {
  const { packageId } = useParams();
  const location = useLocation();
  const { steps, dbError } = usePipelineSteps(packageId);
  const { pkg } = usePackage(packageId);
  const { setShellData } = useShell();

  const periodLabel = pkg?.billingPeriodMonth
    ? new Date(pkg.billingPeriodYear, pkg.billingPeriodMonth - 1).toLocaleString('default', { month: 'short', year: 'numeric' })
    : '';

  // Update shell context with package info
  useEffect(() => {
    if (!pkg) return;
    const path = location.pathname;
    const runningStep = steps?.find(s => s.status === 'running');

    // Per-page status overrides
    let statusLabel, statusTone;
    if (path.endsWith('/complete')) {
      statusLabel = 'Processing Complete'; statusTone = 'success';
    } else if (path.endsWith('/plan')) {
      statusLabel = 'Plan Review · Awaiting confirmation'; statusTone = 'warn';
    } else if (path.endsWith('/hitl')) {
      const isApproved = pkg.packageStatus === 'APPROVED' || pkg.packageStatus === 'READY_FOR_APPROVAL';
      statusLabel = isApproved ? 'Awaiting Formal Validation' : 'HITL Gate · Confirm & Route';
      statusTone = isApproved ? 'info' : 'warn';
    } else {
      const statusMap = {
        INGESTING: { label: 'Processing · Ingesting', tone: 'info' },
        FILE_1_PROCESSING: { label: 'Processing · File 1', tone: 'info' },
        FILE_2_PROCESSING: { label: 'Processing · File 2', tone: 'info' },
        AWAITING_PLAN_CONFIRMATION: { label: 'Plan Review · Awaiting confirmation', tone: 'warn' },
        EXCEPTION_REVIEW: { label: `In Review · ${pkg.exceptionsCount || 0} exceptions remain`, tone: 'warn' },
        READY_FOR_APPROVAL: { label: 'Ready for Approval', tone: 'success' },
        APPROVED: { label: 'Complete · Approved', tone: 'success' },
      };
      const mapped = statusMap[pkg.packageStatus] || (runningStep ? { label: `Processing · ${runningStep.stepName}`, tone: 'info' } : null);
      statusLabel = mapped?.label;
      statusTone = mapped?.tone || 'neutral';
    }

    setShellData({
      contractName: pkg.contract?.contractName,
      period: periodLabel,
      statusLabel,
      statusTone,
    });
  }, [pkg, steps, periodLabel, location.pathname, setShellData]);

  return (
    <div className="flex h-full flex-col">
      {/* DB connection warning */}
      {dbError && (
        <div className="flex items-center gap-2 bg-[var(--color-warning)]/10 px-4 py-2 text-sm text-[var(--color-warning)]">
          <span>⚠ Database unreachable — connect to VPN or check network. Retrying in background...</span>
        </div>
      )}

      {/* Page content */}
      <div className="flex-1 overflow-auto">
        <Outlet context={{ steps, pkg }} />
      </div>
    </div>
  );
}
