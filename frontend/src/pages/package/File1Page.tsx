/**
 * File1Page — Sprint 5.
 * Split pane: editable GC header table (19 fields) + GC G703 SOV table (15 cols).
 * Right panel: PDF viewer stub (Sprint 12).
 */
import { useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, FileText } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import PdfViewer from '@/components/PdfViewer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GcHeader {
  id: string;
  packageId: string;
  toOwner: string | null;
  fromContractor: string | null;
  projectName: string | null;
  applicationNo: string | null;
  period: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  originalContractSum: string | null;
  netChangeOrders: string | null;
  contractSumToDate: string | null;
  totalCompletedStored: string | null;
  retainageCompleted: string | null;
  retainageMaterials: string | null;
  totalRetainage: string | null;
  totalEarnedLessRet: string | null;
  lessPrevCertificates: string | null;
  currentPaymentDue: string | null;
  balanceToFinish: string | null;
  changeOrderSummary: string | null;
  extractionConfidence: string | null;
}

interface SovLine {
  id: string;
  packageId: string;
  itemNo: string | null;
  timePeriod: string | null;
  phases: string | null;
  typeOfWork: string | null;
  contractorName: string | null;
  scheduledOriginal: string | null;
  scheduledChangeOrders: string | null;
  scheduledCurrent: string | null;
  workCompletedPrev: string | null;
  workCompletedThis: string | null;
  materialsStored: string | null;
  totalCompleted: string | null;
  pct: string | null;
  balanceToFinish: string | null;
  retainage: string | null;
  extractionConfidence: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CURRENCY_FIELDS = new Set([
  'originalContractSum', 'netChangeOrders', 'contractSumToDate', 'totalCompletedStored',
  'retainageCompleted', 'retainageMaterials', 'totalRetainage', 'totalEarnedLessRet',
  'lessPrevCertificates', 'currentPaymentDue', 'balanceToFinish',
  'scheduledOriginal', 'scheduledChangeOrders', 'scheduledCurrent',
  'workCompletedPrev', 'workCompletedThis', 'materialsStored', 'totalCompleted',
  'retainage',
]);

function fmtCurrency(val: string | null): string {
  if (!val) return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function fmtPct(val: string | null): string {
  if (!val) return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  // stored as 0–1 ratio
  return `${(n * 100).toFixed(1)}%`;
}

function confidenceBadge(conf: string | null) {
  if (!conf) return null;
  const n = parseFloat(conf);
  if (isNaN(n)) return null;
  const color = n >= 0.85 ? 'bg-green-100 text-green-700' : n >= 0.65 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';
  return <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${color}`}>{(n * 100).toFixed(0)}%</span>;
}

function camelToSnake(s: string) {
  return s.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`);
}

function fieldLabel(key: string): string {
  const LABELS: Record<string, string> = {
    toOwner: 'To Owner', fromContractor: 'From Contractor', projectName: 'Project Name',
    applicationNo: 'Application No.', period: 'Period', periodFrom: 'Period From',
    periodTo: 'Period To', originalContractSum: 'Original Contract Sum',
    netChangeOrders: 'Net Change Orders', contractSumToDate: 'Contract Sum to Date',
    totalCompletedStored: 'Total Completed & Stored', retainageCompleted: 'Retainage (Completed)',
    retainageMaterials: 'Retainage (Materials)', totalRetainage: 'Total Retainage',
    totalEarnedLessRet: 'Total Earned Less Retainage', lessPrevCertificates: 'Less Prev. Certificates',
    currentPaymentDue: 'Current Payment Due', balanceToFinish: 'Balance to Finish',
    changeOrderSummary: 'Change Order Summary',
  };
  return LABELS[key] ?? key;
}

const GC_HEADER_FIELDS: (keyof Omit<GcHeader, 'id' | 'packageId' | 'extractionConfidence'>)[] = [
  'toOwner', 'fromContractor', 'projectName', 'applicationNo', 'period', 'periodFrom', 'periodTo',
  'originalContractSum', 'netChangeOrders', 'contractSumToDate', 'totalCompletedStored',
  'retainageCompleted', 'retainageMaterials', 'totalRetainage', 'totalEarnedLessRet',
  'lessPrevCertificates', 'currentPaymentDue', 'balanceToFinish', 'changeOrderSummary',
];

// ─── Inline editable cell ─────────────────────────────────────────────────────

function EditableCell({
  value,
  isCurrency = false,
  isPct = false,
  onSave,
}: {
  value: string | null;
  isCurrency?: boolean;
  isPct?: boolean;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    setEditing(false);
    if (draft !== (value ?? '')) onSave(draft);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="w-full rounded border border-[var(--color-brand-primary)] bg-white px-2 py-0.5 text-sm focus:outline-none"
      />
    );
  }

