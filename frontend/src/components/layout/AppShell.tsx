import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { FileStack, FolderKanban, Layers, Settings, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useShell } from '@/contexts/ShellContext';
import { AgentPanel } from './AgentPanel';
import { apiFetch } from '@/lib/api';

const toneClasses: Record<string, string> = {
  neutral: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border)]',
  info: 'bg-blue-50 text-blue-600 border-blue-200',
  warn: 'bg-orange-50 text-orange-600 border-orange-200',
  success: 'bg-green-50 text-green-700 border-green-200',
};

interface Notification {
  id: string;
  title?: string;
  message?: string;
}

export default function AppShell() {
  const { user } = useAuth();
  const { contractName, period, statusLabel, statusTone } = useShell();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const location = useLocation();

  useEffect(() => {
    const fetchCount = () => {
      apiFetch('/notifications?unread=true')
        .then((data) => {
          if (Array.isArray(data)) {
            setUnreadCount((data as Notification[]).length);
            setNotifications(data as Notification[]);
          }
        })
        .catch(() => {});
    };
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, []);

  const initials =
    (user?.displayName ?? '')
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  const hasAdmin = user?.roles?.some(
    (r) => (typeof r === 'string' ? r : r.code) === 'ADMIN'
  );

  const navItems = [
    { to: '/', label: 'Packages', icon: FileStack },
    { to: '/contracts', label: 'Contracts', icon: FolderKanban },
    { to: '/reports', label: 'Reports', icon: Layers },
    ...(hasAdmin ? [{ to: '/settings', label: 'Settings', icon: Settings }] : []),
  ];

  return (
    <div className="flex h-screen flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
      {/* ── Global Header ─────────────────────────────────────────────────── */}
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-card)] px-4">
        <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded bg-[var(--color-brand-primary)] text-[11px] font-bold text-[var(--color-brand-primary-foreground)]">
            IV
          </span>
          <span className="text-sm">InvoiceReview</span>
        </NavLink>

        {/* Breadcrumbs */}
        {contractName && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
            <span className="text-[var(--color-border)]">/</span>
            <span>Contracts</span>
            <span className="text-[var(--color-border)]">/</span>
            <span className="text-[var(--color-foreground)]">{contractName}</span>
            {period && (
              <>
                <span className="text-[var(--color-border)]">/</span>
                <span className="text-[var(--color-foreground)]">{period}</span>
              </>
            )}
          </div>
        )}

        {/* Status pill (centred) */}
        <div className="flex flex-1 justify-center">
          {statusLabel && (
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                toneClasses[statusTone ?? 'neutral']
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusLabel}
            </span>
          )}
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            className="relative text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            aria-label="Notifications"
            onClick={() => setShowNotifications((v) => !v)}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-8 z-50 w-80 rounded-lg border border-[var(--color-border)] bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2">
                <h3 className="text-sm font-semibold">Notifications</h3>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-[var(--color-muted-foreground)]">
                    No unread notifications
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="border-b border-[var(--color-border)] px-4 py-3 text-xs last:border-0"
                    >
                      <p className="font-medium text-[var(--color-foreground)]">{n.title ?? n.message}</p>
                      {n.title && n.message && (
                        <p className="mt-0.5 text-[var(--color-muted-foreground)]">{n.message}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div className="flex items-center gap-2 text-xs">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-muted)]">
            <span className="text-[10px] font-medium text-[var(--color-muted-foreground)]">{initials}</span>
          </div>
          <span className="hidden text-[var(--color-muted-foreground)] md:inline">{user?.displayName}</span>
        </div>
      </header>

      {/* ── Body: Nav Rail + Main + Agent Panel ───────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Left Navigation Rail */}
        <nav className="flex w-14 shrink-0 flex-col items-center border-r border-[var(--color-border)] bg-[var(--color-card)] py-3 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex w-11 flex-col items-center gap-0.5 rounded-md py-2 text-[10px] transition-colors ${
                  isActive
                    ? 'bg-orange-50 text-orange-600'
                    : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="leading-none">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-auto">
          <Outlet />
        </main>

        {/* v2 — Right-side Agent Panel (new) */}
        <AgentPanel />
      </div>
    </div>
  );
}
