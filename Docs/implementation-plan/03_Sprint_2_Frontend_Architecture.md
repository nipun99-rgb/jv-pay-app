# Invoice Validation & Review Platform
## Sprint 2: Frontend Architecture

**Duration:** Weeks 3–4
**Agents:** Agent 2 (Design System) runs first; Agent 3 (Frontend Architecture) runs after Agent 2; Agent 5 (QA Framework) runs in parallel with Agent 3
**Prerequisite:** Sprint 1 complete (Azure SQL API with auth working)
**Goal:** A fully styled, routed, authenticated React application that connects to the Sprint 1 backend. The GlobalDashboard, ContractList, and PackageIntakeWizard screens are functional by end of sprint.

---

## Sprint 2 — Agent 2 Work: Design System

Agent 2 runs first (can begin Day 1 of Sprint 2 — no backend dependency).

### S2-01 — Install Tailwind CSS v4 and shadcn/ui

**Effort:** 2 hours

**Work:**
1. In `project-manager/frontend/`, run:
   ```bash
   npm install tailwindcss @tailwindcss/vite
   npm install lucide-react
   npx shadcn@latest init
   ```
2. During `shadcn init`: choose React (not Next.js), choose CSS variables for theming, choose the default base color.
3. `vite.config.js`: add `@tailwindcss/vite` plugin.
4. `src/index.css`: replace entire content with `@import "tailwindcss";` and the CSS custom property token definitions (see S2-02).
5. **Delete `src/App.css` entirely.** It contains 3 conflicting button systems and 4 conflicting accent colors. It must not be preserved.
6. Remove all `import './App.css'` and `import './JourneyPanel.css'` statements across all component files.

**Acceptance criteria:**
- `npm run dev` starts without error
- Tailwind utility classes (`text-sm`, `flex`, `p-4`) apply correctly in the browser
- shadcn/ui is initialised (`components.json` present)
- `App.css` is deleted
- No compile errors

---

### S2-02 — Define Design Token System

**Effort:** 3 hours

**Work:** Define all design tokens as CSS custom properties in `src/index.css`. These tokens are the single source of truth for all visual design. No hardcoded hex color is permitted anywhere in the codebase.

**Required token definitions:**
```css
/* src/index.css */
@import "tailwindcss";

:root {
  /* Brand */
  --color-primary: oklch(0.51 0.23 264);       /* EY-aligned indigo */
  --color-primary-hover: oklch(0.44 0.23 264);
  --color-primary-foreground: oklch(0.98 0 0);

  /* Status — Validation */
  --color-valid: oklch(0.60 0.17 145);
  --color-warning: oklch(0.72 0.18 60);
  --color-error: oklch(0.55 0.21 25);
  --color-unchecked: oklch(0.65 0 0);

  /* Severity — Exceptions */
  --color-severity-high: oklch(0.55 0.21 25);
  --color-severity-medium: oklch(0.72 0.18 60);
  --color-severity-low: oklch(0.60 0.17 145);

  /* Surface */
  --color-background: oklch(0.99 0 0);
  --color-surface: oklch(0.97 0 0);
  --color-surface-raised: oklch(1 0 0);
  --color-border: oklch(0.90 0 0);

  /* Text */
  --color-text-primary: oklch(0.13 0 0);
  --color-text-secondary: oklch(0.45 0 0);
  --color-text-disabled: oklch(0.65 0 0);

  /* StepRail states */
  --color-step-pending: oklch(0.90 0 0);
  --color-step-running: oklch(0.51 0.23 264);
  --color-step-complete: oklch(0.60 0.17 145);
  --color-step-paused: oklch(0.72 0.18 60);
  --color-step-error: oklch(0.55 0.21 25);

  /* Layout */
  --sidebar-width: 240px;
  --header-height: 56px;
  --step-rail-height: 64px;
}
```

**Acceptance criteria:**
- Zero hardcoded hex colors in any component file
- Every color reference uses a `var(--color-*)` token or a Tailwind utility that resolves to a token
- WCAG 2.2 AA contrast ratio met: `--color-text-secondary` on `--color-background` is ≥ 4.5:1 (verified with browser contrast checker)
- `--color-text-disabled` (`oklch(0.65 0 0)`) used only for non-interactive, non-critical UI elements — not for body text

