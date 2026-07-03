import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Use the bundled worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function EvidenceViewer({ pdfUrl, pageNumber = 1, onPageChange, documents = [] }) {
  const [numPages, setNumPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const currentPage = Math.max(1, Math.min(pageNumber, numPages || pageNumber));

  // Support multiple documents via tabs
  const activePdfUrl = documents.length > 0 ? documents[activeDocIdx]?.url : pdfUrl;

  const onDocumentLoadSuccess = ({ numPages: total }) => {
    setNumPages(total);
    setLoading(false);
  };

  const goToPage = (p) => {
    const next = Math.max(1, Math.min(p, numPages || 1));
    if (onPageChange) onPageChange(next);
  };

  if (!activePdfUrl) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-secondary)]">
        No document available
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* File tabs (when multiple documents provided) */}
      {documents.length > 1 && (
        <div className="flex border-b border-border">
          {documents.map((doc, i) => (
            <button
              key={i}
              onClick={() => { setActiveDocIdx(i); setNumPages(null); setLoading(true); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                i === activeDocIdx
                  ? 'border-b-2 border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {doc.label || `File ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* PDF canvas */}
      <div className="flex-1 overflow-auto bg-[var(--color-surface)]">
        <Document
          file={activePdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<Skeleton className="m-4 h-[600px] w-full" />}
          error={<div className="p-4 text-sm text-[var(--color-error)]">Failed to load PDF</div>}
        >
          <Page
            pageNumber={currentPage}
            width={560}
            loading={<Skeleton className="m-4 h-[600px] w-full" />}
          />
        </Document>
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => goToPage(currentPage - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs text-[var(--color-text-secondary)]">
          Page {currentPage} of {numPages || '...'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={currentPage >= (numPages || 1)}
          onClick={() => goToPage(currentPage + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
