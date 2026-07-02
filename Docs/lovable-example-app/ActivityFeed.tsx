import { Check, Loader2 } from "lucide-react";

export interface ActivityEntry {
  time: string;
  kind: "info" | "ok" | "warn" | "err" | "running";
  text: string;
  meta?: string;
}

export function ActivityFeed({ entries, children }: { entries: ActivityEntry[]; children?: React.ReactNode }) {
  return (
    <section className="flex-1 min-w-0 p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-sm font-semibold text-foreground mb-4">Activity</h2>
        <ol className="space-y-3">
          {entries.map((e, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="w-14 shrink-0 text-[11px] text-muted-foreground pt-0.5">{e.time}</span>
              <span className="mt-0.5">
                {e.kind === "ok" && <Check className="h-3.5 w-3.5 text-success" />}
                {e.kind === "running" && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />}
                {e.kind === "info" && <span className="h-2 w-2 mt-1 block rounded-full bg-muted-foreground/50" />}
                {e.kind === "warn" && <span className="h-2 w-2 mt-1 block rounded-full bg-warning" />}
                {e.kind === "err" && <span className="h-2 w-2 mt-1 block rounded-full bg-destructive" />}
              </span>
              <div className="min-w-0">
                <div className="text-foreground">{e.text}</div>
                {e.meta && <div className="text-xs text-muted-foreground">{e.meta}</div>}
              </div>
            </li>
          ))}
        </ol>
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}
