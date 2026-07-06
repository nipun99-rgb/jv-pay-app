/**
 * PdfViewer — Sprint 9.
 * Renders a package PDF via the authenticated blob proxy.
 * Uses react-pdf v9 (pdfjs-dist).
 *
 * Props:
 *   packageId  – UUID of the package
 *   docIndex   – 0-based index of the document in the package's document list (default 0)
 *   currentPage – externally controlled page number (1-based); jumps when it changes
 *   onPageChange – fired when the user navigates internally
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, FileText } from 'lucide-react';

// Use CDN worker to avoid Vite bundling issues with pdfjs web workers
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  packageId: string;
  docIndex?: number;
  fileType?: string;  // preferred: use fileType for reliable document lookup
  currentPage?: number | null;
  onPageChange?: (page: number) => void;
}

export default function PdfViewer({ packageId, docIndex = 0, fileType, currentPage, onPageChange }: Props) {
  const [numPages, setNumPages] = useState<number>(0);
  const [internalPage, setInternalPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(500);
  const [pageInput, setPageInput] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  const activePage = currentPage ?? internalPage;

  // Fit-to-width: observe container resizes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 500;
      setContainerWidth(Math.max(200, w - 32)); // subtract 32px padding
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Jump to page when external currentPage changes
  useEffect(() => {
    if (currentPage != null && currentPage >= 1 && numPages > 0 && currentPage <= numPages) {
      setInternalPage(currentPage);
    }
  }, [currentPage, numPages]);

  const goTo = useCallback(
    (p: number) => {
      const page = Math.max(1, Math.min(p, numPages || 1));
      setInternalPage(page);
      onPageChange?.(page);
    },
    [numPages, onPageChange],
  );

  const handlePageInput = () => {
    const n = parseInt(pageInput, 10);
    if (!isNaN(n)) goTo(n);
    setIsEditing(false);
    setPageInput('');
  };

  // Use fileType when provided (reliable) — falls back to docIndex
  const pdfUrl = fileType
    ? `/api/packages/${packageId}/pdf?fileType=${encodeURIComponent(fileType)}`
    : `/api/packages/${packageId}/pdf?docIndex=${docIndex}`;

  return (
    <div className="flex h-full flex-col bg-gray-100 select-none">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-white px-3 py-2 shrink-0">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => goTo(activePage - 1)}
            disabled={activePage <= 1 || numPages === 0}
            className="rounded p-1 hover:bg-gray-100 disabled:opacity-30 transition-opacity"
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {isEditing ? (
            <input
              autoFocus
              type="number"
              min={1}
              max={numPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageInput}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePageInput(); if (e.key === 'Escape') { setIsEditing(false); setPageInput(''); } }}
              className="w-12 rounded border border-[var(--color-brand-primary)] px-1 py-0.5 text-center text-xs focus:outline-none"
            />
          ) : (
            <button
              onClick={() => { setPageInput(String(activePage)); setIsEditing(true); }}
              className="rounded px-2 py-0.5 font-mono text-xs hover:bg-gray-100"
              title="Click to jump to page"
            >
              {numPages === 0 ? '—' : `${activePage} / ${numPages}`}
            </button>
          )}

          <button
            onClick={() => goTo(activePage + 1)}
            disabled={activePage >= numPages || numPages === 0}
            className="rounded p-1 hover:bg-gray-100 disabled:opacity-30 transition-opacity"
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.4, parseFloat((s - 0.15).toFixed(2))))}
            className="rounded p-1 hover:bg-gray-100"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setScale(1.0)}
            className="w-10 rounded px-1 py-0.5 text-center font-mono text-xs hover:bg-gray-100"
            title="Reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={() => setScale((s) => Math.min(3.0, parseFloat((s + 0.15).toFixed(2))))}
            className="rounded p-1 hover:bg-gray-100"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── PDF canvas ────────────────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center p-4">
        {loadError ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center text-sm text-[var(--color-text-secondary)]">
            <FileText className="h-10 w-10 opacity-20" />
            <p className="font-medium">Failed to load PDF</p>
            <p className="text-xs">{loadError}</p>
            <button
              onClick={() => setLoadError(null)}
              className="mt-1 rounded-md border border-[var(--color-border)] px-3 py-1 text-xs hover:bg-gray-50"
            >
              Retry
            </button>
          </div>
        ) : (
          <Document
            file={{ url: pdfUrl, withCredentials: true }}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n);
              // If currentPage was set before doc loaded, apply it now
              if (currentPage != null && currentPage >= 1 && currentPage <= n) {
                setInternalPage(currentPage);
              }
            }}
            onLoadError={(err) => {
              console.error('[PdfViewer] load error:', err);
              setLoadError(err.message || 'Unknown error loading PDF');
            }}
            loading={
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-primary)]" />
              </div>
            }
            error={<span />} // handled by onLoadError
          >
            <Page
              pageNumber={activePage}
              scale={scale}
              width={containerWidth}
              renderTextLayer
              renderAnnotationLayer
              loading={
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand-primary)]" />
                </div>
              }
            />
          </Document>
        )}
      </div>
    </div>
  );
}
