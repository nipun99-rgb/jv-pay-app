/**
 * Shared SummaryBar component — displays a horizontal row of metric cards.
 *
 * Props:
 *   stats: [{ label, value, variant? }]
 *     variant: undefined | "ok" | "warn"
 */
export default function SummaryBar({ stats }) {
  if (!stats || stats.length === 0) return null;
  return (
    <div className="summary-bar">
      {stats.map((stat, i) => (
        <div key={i} className={`summary-stat${stat.variant ? ` ${stat.variant}` : ""}`}>
          <span className="summary-stat-val">{stat.value}</span>
          <span className="summary-stat-lbl">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
