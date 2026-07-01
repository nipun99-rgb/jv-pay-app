import { useState } from "react";

export default function NewProjectModal({ onSubmit, onClose }) {
  const [name, setName] = useState("");
  const [baseline, setBaseline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Project name is required."); return; }
    if (!baseline.trim()) { setError("Project baseline is required."); return; }
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), baseline: baseline.trim() });
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSubmitting(false);
    }
  };

  // Close modal on overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>New Project</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="project-name">Project Name</label>
            <input
              id="project-name"
              type="text"
              placeholder="e.g. Highway Bridge Renovation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label htmlFor="project-baseline">Project Baseline</label>
            <textarea
              id="project-baseline"
              rows={3}
              placeholder="e.g. Budget: $2,500,000 — Target completion: Dec 2026"
              value={baseline}
              onChange={(e) => setBaseline(e.target.value)}
              maxLength={1000}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
