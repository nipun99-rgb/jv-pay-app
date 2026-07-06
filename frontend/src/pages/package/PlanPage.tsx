/**
 * PlanPage — Sprint 6.
 * Agent Plan: Sub-contractor list grouped from GC SOV.
 * Shows when human_plan_gate interrupt fires; user confirms/skips each sub.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ClipboardList, CheckCircle2, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface PlanEntry {
  contractor_name: string;
  line_count: number;
  scheduled_sum: number;
  include: boolean;
}

interface AiStatus {
  status: string;
  current_node: string | null;
  extraction_plan?: PlanEntry[];
  interrupt_data?: { extraction_plan?: PlanEntry[] };
}

function fmtCurrency(v: number): string {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function PlanPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const queryClient = useQueryClient();
  const [plan, setPlan] = useState<PlanEntry[] | null>(null);

  const { data: aiStatus } = useQuery<AiStatus>({
    queryKey: ['ai-status', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}/ai-status`) as Promise<AiStatus>,
    refetchInterval: 3000,
    enabled: !!packageId,
  });

  // Seed plan from AI status when it arrives (check both top-level and interrupt_data)
  const rawPlan = aiStatus?.extraction_plan ?? aiStatus?.interrupt_data?.extraction_plan;
  if (rawPlan && rawPlan.length > 0 && !plan) {
    setPlan(rawPlan);
  }

  const { mutate: confirmPlan, isPending } = useMutation({
    mutationFn: () =>
      apiFetch(`/packages/${packageId}/resume`, {
        method: 'POST',
        body: JSON.stringify({ extraction_plan: plan }),
      }) as Promise<unknown>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-status', packageId] });
      queryClient.invalidateQueries({ queryKey: ['package', packageId] });
    },
  });

  const isWaiting = aiStatus?.current_node === 'human_plan_gate' && aiStatus?.status === 'AWAITING_INPUT';
  const displayPlan = plan ?? aiStatus?.extraction_plan ?? aiStatus?.interrupt_data?.extraction_plan ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Agent Plan: Sub-Contractors</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {isWaiting
              ? 'Review the proposed extraction plan and confirm or skip individual sub-contractors.'
              : 'Pipeline will pause here for plan confirmation after GC SOV extraction.'}
          </p>
        </div>
        {isWaiting && plan && (
          <button
            onClick={() => void confirmPlan()}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isPending ? 'Confirming…' : 'Confirm Plan & Continue'}
          </button>
        )}
      </div>

      {!isWaiting && displayPlan.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white p-16 text-center">
          <ClipboardList className="h-10 w-10 opacity-20 text-[var(--color-text-secondary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Plan will appear here after GC SOV extraction completes.
          </p>
        </div>
      )}

      {displayPlan.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-[var(--color-border)]">
                <th className="px-4 py-3 text-left font-semibold text-[var(--color-text-secondary)]">Sub-Contractor</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--color-text-secondary)]">SOV Lines</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--color-text-secondary)]">Scheduled Value</th>
                <th className="px-4 py-3 text-center font-semibold text-[var(--color-text-secondary)] w-28">Include</th>
              </tr>
            </thead>
            <tbody>
              {displayPlan.map((entry, i) => (
                <tr key={entry.contractor_name} className="border-b border-[var(--color-border)] hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{entry.contractor_name}</td>
                  <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">{entry.line_count}</td>
                  <td className="px-4 py-3 text-right">{fmtCurrency(entry.scheduled_sum)}</td>
                  <td className="px-4 py-3 text-center">
                    {isWaiting ? (
                      <button
                        onClick={() => setPlan((prev) => prev
                          ? prev.map((e, j) => j === i ? { ...e, include: !e.include } : e)
                          : null
                        )}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          entry.include
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {entry.include
                          ? <><CheckCircle2 className="h-3 w-3" /> Include</>
                          : <><XCircle className="h-3 w-3" /> Skip</>}
                      </button>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-xs ${entry.include ? 'text-green-600' : 'text-gray-400'}`}>
                        {entry.include ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {entry.include ? 'Include' : 'Skip'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-[var(--color-border)] bg-gray-50 px-4 py-2 text-xs text-[var(--color-text-secondary)]">
            {displayPlan.filter((e) => e.include).length} of {displayPlan.length} sub-contractors selected for extraction
          </div>
        </div>
      )}
    </div>
  );
}

