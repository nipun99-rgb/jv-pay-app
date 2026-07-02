import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatCurrency, packages } from "@/lib/mockData";

export const Route = createFileRoute("/packages/$id/complete")({
  component: CompleteScreen,
});

function CompleteScreen() {
  const { id } = useParams({ from: "/packages/$id/complete" });
  const pkg = packages.find((p) => p.id === id) ?? packages[0];

  return (
    <AppShell statusLabel="Processing Complete" statusTone="success">
      <div className="p-8">
        <div className="max-w-[820px] mx-auto">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="p-6 border-b border-border">
              <div className="inline-flex items-center gap-2 rounded-full bg-success/10 text-success px-3 py-1 text-xs font-medium">
                <Check className="h-3.5 w-3.5" /> All Steps Complete
              </div>
              <h1 className="text-xl font-semibold tracking-tight mt-3">
                {pkg.contract} · {pkg.period}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Ready for review. Auto-cleared items have been recorded to the audit trail.
              </p>
            </div>

            <div className="grid grid-cols-4 border-b border-border">
              <Stat label="Extracted" value={String(pkg.extracted)} />
              <Stat label="Auto-cleared" value={`${pkg.autoCleared} (${Math.round((pkg.autoCleared / pkg.extracted) * 100)}%)`} tone="success" />
              <Stat label="Exceptions" value={String(pkg.exceptions)} tone="warning" />
              <Stat label="$ at Risk" value={formatCurrency(pkg.atRisk)} tone="destructive" />
            </div>

            <div className="p-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Exceptions by type</div>
              <ul className="space-y-2 text-sm">
                <ExceptionRow color="destructive" label="Math errors" count={5} amount={28400} />
                <ExceptionRow color="warning" label="File 1 vs File 2 variance" count={12} amount={78900} />
                <ExceptionRow color="caution" label="Low confidence OCR" count={8} amount={21300} />
                <ExceptionRow color="caution" label="Missing evidence (File 3)" count={5} amount={13000} />
              </ul>

              <div className="mt-6 flex justify-end">
                <Link
                  to="/packages/$id/exceptions"
                  params={{ id }}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Begin Review →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "warning" | "destructive" }) {
  const cls =
    tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning"
      : tone === "destructive"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div className="p-4 border-r border-border last:border-0">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${cls}`}>{value}</div>
    </div>
  );
}

function ExceptionRow({ color, label, count, amount }: { color: "destructive" | "warning" | "caution"; label: string; count: number; amount: number }) {
  const dot = color === "destructive" ? "bg-destructive" : color === "warning" ? "bg-warning" : "bg-caution";
  return (
    <li className="flex items-center gap-3">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="flex-1">{label}</span>
      <span className="text-muted-foreground tabular-nums">{count} items</span>
      <span className="w-28 text-right tabular-nums font-medium">{formatCurrency(amount)}</span>
    </li>
  );
}
