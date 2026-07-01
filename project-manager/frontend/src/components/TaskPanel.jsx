import { useState } from "react";

export default function TaskPanel({ tasks, onUpdateTask, onOpenInputs }) {
  const statusIcon = (status) => {
    switch (status) {
      case "complete": return "✅";
      case "running":  return "⏳";
      case "error":    return "❌";
      default:         return "⬜";
    }
  };

  const statusLabel = (status) => {
    switch (status) {
      case "complete": return "Complete";
      case "running":  return "Running";
      case "error":    return "Error";
      default:         return "Pending";
    }
  };

  return (
    <div className="task-panel">
      <div className="task-panel-header">
        <h2>Pipeline</h2>
        <button className="btn-inputs" onClick={onOpenInputs}>
          ⚙ Inputs
        </button>
      </div>

      <div className="task-pipeline">
        {tasks.map((task, idx) => (
          <div key={task.id} className={`task-step task-${task.status}`}>
            <div className="task-step-connector">
              <div className="task-dot">{statusIcon(task.status)}</div>
              {idx < tasks.length - 1 && <div className="task-line" />}
            </div>
            <div className="task-step-body">
              <div className="task-step-name">{task.step_name}</div>
              <div className={`task-step-status status-${task.status}`}>
                {statusLabel(task.status)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {tasks.length === 0 && (
        <div className="task-empty">No tasks yet. Configure inputs to begin.</div>
      )}
    </div>
  );
}
