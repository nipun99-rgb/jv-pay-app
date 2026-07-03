import { cn } from "@/lib/utils";

const severityConfig = {
  HIGH: { label: "High", className: "bg-[var(--color-severity-high)]/10 text-[var(--color-severity-high)] border-[var(--color-severity-high)]/30" },
  MEDIUM: { label: "Medium", className: "bg-[var(--color-severity-medium)]/10 text-[var(--color-severity-medium)] border-[var(--color-severity-medium)]/30" },
  LOW: { label: "Low", className: "bg-[var(--color-severity-low)]/10 text-[var(--color-severity-low)] border-[var(--color-severity-low)]/30" },
};

export default function SeverityBadge({ severity, className }) {
  const config = severityConfig[severity?.toUpperCase()] || severityConfig.MEDIUM;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
