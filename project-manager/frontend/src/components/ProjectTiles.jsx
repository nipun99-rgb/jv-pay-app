export default function ProjectTiles({ projects, loading, onSelectProject }) {
  if (loading) {
    return (
      <div className="tiles-container">
        <div className="loading-spinner">
          <span /><span /><span />
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="tiles-container tiles-empty">
        <div className="tiles-empty-icon">📂</div>
        <h2>No projects yet</h2>
        <p>Click <strong>+ New Project</strong> on the sidebar to get started.</p>
      </div>
    );
  }

  return (
    <div className="tiles-container">
      <div className="tiles-header">
        <h1>My Projects</h1>
        <p className="tiles-subtitle">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="tiles-grid">
        {projects.map((project) => {
          const date = project.created_at
            ? new Date(project.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "";

          return (
            <div
              key={project.id}
              className="project-tile"
              onClick={() => onSelectProject(project)}
            >
              <div className="tile-icon">📁</div>
              <div className="tile-body">
                <h3 className="tile-name">{project.name}</h3>
                <p className="tile-baseline">{project.baseline}</p>
              </div>
              <div className="tile-footer">
                <span className="tile-date">{date}</span>
                <span className="tile-id">#{project.id}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
