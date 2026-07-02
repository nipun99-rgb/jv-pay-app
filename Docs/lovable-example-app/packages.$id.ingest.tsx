import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StepRail } from "@/components/StepRail";
import { ActivityFeed } from "@/components/ActivityFeed";
import { packages } from "@/lib/mockData";

export const Route = createFileRoute("/packages/$id/ingest")({
  component: IngestScreen,
});

function IngestScreen() {
  const { id } = useParams({ from: "/packages/$id/ingest" });
  const pkg = packages.find((p) => p.id === id) ?? packages[0];

  const steps = [
    { n: 1, title: "File Upload & Receipt", status: "done" as const, detail: `${pkg.files.length} files received` },
    { n: 2, title: "Preliminary Classification", status: "running" as const, detail: "Checking document integrity…" },
    { n: 3, title: "Extract GC Cover + G703", status: "pending" as const },
    { n: 4, title: "Agent Plan: Sub-Contractors", status: "pending" as const },
    { n: 5, title: "Extract File 2: Sub-Contractors", status: "pending" as const },
    { n: 6, title: "Extract File 3: Supporting Docs", status: "pending" as const },
    { n: 7, title: "Cross-File Reconciliation", status: "pending" as const },
    { n: 8, title: "Exception Assembly", status: "pending" as const },
    { n: 9, title: "Ready for Review", status: "pending" as const },
  ];

  return (
    <AppShell statusLabel="Processing · Ingesting" statusTone="info">
      <div className="flex h-full">
        <StepRail steps={steps} packageTitle={`${pkg.period} · ${pkg.contract}`} />
        <ActivityFeed
          entries={[
            { time: "09:14:02", kind: "info", text: "Receiving files…" },
            ...pkg.files.map((f) => ({
              time: "09:14:0" + f.n,
              kind: "ok" as const,
              text: `File ${f.n} received`,
              meta: `${f.pages} pages · ${f.size}`,
            })),
            { time: "09:14:11", kind: "running", text: "Checking document integrity…" },
          ]}
        >
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-sm font-medium">Preliminary check complete</div>
            <div className="text-xs text-muted-foreground mt-1">
              All 3 files parsed. Detected G702/G703 in File 1. Ready to extract.
            </div>
            <div className="mt-3 flex justify-end">
              <Link
                to="/packages/$id/file1"
                params={{ id }}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Confirm & Continue →
              </Link>
            </div>
          </div>
        </ActivityFeed>
      </div>
    </AppShell>
  );
}
