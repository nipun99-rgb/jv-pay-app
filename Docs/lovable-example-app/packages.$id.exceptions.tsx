import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { exceptionGroups, exceptions as allExceptions, formatCurrency, type ExceptionType } from "@/lib/mockData";

export const Route = createFileRoute("/packages/$id/exceptions")({
  component: ExceptionsScreen,
});

function ExceptionsScreen() {
  const { id } = useParams({ from: "/packages/$id/exceptions" });
  const [activeType, setActiveType] = useState<ExceptionType>("math");
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeException, setActiveException] = useState<string | null>(null);

  const items = useMemo(() => allExceptions.filter((e) => e.type === activeType), [activeType]);
  const active = allExceptions.find((e) => e.id === activeException) ?? items[0];

  const totalUnresolved = allExceptions.filter((e) => !resolvedIds.has(e.id)).length;

  const accept = (ids: string[]) => {
    setResolvedIds((r) => new Set([...r, ...ids]));
    setSelectedIds(new Set());
  };

  return (
    <AppShell statusLabel={`In Review · ${totalUnresolved} exceptions remain`} statusTone="warn">
      <div className="flex flex-col h-full">
        <div className="flex justify-end px-4 py-2 border-b border-border bg-card">
          <Link
            to="/packages/$id/hitl"
            params={{ id }}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Mark Ready for Approval →
          </Link>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Navigator */}
          <aside className="w-[280px] shrink-0 border-r border-border bg-card overflow-y-auto p-3 space-y-2">
            {exceptionGroups.map((g) => {
              const groupItems = allExceptions.filter((e) => e.type === g.type);
              const groupSum = groupItems.reduce((s, e) => s + Math.max(e.variance, e.file2Value * 0.02), 0);
              const isActive = g.type === activeType;
              const unresolved = groupItems.filter((e) => !resolvedIds.has(e.id));
              const allDone = unresolved.length === 0;
              return (
                <button
                  key={g.type}
                  onClick={() => setActiveType(g.type)}
                  className={`w-full text-left rounded-md border p-3 transition-colors ${
                    isActive ? "border-primary/50 bg-primary/5" : "border-border bg-background hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{g.label}</div>
                    {allDone && <Check className="h-3.5 w-3.5 text-success" />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {groupItems.length} items · {formatCurrency(groupSum)}
                  </div>
                  <div className="flex gap-1 mt-2">
                    {groupItems.map((e) => (
                      <span
                        key={e.id}
                        className={`h-1.5 w-1.5 rounded-full ${
                          resolvedIds.has(e.id)
                            ? "bg-success"
                            : g.color === "destructive"
                            ? "bg-destructive"
                            : g.color === "warning"
                            ? "bg-warning"
                            : "bg-caution"
                        }`}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Data grid */}
          <section className="flex-1 min-w-0 flex flex-col border-r border-border">
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/30">
              <div className="text-sm font-semibold flex-1">
                {exceptionGroups.find((g) => g.type === activeType)?.label}
              </div>
              <button
                onClick={() => setSelectedIds(new Set(items.map((i) => i.id)))}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Select all
              </button>
              <button
                onClick={() => accept(Array.from(selectedIds))}
                disabled={selectedIds.size === 0}
                className="text-xs rounded-md border border-border px-2 py-1 hover:bg-muted disabled:opacity-40"
              >
                Bulk accept
              </button>
            </div>

            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-background sticky top-0">
                  <tr className="border-b border-border">
                    <th className="w-8 py-2 px-3"></th>
                    <th className="text-left py-2 px-3">Sub</th>
                    <th className="text-left py-2 px-3">Description</th>
                    <th className="text-right py-2 px-3">File 1</th>
                    <th className="text-right py-2 px-3">File 2</th>
                    <th className="text-right py-2 px-3">Variance</th>
                    <th className="text-right py-2 px-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => {
                    const resolved = resolvedIds.has(e.id);
                    return (
                      <tr
                        key={e.id}
                        onClick={() => setActiveException(e.id)}
                        className={`border-b border-border cursor-pointer hover:bg-muted/40 ${
                          active?.id === e.id ? "bg-primary/5" : ""
                        } ${resolved ? "opacity-50" : ""}`}
                      >
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(e.id)}
                            onChange={(ev) => {
                              ev.stopPropagation();
                              setSelectedIds((s) => {
                                const n = new Set(s);
                                n.has(e.id) ? n.delete(e.id) : n.add(e.id);
                                return n;
                              });
                            }}
                          />
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">{e.sub}</td>
                        <td className="py-2 px-3">{e.description}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(e.file1Value)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(e.file2Value)}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium text-warning">
                          {e.variance ? formatCurrency(e.variance) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {resolved ? (
                            <span className="text-xs text-success inline-flex items-center gap-1">
                              <Check className="h-3 w-3" /> Accepted
                            </span>
                          ) : (
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  accept([e.id]);
                                }}
                                className="text-xs rounded border border-border px-2 py-0.5 hover:bg-success/10 hover:text-success hover:border-success/40"
                              >
                                Accept
                              </button>
                              <button
                                onClick={(ev) => ev.stopPropagation()}
                                className="text-xs rounded border border-border px-2 py-0.5 hover:bg-muted"
                              >
                                Override
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Evidence viewer */}
          <aside className="w-[380px] shrink-0 bg-card flex flex-col">
            <div className="flex border-b border-border text-xs">
              <button className="flex-1 py-2 border-b-2 border-primary text-foreground font-medium">File 1</button>
              <button className="flex-1 py-2 text-muted-foreground hover:text-foreground">File 2</button>
              <button className="flex-1 py-2 text-muted-foreground hover:text-foreground">File 3</button>
            </div>
            <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
              Page {active?.page ?? "—"} · Sub {active?.sub ?? "—"}
            </div>
            <div className="flex-1 p-4 overflow-auto bg-muted/30">
              <div className="mx-auto aspect-[8.5/11] max-w-full bg-card rounded-md shadow-sm border border-border p-6 text-[10px] font-mono text-muted-foreground relative">
                <div className="border-b border-border pb-2 mb-2 text-center text-xs text-foreground">
                  <FileText className="h-3.5 w-3.5 inline mr-1" />
                  Continuation Sheet — Page {active?.page}
                </div>
                <div className="space-y-1">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <span>Line {i + 1} — {i === 3 ? active?.description : "…"}</span>
                      <span
                        className={
                          i === 3
                            ? "bg-warning/30 text-foreground px-1 rounded font-semibold"
                            : ""
                        }
                      >
                        {i === 3 ? formatCurrency(active?.file1Value ?? 0) : "$—"}
                      </span>
                    </div>
                  ))}
                </div>
                {active && (
                  <div className="absolute inset-x-4 top-[6.5rem] h-6 border-2 border-warning rounded pointer-events-none" />
                )}
              </div>
            </div>
            <div className="flex border-t border-border">
              <button className="flex-1 py-2 text-xs text-muted-foreground hover:bg-muted flex items-center justify-center gap-1">
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <div className="w-px bg-border" />
              <button className="flex-1 py-2 text-xs text-muted-foreground hover:bg-muted flex items-center justify-center gap-1">
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </aside>
        </div>

        {/* Action bar */}
        <div className="h-12 border-t border-border bg-card flex items-center gap-2 px-4 shrink-0">
          <div className="text-xs text-muted-foreground">{selectedIds.size} selected</div>
          <div className="flex-1" />
          <button
            disabled={selectedIds.size === 0}
            onClick={() => accept(Array.from(selectedIds))}
            className="text-sm rounded-md bg-success/10 text-success border border-success/30 px-3 py-1.5 hover:bg-success/20 disabled:opacity-40"
          >
            Accept Selected ({selectedIds.size})
          </button>
          <button className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Override Selected
          </button>
          <button className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Escalate
          </button>
        </div>
      </div>
    </AppShell>
  );
}
