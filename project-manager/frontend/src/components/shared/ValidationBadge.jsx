/**
 * Shared ValidationBadge — consistent AI validation status indicator.
 *
 * Props:
 *   status: "valid" | "warning" | "checking" | "unchecked"
 *   onClick?: (e) => void  — optional click handler (for expanding notes)
 */
export default function ValidationBadge({ status, onClick }) {
  const handleClick = (e) => {
    if (onClick) { e.stopPropagation(); onClick(e); }
  };

  if (status === "valid")
    return <span className="v-badge v-valid" title="AI validated — OK" onClick={handleClick}>✓</span>;
  if (status === "checking")
    return <span className="v-badge v-checking" title="AI checking…">⋯</span>;
  if (status === "warning")
    return (
      <span className="v-badge v-warning" title="AI flagged issue" onClick={handleClick} style={{ cursor: onClick ? "pointer" : "default" }}>⚠</span>
    );
  return (
    <span className="v-badge v-unchecked" title="Not yet validated" onClick={handleClick} style={{ cursor: onClick ? "pointer" : "default" }}>—</span>
  );
}
