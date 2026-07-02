import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { AlertTriangle, Check, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatCurrency, packages } from "@/lib/mockData";

export const Route = createFileRoute("/packages/$id/hitl")({
  component: HITLScreen,
});

function HITLScreen() {
  const { id } = useParams({ from: "/packages/$id/hitl" });
  const pkg = packages.find((p) => p.id === id) ?? packages[0];

  return (
    <AppShell statusLabel="HITL Gate · Confirm & Route" statusTone="warn">
      <div className="p-8">
        <div className="max-w-[820px] mx-auto">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="p-6 border-b border-border">
              <div className="inline-flex items-center gap-2 rounded-full bg-warning/10 text-warning px-3 py-1 text-xs font-medium">
                <AlertTriangle className="h-3.5 w-3.5" /> Human-in-the-loop confirmation
              </div>
              <h1 className="text-xl font-semibold tracking-tight mt-3">
                Confirm Package Ready for Formal Validation
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                All exceptions resolved. Review the summary before routing to Finance Approver.
              </p>
            </div>

            <ul className="divide-y divide-border">
              <Checklist ok text="All 30 exceptions resolved" meta="24 accepted · 6 overrides" />
              <Checklist ok text="File 3 evidence attached where required" />
              <Checklist ok text="Audit trail complete" meta="All changes signed by M. Alvarez" />
              <Checklist ok text="Package totals reconcile" meta={`Approved amount: ${formatCurrency(391200)}`} />
            </ul>

            <div className="p-6 bg-muted/30 border-t border-border">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Route to</div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 grid place-items-center text-primary text-xs font-semibold">
                  JR
                </div>
                <div>
                  <div className="text-sm font-medium">Jamie Reyes</div>
                  <div className="text-xs text-muted-foreground">Finance Approver · {pkg.contract}</div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <Link to="/packages/$id/exceptions" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">
                  ← Back to exceptions
                </Link>
                <Link
                  to="/packages/$id/validate"
                  params={{ id }}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <ShieldCheck className="h-4 w-4" /> Confirm & Send for Approval
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Checklist({ ok, text, meta }: { ok?: boolean; text: string; meta?: string }) {
  return (
    <li className="flex items-center gap-3 px-6 py-3">
      <span
        className={`h-5 w-5 rounded-full grid place-items-center ${
          ok ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
        }`}
      >
        <Check className="h-3 w-3" />
      </span>
      <div className="flex-1">
        <div className="text-sm">{text}</div>
        {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
      </div>
    </li>
  );
}
