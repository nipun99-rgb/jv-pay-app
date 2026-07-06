/**
 * File2Page — Sub-contractor pay applications.
 * Same pattern as CoverPage G703: full-width table + floating draggable doc panel.
 */
import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import FloatingDocPanel from '@/components/FloatingDocPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubHeaderSummary {
  id: string;
  seqId: number;
  subcontractorName: string | null;
  applicationNo: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  totalCompletedStored: string | null;
  currentPaymentDue: string | null;
  extractionConfidence: string | null;
}

interface SubSovLine {
  id: string;
  subAppId: string;
  itemNo: string | null;
  description: string | null;
  scheduledValue: string | null;
  workCompletedPrev: string | null;
  workCompletedThis: string | null;
  materialsStored: string | null;
  totalCompleted: string | null;
  pctComplete: string | null;
  balanceToFinish: string | null;
  retainage: string | null;
  contractorSignaturePresent: boolean | null;
  notaryDetailsPresent: boolean | null;
  extractionConfidence: string | null;
  sourcePage: string | null;
}

interface SubHeaderFull extends SubHeaderSummary {
  invoiceTo: string | null;
  projectName: string | null;
  contractPoNumber: string | null;
  originalContractSum: string | null;
  netChangeOrders: string | null;
  contractSumToDate: string | null;
  totalCompletedStored: string | null;
  totalRetainage: string | null;
  retainagePercent: string | null;
  totalEarnedLessRet: string | null;
  lessPreviousCerts: string | null;
  currentPaymentDue: string | null;
  balanceToFinish: string | null;
  applicationDate: string | null;
  periodTo: string | null;
  startPage: number | null;
  endPage: number | null;
  sovLines: SubSovLine[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CURRENCY_KEYS = new Set([
  'originalContractSum', 'netChangeOrders', 'contractSumToDate', 'totalCompletedStored',
  'currentPaymentDue', 'totalRetainage', 'totalEarnedLessRet', 'lessPreviousCerts',
  'balanceToFinish', 'scheduledValue', 'workCompletedPrev',
  'workCompletedThis', 'materialsStored', 'totalCompleted', 'retainage',
]);

function fmtCurrency(v: string | null): string {
  if (!v) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function fmtPct(v: string | null): string {
  if (!v) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  return `${(n * 100).toFixed(1)}%`;
}

function confidenceBadge(conf: string | null) {
  if (!conf) return null;
  const n = parseFloat(conf);
  if (isNaN(n)) return null;
  const cls = n >= 0.85 ? 'bg-green-100 text-green-700' : n >= 0.65 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{(n * 100).toFixed(0)}%</span>;
}

function camelToSnake(s: string) {
  return s.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`);
}

// ─── Inline editable cell ─────────────────────────────────────────────────────

function EditableCell({
  value, isCurrency = false, isPct = false, onSave,
}: { value: string | null; isCurrency?: boolean; isPct?: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const commit = () => {
    setEditing(false);
    if (draft !== (value ?? '')) onSave(draft);
  };

  if (editing) {
    return (
      <input
        autoFocus value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="w-full rounded border border-[var(--color-brand-primary)] bg-white px-2 py-0.5 text-sm focus:outline-none"
      />
    );
  }

  const display = isPct ? fmtPct(value) : isCurrency ? fmtCurrency(value) : (value ?? '—');
  return (
    <span onClick={() => { setDraft(value ?? ''); setEditing(true); }}
      className="cursor-text rounded hover:bg-blue-50 px-1" title="Click to edit">
      {display}
    </span>
  );
}

// ─── SplitPane ────────────────────────────────────────────────────────────────

function SplitPane({ left, right }: { left: ReactNode; right: ReactNode }) {
  const [leftWidth, setLeftWidth] = useState(58);
  let dragging = false;

  return (
    <div className="flex h-full overflow-hidden select-none"
      onMouseMove={(e) => { if (!dragging) return; const r = e.currentTarget.getBoundingClientRect(); setLeftWidth(Math.max(30, Math.min(80, ((e.clientX - r.left) / r.width) * 100))); }}
      onMouseUp={() => { dragging = false; }}
      onMouseLeave={() => { dragging = false; }}>
      <div className="overflow-y-auto" style={{ width: `${leftWidth}%`, minWidth: 260 }}>{left}</div>
      <div className="w-1.5 shrink-0 cursor-col-resize bg-[var(--color-border)] hover:bg-[var(--color-brand-primary)] transition-colors"
        onMouseDown={() => { dragging = true; }} />
      <div className="flex-1 overflow-y-auto" style={{ minWidth: 160 }}>{right}</div>
    </div>
  );
}

// ─── Sub header field definitions ─────────────────────────────────────────────

const SUB_HEADER_FIELDS: { key: keyof SubHeaderFull; label: string }[] = [
  { key: 'subcontractorName',    label: 'Subcontractor Name' },
  { key: 'invoiceTo',            label: 'Invoice To' },
  { key: 'projectName',          label: 'Project Name' },
  { key: 'contractPoNumber',     label: 'Contract / PO Number' },
  { key: 'applicationNo',        label: 'Invoice / Application No.' },
  { key: 'applicationDate',      label: 'Invoice / Application Date' },
  { key: 'periodTo',             label: 'Period To' },
  { key: 'originalContractSum',  label: 'Original Contract Sum' },
  { key: 'netChangeOrders',      label: 'Net Change by Change Orders' },
  { key: 'contractSumToDate',    label: 'Contract Sum to Date' },
  { key: 'totalCompletedStored', label: 'Total Completed & Stored to Date' },
  { key: 'totalRetainage',       label: 'Total Retainage' },
  { key: 'retainagePercent',     label: 'Retainage %' },
  { key: 'totalEarnedLessRet',   label: 'Total Earned Less Retainage' },
  { key: 'lessPreviousCerts',    label: 'Less Previous Certificates / Payments' },
  { key: 'currentPaymentDue',    label: 'Current Payment Due / This Period' },
  { key: 'balanceToFinish',      label: 'Balance to Finish' },
];

const SUB_SOV_COLS: { key: keyof SubSovLine; label: string; width?: string }[] = [
  { key: 'itemNo',                       label: 'Item No.',             width: '50px' },
  { key: 'description',                  label: 'Description of Work' },
  { key: 'scheduledValue',               label: 'Scheduled Value',     width: '110px' },
  { key: 'workCompletedPrev',            label: 'Work Completed Prev.', width: '110px' },
  { key: 'workCompletedThis',            label: 'This Period',          width: '110px' },
  { key: 'materialsStored',              label: 'Materials Stored',    width: '110px' },
  { key: 'totalCompleted',               label: 'Total Completed & Stored', width: '110px' },
  { key: 'pctComplete',                  label: '% Complete',          width: '70px' },
  { key: 'retainage',                    label: 'Retainage',           width: '100px' },
  { key: 'balanceToFinish',              label: 'Balance to Finish',   width: '110px' },
  { key: 'contractorSignaturePresent',   label: 'Contractor Sig.',     width: '80px' },
  { key: 'notaryDetailsPresent',         label: 'Notary',              width: '70px' },
];

// ─── File2Page — Accordion master table ────────────────────────────────────────

export default function File2Page() {
  const { packageId } = useParams<{ packageId: string }>();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDocPanel, setShowDocPanel] = useState(false);
  const [docPanelPage, setDocPanelPage] = useState(1);

  const { data: subList = [], isLoading } = useQuery<SubHeaderFull[]>({
    queryKey: ['sub-headers', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}/sub-headers`) as Promise<SubHeaderFull[]>,
    staleTime: 30_000,
    enabled: !!packageId,
  });

