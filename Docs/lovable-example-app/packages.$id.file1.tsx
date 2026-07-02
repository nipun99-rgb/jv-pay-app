import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StepRail } from "@/components/StepRail";
import { ActivityFeed } from "@/components/ActivityFeed";
import { formatCurrency, packages } from "@/lib/mockData";

export const Route = createFileRoute("/packages/$id/file1")({
  component: File1Screen,
});

function File1Screen() {
  const { id } = useParams({ from: "/packages/$id/file1" });
  const pkg = packages.find((p) => p.id === id) ?? packages[0];

  const steps = [
    { n: 1, title: "File Upload & Receipt", status: "done" as const },
    { n: 2, title: "Preliminary Classification", status: "done" as const },
    { n: 3, title: "Extract GC Cover + G703", status: "running" as const, detail: "Reading line items…", progress: { current: 18, total: 24, label: "Line 18 of 24" } },
    { n: 4, title: "Agent Plan: Sub-Contractors", status: "pending" as const },
    { n: 5, title: "Extract File 2", status: "pending" as const },
    { n: 6, title: "Extract File 3", status: "pending" as const },
    { n: 7, title: "Cross-File Reconciliation", status: "pending" as const },
    { n: 8, title: "Exception Assembly", status: "pending" as const },
    { n: 9, title: "Ready for Review", status: "pending" as const },
  ];

  return (
    <AppShell statusLabel="Processing · File 1" statusTone="info">
      <div className="flex h-full">
        <StepRail steps={steps} packageTitle={`${pkg.period} · ${pkg.contract}`} />
        <ActivityFeed
          entries={[
            { time: "09:14:22", kind: "ok", text: "GC Cover Page extracted", meta: "Contract sum $4.2M · This period $412,300" },
            { time: "09:14:28", kind: "ok", text: "G703 continuation sheet detected", meta: "24 line items" },
            { time: "09:14:31", kind: "running", text: "Extracting line items…", meta: "18 / 24" },
          ]}
        >
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              G702 Cover — Preview
            </div>
            <div className="p-4 grid grid-cols-2 gap-3 text-sm">
              <KV k="Contract sum" v={formatCurrency(4200000)} />
              <KV k="Application no." v="#12" />
              <KV k="Period" v={pkg.period} />
              <KV k="Work completed to date" v={formatCurrency(2860400)} />
              <KV k="Retainage (5%)" v={formatCurrency(143020)} />
              <KV k="This period" v={formatCurrency(412300)} />
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <Link
                to="/packages/$id/plan"
                params={{ id }}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Continue to Agent Plan →
              </Link>
            </div>
          </div>
        </ActivityFeed>
      </div>
    </AppShell>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="text-sm tabular-nums font-medium">{v}</div>
    </div>
  );
}