---

### S2-03 — Build shadcn/ui Component Inventory

**Effort:** 4 hours

**Work:** Install all shadcn/ui components required for the 9-screen journey. Run these `shadcn add` commands:
```bash
npx shadcn@latest add button badge table dialog tabs select input checkbox tooltip scroll-area sheet skeleton sonner progress
```

Then create the following custom components that wrap or extend shadcn/ui primitives:

**`src/components/shared/ValidationBadge.jsx`** (update existing):
Add the missing `pending-review` state to the existing 4 states:
- `valid` → green badge, check icon
- `warning` → amber badge, triangle icon
- `error` → red badge, X icon
- `unchecked` → grey badge, dash icon
- `pending-review` → blue badge, eye icon (agent flagged, human not yet seen) — **this state was missing and is now added**

**`src/components/shared/MoneyCell.jsx`** (new):
A table cell that formats a `Decimal` value with `DECIMAL(18,2)` precision, handles null, and displays a diff indicator when an override has been applied.

**`src/components/shared/StepRail.jsx`** (new — replaces the 3-phase JourneyPanel):
Horizontal strip showing 9 steps from `processing_pipeline_steps`. Each step shows: step number, step name, status icon, and a progress indicator. Polls via a prop that accepts the 9-row array.

**`src/components/shared/SeverityBadge.jsx`** (new):
Displays HIGH / MEDIUM / LOW with the severity color tokens.

**Acceptance criteria:**
- All 14 shadcn/ui components install without error
- `ValidationBadge` renders all 5 states (including `pending-review`)
- `StepRail` renders 9 steps with correct status icons
- All custom components use only token-based colors

---

## Sprint 2 — Agent 3 Work: Frontend Architecture

Agent 3 begins after Agent 2's S2-01 and S2-02 are complete.

### S2-04 — Install React Router v6 and Establish Folder Structure

**Effort:** 3 hours

**Work:**
1. `npm install react-router-dom`
2. Rename/reorganise `src/` to the following structure:
   ```
   src/
   ├── pages/
   │   ├── LoginPage.jsx          (new)
   │   ├── GlobalDashboard.jsx    (new — replaces project tile grid)
   │   ├── ContractListPage.jsx   (new)
   │   ├── PackageIntakePage.jsx  (new)
   │   └── package/
   │       ├── PackageLayout.jsx  (new — outlet wrapper)
   │       ├── IngestPage.jsx     (new)
   │       ├── File1Page.jsx      (new)
   │       ├── PlanPage.jsx       (new)
   │       ├── File2Page.jsx      (new)
   │       ├── CompletePage.jsx   (new)
   │       ├── ExceptionsPage.jsx (new)
   │       └── HitlPage.jsx       (new)
   ├── components/
   │   ├── shared/               (ValidationBadge, MoneyCell, StepRail, SeverityBadge)
   │   ├── AppShell.jsx          (new — header + sidebar + outlet)
   │   ├── DataTable.jsx         (existing — keep)
   │   ├── CoverPageTable.jsx    (existing — keep)
   │   ├── SplitPane.jsx         (existing — keep, reuse in 3-pane workbench)
   │   └── EvidenceViewer.jsx    (new — react-pdf based, replaces PDFViewer.jsx)
   ├── hooks/
   │   ├── useAuth.js            (new)
   │   ├── usePackage.js         (new)
   │   └── usePipelineSteps.js   (new — polling hook)
   ├── lib/
   │   └── api.js                (new — apiFetch wrapper)
   ├── styles/
   │   └── index.css             (design tokens + tailwind import)
   └── main.jsx                  (updated — router provider)
   ```

**Files to retire:**
- `src/App.jsx` → logic migrated to router + pages
- `src/components/JourneyPanel.jsx` → superseded by `StepRail` + route-based navigation
- `src/components/PDFViewer.jsx` → superseded by `EvidenceViewer.jsx`
- `src/test-dashboard-main.jsx` → retired (test dashboard decommissioned)
- `src/components/InputModal.jsx` → replaced by shadcn/ui Dialog