  const { mutate: patchSov } = useMutation({
    mutationFn: ({ lineId, field, value }: { lineId: string; field: string; value: string | number | null }) =>
      apiFetch(`/packages/${packageId}/sub-sov/${lineId}`, {
        method: 'PATCH', body: JSON.stringify({ field, value, changedBy: 'user' }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sub-headers', packageId] }),
  });

  if (!packageId) return null;
  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-primary)]" /></div>;
  if (subList.length === 0) return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--color-text-secondary)]">
      <Users className="h-12 w-12 opacity-20" />
      <p className="text-sm font-medium">No sub-contractor data yet</p>
    </div>
  );

  // Grand totals across all subs
  const grandTotals = subList.reduce((acc, s) => {
    const add = (k: keyof SubHeaderFull) => { acc[k as string] = (acc[k as string] ?? 0) + (parseFloat(s[k] as string ?? '0') || 0); };
    ['originalContractSum','contractSumToDate','totalCompletedStored','totalRetainage','currentPaymentDue','balanceToFinish'].forEach(add);
    return acc;
  }, {} as Record<string, number>);

  const MASTER_COLS = [
    { key: 'subcontractorName',  label: 'Subcontractor',               pct: false, curr: false },
    { key: 'applicationNo',      label: 'App No.',                      pct: false, curr: false },
    { key: 'periodTo',           label: 'Period To',                    pct: false, curr: false },
    { key: 'invoiceTo',          label: 'Invoice To',                   pct: false, curr: false },
    { key: 'originalContractSum',label: 'Original Contract Sum',        pct: false, curr: true  },
    { key: 'netChangeOrders',    label: 'Net Change Orders',            pct: false, curr: true  },
    { key: 'contractSumToDate',  label: 'Contract Sum to Date',         pct: false, curr: true  },
    { key: 'totalCompletedStored',label: 'Total Completed & Stored',    pct: false, curr: true  },
    { key: 'totalRetainage',     label: 'Total Retainage',              pct: false, curr: true  },
    { key: 'lessPreviousCerts',  label: 'Less Previous Certs',          pct: false, curr: true  },
    { key: 'currentPaymentDue',  label: 'Current Payment Due',          pct: false, curr: true  },
    { key: 'balanceToFinish',    label: 'Balance to Finish',            pct: false, curr: true  },
  ] as const;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-2.5 bg-white border-b border-[var(--color-border)]">
        <h2 className="text-sm font-bold text-gray-900">Sub-Contractor Pay Applications</h2>
        <span className="text-xs text-gray-400">{subList.length} subs · click row to expand SOV lines · click cell → edit</span>
        <button onClick={() => { setShowDocPanel(v => !v); }}
          className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
          📄 {showDocPanel ? 'Hide Doc' : 'Show Doc'}
        </button>
      </div>

      {/* Master accordion table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="text-xs border-collapse w-full" style={{ minWidth: '1400px' }}>
          {/* Master header */}
          <thead className="sticky top-0 z-20">
            <tr className="bg-gray-800 text-white">
              <th className="w-8 px-2 py-2.5" />
              <th className="w-6 px-1 py-2.5 text-center text-[10px]">#</th>
              {MASTER_COLS.map(c => (
                <th key={c.key} className={`px-2 py-2.5 font-semibold text-[11px] whitespace-nowrap border-r border-white/10 ${c.curr ? 'text-right' : 'text-left'}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subList.map((sub, idx) => {
              const isOpen = expandedId === sub.id;
              const conf = parseFloat(sub.extractionConfidence ?? '0');

              return (
                <>
                  {/* Master row */}
                  <tr key={sub.id}
                    onClick={() => {
                      setExpandedId(isOpen ? null : sub.id);
                      if (!isOpen && sub.startPage) { setDocPanelPage(sub.startPage); setShowDocPanel(true); }
                    }}
                    className={`border-b cursor-pointer transition-colors select-none ${
                      isOpen ? 'bg-[var(--color-brand-primary)]/5 border-[var(--color-brand-primary)]/20' : idx % 2 === 0 ? 'bg-white hover:bg-orange-50/40' : 'bg-gray-50/60 hover:bg-orange-50/40'
                    }`}>

                    {/* Expand toggle */}
                    <td className="px-2 text-center">
                      <span className={`inline-block text-gray-400 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                    </td>
                    <td className="px-1 text-center text-gray-400 font-mono">{sub.seqId + 1}</td>

                    {MASTER_COLS.map(c => {
                      const raw = sub[c.key as keyof SubHeaderFull] as string | null;
                      const display = c.curr ? fmtCurrency(raw) : (raw ?? '—');
                      const isPayDue = c.key === 'currentPaymentDue';
                      return (
                        <td key={c.key} className={`px-2 py-2 border-r border-gray-100 ${c.curr ? 'text-right tabular-nums' : ''} ${isPayDue ? 'font-bold text-[var(--color-brand-primary)]' : c.key === 'subcontractorName' ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                          {c.key === 'subcontractorName' ? (
                            <div className="flex items-center gap-2">
                              <span>{display}</span>
                              {conf >= 0.9 ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" /> : <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />}
                              <span className="text-[9px] text-gray-400 ml-auto">{(sub.sovLines ?? []).length} lines</span>
                            </div>
                          ) : display}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Expanded SOV rows */}
                  {isOpen && (
                    <tr key={`${sub.id}-sov`}>
                      <td colSpan={MASTER_COLS.length + 2} className="p-0 bg-blue-50/20">
                        <div className="border-y border-[var(--color-brand-primary)]/20">
                          {/* SOV header */}
                          <div className="flex items-center gap-3 px-4 py-1.5 bg-[var(--color-brand-primary)]/8 border-b border-[var(--color-brand-primary)]/20">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-brand-primary)]">
                              {sub.subcontractorName} — Continuation Sheet ({(sub.sovLines ?? []).length} lines)
                            </span>
                            <span className="text-[10px] text-gray-400 ml-auto">💡 Click row → document · Click cell → edit</span>
                          </div>
                          {/* SOV table */}
                          <table className="text-xs border-collapse w-full" style={{ minWidth: '1100px' }}>
                            <thead>
                              <tr className="bg-[var(--color-brand-primary)] text-white">
                                {SUB_SOV_COLS.map(col => (
                                  <th key={col.key} className="px-2 py-1.5 text-center font-semibold whitespace-nowrap border-r border-blue-400/20"
                                    style={{ width: col.width, minWidth: col.width }}>
                                    {col.label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(sub.sovLines ?? []).map((line, li) => (
                                <tr key={line.id ?? li}
                                  onClick={e => { e.stopPropagation(); const pg = line.sourcePage ? parseInt(String(line.sourcePage), 10) : (sub.startPage ?? 1); setDocPanelPage(isNaN(pg) ? 1 : pg); setShowDocPanel(true); }}
                                  className={`border-b border-gray-100 cursor-pointer transition-colors ${li % 2 === 0 ? 'bg-white hover:bg-blue-50/60' : 'bg-blue-50/20 hover:bg-blue-50/60'}`}>
                                  {SUB_SOV_COLS.map(col => {
                                    const raw = line[col.key];
                                    const isCurr = CURRENCY_KEYS.has(col.key);
                                    const isPct = col.key === 'pctComplete';
                                    const isBool = col.key === 'contractorSignaturePresent' || col.key === 'notaryDetailsPresent';
                                    return (
                                      <td key={col.key} className={`px-2 py-1 border-r border-gray-100 ${col.key === 'description' ? 'font-medium text-gray-800' : isCurr ? 'text-right tabular-nums text-gray-700' : isPct ? 'text-right' : 'text-gray-600'}`}>
                                        {isBool ? (
                                          <span className={`font-bold ${raw ? 'text-green-600' : 'text-gray-300'}`}>{raw ? '✓' : '—'}</span>
                                        ) : (
                                          <EditableCell value={raw as string | null} isCurrency={isCurr} isPct={isPct}
                                            onSave={v => {
                                              const n = (isCurr || isPct) ? parseFloat(v.replace(/,/g, '')) : null;
                                              const val = n !== null && !isNaN(n) ? (isPct && n > 1 ? n / 100 : n) : v;
                                              patchSov({ lineId: line.id, field: camelToSnake(col.key), value: val });
                                            }} />
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                              {(sub.sovLines ?? []).length === 0 && (
                                <tr><td colSpan={12} className="px-4 py-6 text-center text-gray-400">No SOV lines extracted.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>

          {/* Grand totals footer */}
          <tfoot className="sticky bottom-0 z-10">
            <tr className="bg-gray-800 text-white font-bold text-xs">
              <td colSpan={5} className="px-3 py-2.5">Grand Total — {subList.length} Sub-Contractors</td>
              {MASTER_COLS.slice(4).map(c => (
                <td key={c.key} className="px-2 py-2.5 text-right tabular-nums">
                  {grandTotals[c.key] ? fmtCurrency(String(grandTotals[c.key])) : '—'}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Floating doc panel */}
      {showDocPanel && packageId && (
        <FloatingDocPanel
          packageId={packageId}
          page={docPanelPage}
          totalPages={198}
          fileType="SUB_PAY_APP"
          label="Sub-Contractor Doc"
          onClose={() => setShowDocPanel(false)}
        />
      )}
    </div>
  );
}
