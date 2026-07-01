import { useState, useEffect, useRef } from "react";

const API = "/api";

const LEVEL_STYLES = {
  step:     { icon: "▶", color: "#89b4fa" },
  success:  { icon: "✓", color: "#a6e3a1" },
  warn:     { icon: "⚠", color: "#f9e2af" },
  error:    { icon: "✕", color: "#f38ba8" },
  progress: { icon: "⟳", color: "#cba6f7" },
  info:     { icon: "·", color: "#6c7086" },
};

export default function OutputPanel({ projectId, visible }) {
  const [logs, setLogs] = useState([]);
  const [connected, setConnected] = useState(false);
  const [lastPoll, setLastPoll] = useState(null);
  const bottomRef = useRef(null);
  const lastIdRef = useRef(0);

  // Poll for new logs every 1.5s
  useEffect(() => {
    if (!visible || !projectId) return;

    const fetchLogs = async () => {
      try {
        const res = await fetch(
          `${API}/projects/${projectId}/logs?after=${lastIdRef.current}`
        );
        const newLogs = await res.json();
        setConnected(true);
        setLastPoll(new Date());
        if (newLogs.length > 0) {
          setLogs((prev) => [...prev, ...newLogs]);
          lastIdRef.current = newLogs[newLogs.length - 1].id;
        }
      } catch (err) {
        setConnected(false);
      }
    };

    fetchLogs(); // initial fetch
    const interval = setInterval(fetchLogs, 1500);
    return () => clearInterval(interval);
  }, [projectId, visible]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  // Reset when project changes
  useEffect(() => {
    setLogs([]);
    lastIdRef.current = 0;
    setConnected(false);
    setLastPoll(null);
  }, [projectId]);

  const handleClear = async () => {
    await fetch(`${API}/projects/${projectId}/logs`, { method: "DELETE" });
    setLogs([]);
    lastIdRef.current = 0;
  };

  if (!visible) return null;

  const statusColor = connected ? "#a6e3a1" : "#f38ba8";
  const statusText = connected ? "Connected" : "Disconnected";

  return (
    <div className="output-panel">
      <div className="output-header">
        <span className="output-title">
          <span className="output-dot" style={{ background: statusColor, animation: connected ? "pulse-dot 2s infinite" : "none" }} />
          Output
        </span>
        <span className="output-status" style={{ color: statusColor }}>{statusText}</span>
        <span className="output-count">{logs.length} lines</span>
        <button className="output-clear" onClick={handleClear} title="Clear logs">
          Clear
        </button>
      </div>

      <div className="output-body">
        {logs.length === 0 ? (
          <div className="output-empty">
            <div className="output-empty-icon">{connected ? "📡" : "⏳"}</div>
            <p>{connected ? "Connected — ready" : "Connecting…"}</p>
            <span>{connected
              ? "Logs will appear here when the pipeline runs."
              : "Trying to reach the backend server…"
            }</span>
            {connected && lastPoll && (
              <span className="output-poll-time">
                Last polled: {lastPoll.toLocaleTimeString()}
              </span>
            )}
          </div>
        ) : (
          logs.map((log) => {
            const style = LEVEL_STYLES[log.level] || LEVEL_STYLES.info;
            return (
              <div key={log.id} className="output-line">
                <span className="output-icon" style={{ color: style.color }}>
                  {style.icon}
                </span>
                <span className="output-time">
                  {log.created_at?.split(" ")[1]?.slice(0, 8) || ""}
                </span>
                <span className="output-msg">{log.message}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
