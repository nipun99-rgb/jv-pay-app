export default function ProjectView({ project, onDelete }) {
  if (!project) {
    return (
      <div className="project-view project-view-empty">
        <div className="project-view-empty-icon">📂</div>
        <h2>No project selected</h2>
        <p>Create a new project or select one from the sidebar.</p>
      </div>
    );
  }

  const formattedDate = project.created_at
    ? new Date(project.created_at).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const handleDelete = () => {
    if (window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
      onDelete(project.id);
    }
  };

  return (
    <div className="project-view">
      {/* Header */}
      <div className="project-header">
        <div className="project-header-left">
          <div className="project-big-icon">📁</div>
          <div className="project-title-group">
            <h1>{project.name}</h1>
            <p className="project-created-at">Created {formattedDate}</p>
          </div>
        </div>
        <button className="btn-delete" onClick={handleDelete}>
          🗑 Delete
        </button>
      </div>

      {/* Info Cards */}
      <div className="info-cards">
        <div className="info-card">
          <div className="info-card-label">Project Name</div>
          <div className="info-card-value">{project.name}</div>
        </div>
        <div className="info-card accent">
          <div className="info-card-label">Project Baseline</div>
          <div className="info-card-value">{project.baseline}</div>
        </div>
      </div>

      {/* Details Table */}
      <div className="details-section">
        <h3>Project Details</h3>
        <div className="detail-row">
          <span className="detail-key">Project ID</span>
          <span className="detail-val">#{project.id}</span>
        </div>
        <div className="detail-row">
          <span className="detail-key">Project Name</span>
          <span className="detail-val">{project.name}</span>
        </div>
        <div className="detail-row">
          <span className="detail-key">Baseline</span>
          <span className="detail-val">{project.baseline}</span>
        </div>
        <div className="detail-row">
          <span className="detail-key">Created At</span>
          <span className="detail-val">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}
