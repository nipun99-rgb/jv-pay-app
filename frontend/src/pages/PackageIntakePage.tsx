import { useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, X, Check, Loader2, Building2, Calendar, ChevronRight, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────
type FileSlot = { role: string; label: string; hint: string; required: boolean; icon: string };
type UploadedFile = { file: File; progress: number; done: boolean; error?: string; blobName?: string };

interface ContractOption {
  id: string;
  name: string;
  client: { id: string; name: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FILE_SLOTS: FileSlot[] = [
  { role: 'GC_PAY_APP',  label: 'GC Pay Application', hint: 'G702 + G703',            required: true,  icon: '' },
  { role: 'SUB_PAY_APP', label: 'Sub-Contractor Apps', hint: 'Sub G702/G703',          required: false, icon: '' },
  { role: 'SUPPORTING',  label: 'Supporting Docs',     hint: 'Invoices, lien waivers', required: false, icon: '' },
];

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const NOW = new Date();
const YEARS = Array.from({ length: 5 }, (_, i) => NOW.getFullYear() - 2 + i);

// ─── Upload helpers ────────────────────────────────────────────────────────────
async function presignAndUpload(file: File, onProgress: (pct: number) => void): Promise<string> {
  const presign = await apiFetch('/upload/presign', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/pdf' }),
  }) as { sasUrl: string; blobName: string };

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presign.sasUrl);
    xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
    xhr.setRequestHeader('Content-Type', file.type || 'application/pdf');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 95)); };
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
  return presign.blobName;
}

async function confirmUpload(blobName: string, filename: string, packageId: string, createdBy: string, fileType: string): Promise<void> {
  await apiFetch('/upload/confirm', {
    method: 'POST',
    body: JSON.stringify({ blobName, filename, packageId, createdBy, fileType }),
  });
}

