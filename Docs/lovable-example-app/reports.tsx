import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/reports")({
  component: () => (
    <AppShell>
      <div className="p-8 max-w-[720px]">
        <h1 className="text-xl font-semibold tracking-tight">Reports & Audit</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Package-level audit trails, exception disposition history, and reviewer throughput.
        </p>
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Not part of the L2 journey scope.
        </div>
      </div>
    </AppShell>
  ),
});
