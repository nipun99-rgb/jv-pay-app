import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import ProjectTiles from "./components/ProjectTiles";
import ProjectDetail from "./components/ProjectDetail";
import NewProjectModal from "./components/NewProjectModal";
import TestDashboard from "./components/TestDashboard";

const API = "/api";

export default function App() {
  // Check if we're on the test-dashboard route
  const pathMatch = window.location.pathname.match(/^\/test-dashboard\/(\d+)/);
  if (pathMatch) {
    // Render test dashboard full-screen, no sidebar
    return <TestDashboard projectIdOverride={pathMatch[1]} />;
  }

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API}/projects`);
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (formData) => {
    const res = await fetch(`${API}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create project");
    }
    const created = await res.json();
    setProjects((prev) => [created, ...prev]);
    setSelectedProject(null); // stay on tiles view to see new tile
    setShowModal(false);
  };

  const handleDeleteProject = async (id) => {
    await fetch(`${API}/projects/${id}`, { method: "DELETE" });
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    setSelectedProject(null); // go back to tiles
  };

  return (
    <div className="app-layout">
      <Sidebar
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={setSelectedProject}
        onNewProject={() => setShowModal(true)}
        loading={loading}
        collapsed={!sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
      />

      {/* Expand button when sidebar is collapsed */}
      {!sidebarOpen && (
        <button
          className="btn-expand-sidebar"
          onClick={() => setSidebarOpen(true)}
          title="Open sidebar"
        >
          ☰
        </button>
      )}

      <main className="main-content">
        {selectedProject ? (
          <ProjectDetail
            project={selectedProject}
            onDelete={handleDeleteProject}
            onBack={() => setSelectedProject(null)}
            onProjectUpdate={(updated) => {
              setSelectedProject(updated);
              setProjects((prev) =>
                prev.map((p) => (p.id === updated.id ? updated : p))
              );
            }}
          />
        ) : (
          <ProjectTiles
            projects={projects}
            loading={loading}
            onSelectProject={setSelectedProject}
          />
        )}
      </main>

      {showModal && (
        <NewProjectModal
          onSubmit={handleCreateProject}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
