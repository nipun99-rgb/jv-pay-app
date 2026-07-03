import { cn } from "@/lib/utils";
import { Check, AlertTriangle, X, Minus, Eye } from "lucide-react";

const states = {
  valid: {
    label: "Valid",
    className: "bg-[var(--color-valid)]/10 text-[var(--color-valid)] border-[var(--color-valid)]/30",
    icon: Check,
  },
  warning: {
    label: "Warning",
    className: "bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/30",
    icon: AlertTriangle,
  },
  error: {
    label: "Error",
    className: "bg-[var(--color-error)]/10 text-[var(--color-error)] border-[var(--color-error)]/30",
    icon: X,
  },
  unchecked: {
    label: "Unchecked",
    className: "bg-[var(--color-unchecked)]/10 text-[var(--color-unchecked)] border-[var(--color-unchecked)]/30",
    icon: Minus,
  },
  "pending-review": {
    label: "Pending Review",
    className: "bg-[var(--color-step-running)]/10 text-[var(--color-step-running)] border-[var(--color-step-running)]/30",
    icon: Eye,
  },
};

export default function ValidationBadge({ status, className }) {
  const config = states[status] || states.unchecked;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}
