import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '@/lib/api.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ValidationBadge from '@/components/shared/ValidationBadge.jsx';
import EvidenceViewer from '@/components/EvidenceViewer.jsx';
import { Skeleton } from '@/components/ui/skeleton';

export default function File1Page() {
  const { packageId } = useParams();
  const [header, setHeader] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [editCell, setEditCell] = useState(null); // { lineId, field, value }
  const [showSubOnly, setShowSubOnly] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [h, l, pkg] = await Promise.all([
          apiFetch(`/packages/${packageId}/gc-header`),
          apiFetch(`/packages/${packageId}/gc-sov-lines`),
          apiFetch(`/packages/${packageId}`),
        ]);
        setHeader(h);
        setLines(l);
        // Get PDF URL from package documents
        const file1Doc = pkg.documents?.find(d => d.fileRole === 'FILE_1');
        if (file1Doc) setPdfUrl(`/api/packages/${packageId}/pdf/${file1Doc.id}`);

        // Check if extraction is still running — if so, poll until complete
        const extract1Step = pkg.pipelineSteps?.find(s => s.stepName === 'EXTRACT_FILE1');
        if (extract1Step?.status === 'running') {
          pollRef.current = setInterval(async () => {
            try {
              const [freshLines, freshPkg] = await Promise.all([
                apiFetch(`/packages/${packageId}/gc-sov-lines`),
                apiFetch(`/packages/${packageId}`),
              ]);
              setLines(freshLines);
              const freshStep = freshPkg.pipelineSteps?.find(s => s.stepName === 'EXTRACT_FILE1');
              if (freshStep?.status !== 'running') {
                clearInterval(pollRef.current);
                // Also refresh header
                const freshHeader = await apiFetch(`/packages/${packageId}/gc-header`);
                setHeader(freshHeader);
              }
            } catch {}
          }, 3000);
        }
      } catch (e) {
        console.error('File1Page load error:', e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [packageId]);

  const startEdit = (lineId, field, value) => setEditCell({ lineId, field, value });

  const commitEdit = async () => {
    if (!editCell) return;
    try {
      await apiFetch(`/packages/${packageId}/gc-sov-lines/${editCell.lineId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [editCell.field]: editCell.value }),
      });
      setLines(prev => prev.map(l =>
        l.id === editCell.lineId ? { ...l, [editCell.field]: editCell.value } : l
      ));
    } catch (e) {
      console.error('Edit error:', e.message);
    }
    setEditCell(null);
  };

  const cancelEdit = () => setEditCell(null);

  const filteredLines = showSubOnly
    ? lines.filter(l => parseFloat(l.workCompletedThis || 0) !== 0)
    : lines;

  if (loading) return <div className="p-4"><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="flex h-full">
      {/* Left — G702 Cover */}
      <div className="w-64 shrink-0 overflow-auto border-r border-border p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">G702 Cover</h3>
        {header ? (
          <div className="space-y-3">
            {[
              ['Project', header.projectName],
              ['App No', header.applicationNo],
              ['Period To', header.periodTo],
              ['Original Sum', fmt(header.originalContractSum)],
              ['Change Orders', fmt(header.netChangeOrders)],
              ['Sum to Date', fmt(header.contractSumToDate)],
              ['Completed', fmt(header.totalCompletedStored)],
              ['Retainage', fmt(header.totalRetainage)],
              ['Earned Less Ret', fmt(header.totalEarnedLessRet)],
              ['Less Prev Certs', fmt(header.lessPrevCertificates)],
              ['Payment Due', fmt(header.currentPaymentDue)],
              ['Balance', fmt(header.balanceToFinish)],
            ].map(([label, val]) => (
              <div key={label} className="text-xs">
                <span className="block text-[var(--color-text-secondary)]">{label}</span>
                <span className="font-medium text-[var(--color-text-primary)]">{val ?? '—'}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-secondary)]">No header data yet</p>
        )}
      </div>

      {/* Centre — G703 SOV Lines */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">G703 SOV Lines</h3>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={showSubOnly}
              onChange={(e) => setShowSubOnly(e.target.checked)}
              className="rounded border-border"
            />
            Sub-contractor lines only
          </label>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b border-border text-left text-[var(--color-text-secondary)]">
                <th className="px-2 py-1.5">#</th>
                <th className="px-2 py-1.5">Description</th>
                <th className="px-2 py-1.5 text-right">Scheduled</th>
                <th className="px-2 py-1.5 text-right">Prev Completed</th>
                <th className="px-2 py-1.5 text-right">This Period</th>
                <th className="px-2 py-1.5 text-right">Materials</th>
                <th className="px-2 py-1.5 text-right">Total %</th>
                <th className="px-2 py-1.5 text-right">Retainage</th>
                <th className="px-2 py-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLines.map(line => (
                <tr
                  key={line.id}
                  className="border-b border-border hover:bg-[var(--color-surface)] cursor-pointer"
                  onClick={() => line.sourcePage && setActivePage(line.sourcePage)}
                >
                  <td className="px-2 py-1.5">{line.lineNo ?? line.itemNo ?? line.seqNo ?? ''}</td>
                  <td className="px-2 py-1.5 max-w-[200px] truncate">{line.description || line.subContractorName || line.lineDescription || '—'}</td>
                  <EditableCell line={line} field="scheduledValue" editCell={editCell} startEdit={startEdit} commitEdit={commitEdit} cancelEdit={cancelEdit} />
                  <EditableCell line={line} field="previousCompleted" editCell={editCell} startEdit={startEdit} commitEdit={commitEdit} cancelEdit={cancelEdit} />
                  <EditableCell line={line} field="workCompletedThis" editCell={editCell} startEdit={startEdit} commitEdit={commitEdit} cancelEdit={cancelEdit} />
                  <EditableCell line={line} field="materialsStored" editCell={editCell} startEdit={startEdit} commitEdit={commitEdit} cancelEdit={cancelEdit} />
                  <td className="px-2 py-1.5 text-right">{line.totalCompletedPercent ?? '—'}</td>
                  <EditableCell line={line} field="retainage" editCell={editCell} startEdit={startEdit} commitEdit={commitEdit} cancelEdit={cancelEdit} />
                  <td className="px-2 py-1.5">
                    <ValidationBadge status={line.validationStatus || 'unchecked'} />
                  </td>
                </tr>
              ))}
              {filteredLines.length === 0 && (
                <tr><td colSpan={9} className="px-2 py-4 text-center text-[var(--color-text-secondary)]">No lines</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right — Evidence Viewer */}
      <div className="w-[360px] shrink-0 border-l border-border">
        <EvidenceViewer pdfUrl={pdfUrl} pageNumber={activePage} onPageChange={setActivePage} />
      </div>
    </div>
  );
}

function EditableCell({ line, field, editCell, startEdit, commitEdit, cancelEdit }) {
  const isEditing = editCell?.lineId === line.id && editCell?.field === field;
  const value = line[field];

  if (isEditing) {
    return (
      <td className="px-2 py-1.5 text-right">
        <Input
          className="h-6 w-24 text-right text-xs"
          autoFocus
          value={editCell.value}
          onChange={(e) => startEdit(line.id, field, e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
        />
      </td>
    );
  }
  return (
    <td
      className="px-2 py-1.5 text-right cursor-text hover:bg-[var(--color-surface-raised)]"
      onDoubleClick={() => startEdit(line.id, field, value ?? '')}
    >
      {fmt(value)}
    </td>
  );
}

function fmt(v) {
  if (v == null || v === '') return '—';
  const n = parseFloat(v);
  return isNaN(n) ? v : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
