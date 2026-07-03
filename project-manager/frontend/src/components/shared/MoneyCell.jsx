import { cn } from "@/lib/utils";

export default function MoneyCell({ value, override, className }) {
  if (value == null && override == null) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  const display = override != null ? override : value;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(display));

  return (
    <span className={cn("tabular-nums", override != null && "text-[var(--color-warning)] line-through decoration-[var(--color-warning)]/50", className)}>
      {formatted}
      {override != null && (
        <span className="ml-1 no-underline text-[var(--color-valid)]">
          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(Number(override))}
        </span>
      )}
    </span>
  );
}
