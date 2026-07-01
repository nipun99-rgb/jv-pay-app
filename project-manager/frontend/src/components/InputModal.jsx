import { useState, useRef } from "react";

export default function InputModal({ project, onSave, onClose }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (f && f.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }
    setError("");
    setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    handleFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Please choose a PDF file.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      const res = await fetch(`/api/projects/${project.id}/upload-pdf`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const updated = await res.json();
      await onSave(updated);
    } catch (err) {
      setError(err.message || "Upload failed.");
      setUploading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const existingFile = project.pdf_path
    ? project.pdf_path.split("\\").pop().split("/").pop()
    : null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>Configure Inputs</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label>Contractor Payment Application PDF</label>
            <div
              className={`upload-zone ${dragOver ? "upload-zone-active" : ""} ${file ? "upload-zone-has-file" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {file ? (
                <div className="upload-selected">
                  <span className="upload-file-icon">📄</span>
                  <div className="upload-file-info">
                    <strong>{file.name}</strong>
                    <span>{(file.size / 1_048_576).toFixed(1)} MB</span>
                  </div>
                  <button
                    type="button"
                    className="upload-remove"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="upload-placeholder">
                  <span className="upload-icon">☁</span>
                  <p><strong>Click to choose</strong> or drag & drop</p>
                  <span className="upload-hint">PDF files only, up to 200 MB</span>
                </div>
              )}
            </div>
          </div>

          {existingFile && !file && (
            <div className="upload-existing">
              📎 Current: <strong>{existingFile}</strong>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={uploading}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={uploading || !file}>
              {uploading ? "Uploading…" : "Upload PDF"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