  const display = isPct ? fmtPct(value) : isCurrency ? fmtCurrency(value) : (value ?? '—');
  return (
    <span
      onClick={() => { setDraft(value ?? ''); setEditing(true); }}
      className="cursor-text rounded hover:bg-blue-50 px-1"
      title="Click to edit"
    >
      {display}
    </span>
  );
}

// ─── Split Pane ───────────────────────────────────────────────────────────────

function SplitPane({ left, right }: { left: ReactNode; right: ReactNode }) {
  const [leftWidth, setLeftWidth] = useState(60); // percent
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback(() => { dragging.current = true; }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftWidth(Math.max(30, Math.min(80, pct)));
  }, []);
  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  return (
    <div
      ref={containerRef}
      className="flex h-full overflow-hidden select-none"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div className="overflow-y-auto" style={{ width: `${leftWidth}%`, minWidth: 280 }}>
        {left}
      </div>
      {/* Draggable divider */}
      <div
        onMouseDown={onMouseDown}
        className="w-1.5 shrink-0 cursor-col-resize bg-[var(--color-border)] hover:bg-[var(--color-brand-primary)] transition-colors"
      />
      <div className="flex-1 overflow-y-auto" style={{ minWidth: 200 }}>
        {right}
      </div>
    </div>
  );
}

// ─── GC Header Table ──────────────────────────────────────────────────────────

