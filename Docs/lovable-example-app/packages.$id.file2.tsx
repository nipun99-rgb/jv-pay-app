import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StepRail } from "@/components/StepRail";
import { ActivityFeed } from "@/components/ActivityFeed";
import { agentSteps, packages } from "@/lib/mockData";

export const Route = createFileRoute("/packages/$id/file2")({
  component: File2Screen,
});

function File2Screen() {
  const { id } = useParams({ from: "/packages/$id/file2" });
  const pkg = packages.find((p) => p.id === id) ?? packages[0];

  return (
    <AppShell statusLabel="Processing · File 2 · 8/14 subs" statusTone="info">
      <div className="flex h-full">
        <StepRail steps={agentSteps} packageTitle={`${pkg.period} · ${pkg.contract}`} />
        <ActivityFeed
          entries={[
            { time: "09:22:04", kind: "ok", text: "ABC Structural Steel", meta: "Extracted · $250,000" },
            { time: "09:22:41", kind: "ok", text: "Delta Plumbing (in progress)", meta: "Pages 19–24" },
            { time: "09:23:02", kind: "warn", text: "Ironclad Rebar Co", meta: "Variance detected — File 1: $92.1K · File 2: $95.5K" },
            { time: "09:23:18", kind: "ok", text: "Evergreen Electrical", meta: "Extracted · $132,500" },
            { time: "09:23:44", kind: "warn", text: "Kilnsworth Masonry", meta: "Variance detected — $2.6K delta" },
            { time: "09:24:11", kind: "err", text: "GreenLine Site Services", meta: "OCR failed on page 33 · will retry" },
            { time: "09:24:32", kind: "running", text: "Delta Plumbing Inc — extracting…" },
          ]}
        >
          <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
            No action required. This view auto-advances when extraction completes.{" "}
            <Link to="/packages/$id/complete" params={{ id }} className="text-primary hover:underline">
              Skip to complete →
            </Link>
          </div>
        </ActivityFeed>
      </div>
    </AppShell>
  );
}
