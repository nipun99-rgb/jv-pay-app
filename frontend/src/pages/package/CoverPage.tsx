/**
 * CoverPage — 2-step extraction confirmation.
 * Step 1: G702 Cover Sheet (18 fields) + PDF viewer side-by-side.
 * Step 2: G703 Continuation Sheet + PDF viewer side-by-side.
 */
import { useState, useRef, useCallback, Component, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle2, AlertCircle, ChevronRight, Check, FileText, ZoomIn, ZoomOut, X, Minimize2, Maximize2, Move } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import PageImageViewer from '@/components/PageImageViewer';

// ─── PDF Error Boundary (keep for potential future use) ───────────────────────
class PdfErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center text-gray-400 p-8">
        <FileText className="h-12 w-12 opacity-20" />
        <p className="text-sm">{this.state.error}</p>
      </div>
    );
    return this.props.children;
  }
}

interface GcHeader {
  toOwner: string | null; fromContractor: string | null; projectName: string | null;
  applicationNo: string | null; period: string | null; periodTo: string | null;
  originalContractSum: string | null; netChangeOrders: string | null; contractSumToDate: string | null;
  totalCompletedStored: string | null; retainageCompleted: string | null; retainageMaterials: string | null;
  totalRetainage: string | null; totalEarnedLessRet: string | null; lessPrevCertificates: string | null;
  currentPaymentDue: string | null; balanceToFinish: string | null; changeOrderSummary: string | null;
  extractionConfidence: string | null;
}
interface SovLine {
  id?: string;
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

function fmt(val: string | null, style: 'currency' | 'plain' = 'plain'): string {
  if (!val) return '—';
  if (style === 'currency') {
    const n = parseFloat(val.replace(/,/g, ''));
    return isNaN(n) ? val : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
  return val;
}

interface FieldDef { label: string; hint: string; key: keyof GcHeader; format: 'plain' | 'currency' | 'bool'; section: 'identity' | 'financial' | 'signature'; highlight?: boolean; }

const G702_FIELDS: FieldDef[] = [
  { label: 'From Contractor',                   hint: 'JV/contractor submitting application',          key: 'fromContractor',       format: 'plain',    section: 'identity' },
  { label: 'Project Name',                       hint: 'Project name or description',                  key: 'projectName',          format: 'plain',    section: 'identity' },
  { label: 'Payment Application No.',           hint: 'Application or invoice reference number',      key: 'applicationNo',        format: 'plain',    section: 'identity' },
  { label: 'Payment Application Period',         hint: 'Period covered by payment application',        key: 'periodTo',             format: 'plain',    section: 'identity' },
  { label: 'Original Contract Sum',             hint: 'Original contract value',                      key: 'originalContractSum',  format: 'currency', section: 'financial' },
  { label: 'Net Change by Change Orders',        hint: 'Net approved change orders to date',           key: 'netChangeOrders',      format: 'currency', section: 'financial' },
  { label: 'Contract Sum to Date',               hint: 'Current contract value after COs',             key: 'contractSumToDate',    format: 'currency', section: 'financial' },
  { label: 'Total Completed & Stored to Date',  hint: 'Total cumulative completed/stored amount',     key: 'totalCompletedStored', format: 'currency', section: 'financial' },
  { label: 'Retainage on Completed Work',        hint: 'Retainage on completed work',                  key: 'retainageCompleted',   format: 'currency', section: 'financial' },
  { label: 'Retainage on Stored Materials',      hint: 'Retainage on stored materials',                key: 'retainageMaterials',   format: 'currency', section: 'financial' },
  { label: 'Total Retainage',                    hint: 'Total retainage withheld',                     key: 'totalRetainage',       format: 'currency', section: 'financial' },
  { label: 'Total Earned Less Retainage',        hint: 'Earned value after retainage',                 key: 'totalEarnedLessRet',   format: 'currency', section: 'financial' },
  { label: 'Less Previous Certificates',        hint: 'Previously certified/paid amount',             key: 'lessPrevCertificates', format: 'currency', section: 'financial' },
  { label: 'Current Payment Due',                hint: 'Current payment requested',                    key: 'currentPaymentDue',    format: 'currency', section: 'financial', highlight: true },
  { label: 'Balance to Finish incl. Retainage', hint: 'Remaining contract balance',                   key: 'balanceToFinish',      format: 'currency', section: 'financial' },
  { label: 'Change Order Summary',               hint: 'Summary of change order additions/deductions', key: 'changeOrderSummary',   format: 'plain',    section: 'financial' },
  { label: "Architect's Signature Present",      hint: 'Whether architect certification is present',   key: 'extractionConfidence', format: 'bool',     section: 'signature' },
  { label: "Contractor's Signature Present",     hint: 'Whether contractor signature is present',      key: 'extractionConfidence', format: 'bool',     section: 'signature' },
];

function FieldRow({ field, header, packageId, onSaved, onEdit }: { field: FieldDef; header: GcHeader; packageId: string; onSaved: (key: keyof GcHeader, val: string) => void; onEdit?: () => void; }) {
  const raw = header[field.key];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  let display: string; let status: 'ok' | 'warn' | 'missing';
  if (field.format === 'bool') {
    const c = parseFloat(header.extractionConfidence ?? '0');
    display = c >= 0.75 ? 'Present ✓' : 'Not detected'; status = c >= 0.75 ? 'ok' : 'warn';
  } else if (field.format === 'currency') {
    const n = raw ? parseFloat(raw.replace(/,/g, '')) : NaN;
    display = isNaN(n) ? '—' : fmt(raw, 'currency'); status = !raw ? 'missing' : n < 0 ? 'warn' : 'ok';
  } else { display = raw ?? '—'; status = !raw ? 'missing' : 'ok'; }

  const editable = field.format !== 'bool';

  const save = async () => {
    if (!editable) return;
    setSaving(true);
    try {
      await apiFetch(`/packages/${packageId}/gc-header`, {
        method: 'PATCH',
        body: JSON.stringify({ field: field.key, value: draft || null, changedBy: 'user' }),
      });
      onSaved(field.key, draft);
    } catch { /* silent */ }
    setSaving(false);
    setEditing(false);
  };

  if (editing) return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 ${field.highlight ? 'bg-blue-50 -mx-4 px-4 rounded-lg my-1' : ''}`}>
      <div className="mt-0.5 shrink-0"><AlertCircle className="h-3.5 w-3.5 text-blue-400" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-600">{field.label}</p>
        <p className="text-[10px] text-gray-400 leading-tight">{field.hint}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          onBlur={save}
          className="text-xs border border-blue-400 rounded px-2 py-1 outline-none bg-blue-50 w-44"
        />
        {saving && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
      </div>
    </div>
  );

  return (
    <div
      className={`flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 group ${field.highlight ? 'bg-blue-50 -mx-4 px-4 rounded-lg my-1' : ''} ${editable ? 'cursor-pointer hover:bg-yellow-50 transition-colors' : ''}`}
      onClick={() => { if (!editable) return; setDraft(raw ?? ''); setEditing(true); onEdit?.(); }}
      title={editable ? 'Click to edit' : undefined}
    >
      <div className="mt-0.5 shrink-0">
        {status === 'ok'      && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
        {status === 'warn'    && <AlertCircle  className="h-3.5 w-3.5 text-amber-400" />}
        {status === 'missing' && <AlertCircle  className="h-3.5 w-3.5 text-red-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-600">{field.label}</p>
        <p className="text-[10px] text-gray-400 leading-tight">{field.hint}</p>
      </div>
      <div className={`relative text-right text-sm font-semibold shrink-0 max-w-[45%] break-words ${field.highlight ? 'text-[var(--color-brand-primary)] text-base' : status === 'missing' ? 'text-gray-300' : 'text-gray-800'}`}>
        {display}
        {editable && <span className="absolute -top-1 -right-2 hidden group-hover:flex items-center justify-center w-3 h-3 bg-yellow-400 rounded-full text-[8px] font-bold text-white">✎</span>}
      </div>
    </div>
  );
}

function StepBar({ current, onStepClick }: { current: 1 | 2; onStepClick?: (n: 1 | 2) => void }) {
  const steps = [
    { n: 1 as const, label: 'G702 Cover Sheet', sub: 'Cover page fields' },
    { n: 2 as const, label: 'G703 Continuation Sheet', sub: 'Schedule of values' },
  ];
  return (
    <div className="flex items-center gap-0">
      {steps.map(({ n, label, sub }, i) => {
        const done = current > n;
        const active = current === n;
        const clickable = true; // always allow jumping between steps
        return (
          <div key={n} className="flex items-center">
            {/* Step */}
            <button
              onClick={() => onStepClick?.(n)}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors ${active ? 'bg-[var(--color-brand-primary)]/8' : 'hover:bg-gray-50 cursor-pointer'}`}
            >
              {/* Circle */}
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold shadow-sm ${
                done    ? 'bg-green-500 text-white' :
                active  ? 'bg-[var(--color-brand-primary)] text-white ring-4 ring-[var(--color-brand-primary)]/20' :
                          'bg-gray-100 text-gray-400 border border-gray-200'
              }`}>
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </div>
              {/* Labels */}
              <div className="text-left">
                <p className={`text-xs font-semibold leading-tight ${active ? 'text-[var(--color-brand-primary)]' : done ? 'text-green-700' : 'text-gray-400'}`}>
                  {label}
                </p>
                <p className={`text-[10px] leading-tight ${active ? 'text-[var(--color-brand-primary)]/70' : done ? 'text-green-500' : 'text-gray-300'}`}>
                  {sub}
                </p>
              </div>
            </button>
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-8 mx-1 rounded-full transition-colors ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page mapping: estimate which PDF page a SOV row is on ───────────────────
const PHASE_TO_PAGE: Record<string, number> = {
  'P1SI': 2, 'P1SI - PHASE I SITE IMPROVEMENTS': 2,
  'SITE': 3, 'SITE - SITE INFRASTRUCTURE': 3,
  'FLTL': 4, 'FLTL - FLIGHTLINE STALLS': 4,
  'PTS': 4,
  'PKRD': 5, 'PKRD - PARKING & ROADWAYS': 5,
  'TEMP FIRE': 5, 'TEMP FIRE - PARKING & ROADWAYS': 5,
  '8848': 6, '8848 - 88-48 FINAL ASSEMBLY BLDG': 6,
  'CUB': 6, 'CUB - CUB': 6,
  'T1-T4': 7,
  'DLO': 7,
  'TEMP FIRE STATION': 8,
};

function getPageForLine(line: SovLine): number {
  const phase = (line.phases ?? '').toUpperCase();
  for (const [key, pg] of Object.entries(PHASE_TO_PAGE)) {
    if (phase.startsWith(key)) return pg;
  }
  // Fallback: estimate by item number
  const num = parseInt(line.itemNo ?? '0', 10);
  if (num <= 19) return 2;
  if (num <= 47) return 3;
  if (num <= 79) return 4;
  if (num <= 109) return 5;
  if (num <= 154) return 6;
  if (num <= 197) return 7;
  return 8;
}

// ─── Floating draggable document panel ───────────────────────────────────────
interface FloatingPanelProps {
  packageId: string;
  page: number;
  totalPages?: number;
  onClose: () => void;
}

function FloatingDocPanel({ packageId, page, totalPages = 8, onClose }: FloatingPanelProps) {
  const [pos, setPos] = useState({ x: Math.max(20, window.innerWidth - 660), y: 50 });
  const [size, setSize] = useState({ w: 620, h: Math.min(window.innerHeight - 120, 780) });
  const [zoom, setZoom] = useState(1.0);
  const [minimized, setMinimized] = useState(false);
  const [localPage, setLocalPage] = useState(page);
  const [imgLoaded, setImgLoaded] = useState(false);
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const resizeRef = useRef<{ active: boolean; dir: string; mx: number; my: number; x: number; y: number; w: number; h: number }>({ active: false, dir: '', mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 });

  // Sync external page changes
  if (page !== localPage && !dragging.current) {
    setLocalPage(page);
    setImgLoaded(false);
  }

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: dragStart.current.px + ev.clientX - dragStart.current.mx, y: dragStart.current.py + ev.clientY - dragStart.current.my });
    };
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos]);

  const onResizeStart = useCallback((e: React.MouseEvent, dir: string) => {
    e.preventDefault(); e.stopPropagation();
    resizeRef.current = { active: true, dir, mx: e.clientX, my: e.clientY, x: pos.x, y: pos.y, w: size.w, h: size.h };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current.active) return;
      const { dir: d, mx, my, x, y, w, h } = resizeRef.current;
      const dx = ev.clientX - mx, dy = ev.clientY - my;
      let nx = x, ny = y, nw = w, nh = h;
      if (d.includes('e')) nw = Math.max(360, w + dx);
      if (d.includes('s')) nh = Math.max(280, h + dy);
      if (d.includes('w')) { nw = Math.max(360, w - dx); nx = x + w - nw; }
      if (d.includes('n')) { nh = Math.max(280, h - dy); ny = y + h - nh; }
      setSize({ w: nw, h: nh });
      setPos({ x: nx, y: ny });
    };
    const onUp = () => { resizeRef.current.active = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos, size]);

  const imgUrl = `/api/packages/${packageId}/page-image?page=${localPage}&fileType=GC_PAY_APP`;

  // Resize handle helper
  const rh = (dir: string, style: React.CSSProperties, cursor: string) => (
    <div
      key={dir}
      className="absolute z-10 select-none"
      style={{ ...style, cursor }}
      onMouseDown={e => onResizeStart(e, dir)}
    />
  );

  return (
    <div
      className="fixed z-50 rounded-xl border border-[var(--color-border)] bg-white shadow-2xl overflow-hidden flex flex-col"
      style={{ left: pos.x, top: pos.y, width: size.w, height: minimized ? 44 : size.h, transition: 'height 0.15s', minWidth: 360, minHeight: 44 }}
    >
      {/* Resize handles — all 8 directions */}
      {!minimized && <>
        {rh('n',  { top: 0, left: 8, right: 8, height: 6 }, 'ns-resize')}
        {rh('s',  { bottom: 0, left: 8, right: 8, height: 6 }, 'ns-resize')}
        {rh('w',  { left: 0, top: 8, bottom: 8, width: 6 }, 'ew-resize')}
        {rh('e',  { right: 0, top: 8, bottom: 8, width: 6 }, 'ew-resize')}
        {rh('nw', { top: 0, left: 0, width: 14, height: 14 }, 'nwse-resize')}
        {rh('ne', { top: 0, right: 0, width: 14, height: 14 }, 'nesw-resize')}
        {rh('sw', { bottom: 0, left: 0, width: 14, height: 14 }, 'nesw-resize')}
        {rh('se', { bottom: 0, right: 0, width: 14, height: 14 }, 'nwse-resize')}
      </>}

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white cursor-grab active:cursor-grabbing shrink-0 select-none"
        onMouseDown={onDragStart}
      >
        <Move className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <span className="text-xs font-semibold flex-1">G703 — Page {localPage} / {totalPages}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(0.4, parseFloat((z - 0.1).toFixed(1))))} className="rounded p-0.5 hover:bg-gray-600"><ZoomOut className="h-3.5 w-3.5" /></button>
          <span className="text-[10px] tabular-nums w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(4, parseFloat((z + 0.1).toFixed(1))))} className="rounded p-0.5 hover:bg-gray-600"><ZoomIn className="h-3.5 w-3.5" /></button>
          <div className="w-px h-4 bg-gray-600 mx-1" />
          <button onClick={() => { setLocalPage(p => Math.max(1, p - 1)); setImgLoaded(false); }} className="rounded px-1.5 py-0.5 text-[10px] hover:bg-gray-600 disabled:opacity-30" disabled={localPage <= 1}>◀</button>
          <button onClick={() => { setLocalPage(p => Math.min(totalPages, p + 1)); setImgLoaded(false); }} className="rounded px-1.5 py-0.5 text-[10px] hover:bg-gray-600 disabled:opacity-30" disabled={localPage >= totalPages}>▶</button>
          <div className="w-px h-4 bg-gray-600 mx-1" />
          <button onClick={() => setMinimized(m => !m)} className="rounded p-0.5 hover:bg-gray-600" title={minimized ? 'Expand' : 'Minimize'}>
            {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onClose} className="rounded p-0.5 hover:bg-red-600" title="Close"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Image */}
      {!minimized && (
        <div className="flex-1 overflow-auto bg-gray-200 relative">
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}
          <img
            key={imgUrl}
            src={imgUrl}
            alt={`G703 page ${localPage}`}
            className={`block transition-opacity duration-150 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ width: `${zoom * 100}%` }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Column value formatter ────────────────────────────────────────────────────
// NOTE: strip commas before parseFloat — AI may store "18,455" which parseFloat truncates to 18
function stripNum(value: string): string { return value.replace(/,/g, ''); }
function fmtCol(value: string | null | undefined, format: 'plain' | 'currency' | 'pct'): string {
  if (value == null || value === '') return '—';
  if (format === 'currency') {
    const n = parseFloat(stripNum(value));
    if (isNaN(n)) return value;
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
  if (format === 'pct') {
    const n = parseFloat(stripNum(value));
    if (isNaN(n)) return value;
    return `${(n <= 1 ? n * 100 : n).toFixed(1)}%`;
  }
  return value;
}

// ─── Editable cell ─────────────────────────────────────────────────────────────
function EditableCell({ lineId, field, value, format, packageId, onSaved, onEdit }: {
  lineId: string; field: string; value: string | null; format: 'plain' | 'currency' | 'pct';
  packageId: string; onSaved: (v: string) => void; onEdit?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const display = fmtCol(value, format);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/packages/${packageId}/gc-sov/${lineId}`, {
        method: 'PATCH',
        body: JSON.stringify({ field, value: draft || null, changedBy: 'user' }),
      });
      onSaved(draft);
    } catch (e) { /* silent */ }
    setSaving(false);
    setEditing(false);
  };

  if (editing) return (
    <div className="flex items-center gap-0.5 min-w-[80px]">
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        onBlur={save}
        className="w-full text-xs border border-blue-400 rounded px-1 py-0.5 outline-none bg-blue-50 tabular-nums"
        style={{ minWidth: 70 }}
      />
      {saving && <Loader2 className="h-3 w-3 animate-spin shrink-0 text-blue-500" />}
    </div>
  );

  return (
    <div
      className="group relative cursor-pointer hover:bg-yellow-50 rounded px-1 -mx-1 transition-colors"
      onClick={() => { setDraft(value ?? ''); setEditing(true); onEdit?.(); }}
      title="Click to edit"
    >
      <span className={!value ? 'text-gray-300' : ''}>{display}</span>
      <span className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3 h-3 bg-yellow-400 rounded-full text-[8px] font-bold text-white">✎</span>
    </div>
  );
}

// ─── SOV Column Definitions ───────────────────────────────────────────────────
const SOV_COLS: { label: string; sub: string; key: keyof SovLine; align: 'left' | 'right'; width: string; format: 'plain' | 'currency' | 'pct' }[] = [
  { label: 'Item No.',                          sub: 'Line item number',                   key: 'itemNo',               align: 'left',  width: 'w-14',   format: 'plain'    },
  { label: 'Time Period',                       sub: 'Billing period/month',               key: 'timePeriod',           align: 'left',  width: 'w-20',   format: 'plain'    },
  { label: 'Phases',                            sub: 'Phase/site/WBS',                     key: 'phases',               align: 'left',  width: 'w-20',   format: 'plain'    },
  { label: 'Type of Work',                      sub: 'Work description',                   key: 'typeOfWork',           align: 'left',  width: 'min-w-[140px]', format: 'plain' },
  { label: 'Contractor',                        sub: 'Contractor/subcontractor',            key: 'contractorName',       align: 'left',  width: 'w-28',   format: 'plain'    },
  { label: 'Scheduled\nOriginal',               sub: 'Original value before COs',          key: 'scheduledOriginal',    align: 'right', width: 'w-24',   format: 'currency' },
  { label: 'Scheduled\nChange Orders',          sub: 'CO value applied to line',           key: 'scheduledChangeOrders',align: 'right', width: 'w-24',   format: 'currency' },
  { label: 'Scheduled\nCurrent',                sub: 'Current value after COs',            key: 'scheduledCurrent',     align: 'right', width: 'w-24',   format: 'currency' },
  { label: 'Work Completed\nPrev. Application', sub: 'Cumulative prev. billings',          key: 'workCompletedPrev',    align: 'right', width: 'w-24',   format: 'currency' },
  { label: 'Work Completed\nThis Period',       sub: 'Current period billing',             key: 'workCompletedThis',    align: 'right', width: 'w-24',   format: 'currency' },
  { label: 'Materials\nStored',                 sub: 'Stored, not yet installed',          key: 'materialsStored',      align: 'right', width: 'w-22',   format: 'currency' },
  { label: 'Total Completed\n& Stored',         sub: 'Cumulative + stored (D+E+F)',        key: 'totalCompleted',       align: 'right', width: 'w-24',   format: 'currency' },
  { label: '% (G/C)',                           sub: 'Completion percentage',              key: 'pct',                  align: 'right', width: 'w-16',   format: 'pct'      },
  { label: 'Balance to\nFinish (C-G)',          sub: 'Remaining value',                    key: 'balanceToFinish',      align: 'right', width: 'w-24',   format: 'currency' },
];

// ─── Add Row inline form (for missing items) ─────────────────────────────────
function AddRowForm({ itemNum, phases, packageId, onSaved, onCancel }: {
  itemNum: number; phases: string; packageId: string;
  onSaved: () => void; onCancel: () => void;
}) {
  const [fields, setFields] = useState({
    typeOfWork: '', contractorName: '',
    scheduledOriginal: '', scheduledCurrent: '',
    workCompletedPrev: '', workCompletedThis: '',
    materialsStored: '', totalCompleted: '', pct: '', balanceToFinish: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields(prev => ({ ...prev, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      const num = (v: string) => v ? parseFloat(v.replace(/[$,]/g, '')) : null;
      const pctVal = fields.pct ? parseFloat(fields.pct) / (parseFloat(fields.pct) > 1 ? 100 : 1) : null;
      const dep = (num(fields.workCompletedPrev) ?? 0) + (num(fields.workCompletedThis) ?? 0) + (num(fields.materialsStored) ?? 0);
      const sched = num(fields.scheduledCurrent);
      const payload = [{
        item_no: String(itemNum).padStart(3, '0'),
        phases, type_of_work: fields.typeOfWork, contractor_name: fields.contractorName || null,
        scheduled_original: num(fields.scheduledOriginal), scheduled_current: sched,
        work_completed_prev: num(fields.workCompletedPrev), work_completed_this: num(fields.workCompletedThis),
        materials_stored: num(fields.materialsStored),
        total_completed: dep > 0 ? dep : num(fields.totalCompleted),
        pct: pctVal, balance_to_finish: sched != null ? sched - dep : num(fields.balanceToFinish),
        extraction_confidence: 1.0,
      }];
      // Append to existing SOV
      const existing = await apiFetch(`/packages/${packageId}/gc-sov`) as unknown[];
      const mapped = (existing as Record<string,unknown>[]).map(r => ({
        item_no: r.itemNo, phases: r.phases, type_of_work: r.typeOfWork,
        contractor_name: r.contractorName, scheduled_original: r.scheduledOriginal,
        scheduled_change_orders: r.scheduledChangeOrders, scheduled_current: r.scheduledCurrent,
        work_completed_prev: r.workCompletedPrev, work_completed_this: r.workCompletedThis,
        materials_stored: r.materialsStored, total_completed: r.totalCompleted,
        pct: r.pct, balance_to_finish: r.balanceToFinish, retainage: r.retainage,
        extraction_confidence: r.extractionConfidence,
      }));
      await apiFetch(`/packages/${packageId}/gc-sov`, {
        method: 'POST',
        body: JSON.stringify([...mapped, ...payload]),
      });
      onSaved();
    } catch { /* silent */ }
    setSaving(false);
  };

  const inp = (label: string, k: keyof typeof fields, placeholder = '') => (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold uppercase text-gray-500">{label}</span>
      <input value={fields[k]} onChange={set(k)} placeholder={placeholder}
        className="text-xs border border-gray-200 rounded px-1.5 py-1 outline-none focus:border-[var(--color-brand-primary)] w-full" />
    </label>
  );

  return (
    <tr className="border-b border-[var(--color-brand-primary)]/30 bg-blue-50/30">
      <td className="px-2 py-3 text-[10px] font-bold text-[var(--color-brand-primary)] align-top">
        + {String(itemNum).padStart(3, '0')}
      </td>
      <td colSpan={9} className="px-2 py-2">
        <div className="grid grid-cols-4 gap-2 mb-2">
          {inp('Type of Work', 'typeOfWork', 'Description of work...')}
          {inp('Contractor', 'contractorName', 'Contractor name')}
          {inp('Scheduled Original', 'scheduledOriginal', '$0')}
          {inp('Scheduled Current', 'scheduledCurrent', '$0')}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {inp('Work Comp. Prev', 'workCompletedPrev', '$0')}
          {inp('This Period', 'workCompletedThis', '$0')}
          {inp('Materials Stored', 'materialsStored', '$0')}
          {inp('% Complete', 'pct', '85')}
          {inp('Balance to Finish', 'balanceToFinish', '$0')}
        </div>
      </td>
      <td colSpan={5} className="px-2 py-2 align-bottom">
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
          <button onClick={save} disabled={saving || !fields.typeOfWork}
            className="inline-flex items-center gap-1 text-xs font-semibold bg-[var(--color-brand-primary)] text-white rounded px-3 py-1 hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Save Row
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Change Order Summary Table ───────────────────────────────────────────────
function ChangeOrderSummaryTable({ text }: { text: string }) {
  const fmtV = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const pairs = text.split(';').map(s => s.trim()).filter(Boolean).map(s => {
    const idx = s.lastIndexOf(':');
    return { label: s.slice(0, idx).trim().toLowerCase(), rawVal: s.slice(idx + 1).trim() };
  });
  const getVal = (keyword: string) => {
    const found = pairs.find(p => keyword.split('|').every(k => p.label.includes(k)));
    return found ? parseFloat(found.rawVal) : null;
  };

  const prevAdd = getVal('previously|addition');
  const prevDed = getVal('previously|deduction');
  const thisAdd = getVal('this month|addition');
  const thisDed = getVal('this month|deduction');
  const totAdd  = getVal('total addition');
  const totDed  = getVal('total deduction');
  const net     = getVal('net change');

  const rows = [
    { label: 'Previously Approved', add: prevAdd, ded: prevDed },
    { label: 'This Month Approved', add: thisAdd, ded: thisDed },
    { label: 'Total', add: totAdd, ded: totDed, bold: true },
  ];

  return (
    <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-[var(--color-border)]">
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Category</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-green-700 uppercase tracking-wider">Additions (+)</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-red-600 uppercase tracking-wider">Deductions (−)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, add, ded, bold }, i) => (
            <tr key={i} className={`border-b border-[var(--color-border)] ${bold ? 'bg-gray-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
              <td className={`px-3 py-2 ${bold ? 'font-semibold text-gray-700' : 'text-[var(--color-text-secondary)]'}`}>{label}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${bold ? 'font-bold text-green-700' : 'text-green-600'}`}>{add != null && !isNaN(add) ? fmtV(add) : '—'}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${bold ? 'font-bold text-red-600' : 'text-red-500'}`}>{ded != null && !isNaN(ded) ? fmtV(ded) : '—'}</td>
            </tr>
          ))}
        </tbody>
        {net != null && !isNaN(net) && (
          <tfoot>
            <tr className="bg-[var(--color-brand-primary)]/5 border-t-2 border-[var(--color-brand-primary)]/20">
              <td className="px-3 py-2.5 font-bold text-[var(--color-text-primary)]">Net Change by Change Order</td>
              <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[var(--color-brand-primary)]" colSpan={2}>{fmtV(net)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─── Re-Extract Modal ─────────────────────────────────────────────────────────
function ReExtractModal({ packageId, onClose, onStarted }: { packageId: string; onClose: () => void; onStarted: () => void }) {
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set([2,3,4,5,6,7,8]));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (pg: number) => setSelectedPages(prev => {
    const next = new Set(prev);
    next.has(pg) ? next.delete(pg) : next.add(pg);
    return next;
  });

  const handleRun = async () => {
    if (selectedPages.size === 0) return;
    setRunning(true);
    setError(null);
    try {
      await apiFetch(`/packages/${packageId}/reextract-sov`, {
        method: 'POST',
        body: JSON.stringify({ pages: Array.from(selectedPages).sort() }),
      });
      onStarted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start re-extraction');
    }
    setRunning(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl border border-[var(--color-border)] w-[400px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Re-extract G703 Pages</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4 text-gray-500" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Select which G703 continuation sheet pages to re-run extraction on. The AI will re-process the selected pages and update values — including auto-fixing any truncated or incorrect values.</p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[2,3,4,5,6,7,8].map(pg => (
            <button
              key={pg}
              onClick={() => toggle(pg)}
              className={`rounded-lg border py-2 text-xs font-semibold transition-colors ${selectedPages.has(pg) ? 'bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)]' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[var(--color-brand-primary)]/50'}`}
            >
              Page {pg}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleRun}
            disabled={running || selectedPages.size === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {running ? 'Starting…' : `Re-extract ${selectedPages.size} page${selectedPages.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Interactive SOV Table ────────────────────────────────────────────────────
function SovSection({ lines, packageId, onRowSelect, highlightMode, gcHeader }: {
  lines: SovLine[]; packageId: string; onRowSelect: (line: SovLine) => void;
  highlightMode?: 'none' | 'flagged' | 'missing';
  gcHeader?: GcHeader;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localLines, setLocalLines] = useState<SovLine[]>([]);
  const [addingForItem, setAddingForItem] = useState<{ num: number; phases: string } | null>(null);

  // Merge local edits with incoming lines
  const allConfLines = lines.map(l => localLines.find(ll => ll.id === l.id) ?? l)
    .filter(l => parseFloat(l.extractionConfidence ?? '0') >= 0.70);

  // Quality check helper
  const n = (v: string | null | undefined) => parseFloat((v ?? '0').replace(/,/g, '')) || 0;
  const isFlagged = (l: SovLine) => {
    const dep = n(l.workCompletedPrev) + n(l.workCompletedThis) + n(l.materialsStored);
    const tot = n(l.totalCompleted);
    // Also flag comma-truncation issues
    const NUMERIC_SOV_KEYS: (keyof SovLine)[] = ['scheduledOriginal','scheduledCurrent','workCompletedPrev','workCompletedThis','materialsStored','totalCompleted','balanceToFinish'];
    const hasCommaTrunc = NUMERIC_SOV_KEYS.some(k => {
      const val = l[k] as string | null;
      return val != null && /,/.test(val) && parseFloat(val) !== parseFloat(val.replace(/,/g, ''));
    });
    return hasCommaTrunc ||
           (!l.scheduledOriginal && l.scheduledChangeOrders) ||
           (dep > 1000 && tot > 10 && Math.abs(dep - tot) > 500) ||
           (n(l.scheduledCurrent) > 0 && tot > n(l.scheduledCurrent) * 1.02) ||
           (l.contractorName && /^\d+$/.test(l.contractorName.trim()));
  };

  // Apply filter based on highlightMode
  const displayLines = highlightMode === 'flagged'
    ? allConfLines.filter(isFlagged)
    : allConfLines;  // 'missing' mode still shows all — placeholders will be inserted

  const handleCellSaved = (lineId: string, field: keyof SovLine, val: string) => {
    setLocalLines(prev => {
      const existing = prev.find(l => l.id === lineId);
      if (existing) return prev.map(l => l.id === lineId ? { ...l, [field]: val } : l);
      const orig = lines.find(l => l.id === lineId);
      if (orig) return [...prev, { ...orig, [field]: val }];
      return prev;
    });
  };

  const NUMERIC_KEYS = new Set<keyof SovLine>(['scheduledOriginal','scheduledChangeOrders','scheduledCurrent','workCompletedPrev','workCompletedThis','materialsStored','totalCompleted','balanceToFinish','retainage']);

  // Quality check: returns list of issue descriptions for a row
  const getRowIssues = (line: SovLine): string[] => {
    const issues: string[] = [];
    const nv = (v: string | null | undefined) => parseFloat((v ?? '0').replace(/,/g, '')) || 0;
    const dep = nv(line.workCompletedPrev) + nv(line.workCompletedThis) + nv(line.materialsStored);
    const total = nv(line.totalCompleted);
    const schedCurr = nv(line.scheduledCurrent);

    // Comma-truncation: value stored with commas means raw parseFloat gives wrong number
    const NUMERIC_SOV_KEYS: (keyof SovLine)[] = ['scheduledOriginal','scheduledCurrent','workCompletedPrev','workCompletedThis','materialsStored','totalCompleted','balanceToFinish'];
    for (const k of NUMERIC_SOV_KEYS) {
      const val = line[k] as string | null;
      if (val && /,/.test(val) && parseFloat(val) !== parseFloat(val.replace(/,/g, ''))) {
        issues.push(`Truncated value in "${String(k)}": stored as "${val}" — raw parseFloat gives ${parseFloat(val)} instead of ${parseFloat(val.replace(/,/g,''))}`);
        break;
      }
    }
    // Column shift: scheduled original missing but change orders has a value
    if (!line.scheduledOriginal && line.scheduledChangeOrders)
      issues.push('Missing scheduled original (possible column shift)');
    // Math error: D+E+F doesn't equal G
    if (dep > 1000 && total > 10 && Math.abs(dep - total) > 500)
      issues.push(`Math error: D+E+F=${ Math.round(dep).toLocaleString() } ≠ G=${Math.round(total).toLocaleString()}`);
    // Over 100% completion
    if (schedCurr > 0 && total > schedCurr * 1.02)
      issues.push('Total completed > scheduled (>100%)');
    // Numeric contractor name (column shift indicator)
    if (line.contractorName && /^\d+$/.test(line.contractorName.trim()))
      issues.push('Contractor name looks like a number (column shift)');
    // No scheduled value but has completion
    if (!line.scheduledCurrent && total > 0)
      issues.push('Has completed work but no scheduled value');
    return issues;
  };

  return (
    <div className="flex-1 overflow-auto relative">
      <table className="text-xs border-collapse" style={{ minWidth: '1200px' }}>
        <thead className="sticky top-0 z-20">
          <tr className="bg-[var(--color-brand-primary)] text-white">
            {SOV_COLS.map(col => (
              <th key={col.key} className={`px-2 py-2 text-center font-semibold whitespace-pre-line border-r border-blue-400/30 ${col.width}`}>
                {col.label}
              </th>
            ))}
          </tr>
          <tr className="bg-blue-50 border-b border-blue-200">
            {SOV_COLS.map(col => (
              <th key={col.key} className="px-2 py-1 text-[9px] font-normal text-blue-600 text-center italic border-r border-blue-100">
                {col.sub}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(() => {
            // Build gap list
            const numItems = allConfLines
              .filter(l => l.itemNo && /^\d+$/.test(l.itemNo.trim()))
              .map(l => parseInt(l.itemNo!.trim(), 10))
              .sort((a, b) => a - b);
            const missingSet = new Set<number>();
            for (let i = 1; i < numItems.length; i++) {
              for (let g = numItems[i - 1] + 1; g < numItems[i]; g++) missingSet.add(g);
            }

            // In 'missing' filter mode — show ONLY placeholder rows for missing items
            if (highlightMode === 'missing') {
              return Array.from(missingSet).map(gap => {
                const neighbors = allConfLines.filter(l => l.itemNo && /^\d+$/.test(l.itemNo.trim()))
                  .sort((a, b) => Math.abs(parseInt(a.itemNo!)-gap) - Math.abs(parseInt(b.itemNo!)-gap));
                const nearPhase = neighbors[0]?.phases ?? '';
                return (
                  <tr key={`missing-${gap}`} className="border-b border-amber-200 bg-amber-50/80">
                    <td className="px-2 py-2 text-[10px] font-bold text-amber-700">⬜ {String(gap).padStart(3,'0')}</td>
                    <td colSpan={13} className="px-2 py-1.5 text-[10px] text-amber-600 italic">
                      Item {gap} not extracted ({nearPhase}) — verify against PDF
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button onClick={() => setAddingForItem({ num: gap, phases: nearPhase })}
                        className="text-[10px] font-semibold text-[var(--color-brand-primary)] hover:underline">
                        + Add Row
                      </button>
                    </td>
                  </tr>
                );
              });
            }

            const rows: React.ReactNode[] = [];
            displayLines.forEach((line, i) => {
            const pct = parseFloat(line.pct ?? '0');
            const isSelected = selectedId === (line.id ?? String(i));
            const issues = getRowIssues(line);
            const hasIssue = issues.length > 0;

            // Insert amber placeholder rows for missing items (only in non-filter mode)
            if (highlightMode !== 'flagged') {
              const lineNum = line.itemNo && /^\d+$/.test(line.itemNo.trim()) ? parseInt(line.itemNo.trim(), 10) : null;
              if (lineNum !== null) {
                const prevLine = displayLines[i - 1];
                const prevNum = prevLine?.itemNo && /^\d+$/.test(prevLine.itemNo.trim())
                  ? parseInt(prevLine.itemNo.trim(), 10) : null;
                if (prevNum !== null) {
                  for (let gap = prevNum + 1; gap < lineNum; gap++) {
                    rows.push(
                      <tr key={`missing-${gap}`} className="border-b border-amber-200 bg-amber-50/40">
                        <td className="px-2 py-1.5 text-[10px] font-bold text-amber-600">⬜ {String(gap).padStart(3,'0')}</td>
                        <td colSpan={13} className="px-2 py-1.5 text-[10px] text-amber-500 italic">
                          Item {gap} not extracted — verify against PDF and add manually
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button onClick={() => setAddingForItem({ num: gap, phases: line.phases ?? '' })}
                            className="text-[10px] font-semibold text-[var(--color-brand-primary)] hover:underline">
                            + Add Row
                          </button>
                        </td>
                      </tr>
                    );
                  }
                }
              }
            }

            rows.push(
              <tr
                key={line.id ?? i}
                onClick={() => { setSelectedId(line.id ?? String(i)); onRowSelect(line); }}
                title={hasIssue ? `⚠ ${issues.join(' · ')}` : undefined}
                className={`border-b cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-100 ring-1 ring-blue-400 ring-inset border-blue-200'
                    : hasIssue
                    ? 'bg-red-50/60 border-red-100 hover:bg-red-50'
                    : 'border-gray-50 hover:bg-blue-50/40'
                }`}
              >
                {SOV_COLS.map(col => {
                  const rawVal = line[col.key];
                  const val = rawVal as string | null;
                  const isEditable = col.key === 'typeOfWork' || col.key === 'contractorName' || NUMERIC_KEYS.has(col.key) || col.key === 'pct';
                  return (
                    <td
                      key={col.key}
                      className={`px-2 py-1.5 border-r border-gray-50 ${col.align === 'right' ? 'text-right' : ''} ${
                        col.key === 'typeOfWork' ? 'font-medium text-gray-800 max-w-[160px]' :
                        col.key === 'pct' ? `font-semibold ${pct >= 0.9 ? 'text-green-600' : pct >= 0.5 ? 'text-blue-600' : 'text-gray-600'}` :
                        col.format === 'currency' ? 'text-gray-700 tabular-nums' : 'text-gray-600'
                      }`}
                    >
                      {/* Warning badge on first column of flagged rows */}
                      {hasIssue && col.key === 'itemNo' && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-red-500 font-bold">
                          ⚠ {val ?? '—'}
                        </span>
                      )}
                      {!(hasIssue && col.key === 'itemNo') && (isEditable && line.id ? (
                        <EditableCell
                          lineId={line.id}
                          field={col.key}
                          value={val}
                          format={col.format}
                          packageId={packageId}
                          onSaved={v => handleCellSaved(line.id!, col.key, v)}
                          onEdit={() => onRowSelect(line)}
                        />
                      ) : (
                        <span className={!val ? 'text-gray-300' : ''}>{fmtCol(val, col.format)}</span>
                      ))}
                    </td>
                  );
                })}
              </tr>
            );
            });
            return rows;
          })()}
          {/* Add Row inline form */}
          {addingForItem && (
            <AddRowForm
              itemNum={addingForItem.num}
              phases={addingForItem.phases}
              packageId={packageId}
              onSaved={() => { setAddingForItem(null); }}
              onCancel={() => setAddingForItem(null)}
            />
          )}
          {displayLines.length === 0 && !addingForItem && (
            <tr><td colSpan={15} className="px-4 py-8 text-center text-gray-400 text-xs">
              {highlightMode === 'flagged' ? 'No flagged rows — all data looks clean ✓' :
               highlightMode === 'missing' ? 'No missing item numbers detected' :
               'No high-confidence lines yet.'}
            </td></tr>
          )}
        </tbody>
        {displayLines.length > 0 && (
          <tfoot className="sticky bottom-0 z-10 border-t-2 border-gray-300">
            {/* Row 1: Extracted sums */}
            <tr className="bg-gray-100">
              {SOV_COLS.map((col, ci) => {
                if (ci < 5) return <td key={col.key} className="px-2 py-2 text-[10px] font-bold text-gray-500">{ci === 3 ? `Extracted (${displayLines.length} lines)` : ''}</td>;
                if (col.format === 'pct') {
                  const avg = displayLines.reduce((a, l) => a + parseFloat((l.pct ?? '0').replace(/,/g,'')), 0) / (displayLines.length || 1);
                  return <td key={col.key} className="px-2 py-2 text-right text-xs font-bold text-gray-700">{`${(avg <= 1 ? avg * 100 : avg).toFixed(1)}%`}</td>;
                }
                const sum = displayLines.reduce((acc, l) => { const v = parseFloat(((l[col.key] as string) ?? '0').replace(/,/g,'')); return acc + (isNaN(v) ? 0 : v); }, 0);
                return <td key={col.key} className="px-2 py-2 text-right tabular-nums text-xs font-bold text-gray-700">{sum > 0 ? sum.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—'}</td>;
              })}
            </tr>
            {/* Row 2: G702 header reference values (from PDF cover sheet) */}
            {gcHeader && (
              <tr className="bg-blue-50 border-t border-blue-200">
                {SOV_COLS.map((col, ci) => {
                  // Map G703 column to its corresponding G702 header field
                  const G702_REF: Partial<Record<keyof SovLine, keyof GcHeader>> = {
                    scheduledCurrent: 'contractSumToDate',
                    totalCompleted: 'totalCompletedStored',
                    balanceToFinish: 'balanceToFinish',
                    retainage: 'totalRetainage',
                  };
                  if (ci === 3) return <td key={col.key} className="px-2 py-1.5 text-[10px] font-bold text-blue-600">G702 Reference (PDF)</td>;
                  if (ci < 5) return <td key={col.key} className="px-2 py-1.5" />;
                  const headerKey = G702_REF[col.key];
                  if (!headerKey) return <td key={col.key} className="px-2 py-1.5 text-right text-[10px] text-blue-300">—</td>;
                  const val = gcHeader[headerKey] as string | null;
                  const n = val ? parseFloat(val.replace(/,/g,'')) : NaN;
                  return (
                    <td key={col.key} className="px-2 py-1.5 text-right tabular-nums text-[10px] font-semibold text-blue-700">
                      {isNaN(n) ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                    </td>
                  );
                })}
              </tr>
            )}
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default function CoverPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [docPanelPage, setDocPanelPage] = useState(1);
  const [showDocPanel, setShowDocPanel] = useState(false);
  const [highlightMode, setHighlightMode] = useState<'none' | 'flagged' | 'missing'>('none');
  const sovTableRef = useRef<HTMLDivElement>(null);
  const [localHeader, setLocalHeader] = useState<Partial<GcHeader>>({});
  const [showReExtract, setShowReExtract] = useState(false);
  const [reExtractSuccess, setReExtractSuccess] = useState(false);

  const handleRowSelect = useCallback((line: SovLine) => {
    const pg = getPageForLine(line);
    setDocPanelPage(pg);
    setShowDocPanel(true);
  }, []);

  const handleHeaderSaved = useCallback((key: keyof GcHeader, val: string) => {
    setLocalHeader(prev => ({ ...prev, [key]: val }));
  }, []);

  // No need for gcDocIndex — use fileType directly for reliable PDF lookup
  const { data: header, isLoading: loadingH } = useQuery<GcHeader>({
    queryKey: ['gc-header', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}/gc-header`) as Promise<GcHeader>,
    enabled: !!packageId,
  });
  const { data: sovLines = [], isLoading: loadingSOV } = useQuery<SovLine[]>({
    queryKey: ['gc-sov', packageId],
    queryFn: () => apiFetch(`/packages/${packageId}/gc-sov`) as Promise<SovLine[]>,
    enabled: !!packageId && step === 2,
  });

  // Merge remote header with local edits
  const mergedHeader: GcHeader = header ? { ...header, ...localHeader } : header!;
  const conf = header ? parseFloat(header.extractionConfidence ?? '0') : 0;

  if (loadingH) return (
    <div className="flex h-full items-center justify-center gap-2 text-gray-400">
      <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading extracted data…</span>
    </div>
  );
  if (!header) return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-gray-400">Cover page data not available.</p>
    </div>
  );

  const sections = [
    { id: 'identity'  as const, label: 'Identification' },
    { id: 'financial' as const, label: 'Financial Values' },
    { id: 'signature' as const, label: 'Signatures' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--color-surface)]">

      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 bg-white border-b border-[var(--color-border)]">
        <StepBar current={step} onStepClick={n => { setStep(n); setHighlightMode('none'); }} />
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${conf >= 0.90 ? 'bg-green-100 text-green-700' : conf >= 0.75 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
          {conf >= 0.90 ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
          {Math.round(conf * 100)}% extraction confidence
        </span>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Fields (always full width) */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="px-5 pt-4 pb-2 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  {step === 1 ? 'G702 — Application for Payment' : 'G703 — Continuation Sheet'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {step === 1
                    ? 'Click any card to open document · values update on edit'
                    : (() => {
                        const confLines = sovLines.filter(l => parseFloat(l.extractionConfidence ?? '0') >= 0.70);
                        const n = (v: string | null | undefined) => parseFloat(v ?? '0') || 0;

                        // Flagged rows: math/column errors
                        const flagged = confLines.filter(l => {
                          const dep = n(l.workCompletedPrev) + n(l.workCompletedThis) + n(l.materialsStored);
                          const tot = n(l.totalCompleted);
                          return (!l.scheduledOriginal && l.scheduledChangeOrders) ||
                                 (dep > 1000 && tot > 10 && Math.abs(dep - tot) > 500) ||
                                 (n(l.scheduledCurrent) > 0 && tot > n(l.scheduledCurrent) * 1.02) ||
                                 (l.contractorName && /^\d+$/.test(l.contractorName.trim()));
                        });

                        // Missing item numbers: gaps in numeric sequence
                        const nums = confLines
                          .filter(l => l.itemNo && /^\d+$/.test(l.itemNo.trim()))
                          .map(l => parseInt(l.itemNo!.trim(), 10))
                          .sort((a, b) => a - b);
                        const missing: number[] = [];
                        for (let i = 1; i < nums.length; i++) {
                          for (let gap = nums[i - 1] + 1; gap < nums[i]; gap++) missing.push(gap);
                        }

                        const scrollToFirst = (mode: 'flagged' | 'missing') => {
                          setHighlightMode(prev => prev === mode ? 'none' : mode);
                          setTimeout(() => {
                            const el = sovTableRef.current?.querySelector(`tr.${mode === 'flagged' ? 'bg-red-50\\/60' : 'bg-amber-50\\/60'}`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 100);
                        };

                        return (
                          <span className="flex items-center gap-2 flex-wrap">
                            <span>{confLines.length} lines · click row → doc · click cell → edit</span>
                            {missing.length > 0 && (
                              <button
                                onClick={() => scrollToFirst('missing')}
                                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold transition-colors border ${
                                  highlightMode === 'missing'
                                    ? 'bg-amber-100 text-amber-700 border-amber-300'
                                    : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                                }`}
                              >
                                ⬜ {missing.length} missing item{missing.length > 1 ? 's' : ''} #{missing.slice(0,3).join(', ')}{missing.length > 3 ? '…' : ''}
                              </button>
                            )}
                            {flagged.length > 0 && (
                              <button
                                onClick={() => scrollToFirst('flagged')}
                                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold transition-colors border ${
                                  highlightMode === 'flagged'
                                    ? 'bg-red-100 text-red-700 border-red-300'
                                    : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'
                                }`}
                              >
                                ⚠ {flagged.length} rows need review
                              </button>
                            )}
                          </span>
                        );
                      })()
                  }
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2 shrink-0">
                {step === 2 && (
                  <button
                    onClick={() => setShowReExtract(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    title="Re-run extraction on specific G703 pages"
                  >
                    ↻ Re-extract Pages
                  </button>
                )}
                {reExtractSuccess && step === 2 && (
                  <span className="text-[10px] text-green-600 font-medium">✓ Re-extraction started</span>
                )}
                <button
                  onClick={() => { setShowDocPanel(v => !v); setDocPanelPage(step === 1 ? 1 : 2); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  📄 {showDocPanel ? 'Hide Doc' : 'Show Doc'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {step === 1
              ? (() => {
                  const h = mergedHeader;
                  const fmtC = (v: string | null) => v ? parseFloat(v.replace(/,/g, '')).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—';
                  const EditField = ({ fieldKey, format }: { fieldKey: keyof GcHeader; format: 'plain' | 'currency' }) => (
                    <FieldRow
                      field={G702_FIELDS.find(f => f.key === fieldKey)!}
                      header={mergedHeader} packageId={packageId!} onSaved={handleHeaderSaved}
                      onEdit={() => { setShowDocPanel(true); setDocPanelPage(1); }}
                    />
                  );

                  return (
                    <div className="p-5 space-y-4">

                      {/* ── Identity strip ─────────────────────────────────── */}
                      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-secondary)] mb-1">Project</p>
                            <p className="text-sm font-bold text-[var(--color-text-primary)] leading-tight truncate">{h.projectName ?? '—'}</p>
                            <p className="text-xs text-[var(--color-text-secondary)] mt-1 truncate">{h.fromContractor ?? '—'}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-widest">App No.</div>
                            <div className="text-xl font-black text-[var(--color-brand-primary)]">#{h.applicationNo ?? '—'}</div>
                            <div className="text-xs text-[var(--color-text-secondary)]">Period: {h.periodTo ?? '—'}</div>
                          </div>
                        </div>
                      </div>

                      {/* ── Current Payment Due ─────────────────────────────── */}
                      <div className="rounded-xl border border-[var(--color-border)] bg-white px-5 py-4 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-secondary)] mb-1">Current Payment Due</p>
                        <div className="flex items-end justify-between gap-2">
                          <span className="text-2xl font-black text-[var(--color-brand-primary)] tabular-nums leading-none">
                            {fmtC(h.currentPaymentDue)}
                          </span>
                          <div className="text-right text-xs text-[var(--color-text-secondary)] space-y-0.5">
                            <div>Earned Less Ret: <span className="font-semibold text-[var(--color-text-primary)]">{fmtC(h.totalEarnedLessRet)}</span></div>
                            <div>Less Previous: <span className="font-semibold text-[var(--color-text-primary)]">{fmtC(h.lessPrevCertificates)}</span></div>
                          </div>
                        </div>
                      </div>

                      {/* ── Contract value grid ─────────────────────────────── */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Contract Values</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: 'Original Contract', key: 'originalContractSum' as keyof GcHeader, color: 'bg-white border-[var(--color-border)]' },
                            { label: 'Net Change Orders',  key: 'netChangeOrders' as keyof GcHeader,    color: 'bg-white border-[var(--color-border)]' },
                            { label: 'Contract to Date',   key: 'contractSumToDate' as keyof GcHeader, color: 'bg-[var(--color-surface)] border-[var(--color-border)]' },
                          ].map(({ label, key, color }) => (
                            <div key={key} className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5">
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">{label}</p>
                              <p className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums">{fmtC(h[key] as string | null)}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── Completion grid ─────────────────────────────────── */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Completion</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'Total Completed & Stored', key: 'totalCompletedStored' as keyof GcHeader, color: 'bg-white border-[var(--color-border)]' },
                            { label: 'Balance to Finish',        key: 'balanceToFinish' as keyof GcHeader,      color: 'bg-[var(--color-surface)] border-[var(--color-border)]' },
                          ].map(({ label, key, color }) => (
                            <div key={key} className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5">
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">{label}</p>
                              <p className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums">{fmtC(h[key] as string | null)}</p>
                            </div>
                          ))}
                        </div>
                        {/* Progress bar */}
                        {h.contractSumToDate && h.totalCompletedStored && (() => {
                          const pct = Math.min(100, (parseFloat(h.totalCompletedStored!) / parseFloat(h.contractSumToDate!)) * 100);
                          return (
                            <div className="mt-2">
                              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                <span>Completion %</span><span className="font-bold">{pct.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-[var(--color-brand-primary)] rounded-full transition-all"
                                  style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* ── Retainage grid ─────────────────────────────────── */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Retainage</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: 'On Completed Work',  key: 'retainageCompleted' as keyof GcHeader },
                            { label: 'On Stored Materials', key: 'retainageMaterials' as keyof GcHeader },
                            { label: 'Total Retainage',    key: 'totalRetainage' as keyof GcHeader },
                          ].map(({ label, key }) => (
                            <div key={key} className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5">
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">{label}</p>
                              <p className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums">{fmtC(h[key] as string | null)}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── Signatures ─────────────────────────────────────── */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Signatures</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[{ label: "Architect's Certificate", key: 'extractionConfidence' }, { label: "Contractor's Signature", key: 'extractionConfidence' }].map(({ label }) => {
                            const ok = parseFloat(h.extractionConfidence ?? '0') >= 0.75;
                            return (
                              <div key={label} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${ok ? 'bg-white border-[var(--color-border)]' : 'bg-[var(--color-surface)] border-[var(--color-border)]'}`}>
                                <span className={`text-sm font-bold ${ok ? 'text-[var(--color-valid)]' : 'text-[var(--color-text-disabled)]'}`}>{ok ? '✓' : '–'}</span>
                                <p className="text-xs font-medium text-[var(--color-text-primary)]">{label}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* ── Change Order Summary ────────────────────────────── */}
                      {h.changeOrderSummary && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Change Order Summary</p>
                          <ChangeOrderSummaryTable text={h.changeOrderSummary} />
                        </div>
                      )}

                      {/* ── Click-to-edit fields (hidden, triggered on card click) ── */}
                      <div className="hidden">
                        {G702_FIELDS.map(f => (
                          <FieldRow key={f.label} field={f} header={mergedHeader} packageId={packageId!} onSaved={handleHeaderSaved}
                            onEdit={() => { setShowDocPanel(true); setDocPanelPage(1); }} />
                        ))}
                      </div>

                    </div>
                  );
                })()
              : loadingSOV
                ? <div className="flex h-full items-center justify-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                : <div className="mt-2 h-full flex flex-col relative">
                    <div ref={sovTableRef} className="flex-1 overflow-auto relative h-full">
                      <SovSection lines={sovLines} packageId={packageId!} onRowSelect={handleRowSelect} highlightMode={highlightMode} gcHeader={mergedHeader} />
                    </div>
                  </div>
            }
          </div>

          {/* Actions */}
          <div className="shrink-0 border-t border-[var(--color-border)] px-5 py-3 bg-white flex items-center gap-3">
            {step === 2 && (
              <button onClick={() => { setStep(1); }}
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                ← Cover Sheet
              </button>
            )}
            {step === 1 && (
              <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Use "Show Doc" to verify fields against the original document
              </p>
            )}
            {step === 1 ? (
              <button onClick={() => { setStep(2); }}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-colors shadow-sm">
                <Check className="h-4 w-4" /> Confirm G702 <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button onClick={() => navigate(`/packages/${packageId}/plan`)}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-colors shadow-sm">
                <Check className="h-4 w-4" /> Confirm G703 & Review Sub Plan <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>



      </div>

      {/* Floating draggable document panel */}
      {showDocPanel && packageId && (
        <FloatingDocPanel
          packageId={packageId}
          page={docPanelPage}
          totalPages={step === 1 ? 1 : 8}
          onClose={() => setShowDocPanel(false)}
        />
      )}

      {/* Re-extract pages modal */}
      {showReExtract && packageId && (
        <ReExtractModal
          packageId={packageId}
          onClose={() => setShowReExtract(false)}
          onStarted={() => {
            setShowReExtract(false);
            setReExtractSuccess(true);
            setTimeout(() => setReExtractSuccess(false), 5000);
          }}
        />
      )}
    </div>
  );
}
