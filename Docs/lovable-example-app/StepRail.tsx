import { Check, Loader2, Pause } from "lucide-react";
import type { AgentStep } from "@/lib/mockData";

export function StepRail({ steps, packageTitle }: { steps: AgentStep[]; packageTitle: string }) {
  return (
    <aside className="w-[380px] shrink-0 border-r border-border bg-card p-5 overflow-y-auto">
      <div className="mb-5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Processing</div>
        <div className="text-sm font-semibold text-foreground mt-0.5">{packageTitle}</div>
      </div>

      <ol className="space-y-2">
        {steps.map((step) => {
          const isDone = step.status === "done";
          const isRunning = step.status === "running";
          const isPause = step.status === "pause";
          const isPending = step.status === "pending";

          return (
            <li
              key={step.n}
              className={`rounded-md border p-3 transition-colors ${
                isRunning
                  ? "border-primary/40 bg-primary/5"
                  : isPause
                  ? "border-warning/40 bg-warning/5"
                  : isDone
                  ? "border-border bg-background"
                  : "border-dashed border-border bg-background/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[11px] font-medium text-muted-foreground">Step {step.n}</span>
                <span>
                  {isDone && <Check className="h-3.5 w-3.5 text-success" />}
                  {isRunning && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />}
                  {isPause && <Pause className="h-3.5 w-3.5 text-warning" />}
                  {isPending && <span className="h-2 w-2 rounded-full bg-border inline-block" />}
                </span>
              </div>
              <div className={`text-sm mt-1 ${isPending ? "text-muted-foreground" : "text-foreground"}`}>
                {step.title}
              </div>
              {step.detail && !step.progress && (
                <div className="text-xs text-muted-foreground mt-1">{step.detail}</div>
              )}
              {step.progress && (
                <div className="mt-2">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(step.progress.current / step.progress.total) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
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
  );
}
