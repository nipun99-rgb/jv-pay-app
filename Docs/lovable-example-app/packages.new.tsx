import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Upload, X } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { contracts, packages } from "@/lib/mockData";

export const Route = createFileRoute("/packages/new")({
  component: NewPackage,
});

interface UploadedFile {
  name: string;
  size: string;
}

function NewPackage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState("July");
  const [year, setYear] = useState("2026");
  const [contract, setContract] = useState(contracts[0]);
  const [f1, setF1] = useState<UploadedFile | null>(null);
  const [f2, setF2] = useState<UploadedFile | null>(null);
  const [f3, setF3] = useState<UploadedFile | null>(null);

  const mockUpload = (n: 1 | 2 | 3) => {
    const mock: UploadedFile = {
      name: n === 1 ? "GC_Invoice_Jul2026.pdf" : n === 2 ? "Subs_Jul2026.pdf" : "Support_Jul2026.pdf",
      size: n === 1 ? "12.1 MB" : n === 2 ? "27.8 MB" : "9.4 MB",
    };
    if (n === 1) setF1(mock);
    if (n === 2) setF2(mock);
    if (n === 3) setF3(mock);
  };

  const beginProcessing = () => {
    if (!f1) return;
    navigate({ to: "/packages/$id/ingest", params: { id: packages[1].id } });
  };

  return (
    <AppShell contractName={contract} period={`${month} ${year}`} statusLabel="New package" statusTone="neutral">
      <div className="p-8">
        <div className="max-w-[720px] mx-auto">
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-5">
              <h1 className="text-lg font-semibold">Start New Monthly Package</h1>
              <StepIndicator step={1} />
            </div>

            <div className="p-5 space-y-6">
              {/* Selectors */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Billing Period">
                  <div className="flex gap-2">
                    <select value={month} onChange={(e) => setMonth(e.target.value)} className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm">
                      {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                    <select value={year} onChange={(e) => setYear(e.target.value)} className="w-24 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm">
                      {["2025", "2026", "2027"].map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </Field>
                <Field label="Contract">
                  <select value={contract} onChange={(e) => setContract(e.target.value)} className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm">
                    {contracts.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* File zones */}
              <div className="space-y-3">
                <FileZone
                  n={1}
                  title="Consolidated / Summary Invoice"
                  hint="GC Cover Page + Continuation Sheet"
                  required
                  file={f1}
                  onUpload={() => mockUpload(1)}
                  onRemove={() => setF1(null)}
                />
                <FileZone
                  n={2}
                  title="Sub-Contractor Breakdown"
                  hint="All sub-contractor invoices compiled"
                  file={f2}
                  onUpload={() => mockUpload(2)}
                  onRemove={() => setF2(null)}
                />
                <FileZone
                  n={3}
                  title="Supporting Documents"
                  hint="Direct-cost backup billed by contractor"
                  file={f3}
                  onUpload={() => mockUpload(3)}
                  onRemove={() => setF3(null)}
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate({ to: "/" })}>
                  Cancel
                </button>
                <button
                  disabled={!f1}
                  onClick={beginProcessing}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Begin Processing →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function StepIndicator({ step }: { step: number }) {
  const steps = ["Upload Files", "Confirm", "Process"];
  return (
    <div className="flex items-center gap-2 mt-3">
      {steps.map((s, i) => {
        const active = i + 1 === step;
        const done = i + 1 < step;
        return (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                  ? "bg-success text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={`text-xs ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
            {i < steps.length - 1 && <span className="w-6 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function FileZone({
  n,
  title,
  hint,
  required,
  file,
  onUpload,
  onRemove,
}: {
  n: number;
  title: string;
  hint: string;
  required?: boolean;
  file: UploadedFile | null;
  onUpload: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`rounded-md p-4 ${
        file
          ? "border border-success/40 bg-success/5"
          : required
          ? "border border-border bg-background"
          : "border border-dashed border-border bg-background/60"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium">
          File {n} — {title}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {required ? "Required" : "Optional"}
        </span>
      </div>
      <div className="text-xs text-muted-foreground mb-3">{hint}</div>
      {file ? (
        <div className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-success" />
          <span className="flex-1 truncate">{file.name}</span>
          <span className="text-xs text-muted-foreground">{file.size}</span>
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onUpload}
          className="w-full rounded-md border border-dashed border-border bg-muted/30 py-6 text-sm text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
        >
          <Upload className="h-4 w-4 inline mr-1.5" /> Drop PDF here or click to browse
        </button>
      )}
    </div>
  );
}
