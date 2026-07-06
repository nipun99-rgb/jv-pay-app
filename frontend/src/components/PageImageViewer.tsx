/**
 * PageImageViewer — shows pre-rendered page JPEGs from ingest.
 * Much faster than PdfViewer: no PDF download, no worker, instant render.
 * Images are cached by the browser after first load.
 */
import { useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

interface Props {
  packageId: string;
  fileType?: string;
  totalPages?: number;
  currentPage?: number | null;
  onPageChange?: (page: number) => void;
}

export default function PageImageViewer({
  packageId,
  fileType = 'GC_PAY_APP',
  totalPages = 12,
  currentPage,
  onPageChange,
}: Props) {
  const [internalPage, setInternalPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const activePage = currentPage ?? internalPage;

  const goTo = (n: number) => {
    const p = Math.max(1, Math.min(totalPages, n));
    setInternalPage(p);
    setLoaded(false);
    setError(false);
    onPageChange?.(p);
  };

  const imgUrl = `/api/packages/${packageId}/page-image?page=${activePage}&fileType=${encodeURIComponent(fileType)}`;

  return (
    <div className="flex flex-col h-full bg-gray-100 select-none">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-white px-3 py-2 shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={() => goTo(activePage - 1)} disabled={activePage <= 1}
            className="rounded p-1 hover:bg-gray-100 disabled:opacity-30 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs tabular-nums text-[var(--color-text-secondary)] min-w-[60px] text-center">
            {activePage} / {totalPages}
          </span>
          <button onClick={() => goTo(activePage + 1)} disabled={activePage >= totalPages}
            className="rounded p-1 hover:bg-gray-100 disabled:opacity-30 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setScale(s => Math.max(0.5, parseFloat((s - 0.15).toFixed(2))))}
            className="rounded p-1 hover:bg-gray-100" title="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs tabular-nums text-[var(--color-text-secondary)] min-w-[40px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => setScale(s => Math.min(3.0, parseFloat((s + 0.15).toFixed(2))))}
            className="rounded p-1 hover:bg-gray-100" title="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 overflow-auto flex justify-center p-4 bg-gray-100">
        {error ? (
          <div className="flex flex-col items-center justify-center gap-2 text-gray-400">
            <p className="text-sm">Page image unavailable</p>
            <button onClick={() => { setError(false); setLoaded(false); }}
              className="text-xs text-[var(--color-brand-primary)] hover:underline">Retry</button>
          </div>
        ) : (
          <div className="relative" style={{ transform: `scale(${scale})`, transformOrigin: 'top center', transition: 'transform 0.1s' }}>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-white rounded shadow min-w-[400px] min-h-[500px]">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <div className="h-6 w-6 rounded-full border-2 border-[var(--color-brand-primary)] border-t-transparent animate-spin" />
                  <span className="text-xs">Loading page {activePage}…</span>
                </div>
              </div>
            )}
            <img
              key={imgUrl}
              src={imgUrl}
              alt={`Page ${activePage}`}
              onLoad={() => setLoaded(true)}
              onError={() => { setError(true); setLoaded(true); }}
              className={`rounded shadow max-w-none transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              style={{ maxWidth: '100%' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
