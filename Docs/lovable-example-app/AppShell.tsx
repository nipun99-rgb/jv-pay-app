import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { Bell, FileStack, FolderKanban, Layers, Settings, User } from "lucide-react";
import type { ReactNode } from "react";
import { packages } from "@/lib/mockData";

interface AppShellProps {
  children: ReactNode;
  contractName?: string;
  period?: string;
  statusLabel?: string;
  statusTone?: "neutral" | "info" | "warn" | "success";
}

const toneClass: Record<NonNullable<AppShellProps["statusTone"]>, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info/10 text-info border-info/30",
  warn: "bg-warning/10 text-warning border-warning/30",
  success: "bg-success/10 text-success border-success/30",
};

export function AppShell({ children, contractName, period, statusLabel, statusTone = "neutral" }: AppShellProps) {
  const params = useParams({ strict: false }) as { id?: string };
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pkg = params.id ? packages.find((p) => p.id === params.id) : undefined;
  const displayContract = contractName ?? pkg?.contract;
  const displayPeriod = period ?? pkg?.period;
  const displayStatus = statusLabel ?? pkg?.statusLabel;

  const navItems = [
    { to: "/", label: "Packages", icon: FileStack },
    { to: "/contracts", label: "Contracts", icon: FolderKanban },
    { to: "/reports", label: "Reports", icon: Layers },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Global Header */}
      <header className="h-12 flex items-center gap-4 border-b border-border bg-card px-4 shrink-0">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="h-6 w-6 rounded bg-primary text-primary-foreground grid place-items-center text-[11px] font-bold">IV</span>
          <span className="text-sm">InvoiceReview</span>
        </Link>
        {displayContract && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-border">/</span>
            <span>Contracts</span>
            <span className="text-border">/</span>
            <span className="text-foreground">{displayContract}</span>
            {displayPeriod && (
              <>
                <span className="text-border">/</span>
                <span className="text-foreground">{displayPeriod}</span>
              </>
            )}
          </div>
        )}
        <div className="flex-1 flex justify-center">
          {displayStatus && (
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${toneClass[statusTone]}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {displayStatus}
            </span>
          )}
        </div>
        <button className="text-muted-foreground hover:text-foreground" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 text-xs">
          <div className="h-7 w-7 rounded-full bg-muted grid place-items-center">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="hidden md:inline text-muted-foreground">M. Alvarez</span>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Nav Rail */}
        <nav className="w-14 shrink-0 border-r border-border bg-card flex flex-col items-center py-3 gap-1">
          {navItems.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`w-11 py-2 rounded-md flex flex-col items-center gap-0.5 text-[10px] transition-colors ${
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
