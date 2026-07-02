import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatCurrency, subContractors, type SubContractor } from "@/lib/mockData";

export const Route = createFileRoute("/packages/$id/plan")({
  component: PlanScreen,
});

function PlanScreen() {
  const { id } = useParams({ from: "/packages/$id/plan" });
  const [rows, setRows] = useState<SubContractor[]>(subContractors);

  const addRow = () =>
    setRows((r) => [
      ...r,
      { code: "NEW", name: "New sub-contractor", trade: "—", file1Value: 0, file2Value: 0, added: true },
    ]);

  return (
    <AppShell statusLabel="Plan Review · Awaiting confirmation" statusTone="warn">
      <div className="p-8">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-4">
            <h1 className="text-xl font-semibold tracking-tight">Agent Plan — Sub-Contractors</h1>
            <p className="text-sm text-muted-foreground mt-1">
              The agent identified <strong>{subContractors.length} sub-contractors</strong> in File 1. Confirm the list or edit before extraction begins on File 2.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-[80px_1fr_160px_140px_60px] gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
              <div>Code</div>
              <div>Name</div>
              <div>Trade</div>
              <div className="text-right">File 1 Value</div>
              <div />
            </div>
            {rows.map((r, i) => (
              <div key={i} className="group grid grid-cols-[80px_1fr_160px_140px_60px] gap-3 px-4 py-2.5 text-sm border-b border-border last:border-0 hover:bg-muted/30">
                <input
                  className="bg-transparent font-mono text-xs outline-none focus:ring-1 focus:ring-primary rounded px-1"
                  value={r.code}
                  onChange={(e) => update(i, { code: e.target.value })}
                />
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    className="bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1 flex-1 min-w-0"
                    value={r.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                  {r.added && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                      Added by you
                    </span>
                  )}
                </div>
                <input
                  className="bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
                  value={r.trade}
                  onChange={(e) => update(i, { trade: e.target.value })}
                />
                <div className="text-right tabular-nums">{formatCurrency(r.file1Value)}</div>
                <button
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={addRow}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5"
            >
              <Plus className="h-3.5 w-3.5" /> Add sub-contractor
            </button>
          </div>

          <div className="mt-6 flex justify-between items-center">
            <Link to="/packages/$id/file1" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">
              ← Go back
            </Link>
            <Link
              to="/packages/$id/file2"
              params={{ id }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Confirm & Begin File 2 Extraction →
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );

  function update(i: number, patch: Partial<SubContractor>) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }
}
