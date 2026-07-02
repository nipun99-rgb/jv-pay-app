import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/settings")({
  component: () => (
    <AppShell>
      <div className="p-8 max-w-[720px]">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-2">Admin-only configuration for contracts, users, and validation rules.</p>
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Not part of the L2 journey scope.
        </div>
      </div>
    </AppShell>
  ),
});