**Acceptance criteria:**
- `src/` folder matches the structure above
- Old files retired (not just emptied — actually removed)
- `npm run dev` still starts without error

---

### S2-05 — Implement `apiFetch` Wrapper (`src/lib/api.js`)

**Effort:** 1 hour

**Work:**
```javascript
// src/lib/api.js
const BASE = '/api';

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',  // send httpOnly session cookie automatically
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (res.status === 401) {
    // Session expired — redirect to login
    window.location.href = '/login';
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}
```

**Key design choices (from D12, D16):**
- `credentials: 'include'` sends the httpOnly session cookie automatically — no manual token header management
- HTTP 401 redirects to `/login` — session expiry is handled globally, not per-component
- `Content-Type: application/json` default — overridden for multipart file uploads by passing `headers: {}` in options
- No Axios, no TanStack Query — native fetch as confirmed in the decision register

**Acceptance criteria:**
- All existing fetch calls in components are migrated to `apiFetch`
- No component contains `fetch()` directly — all go through `apiFetch`
- `SubcontractorTable.jsx` old `const API = "http://localhost:3001/api"` line is already removed (Pre-Sprint PS-01)

---

### S2-06 — Implement AuthContext and `useAuth` Hook

**Effort:** 3 hours

**Work:**

`src/hooks/useAuth.js`:
```javascript
import { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

**Acceptance criteria:**
- `useAuth()` returns `{ user, loading, login, logout }`
- `user` is `null` when unauthenticated
- `user.roles` is available for role-based rendering decisions in components
- `loading` prevents flash of unauthenticated content on page refresh

---

### S2-07 — Register All Routes in `main.jsx`

**Effort:** 2 hours

**Work:** Replace the current `main.jsx` content with a `createBrowserRouter` configuration:

```javascript
// src/main.jsx
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.js';
import AppShell from './components/AppShell.jsx';
import LoginPage from './pages/LoginPage.jsx';
import GlobalDashboard from './pages/GlobalDashboard.jsx';
import ContractListPage from './pages/ContractListPage.jsx';
import PackageIntakePage from './pages/PackageIntakePage.jsx';
import PackageLayout from './pages/package/PackageLayout.jsx';
import IngestPage from './pages/package/IngestPage.jsx';
import File1Page from './pages/package/File1Page.jsx';
import PlanPage from './pages/package/PlanPage.jsx';
import File2Page from './pages/package/File2Page.jsx';
import CompletePage from './pages/package/CompletePage.jsx';
import ExceptionsPage from './pages/package/ExceptionsPage.jsx';
import HitlPage from './pages/package/HitlPage.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth><AppShell><Outlet /></AppShell></RequireAuth>,
    children: [
      { index: true, element: <GlobalDashboard /> },
      { path: 'contracts', element: <ContractListPage /> },
      { path: 'packages/new', element: <PackageIntakePage /> },
      {
        path: 'packages/:packageId',
        element: <PackageLayout />,
        children: [
          { path: 'ingest', element: <IngestPage /> },
          { path: 'file1', element: <File1Page /> },
          { path: 'plan', element: <PlanPage /> },
          { path: 'file2', element: <File2Page /> },
          { path: 'complete', element: <CompletePage /> },
          { path: 'exceptions', element: <ExceptionsPage /> },
          { path: 'hitl', element: <HitlPage /> },
        ]
      },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'reports', element: <ReportsPage /> },
    ]
  }
]);
```

**Acceptance criteria:**
- All 13 routes render without error (pages can be stubs initially)
- `RequireAuth` wrapper redirects to `/login` if no authenticated session
- Browser back/forward navigation works correctly between routes
- Deep links (e.g., `/packages/42/exceptions`) work when typed directly into the browser

---

### S2-08 — Build `AppShell` Component

**Effort:** 4 hours

**What AppShell contains:**
- **Header (56px height):** Platform name/logo (left), notification bell with unread badge count (right), user avatar + display name (right), logout button
- **Sidebar (240px width):** Navigation links — Dashboard, Contracts, Settings (admin only), Reports. Uses `NavLink` from React Router to show active state.
- **Main content area:** `<Outlet />` renders the current page

**Notification bell behaviour:**
- Polls `GET /api/notifications?unread=true` every 30 seconds via `setInterval` inside a `useEffect`
- Shows a badge with the count of unread notifications
- Clicking opens a dropdown Sheet (shadcn/ui Sheet) showing the 10 most recent notifications
- Clicking a notification marks it as read via `PATCH /api/notifications/:id`

**User avatar:**
- Displays `user.displayName` initials (first letter of first and last word)
- Not a real image — initials in a colored circle
- Tooltip on hover shows full display name and job title

**Admin-only sidebar item:**
- "Settings" link visible only when `user.roles` includes `system_admin`
- Implemented: `{user.roles.includes('system_admin') && <NavLink to="/settings">Settings</NavLink>}`

**Acceptance criteria:**
- AppShell renders on all authenticated routes
- Notification bell shows unread count from live API
- Sidebar highlights the active route
- Settings link only visible to system_admin role
- Logout calls `/api/auth/logout` and redirects to `/login`

---

### S2-09 — Build `LoginPage`

**Effort:** 3 hours

**Layout:** Centered card on a light background. EY / Platform branding. Email input, password input, Submit button.

**Behaviour:**
- On submit: calls `login(email, password)` from `useAuth`
- On success: navigates to `/` (GlobalDashboard)
- On failure: displays the error message from the API (e.g., "Invalid email or password")
- Loading state: Submit button shows spinner, is disabled during the API call
- No "Sign in with Microsoft" button in Sprint 2 — Entra ID is Phase 2

**Security:**
- Email and password fields have `autocomplete="email"` and `autocomplete="current-password"` respectively (browser password manager compatibility)
- No client-side credential storage — the httpOnly cookie is managed by the browser automatically
- Password field is `type="password"` (not shown)

**Acceptance criteria:**
- Login with valid credentials navigates to GlobalDashboard
- Login with invalid credentials shows error message, does not navigate
- After successful login, pressing browser back does not return to LoginPage
- Page is accessible (form labels, keyboard navigation, error message announced to screen readers)

---

### S2-10 — Build `GlobalDashboard` (Package Queue)

**Effort:** 4 hours

**Purpose:** The primary landing screen. Shows all packages the current user has access to, grouped by status. This is the "command centre" for the invoice reviewer.

**Data source:** `GET /api/packages` — returns packages with contract name and pipeline step summary.

**Layout:**
- Page header: "Package Queue" title, "New Package" primary button (routes to `/packages/new`)
- Summary row: total counts — Awaiting Review, In Progress, Approved this month, Flagged (has open exceptions)
- Package table columns: Contract Name, Billing Period, Contractor, Package Status badge, Open Exceptions count, Last Activity timestamp, Action button (→ opens the relevant step page)

**Package Status badges (maps to `packages.package_status`):**
- `DRAFT` → grey badge
- `INGESTING` / `FILE_1_PROCESSING` / `FILE_2_PROCESSING` → blue badge "Processing"
- `AWAITING_PLAN_CONFIRMATION` → amber badge "Awaiting Review"
- `EXCEPTION_REVIEW` → amber badge + exception count
- `READY_FOR_APPROVAL` → blue badge "Ready for Approval"
- `APPROVED` → green badge
- `REJECTED` → red badge

**"Open Package" action:** Navigates to the correct sub-route based on current `package_status`:
```javascript
const packageRoute = {
  INGESTING: 'ingest',
  FILE_1_PROCESSING: 'file1',
  AWAITING_PLAN_CONFIRMATION: 'plan',
  FILE_2_PROCESSING: 'file2',
  EXCEPTION_REVIEW: 'exceptions',
  READY_FOR_APPROVAL: 'hitl',
  APPROVED: 'hitl',
}[pkg.packageStatus] ?? 'ingest';
navigate(`/packages/${pkg.id}/${packageRoute}`);
```

**Acceptance criteria:**
- Dashboard loads with real data from `/api/packages`
- Package status badges render with correct color
- "Open Package" routes to the correct step page for each package status
- "New Package" button routes to `/packages/new`
- Empty state displayed when no packages exist (not a blank table)

---

### S2-11 — Build `PackageIntakePage` (Wizard)

**Effort:** 6 hours

**Purpose:** Screen 1 of the 9-screen journey. Creates a new package by collecting contract selection, billing period, and uploading up to 3 PDF files.

**Layout:** 3-step wizard (not full page navigation — steps are within the same page):
- Step 1: Select Contract — dropdown of contracts from `GET /api/contracts`
- Step 2: Billing Period — month selector (1–12) + year selector
- Step 3: Upload Files — drag-and-drop upload zones for File 1 (required), File 2 (optional), File 3 (optional)

**Duplicate check:** After the user selects contract + billing period, immediately query `GET /api/packages?contractId=X&month=Y&year=Z` to detect existing packages. Show a warning banner if a duplicate exists: "A package already exists for this contract and billing period. Are you sure you want to continue?"

**File upload zones:**
- Each zone accepts PDF only (`accept=".pdf"`)
- Shows file name and size after selection
- File 1 is labelled "GC Pay Application (File 1)" — required
- File 2 is labelled "Sub-Contractor Package (File 2)" — optional at intake
- File 3 is labelled "Supporting Documents (File 3)" — optional

**Submission:** `POST /api/packages` as multipart form. On success, navigate to `/packages/:newPackageId/ingest`.

**Acceptance criteria:**
- Contract dropdown is populated from live API
- Billing period validation: month must be 1–12, year must be 4-digit
- Duplicate warning shown when applicable
- PDF-only file type enforced
- Submission navigates to the new package's ingest page
- Loading state shown during submission

---

## Sprint 2 — Agent 5 Work: QA Framework

Runs in parallel with Agent 3.

### S2-12 — Install vitest and Testing Library

**Effort:** 2 hours

```bash
npm install -D vitest @testing-library/react @testing-library/user-event jsdom @vitejs/plugin-react
```

Add to `vite.config.js`:
```javascript
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: './src/test-setup.js'
}
```

Create `src/test-setup.js`:
```javascript
import '@testing-library/jest-dom';
```

**First test target:** `ValidationBadge.jsx` — verify all 5 states render with correct text and ARIA attributes.

---

### S2-13 — Install Playwright for E2E Testing

**Effort:** 3 hours

```bash
npm install -D @playwright/test
npx playwright install chromium
```

**First E2E test:** Login flow.
```javascript
test('login with valid credentials navigates to dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'reviewer@test.com');
  await page.fill('[name=password]', 'testpassword');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL('/');
  await expect(page.locator('text=Package Queue')).toBeVisible();
});
```

**Test database:** A separate Azure SQL test instance (not the development instance). Provisioned with seed data only. Reset between test runs via `npx prisma migrate reset --skip-seed && npx prisma db seed`.

---

## Sprint 2 Completion Criteria

- [ ] **S2-01** — Tailwind v4 + shadcn/ui installed; `App.css` deleted; no compile errors
- [ ] **S2-02** — Design token system in `src/styles/index.css`; zero hardcoded hex colors anywhere
- [ ] **S2-03** — 14 shadcn/ui components added; `ValidationBadge` updated with `pending-review` state; `StepRail` component built
- [ ] **S2-04** — Folder structure matches spec; old files retired; React Router v6 installed
- [ ] **S2-05** — `apiFetch` wrapper in `src/lib/api.js`; all components use it
- [ ] **S2-06** — `AuthContext` + `useAuth` working; login/logout cycle works end-to-end
- [ ] **S2-07** — All 13 routes registered; `RequireAuth` guard working
- [ ] **S2-08** — `AppShell` renders with notification bell (live count), sidebar with active state, logout
- [ ] **S2-09** — `LoginPage` works end-to-end; error handling correct; no credential storage
- [ ] **S2-10** — `GlobalDashboard` shows real package data; "Open Package" routes correctly per status
- [ ] **S2-11** — `PackageIntakePage` wizard works end-to-end; creates a real package; navigates to ingest
- [ ] **S2-12** — vitest installed; `ValidationBadge` test passing
- [ ] **S2-13** — Playwright installed; login E2E test passing against real backend
