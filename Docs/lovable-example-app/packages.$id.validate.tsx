import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Clock, FileCheck2, Info } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatCurrency } from "@/lib/mockData";

export const Route = createFileRoute("/packages/$id/validate")({
  component: ValidateScreen,
});

function ValidateScreen() {
  const { id } = useParams({ from: "/packages/$id/validate" });
  return (
    <AppShell statusLabel="Awaiting Formal Validation" statusTone="info">
      <div className="p-8">
        <div className="max-w-[820px] mx-auto">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-2 rounded-full bg-info/10 text-info px-3 py-1 text-xs font-medium w-fit">
              <Clock className="h-3.5 w-3.5" /> With Finance Approver — Jamie Reyes
            </div>
            <h1 className="text-xl font-semibold tracking-tight mt-3">Formal Validation (Step 16)</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Package handed off to the Finance Approver for lien-waiver checks, sworn-statement match, and payment authorization.
            </p>

            <div className="mt-6 grid grid-cols-3 border-y border-border">
              <Cell label="Approved amount" value={formatCurrency(391200)} />
              <Cell label="Retainage held" value={formatCurrency(19560)} />
              <Cell label="Payment due" value="Jul 12, 2026" />
            </div>

            <div className="mt-6 rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground flex gap-2">
              <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
              Step 16 formal-validation UI is defined in the next journey document. From here, the approver runs lien-waiver checks, sworn-statement reconciliation, and cuts the payment authorization.
            </div>

            <div className="mt-6 flex justify-between">
              <Link to="/packages/$id/hitl" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">
                ← Back
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <FileCheck2 className="h-4 w-4" /> Return to Queue
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 border-r border-border last:border-0">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
