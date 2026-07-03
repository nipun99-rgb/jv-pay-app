import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api.js';
import { Loader2, Upload, Check, X } from 'lucide-react';

export default function PackageIntakePage() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [contractId, setContractId] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [file3, setFile3] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  useEffect(() => {
    apiFetch('/contracts').then(setContracts).catch(() => {});
  }, []);

  useEffect(() => {
    if (!contractId || !month || !year) { setDuplicateWarning(false); return; }
    apiFetch(`/packages?contractId=${contractId}&month=${month}&year=${year}`)
      .then(data => setDuplicateWarning(data && data.length > 0))
      .catch(() => setDuplicateWarning(false));
  }, [contractId, month, year]);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    setLoadingMsg('Creating package...');
    try {
      // Step 1: Create package
      const data = await apiFetch('/packages', {
        method: 'POST',
        body: JSON.stringify({
          contractId: parseInt(contractId),
          billingPeriodMonth: parseInt(month),
          billingPeriodYear: parseInt(year),
        })
      });

      // Step 2: Upload files
      setLoadingMsg('Uploading files...');
      const form = new FormData();
      if (file1) form.append('file1', file1);
      if (file2) form.append('file2', file2);
      if (file3) form.append('file3', file3);
      await apiFetch(`/packages/${data.packageId}/documents`, {
        method: 'POST',
        body: form
      });

      navigate(`/packages/${data.packageId}/ingest`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const canSubmit = !!file1 && !!contractId && !!month && !!year && !loading;

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-[680px] rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Title */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
          <h1 className="text-2xl font-semibold text-gray-900">Start New Monthly Package</h1>

          {/* Decorative stepper */}
          <div className="mt-5 flex items-center gap-0">
            <StepperStep num={1} label="Upload Files" active />
            <StepperLine />
            <StepperStep num={2} label="Confirm" />
            <StepperLine />
            <StepperStep num={3} label="Process" />
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Billing Period + Contract row */}
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Billing Period</label>
              <div className="flex gap-2">
                <select
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                >
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Contract</label>
              <select
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={contractId}
                onChange={e => setContractId(e.target.value)}
              >
                <option value="">Select contract…</option>
                {contracts.map(c => (
                  <option key={c.id} value={c.id}>{c.contractName}{c.contractNo ? ` (${c.contractNo})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {duplicateWarning && (
            <p className="rounded-md bg-orange-50 border border-orange-200 px-3 py-2 text-sm text-orange-700">
              A package already exists for this contract and billing period.
            </p>
          )}

          {/* File upload cards */}
          <div className="space-y-4">
            <FileCard
              num={1}
              title="File 1 — Consolidated / Summary Invoice"
              subtitle="GC Cover Page + Continuation Sheet"
              required
              file={file1}
              onSelect={setFile1}
              onRemove={() => setFile1(null)}
            />
            <FileCard
              num={2}
              title="File 2 — Sub-Contractor Breakdown"
              subtitle="All sub-contractor invoices compiled"
              file={file2}
              onSelect={setFile2}
              onRemove={() => setFile2(null)}
            />
            <FileCard
              num={3}
              title="File 3 — Supporting Documents"
              subtitle="Direct-cost backup billed by contractor"
              file={file3}
              onSelect={setFile3}
              onRemove={() => setFile3(null)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-8 py-5">
          <button
            className="text-sm text-gray-500 hover:text-gray-700"
            onClick={() => navigate('/')}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loadingMsg || 'Begin Processing →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepperStep({ num, label, active }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold ${active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
        {num}
      </div>
      <span className={`text-sm ${active ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{label}</span>
    </div>
  );
}

function StepperLine() {
  return <div className="flex-1 mx-3 h-px border-t border-dashed border-gray-300 min-w-[32px]" />;
}

function FileCard({ num, title, subtitle, required, file, onSelect, onRemove }) {
  const inputRef = useRef(null);
  const fmtSize = (bytes) => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className={`rounded-lg border px-4 py-4 ${file ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded ${required ? 'text-gray-500 bg-gray-100' : 'text-gray-400 bg-gray-50'}`}>
          {required ? 'Required' : 'Optional'}
        </span>
      </div>

      {file ? (
        <div className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span className="text-gray-800 font-medium flex-1 truncate">{file.name}</span>
          <span className="text-gray-400 text-xs">{fmtSize(file.size)}</span>
          <button onClick={onRemove} className="text-gray-400 hover:text-gray-600 ml-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">Drop PDF here or click to browse</span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={e => onSelect(e.target.files?.[0] || null)}
          />
        </label>
      )}
    </div>
  );
}