function GcHeaderTable({ packageId }: { packageId: string }) {
  const queryClient = useQueryClient();
  const { data: header, isLoading } = useQuery<GcHeader | null>({
    queryKey: ['gc-header', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}/gc-header`) as Promise<GcHeader | null>,
    staleTime: 30_000,
  });

  const { mutate: patchField } = useMutation({
    mutationFn: ({ field, value }: { field: string; value: string | number | null }) =>
      apiFetch(`/packages/${packageId}/gc-header`, {
        method: 'PATCH',
        body: JSON.stringify({ field, value, changedBy: 'user' }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gc-header', packageId] }),
  });

  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand-primary)]" /></div>;
  if (!header) return (
    <div className="flex flex-col items-center justify-center gap-2 p-8 text-sm text-[var(--color-text-secondary)]">
      <FileText className="h-8 w-8 opacity-30" />
      <p>No GC header extracted yet.</p>
      <p className="text-xs">Run the pipeline to extract G702 data.</p>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          G702 Application Header
        </h3>
        {confidenceBadge(header.extractionConfidence)}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {GC_HEADER_FIELDS.map((key) => {
            const rawVal = header[key as keyof GcHeader] as string | null;
            const isCurr = CURRENCY_FIELDS.has(key);
            return (
              <tr key={key} className="border-b border-[var(--color-border)] hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-[var(--color-text-secondary)] whitespace-nowrap w-48">
                  {fieldLabel(key)}
                </td>
                <td className="px-4 py-2 text-right">
                  <EditableCell
                    value={rawVal}
                    isCurrency={isCurr}
                    onSave={(v) => {
                      const numVal = isCurr ? parseFloat(v.replace(/,/g, '')) : null;
                      patchField({ field: camelToSnake(key), value: numVal !== null && !isNaN(numVal) ? numVal : v });
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── GC SOV Table ─────────────────────────────────────────────────────────────

const SOV_COLS: { key: keyof SovLine; label: string; width?: string }[] = [
  { key: 'itemNo',               label: 'Item',     width: '60px' },
  { key: 'typeOfWork',           label: 'Description' },
  { key: 'contractorName',       label: 'Contractor' },
  { key: 'scheduledOriginal',    label: 'Scheduled',  width: '110px' },
  { key: 'scheduledChangeOrders',label: 'Change Ord', width: '110px' },
  { key: 'scheduledCurrent',     label: 'Current',    width: '110px' },
  { key: 'workCompletedPrev',    label: 'Prev.',       width: '110px' },
  { key: 'workCompletedThis',    label: 'This Period', width: '110px' },
  { key: 'materialsStored',      label: 'Materials',  width: '110px' },
  { key: 'totalCompleted',       label: 'Total',      width: '110px' },
  { key: 'pct',                  label: '%',           width: '60px' },
  { key: 'balanceToFinish',      label: 'Balance',    width: '110px' },
  { key: 'retainage',            label: 'Retainage',  width: '110px' },
];

function GcSovTable({ packageId, onPageSelect }: { packageId: string; onPageSelect?: (page: number) => void }) {
  const queryClient = useQueryClient();
  const { data: lines = [], isLoading } = useQuery<SovLine[]>({
    queryKey: ['gc-sov', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}/gc-sov`) as Promise<SovLine[]>,
    staleTime: 30_000,
  });

  const { mutate: patchLine } = useMutation({
    mutationFn: ({ lineId, field, value }: { lineId: string; field: string; value: string | number | null }) =>
      apiFetch(`/packages/${packageId}/gc-sov/${lineId}`, {
        method: 'PATCH',
        body: JSON.stringify({ field, value, changedBy: 'user' }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gc-sov', packageId] }),
  });

  // Client-side computed totals for display
  const totals = lines.reduce(
    (acc, l) => {
      const add = (k: keyof SovLine) => acc[k as string] = (acc[k as string] ?? 0) + (parseFloat(l[k] as string ?? '0') || 0);
      ['scheduledOriginal', 'scheduledChangeOrders', 'scheduledCurrent', 'workCompletedPrev', 'workCompletedThis',
       'materialsStored', 'totalCompleted', 'balanceToFinish', 'retainage'].forEach(add);
      return acc;
    },
    {} as Record<string, number>,
  );

  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand-primary)]" /></div>;

  return (
    <div>
      <div className="px-4 py-2 border-b border-[var(--color-border)]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          G703 Schedule of Values
          <span className="ml-2 font-normal normal-case">({lines.length} lines)</span>
        </h3>
      </div>
      {lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 p-8 text-sm text-[var(--color-text-secondary)]">
          <FileText className="h-8 w-8 opacity-30" />
          <p>No SOV lines extracted yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 sticky top-0 z-10">
                {SOV_COLS.map((col) => (
                  <th
                    key={col.key}
                    className="border-b border-[var(--color-border)] px-2 py-2 text-left font-semibold text-[var(--color-text-secondary)] whitespace-nowrap"
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                // Client-side recalculate pct and balance
                const prev = parseFloat(line.workCompletedPrev ?? '0') || 0;
                const curr = parseFloat(line.workCompletedThis ?? '0') || 0;
                const mats = parseFloat(line.materialsStored ?? '0') || 0;
                const sched = parseFloat(line.scheduledCurrent ?? line.scheduledOriginal ?? '0') || 0;
                const computedTotal = prev + curr + mats;
                const computedPct = sched > 0 ? computedTotal / sched : null;
                const computedBalance = sched - computedTotal;

                return (
                  <tr key={line.id}
                    className={`border-b border-[var(--color-border)] ${onPageSelect && line.sourcePage ? 'cursor-pointer hover:bg-blue-50/50' : 'hover:bg-blue-50/30'}`}
                    onClick={() => { if (onPageSelect && line.sourcePage) onPageSelect(parseInt(line.sourcePage)); }}
                    title={line.sourcePage ? `📄 Source: page ${line.sourcePage}` : undefined}
                  >
                    {SOV_COLS.map((col) => {
                      const raw = line[col.key] as string | null;
                      const isCurr = CURRENCY_FIELDS.has(col.key);
                      const isPct = col.key === 'pct';
                      // Use computed values for derived fields
                      const displayVal = col.key === 'totalCompleted' ? String(computedTotal || '')
                        : col.key === 'pct' ? (computedPct !== null ? String(computedPct) : raw)
                        : col.key === 'balanceToFinish' ? String(computedBalance || '')
                        : raw;

                      return (
                        <td key={col.key} className="px-2 py-1.5 align-middle">
                          <EditableCell
                            value={displayVal}
                            isCurrency={isCurr}
                            isPct={isPct}
                            onSave={(v) => {
                              const numVal = (isCurr || isPct) ? parseFloat(v.replace(/,/g, '')) : null;
                              const finalVal = numVal !== null && !isNaN(numVal)
                                ? (isPct && numVal > 1 ? numVal / 100 : numVal)
                                : v;
                              patchLine({ lineId: line.id, field: camelToSnake(col.key), value: finalVal });
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="bg-gray-50 font-semibold text-xs border-t-2 border-[var(--color-border)]">
                <td className="px-2 py-2" colSpan={3}>Totals</td>
                {SOV_COLS.slice(3).map((col) => (
                  <td key={col.key} className="px-2 py-2 text-right">
                    {CURRENCY_FIELDS.has(col.key) ? fmtCurrency(String(totals[col.key] ?? '')) : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── File1Page ────────────────────────────────────────────────────────────────

export default function File1Page() {
  const { packageId } = useParams<{ packageId: string }>();
  const [pdfPage, setPdfPage] = useState<number>(1);
  if (!packageId) return null;

  const leftPanel = (
    <div className="flex flex-col divide-y divide-[var(--color-border)]">
      <GcHeaderTable packageId={packageId} />
      <GcSovTable packageId={packageId} onPageSelect={(page) => setPdfPage(page)} />
    </div>
  );

  return (
    <div className="h-[calc(100vh-3rem)] overflow-hidden">
      <SplitPane
        left={leftPanel}
        right={
          <PdfViewer
            packageId={packageId}
            docIndex={0}
            currentPage={pdfPage}
            onPageChange={setPdfPage}
          />
        }
      />
    </div>
  );
}

