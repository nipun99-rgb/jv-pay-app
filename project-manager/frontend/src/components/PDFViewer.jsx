import { useState } from "react";

export default function PDFViewer({ projectId, hasPdf }) {
  const [page, setPage] = useState(1);
  const pdfUrl = `/api/projects/${projectId}/pdf`;

  if (!hasPdf) {
    return (
      <div className="pdf-viewer pdf-empty">
        <div className="pdf-empty-icon">📄</div>
        <h3>No PDF configured</h3>
        <p>Click <strong>⚙ Inputs</strong> to set the PDF path.</p>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <span className="pdf-toolbar-title">Original PDF</span>
        <div className="pdf-page-controls">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            ◀
          </button>
          <span className="pdf-page-num">Page {page}</span>
          <button onClick={() => setPage((p) => p + 1)}>▶</button>
        </div>
      </div>
      <iframe
        className="pdf-frame"
        src={`${pdfUrl}#page=${page}`}
        title="PDF Viewer"
      />
    </div>
  );
}
