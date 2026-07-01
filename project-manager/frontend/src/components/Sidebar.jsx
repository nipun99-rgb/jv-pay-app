export default function Sidebar({
  projects,
  selectedProject,
  onSelectProject,
  onNewProject,
  loading,
  collapsed,
  onToggle,
}) {
  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">P</div>
          <span className="sidebar-logo-text">Project Manager</span>
        </div>

        <button className="btn-new-project" onClick={onNewProject}>
          <span className="plus-icon">+</span>
          New Project
        </button>
      </div>

      {projects.length > 0 && (
        <div className="sidebar-section-label">Projects</div>
      )}

      <div className="project-list">
        {loading ? (
          <div className="loading-spinner">
            <span /><span /><span />
          </div>
        ) : projects.length === 0 ? (
          <div className="sidebar-empty">
            No projects yet.
            <br />
            Click <strong>New Project</strong> to get started.
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className={`project-item ${
                selectedProject?.id === project.id ? "active" : ""
              }`}
              onClick={() => onSelectProject(project)}
            >
              <div className="project-item-icon">📁</div>
              <span className="project-item-name">{project.name}</span>
            </div>
          ))
        )}
      </div>

      {/* Collapse / shrink button at the bottom */}
      <div className="sidebar-footer">
        <button className="btn-collapse" onClick={onToggle} title="Collapse sidebar">
          ◀ Hide
        </button>
      </div>
    </aside>
  );
}
