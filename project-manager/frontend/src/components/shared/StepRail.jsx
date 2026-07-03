import { cn } from "@/lib/utils";
import { Check, Loader2, Clock, AlertTriangle, XCircle } from "lucide-react";

const stepStates = {
  pending: { icon: Clock, color: "var(--color-step-pending)", bg: "bg-[var(--color-step-pending)]/20" },
  running: { icon: Loader2, color: "var(--color-step-running)", bg: "bg-[var(--color-step-running)]/10", animate: true },
  complete: { icon: Check, color: "var(--color-step-complete)", bg: "bg-[var(--color-step-complete)]/10" },
  confirmed: { icon: Check, color: "var(--color-step-complete)", bg: "bg-[var(--color-step-complete)]/10" },
  paused: { icon: AlertTriangle, color: "var(--color-step-paused)", bg: "bg-[var(--color-step-paused)]/10" },
  error: { icon: XCircle, color: "var(--color-step-error)", bg: "bg-[var(--color-step-error)]/10" },
};

export default function StepRail({ steps = [], className, onStepClick }) {
  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto px-4 py-2", className)}>
      {steps.map((step, i) => {
        const state = stepStates[step.status] || stepStates.pending;
        const Icon = state.icon;
        const clickable = onStepClick && step.status !== 'pending';
        return (
          <div key={step.id || i} className="flex items-center">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(step)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                state.bg,
                clickable && "cursor-pointer hover:opacity-80",
                !clickable && "cursor-default"
              )}
              style={{ color: state.color }}
            >
              <Icon className={cn("size-3.5", state.animate && "animate-spin")} />
              <span className="hidden sm:inline">{step.stepName}</span>
              <span className="sm:hidden">{step.stepNo}</span>
            </button>
            {i < steps.length - 1 && (
              <div className="mx-0.5 h-px w-3 bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}
