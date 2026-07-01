import { useState, useRef, useCallback, useEffect } from "react";
import "./SplitPane.css";

/**
 * Resizable split pane with drag handle and collapse/expand on hover.
 * Props:
 *   left       – React node for left panel
 *   right      – React node for right panel
 *   defaultPct – initial left width % (default 50)
 *   minPct     – minimum left width % (default 20)
 *   maxPct     – maximum left width % (default 80)
 */
export default function SplitPane({ left, right, defaultPct = 50, minPct = 20, maxPct = 80 }) {
  const [leftPct, setLeftPct] = useState(defaultPct);
  const [collapsed, setCollapsed] = useState(null); // null | "left" | "right"
  const containerRef = useRef(null);
  const dragging = useRef(false);
  const savedPct = useRef(defaultPct);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let pct = ((e.clientX - rect.left) / rect.width) * 100;
      pct = Math.max(minPct, Math.min(maxPct, pct));
      setLeftPct(pct);
      savedPct.current = pct;
      if (collapsed) setCollapsed(null);
    };

    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [minPct, maxPct, collapsed]);

  const collapseLeft = () => {
    if (collapsed === "left") {
      setCollapsed(null);
      setLeftPct(savedPct.current);
    } else {
      savedPct.current = leftPct;
      setCollapsed("left");
    }
  };

  const collapseRight = () => {
    if (collapsed === "right") {
      setCollapsed(null);
      setLeftPct(savedPct.current);
    } else {
      savedPct.current = leftPct;
      setCollapsed("right");
    }
  };

  const leftStyle = collapsed === "left"
    ? { width: 0, minWidth: 0, overflow: "hidden" }
    : collapsed === "right"
      ? { width: "100%", flex: 1 }
      : { width: `${leftPct}%` };

  const rightStyle = collapsed === "right"
    ? { width: 0, minWidth: 0, overflow: "hidden" }
    : collapsed === "left"
      ? { width: "100%", flex: 1 }
      : { flex: 1 };

  return (
    <div className="split-pane" ref={containerRef}>
      <div className="split-pane-left" style={leftStyle}>
        {left}
      </div>

      <div className="split-pane-divider" onMouseDown={onMouseDown}>
        <div className="split-divider-line" />

        {/* Collapse arrows — visible on hover */}
        <button
          className={`split-collapse-btn split-collapse-left ${collapsed === "left" ? "active" : ""}`}
          onClick={(e) => { e.stopPropagation(); collapseLeft(); }}
          title={collapsed === "left" ? "Show table" : "Hide table"}
        >
          {collapsed === "left" ? "▶" : "◀"}
        </button>
        <button
          className={`split-collapse-btn split-collapse-right ${collapsed === "right" ? "active" : ""}`}
          onClick={(e) => { e.stopPropagation(); collapseRight(); }}
          title={collapsed === "right" ? "Show PDF" : "Hide PDF"}
        >
          {collapsed === "right" ? "◀" : "▶"}
        </button>
      </div>

      <div className="split-pane-right" style={rightStyle}>
        {right}
      </div>
    </div>
  );
}