// ─── Compact DropZone ─────────────────────────────────────────────────────────
function DropZone({ slot, uploaded, onFile, onRemove }: {
  slot: FileSlot; uploaded: UploadedFile | undefined;
  onFile: (f: File) => void; onRemove: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) onFile(f);
  }, [onFile]);

  const isUploading = !!uploaded && !uploaded.done && !uploaded.error;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <span className="text-xs font-semibold text-[var(--color-text-primary)]">
          {slot.label}
          {slot.required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      </div>
      <p className="text-[11px] text-[var(--color-text-secondary)] -mt-1">{slot.hint} · PDF</p>

      {uploaded ? (
        <div className={`rounded-lg border px-3 py-2 transition-all duration-200 ${
          uploaded.done ? 'border-green-200 bg-green-50' :
          uploaded.error ? 'border-red-200 bg-red-50' :
          'border-[var(--color-brand-primary)] bg-blue-50'
        }`}>
          <div className="flex items-center gap-2">
            {isUploading
              ? <Loader2 className="h-3.5 w-3.5 text-[var(--color-brand-primary)] shrink-0 animate-spin" />
              : uploaded.done
                ? <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                : <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
            <span className="flex-1 text-xs font-medium truncate text-[var(--color-text-primary)]">
              {uploaded.file.name}
            </span>
            {!isUploading && (
              <button onClick={onRemove} className="ml-1 text-gray-400 hover:text-red-500 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {isUploading && (
            <div className="mt-1.5 h-1 w-full rounded-full bg-blue-100 overflow-hidden">
              <div
                className="h-1 rounded-full bg-[var(--color-brand-primary)] transition-all duration-300 ease-out"
                style={{ width: `${uploaded.progress}%` }}
              />
            </div>
          )}
          {uploaded.error && <p className="mt-1 text-[11px] text-red-600">{uploaded.error}</p>}
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed py-4 cursor-pointer transition-all duration-200 select-none
            ${dragging
              ? 'border-[var(--color-brand-primary)] bg-blue-50 scale-[1.02]'
              : 'border-[var(--color-border)] hover:border-[var(--color-brand-primary)] hover:bg-blue-50/50 hover:scale-[1.01]'
            }`}
        >
          <Upload className={`h-4 w-4 transition-colors duration-200 ${dragging ? 'text-[var(--color-brand-primary)]' : 'text-gray-400'}`} />
          <p className="text-[11px] text-[var(--color-text-secondary)] text-center">
            <span className="font-medium text-[var(--color-brand-primary)]">Browse</span> or drop
          </p>
          <input ref={inputRef} type="file" accept=".pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function PackageIntakePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [projectName, setProjectName] = useState('');
  const [contractId, setContractId]   = useState<string>(searchParams.get('contractId') ?? '');
  const [periodMonth, setPeriodMonth] = useState<string>(String(NOW.getMonth() + 1).padStart(2, '0'));
  const [periodYear, setPeriodYear]   = useState<string>(String(NOW.getFullYear()));
  const [files, setFiles]             = useState<Record<string, UploadedFile>>({});
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const { data: contracts = [] } = useQuery<ContractOption[]>({
    queryKey: ['contracts'],
    queryFn: () => apiFetch('/contracts') as Promise<ContractOption[]>,
    staleTime: 60_000,
  });

  const startUpload = useCallback((role: string, f: File) => {
    setFiles((prev) => ({ ...prev, [role]: { file: f, progress: 0, done: false } }));
    presignAndUpload(f, (pct) => {
      setFiles((prev) => prev[role] ? { ...prev, [role]: { ...prev[role]!, progress: pct } } : prev);
    }).then((blobName) => {
      setFiles((prev) => prev[role] ? { ...prev, [role]: { ...prev[role]!, progress: 100, done: true, blobName } } : prev);
    }).catch((err: Error) => {
      setFiles((prev) => prev[role] ? { ...prev, [role]: { ...prev[role]!, error: err.message } } : prev);
    });
  }, []);

  const removeFile = (role: string) => {
    setFiles((prev) => { const next = { ...prev }; delete next[role]; return next; });
  };

  const gcFile = files['GC_PAY_APP'];
  const gcUploading = gcFile && !gcFile.done && !gcFile.error;
  const canSubmit = !!projectName.trim() && gcFile?.done === true && !submitting;
  const allUploaded = Object.values(files).filter(f => f.done).length;
  const anyUploading = Object.values(files).some(f => !f.done && !f.error);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null); setSubmitting(true);
    try {
      const applicationPeriod = `${periodYear}-${periodMonth}`;
      const pkg = await apiFetch('/packages', {
        method: 'POST',
        body: JSON.stringify({
          projectName: projectName.trim(),
          createdBy: user?.displayName ?? user?.email ?? 'unknown',
          applicationPeriod,
          ...(contractId && { contractId }),
        }),
      }) as { id: string };

      for (const slot of FILE_SLOTS) {
        const up = files[slot.role];
        if (!up?.done || !up.blobName) continue;
        await confirmUpload(up.blobName, up.file.name, pkg.id, user?.displayName ?? 'unknown', slot.role);
      }
      navigate(`/packages/${pkg.id}/ingest`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-[var(--color-surface)] px-6 py-4">
      <div className="w-full max-w-[720px] rounded-2xl border border-[var(--color-border)] bg-white shadow-lg overflow-hidden">

        {/* ── Header ── */}
        <div className="px-8 pt-6 pb-4 border-b border-[var(--color-border)]">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">New Pay Application Package</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Fill in the details and upload your documents to begin processing.</p>
        </div>

        {/* ── Body ── */}
        <div className="px-8 py-5 space-y-4">

          {/* Row 1: Project Name + Period */}
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1.5">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Boeing BSC Site Expansion"
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 placeholder:text-gray-300"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-[var(--color-text-primary)] mb-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Period <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)}
                  className="flex-1 min-w-0 rounded-lg border border-[var(--color-border)] px-2 py-2 text-sm outline-none transition-all duration-200 focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 bg-white">
                  {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                </select>
                <select value={periodYear} onChange={(e) => setPeriodYear(e.target.value)}
                  className="w-20 rounded-lg border border-[var(--color-border)] px-2 py-2 text-sm outline-none transition-all duration-200 focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 bg-white">
                  {YEARS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Row 2: Contract */}
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] mb-1.5 flex items-center gap-1">
              <Building2 className="h-3 w-3" /> Contract
              <span className="ml-1 font-normal text-[var(--color-text-secondary)]">(optional)</span>
            </label>
            <select value={contractId} onChange={(e) => setContractId(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 bg-white">
              <option value="">— No contract —</option>
              {contracts.map((c) => <option key={c.id} value={c.id}>{c.client.name} · {c.name}</option>)}
            </select>
          </div>

          {/* Row 3: Files (3 columns) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">Documents</span>
              {allUploaded > 0 && (
                <span className="text-[11px] text-green-600 font-medium flex items-center gap-1">
                  <Check className="h-3 w-3" /> {allUploaded} file{allUploaded > 1 ? 's' : ''} ready
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {FILE_SLOTS.map((slot) => (
                <DropZone key={slot.role} slot={slot} uploaded={files[slot.role]}
                  onFile={(f) => startUpload(slot.role, f)} onRemove={() => removeFile(slot.role)} />
              ))}
            </div>
          </div>

          {/* Upload hint */}
          {gcUploading && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              Uploading — "Start Processing" will unlock when the GC file is ready.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
            <button onClick={() => navigate('/')}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-gray-100 transition-all duration-200">
              Cancel
            </button>

            <div className="flex items-center gap-3">
              {anyUploading && (
                <span className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
                </span>
              )}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`inline-flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-semibold text-white transition-all duration-200
                  ${canSubmit
                    ? 'bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] shadow-md hover:shadow-lg hover:-translate-y-px active:translate-y-0'
                    : 'bg-gray-300 cursor-not-allowed'
                  }`}
              >
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <>Start Processing <ChevronRight className="h-4 w-4" /></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
