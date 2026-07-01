/**
 * Shared TabBar component — consistent tabbed navigation across the app.
 *
 * Props:
 *   tabs: [{ key, icon, label, badge }]
 *   activeTab: string (matches tab.key)
 *   onTabChange: (key) => void
 */
export default function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <div className="ws-tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`ws-tab${activeTab === tab.key ? " active" : ""}`}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.icon && <span className="ws-tab-icon">{tab.icon}</span>}
          <span className="ws-tab-text">{tab.label}</span>
          {tab.badge !== undefined && <span className="ws-tab-badge">{tab.badge}</span>}
        </button>
      ))}
    </div>
  );
}
