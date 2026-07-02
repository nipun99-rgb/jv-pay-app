# 3-Sprint Implementation Plan — Invoice Review & Validation Platform

**Version:** 1.0 · July 2, 2026  
**Prepared by:** Product Management  
**Audience:** Three-Agent Development Team (UI/UX · Senior Dev · Testing)  
**Source documents:** L2_User_Journey.md · L2_Layout_Specifications.md · L2_Component_Map.md · lovable-example-app/

---

## Executive Summary

This plan converts the existing React JS + Vite codebase into a production-quality, HITL operations workbench across **3 sprints of 2 weeks each**. Every task is owned by all three agents simultaneously in sequence: `UI/UX → Dev → Test`. No task is marked done until the Testing Agent has cleared it. No mock data is permitted in any file at any time — the Testing Agent will reject any component that does not call a live backend endpoint.

---

## Technology Decision Record

| Decision | Choice | Rationale |
|---|---|---|
| **Language** | React JS (JSX) — no TypeScript conversion | Existing codebase is JS; migration cost outweighs benefit for this timeline |
| **Router** | React Router v6 (`createBrowserRouter`) | Replaces `window.location.pathname` pattern; standard React ecosystem |
| **Styling** | Tailwind CSS v4 + CSS custom properties | Adopt exact token names from `lovable-example-app/styles 1.css` |
| **Component library** | shadcn/ui (JS variant) | Pre-built, accessible, Tailwind-compatible; matches lovable reference pattern |
| **Icons** | Lucide React | Already in lovable-example-app; consistent icon vocabulary |
| **HTTP** | Native `fetch` with custom `apiFetch` wrapper | No new libraries; keeps backend integration identical to today |
| **Theme** | Light only — NO dark mode | One theme to maintain; consistent with lovable CSS `:root` block only |
| **Mock data** | **STRICTLY PROHIBITED** | Every component calls a real backend endpoint from Sprint 1, Task 1 |
| **Backend** | Express/Node.js server.js — **zero changes** | All 30+ endpoints are proven; no backend work in Sprints 1–3 |

---

## Design Token System

Copy this exactly into `src/index.css`. This replaces all of `App.css`. Source: `lovable-example-app/styles 1.css`.

```css
@import "tailwindcss";

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-background:        var(--background);
  --color-foreground:        var(--foreground);
  --color-card:              var(--card);
  --color-card-foreground:   var(--card-foreground);
  --color-primary:           var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted:             var(--muted);
  --color-muted-foreground:  var(--muted-foreground);
  --color-accent:            var(--accent);
  --color-destructive:       var(--destructive);
  --color-success:           var(--success);
  --color-warning:           var(--warning);
  --color-caution:           var(--caution);
  --color-border:            var(--border);
  --color-input:             var(--input);
  --color-ring:              var(--ring);
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}

:root {
  --radius: 0.5rem;
  --background:           oklch(0.985 0.003 250);   /* #F8FAFC slate-50 */
  --foreground:           oklch(0.20 0.03 260);      /* slate-900 */
  --card:                 oklch(1 0 0);              /* white */
  --card-foreground:      oklch(0.20 0.03 260);
  --primary:              oklch(0.55 0.20 259);      /* #2563EB blue-600 */
  --primary-foreground:   oklch(0.99 0 0);
  --secondary:            oklch(0.955 0.008 250);
  --secondary-foreground: oklch(0.25 0.03 260);
  --muted:                oklch(0.96 0.006 250);
  --muted-foreground:     oklch(0.50 0.02 260);      /* #64748B — WCAG AA on white ✓ */
  --accent:               oklch(0.94 0.03 259);
  --accent-foreground:    oklch(0.30 0.10 259);
  --destructive:          oklch(0.58 0.22 27);       /* red-600 */
  --destructive-foreground: oklch(0.99 0 0);
  --success:              oklch(0.62 0.16 150);      /* green-600 */
  --warning:              oklch(0.70 0.17 55);       /* amber-500 */
  --caution:              oklch(0.80 0.16 90);       /* yellow-400 */
  --info:                 oklch(0.55 0.20 259);
  --border:               oklch(0.90 0.01 250);      /* #E2E8F0 */
  --input:                oklch(0.90 0.01 250);
  --ring:                 oklch(0.55 0.20 259);
}

@layer base {
  * { border-color: var(--color-border); }
  html, body {
    font-family: var(--font-sans);
    font-feature-settings: "cv02","cv03","cv04","cv11";
    background-color: var(--color-background);
    color: var(--color-foreground);
    -webkit-font-smoothing: antialiased;
  }
}
```

**Banned from the codebase after Sprint 1, Task 1:**
- Any hardcoded hex: `#4f46e5`, `#6366f1`, `#777`, `#999`, `#94a3b8`, `#64748b`, `#1a3a2a`
- Any class names: `.btn-*`, `.ws-btn-*`, `.jbtn-*`, `.jcard-*`
- Any inline `style={{ color: "#..." }}`
- Any `dark:` Tailwind modifier

---

## Route Architecture

```
/                          → GlobalDashboard          ← replaces ProjectTiles + Sidebar
/packages/new              → PackageIntakeWizard       ← replaces NewProjectModal
/packages/:id              → PackageLayout (Outlet)   ← thin wrapper, no UI
/packages/:id/ingest       → IngestScreen             ← Step 1+2 of AgentProgressRail
/packages/:id/file1        → File1Screen              ← Step 3, shows G702+G703 preview
/packages/:id/plan         → PlanScreen               ← Step 4, HITL Gate 1
/packages/:id/file2        → File2Screen              ← Step 5+6, sub extraction
/packages/:id/reconcile    → ReconcileScreen          ← Step 7+8
/packages/:id/complete     → CompleteScreen           ← Step 8, summary stats
/packages/:id/exceptions   → ExceptionsScreen         ← Step 9a, exception navigator
/packages/:id/hitl         → HITLScreen               ← Step 9b, HITL Gate 2
```

---

## Agent Roles & Responsibilities

### 🎨 UI/UX Design Agent

> **System Prompt:**
> You are a Senior UX Designer at Google with 12 years of experience designing enterprise operations tooling — specifically HITL (Human-in-the-Loop) data review workflows, financial document processing, and operator-grade dashboards. You follow Google's Material Design principles, WCAG 2.2 AA standards without exception, and the Nielsen Norman Group's 10 Usability Heuristics. Your design output is always component-level and implementation-ready: you specify exact Tailwind class names, exact token variable names from the project's CSS, exact layout zones with dimensions, exact aria labels, exact interactive states (default, hover, focus, active, disabled, loading, error). You do not produce wireframes or abstract descriptions — you produce JSX-ready design specifications that a developer can implement without creative interpretation. You have read the following project documents and hold them as ground truth: L2_User_Journey.md, L2_Layout_Specifications.md, L2_Component_Map.md, Sprint_Implementation_Plan.md. For every component you specify, you define: (1) layout zone and dimensions, (2) typography classes using the Inter font and project token scale, (3) every interactive state, (4) WCAG 2.2 AA compliance — aria-label, role, focus-visible, aria-live region if async, minimum 4.5:1 contrast ratio, (5) empty state, (6) loading skeleton. You never approve a component that uses hardcoded hex values, dark: Tailwind modifiers, or mock data arrays.

### 🔧 Senior Developer Agent

> **System Prompt:**
> You are a Senior Software Engineer at Google with 10 years of experience in production React applications, REST API integration, and enterprise frontend architecture. You write clean, idiomatic React JS (not TypeScript) with hooks, React Router v6, and Tailwind CSS v4. You never write mock data, placeholder comments, or TODO stubs — every function you write either calls a real API endpoint or is documented as a configuration value with its real default. You have full access to and have read the project's backend API documentation (all 30 endpoints in L2_Component_Map.md Section A). You know that the backend runs on port 3001 and all API calls must go through the `apiFetch` wrapper at `src/lib/api.js` which prepends `/api` to every path. You implement exactly and only what the UI/UX Agent specifies — no extra features, no refactoring beyond scope, no TypeScript migration. You fix security issues immediately: no hardcoded localhost URLs, no `console.log` with sensitive data, no unvalidated user input rendered as HTML. Before marking your work done, you check: (1) no mock data anywhere, (2) no hardcoded colors, (3) React Router navigation works (no `window.location`), (4) all API error states are handled with user-visible feedback, (5) the component re-renders correctly when the parent re-fetches.

### 🧪 Testing Agent

> **System Prompt:**
> You are a Senior Quality Assurance Engineer at Google with 8 years of experience in frontend testing, accessibility compliance auditing, and zero-regression release pipelines. Your job is to validate every task before it is marked complete. You run three layers of checks for every component delivered: (1) **Data Layer** — confirm every data field on screen maps to a real API endpoint and a real database column from L2_Component_Map.md Section B. Reject any component with a hardcoded string where real data should appear. (2) **Visual Layer** — confirm every color class uses a CSS token (e.g., `bg-primary`, `text-muted-foreground`) not a hardcoded value. Confirm typography follows the Inter font scale. Confirm spacing uses Tailwind's scale, not arbitrary pixel values. (3) **Accessibility Layer** — run WCAG 2.2 AA checks: every interactive element has `aria-label` or visible text label; every async update uses `aria-live="polite"`; every modal has `role="dialog"` + `aria-labelledby` + focus trap; every form field has `<label htmlFor>`; color contrast passes 4.5:1 for body text and 3:1 for large text. If any check fails, you write a structured bug report in this format: `[COMPONENT] [LAYER] [SEVERITY: CRITICAL/HIGH/MEDIUM] — Description. Expected: X. Actual: Y. Fix: Z.` You do not pass a task until all CRITICAL and HIGH severity issues are resolved. MEDIUM issues are logged and must be resolved before the sprint ends.

---

## Sprint 1 — Foundation (Weeks 1–2)

**Sprint Goal:** Replace the entire visual foundation. At the end of Sprint 1, the app uses only token-based styling, has React Router v6 running, renders a working `AppShell` + `GlobalDashboard` from live API data, and all critical production bugs are fixed.

**Sprint 1 Acceptance Criteria (non-negotiable):**
- Zero hardcoded hex values in any `.css`, `.jsx`, or `style={}` attribute
- Zero uses of `window.location` for navigation
- `SubcontractorTable.jsx` line 6 localhost bug resolved
- `GET /api/projects` renders real project cards on the dashboard
- All 3 agents have signed off on every task

---

### S1-T1 — Design Token System + Tailwind v4 Setup

**What this task does:** Wipes `App.css` and replaces the entire styling foundation with the lovable token system. This unblocks every subsequent task — nothing visual can be built correctly until this is done. This is Day 1.

**Files changed:**
- `src/index.css` — complete replacement with token block above
- `package.json` — add `tailwindcss@latest`, `@tailwindcss/vite`, `lucide-react`, `clsx`, `tailwind-merge`
- `vite.config.js` — add Tailwind Vite plugin
- `src/lib/cn.js` — new utility file (2 lines)
- `App.css` — DELETE (all styles moved to index.css tokens)

---

**🎨 UI/UX Agent — S1-T1 Design Specification:**

Deliver the exact CSS token block (already defined in the Token System section above). Additionally specify:

1. **Typography scale** — map to Tailwind classes:
   - Page title: `text-xl font-semibold tracking-tight text-foreground`
   - Section header: `text-sm font-semibold text-foreground`
   - Label / overline: `text-[11px] uppercase tracking-wider text-muted-foreground`
   - Body: `text-sm text-foreground`
   - Caption / meta: `text-xs text-muted-foreground`
   - Tabular numbers: add `tabular-nums` to any financial figure

2. **Button system** — two variants only, implemented as Tailwind class strings (no custom CSS classes):
   - Primary: `rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none`
   - Ghost: `rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`

3. **Badge system** — four variants:
   - Success: `inline-flex items-center rounded-full bg-success/10 text-success border border-success/20 px-2.5 py-0.5 text-xs font-medium`
   - Warning: `... bg-warning/10 text-warning border-warning/20 ...`
   - Destructive: `... bg-destructive/10 text-destructive border-destructive/20 ...`
   - Neutral: `... bg-muted text-muted-foreground border-border ...`

---

**🔧 Senior Dev Agent — S1-T1 Implementation:**

```
1. Install packages:
   npm install tailwindcss@latest @tailwindcss/vite lucide-react clsx tailwind-merge

2. Update vite.config.js:
   import tailwindcss from "@tailwindcss/vite"
   Add tailwindcss() to plugins array.

3. Replace src/index.css with the full token block from Token System section.

4. Delete App.css. Remove its import from App.jsx.

5. Create src/lib/cn.js:
   import { clsx } from "clsx";
   import { twMerge } from "tailwind-merge";
   export function cn(...inputs) { return twMerge(clsx(inputs)); }

6. Create src/lib/api.js:
   const BASE = "/api";
   export async function apiFetch(path, options = {}) {
     const res = await fetch(`${BASE}${path}`, {
       headers: { "Content-Type": "application/json", ...options.headers },
       ...options,
     });
     if (!res.ok) {
       const err = await res.json().catch(() => ({ message: res.statusText }));
       throw new Error(err.message ?? "Request failed");
     }
     return res.json();
   }

CRITICAL: The BASE constant must be "/api" — never "http://localhost:3001/api".
The Vite dev server proxy (already configured) forwards /api → http://localhost:3001/api.
Verify vite.config.js has: server: { proxy: { "/api": "http://localhost:3001" } }
```

---

**🧪 Testing Agent — S1-T1 Test Gate:**

Run these checks before marking S1-T1 complete:

```
DATA LAYER:
□ apiFetch("/projects") compiles without errors
□ No file contains the string "http://localhost:3001"
□ No file contains the string "mockData"
□ api.js BASE constant is "/api" not a full URL

VISUAL LAYER:
□ grep -r "#[0-9a-fA-F]{6}" src/ returns zero results (except index.css comments)
□ App.css does not exist
□ tailwindcss devserver compiles without errors
□ All token variables resolve in browser DevTools :root

ACCESSIBILITY LAYER:
□ Inter font loads from Google Fonts or local (check network tab)
□ Body text color-contrast: --foreground on --background = oklch(0.20) on oklch(0.985) → passes 4.5:1
□ --muted-foreground oklch(0.50) on white: verify contrast ratio ≥ 4.5:1 using browser DevTools
```

**PASS CRITERIA:** All 10 checks pass. Zero hardcoded colors. apiFetch wrapper exists and is importable.

---

### S1-T2 — Fix SubcontractorTable.jsx Production Bug

**What this task does:** Fixes the critical production bug on line 6 of `SubcontractorTable.jsx` where `const API = "http://localhost:3001/api"` will cause all sub-contractor data to fail in any environment other than the developer's local machine.

**Files changed:**
- `src/components/SubcontractorTable.jsx` — lines 6 and all `${API}/...` usages

---

**🎨 UI/UX Agent — S1-T2 Design Specification:**

No visual changes. This is a pure data-layer fix. Confirm the component still renders identically after the fix. Verify the loading state, error state, and expanded row state all render using token-based classes only (audit `SubcontractorTable.jsx` for any remaining hardcoded colors and flag them for the Dev agent to fix in the same task).

---

**🔧 Senior Dev Agent — S1-T2 Implementation:**

```
1. Open src/components/SubcontractorTable.jsx

2. Remove line 6: const API = "http://localhost:3001/api";

3. Add at top of file: import { apiFetch } from "../lib/api.js";

4. Find every usage of:
   fetch(`${API}/...`)
   and replace with:
   apiFetch("/...")

5. The apiFetch wrapper handles Content-Type and error throwing.
   Update any .then(res => res.json()) chains to remove the .json() call
   since apiFetch already returns parsed JSON.

6. While in this file, audit ALL className strings.
   Replace any hardcoded color values with token equivalents:
   - #e5e7eb  → border-border
   - #6b7280  → text-muted-foreground  
   - #16a34a  → text-success
   - #dc2626  → text-destructive
   - background red/green inline styles → use badge token classes
```

---

**🧪 Testing Agent — S1-T2 Test Gate:**

```
DATA LAYER:
□ grep "localhost" src/components/SubcontractorTable.jsx → 0 results
□ grep "const API" src/components/SubcontractorTable.jsx → 0 results
□ Open browser DevTools Network tab → all sub-contractor fetches go to /api/... (relative)
□ With backend running: expand a project → sub-contractor table loads real data

VISUAL LAYER:
□ grep "#[0-9a-fA-F]" src/components/SubcontractorTable.jsx → 0 results
□ Loading spinner visible during fetch
□ Error state shows user-readable message (not a raw error object)

ACCESSIBILITY LAYER:
□ Table has <caption> or aria-label
□ Expandable rows: expand button has aria-expanded="true/false"
□ Lazy-loaded content area has aria-live="polite"
```

**PASS CRITERIA:** No localhost URL in SubcontractorTable.jsx. Real data loads in network tab. Zero hardcoded colors.

---

### S1-T3 — React Router v6 Setup + Route Tree

**What this task does:** Installs React Router v6 and creates the complete route tree defined in the Route Architecture section. Replaces all `window.location` and `selectedProject` state-based routing. The app shell is registered at the root route.

**Files changed:**
- `package.json` — add `react-router-dom`
- `src/main.jsx` — wrap app in `<RouterProvider>`
- `src/router.jsx` — new file, defines `createBrowserRouter` with all routes
- `src/App.jsx` — becomes the root layout component only (AppShell wrapper)

---

**🎨 UI/UX Agent — S1-T3 Design Specification:**

Define the `AppShell` layout — adapted directly from `lovable-example-app/AppShell.tsx` to React JSX:

**Layout zones:**
- Global header: `h-12 flex items-center gap-4 border-b border-border bg-card px-4 shrink-0`
  - Left: Logo mark `h-6 w-6 rounded bg-primary text-primary-foreground grid place-items-center text-[11px] font-bold` with text "IR" + app name "InvoiceReview"
  - Center: Breadcrumb — Contract name / Period — `text-xs text-muted-foreground` with `/` separators
  - Center pill: Status badge using badge token system
  - Right: Bell icon (notifications placeholder) + avatar circle
- Nav rail: `w-14 shrink-0 border-r border-border bg-card flex flex-col items-center py-3 gap-1`
  - Items: Packages (FileStack icon), Contracts (FolderKanban), Reports (Layers), Settings (Settings)
  - Active item: `bg-primary/10 text-primary`
  - Inactive: `text-muted-foreground hover:bg-muted hover:text-foreground`
  - Each item: `w-11 py-2 rounded-md flex flex-col items-center gap-0.5 text-[10px]`
- Main content: `flex-1 min-w-0 overflow-auto` — all page content renders here

**WCAG requirements:**
- Nav landmark: `<nav aria-label="Main navigation">`
- Header: `<header role="banner">`
- Main: `<main id="main-content">`
- Skip link: `<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-1.5 focus:text-sm focus:shadow-md">Skip to content</a>`

---

**🔧 Senior Dev Agent — S1-T3 Implementation:**

```
1. npm install react-router-dom

2. Create src/router.jsx:
import { createBrowserRouter } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import GlobalDashboard from "./pages/GlobalDashboard.jsx";
import PackageIntakeWizard from "./pages/PackageIntakeWizard.jsx";
import PackageLayout from "./pages/PackageLayout.jsx";
import IngestScreen from "./pages/IngestScreen.jsx";
import File1Screen from "./pages/File1Screen.jsx";
import PlanScreen from "./pages/PlanScreen.jsx";
import File2Screen from "./pages/File2Screen.jsx";
import CompleteScreen from "./pages/CompleteScreen.jsx";
import ExceptionsScreen from "./pages/ExceptionsScreen.jsx";
import HITLScreen from "./pages/HITLScreen.jsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <GlobalDashboard /> },
      { path: "packages/new", element: <PackageIntakeWizard /> },
      {
        path: "packages/:id",
        element: <PackageLayout />,
        children: [
          { path: "ingest", element: <IngestScreen /> },
          { path: "file1", element: <File1Screen /> },
          { path: "plan", element: <PlanScreen /> },
          { path: "file2", element: <File2Screen /> },
          { path: "complete", element: <CompleteScreen /> },
          { path: "exceptions", element: <ExceptionsScreen /> },
          { path: "hitl", element: <HITLScreen /> },
        ],
      },
    ],
  },
]);

3. Update src/main.jsx:
import { RouterProvider } from "react-router-dom";
import { router } from "./router.jsx";
root.render(<RouterProvider router={router} />);

4. Create src/components/AppShell.jsx adapted from lovable-example-app/AppShell.tsx:
   - Convert TS types to JSX prop defaults
   - Replace useParams from TanStack with useParams from react-router-dom
   - Replace useRouterState with useLocation from react-router-dom
   - Replace Link from TanStack with Link from react-router-dom
   - Remove the packages.find() mock data lookup entirely — AppShell receives
     contractName, period, statusLabel, statusTone as props from each page

5. Create src/pages/PackageLayout.jsx:
import { Outlet } from "react-router-dom";
export default function PackageLayout() { return <Outlet />; }

6. Stub every page file with a placeholder that shows the route name:
   export default function GlobalDashboard() { return <div className="p-8 text-foreground">GlobalDashboard — TODO</div>; }
   (These get replaced in S1-T4 and Sprint 2)

7. BANNED patterns — do NOT use:
   window.location.href = ...
   window.location.pathname
   selectedProject state for routing
   Any navigation that is not <Link> or useNavigate()
```

---

**🧪 Testing Agent — S1-T3 Test Gate:**

```
DATA LAYER:
□ Navigate to / → renders without crash
□ Navigate to /packages/new → renders without crash
□ Navigate to /packages/test-id/ingest → renders without crash
□ Browser back button works correctly on all routes
□ Refreshing /packages/test-id/ingest does NOT redirect to /

VISUAL LAYER:
□ AppShell renders: header visible, nav rail visible, main content area visible
□ Active nav item shows bg-primary/10 text-primary state
□ Skip link is invisible by default, visible on Tab keypress

ACCESSIBILITY LAYER:
□ <header> element exists with role="banner" (implicit from header tag)
□ <nav> has aria-label="Main navigation"
□ <main> has id="main-content"
□ Skip link href="#main-content" works (focus jumps to main)
□ All nav links are keyboard-navigable with visible focus ring
```

**PASS CRITERIA:** All routes load without crash. Browser navigation works. AppShell renders with correct landmark structure.

---

### S1-T4 — GlobalDashboard (Package List from Live API)

**What this task does:** Builds the `GlobalDashboard` page — the app's home screen. Displays all projects from `GET /api/projects` as package cards. Replaces `ProjectTiles.jsx` and `Sidebar.jsx`. The "New Package" button navigates to `/packages/new`.

**Files changed:**
- `src/pages/GlobalDashboard.jsx` — full implementation
- `src/components/PackageCard.jsx` — new component (project tile)
- Retire: `Sidebar.jsx`, `ProjectTiles.jsx` (delete files)

---

**🎨 UI/UX Agent — S1-T4 Design Specification:**

**Page layout:** `p-8` padding, max-w unconstrained, flex column gap-6

**Header zone:**
```
flex items-center justify-between mb-6
  h1: "Packages" — text-xl font-semibold tracking-tight text-foreground
  Button (primary): "+ New Package" → navigates to /packages/new
```

**Package card grid:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`

**PackageCard component layout:**
```
rounded-lg border border-border bg-card p-5 hover:shadow-sm transition-shadow cursor-pointer
  Top row: contract name (text-sm font-semibold) + status badge (right-aligned)
  Row 2: period — text-xs text-muted-foreground (e.g. "June 2026")
  Row 3: three phase status dots with labels (Phase 1/2/3 — done/running/pending)
  Bottom: "Open →" link — text-xs text-primary hover:underline
```

**Status badge mapping** (from `project.status` or derived from phases):
- All phases complete → success badge "Complete"
- Any phase running → info badge "Processing"
- Phase 1 pending → neutral badge "Not started"
- Any phase error → destructive badge "Error"

**Empty state:**
```
flex flex-col items-center justify-center py-24 gap-4
  FileStack icon h-12 w-12 text-muted-foreground/30
  "No packages yet" — text-sm font-medium text-muted-foreground
  "Create your first monthly package to get started" — text-xs text-muted-foreground
  Button (primary): "+ New Package"
```

**Loading skeleton** (while fetch is in flight):
- 6 skeleton cards: `rounded-lg border border-border bg-card p-5 animate-pulse`
- Each skeleton card: two grey rounded bars (h-4 w-32, h-3 w-20) simulating text

**WCAG:**
- Each card is a `<article>` element
- Card heading is `<h2>` (contract name)
- Pagination or scroll: if >20 projects, add `aria-label="Load more packages"` button
- `aria-busy="true"` on the grid during loading

---

**🔧 Senior Dev Agent — S1-T4 Implementation:**

```javascript
// src/pages/GlobalDashboard.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileStack } from "lucide-react";
import { apiFetch } from "../lib/api.js";
import PackageCard from "../components/PackageCard.jsx";

export default function GlobalDashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/projects")
      .then(setProjects)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return (
    <div className="p-8 text-sm text-destructive" role="alert">{error}</div>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Packages</h1>
        <button
          onClick={() => navigate("/packages/new")}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          + New Package
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading packages">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-5 animate-pulse">
              <div className="h-4 w-32 bg-muted rounded mb-2" />
              <div className="h-3 w-20 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        /* empty state */
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => <PackageCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  );
}

// API contract: GET /api/projects returns array of:
// { id, name, baseline, pdf_path, created_at }
// Phase status must come from GET /api/projects/:id/phases — fetch per-card on mount
```

---

**🧪 Testing Agent — S1-T4 Test Gate:**

```
DATA LAYER:
□ Network tab shows GET /api/projects request (relative URL)
□ Each card displays real project.name from the API response
□ No card contains the string "Test Project", "Demo", "Mock", or any hardcoded name
□ With 0 projects in DB: empty state renders
□ With backend offline: error message renders (not a blank screen)
□ Delete project from DB → refresh → card disappears

VISUAL LAYER:
□ Grid is responsive: 1 col on 400px, 2 col on 768px, 3 col on 1280px
□ Loading skeleton animates correctly
□ Status badge color matches project state (no static "Processing" on completed projects)
□ No hardcoded colors in PackageCard.jsx or GlobalDashboard.jsx

ACCESSIBILITY LAYER:
□ Each card is <article> with <h2> for contract name
□ aria-busy="true" present during loading, removed after
□ "+ New Package" button keyboard accessible, focus ring visible
□ Error message has role="alert"
```

**PASS CRITERIA:** Real projects appear from `/api/projects`. Empty state renders when DB empty. Error state renders when backend is down.

---

### S1-T5 — Sprint 1 Token Audit + Regression Test

**What this task does:** A dedicated testing pass at the end of Sprint 1. The Testing Agent scans the entire `src/` directory and confirms zero regressions from the foundation work. This is the Sprint 1 "definition of done" gate.

**No new code is written.** Dev agent fixes any issues the Testing Agent finds.

---

**🧪 Testing Agent — S1-T5 Full Sprint Audit:**

```
FULL CODEBASE SCAN:
□ grep -r "http://localhost" src/ → 0 results
□ grep -r "window.location" src/ → 0 results  
□ grep -r "mockData\|mock_data\|fakeData" src/ → 0 results
□ grep -rE "#[0-9a-fA-F]{6}" src/ → 0 results (excluding comments in index.css)
□ grep -r "\.btn-\|\.ws-btn-\|\.jbtn-" src/ → 0 results
□ grep -r "dark:" src/ → 0 results (no dark mode classes)

ROUTING:
□ / loads GlobalDashboard with real projects
□ /packages/new → 404 or stub (PackageIntakeWizard not yet built — expected)
□ /packages/:id/ingest → stub renders without crash

VISUAL REGRESSION:
□ AppShell header renders at exactly h-12
□ Nav rail renders at exactly w-14
□ Primary button color matches --primary token in DevTools
□ No layout overflow or horizontal scroll on 1280px viewport

ACCESSIBILITY FULL SWEEP:
□ Axe DevTools browser extension: 0 critical violations on / route
□ Keyboard navigation: Tab through entire dashboard without mouse — all interactive elements reachable
□ Screen reader test: VoiceOver or NVDA reads "Packages, heading level 1" on dashboard
```

**Sprint 1 SHIP CRITERIA:** All 20+ checks pass. Zero hardcoded anything. Real data everywhere.

---

## Sprint 2 — Processing Pipeline (Weeks 3–4)

**Sprint Goal:** Build the complete package intake and agent processing flow — screens 1 through 6 of the L2 User Journey. At the end of Sprint 2, a reviewer can upload 3 PDFs, watch the agent progress rail update in real time from live polling, and confirm the sub-contractor plan before File 2 extraction begins.

**Sprint 2 Acceptance Criteria:**
- `POST /api/projects` creates a real project in the database
- `POST /api/projects/:id/upload-pdf` uploads the PDF and returns
- `GET /api/projects/:id/phases` drives the StepRail with no mock state
- The HITL Gate (Plan Screen) calls `GET /api/projects/:id/line-items?work_completed_this=nonzero` and displays real sub-contractor names
- Phase polling stops when all phases reach `complete` or `error`

---

### S2-T1 — PackageIntakeWizard (Screen 1 — New Package)

**What this task does:** Replaces `NewProjectModal.jsx` with a full-page intake wizard. The user selects a billing period, selects a contract, and uploads 1–3 PDF files. On submit, creates a project via `POST /api/projects` and uploads File 1 via `POST /api/projects/:id/upload-pdf`, then navigates to `/packages/:id/ingest`.

**Files changed:**
- `src/pages/PackageIntakeWizard.jsx` — new page
- `src/components/FileZone.jsx` — drag-and-drop upload zone (new, from lovable pattern)
- Retire: `src/components/NewProjectModal.jsx`

---

**🎨 UI/UX Agent — S2-T1 Design Specification:**

Adapt directly from `lovable-example-app/packages.new.tsx`. Convert TS to JSX.

**Page layout:** `p-8` · `max-w-[720px] mx-auto`

**Card structure:**
```
rounded-lg border border-border bg-card
  Header (border-b border-border p-5):
    h1: "Start New Monthly Package" — text-lg font-semibold
    Step indicator: "Step 1 of 1" — text-xs text-muted-foreground
  Body (p-5 space-y-6):
    Grid 2 cols: Billing Period selector + Contract selector
    File upload zones (3 stacked, each h-[88px]):
      - File 1 (required): "Consolidated / Summary Invoice" — GC Cover Page + Continuation Sheet
      - File 2 (optional): "Sub-Contractor Breakdown" — All sub-contractor invoices compiled
      - File 3 (optional): "Supporting Documents" — Direct cost backup
    Footer: Back link (left) + "Begin Processing →" primary button (right)
```

**FileZone component states:**
- Empty: dashed border (`border-dashed border-border`) + upload icon + filename label + "required" / "optional" pill
- Drag-over: `border-primary bg-primary/5`
- Uploaded: solid border + check icon + filename + file size + remove ×
- Error: `border-destructive bg-destructive/5` + error message

**"Begin Processing" button:** Disabled until File 1 is uploaded. Show `opacity-50 pointer-events-none` when disabled.

**WCAG:**
- File input: `<input type="file" accept=".pdf" aria-label="Upload File 1 — Consolidated Invoice">`
- Each zone: `role="region" aria-label="File 1 upload zone"`
- Upload progress: `aria-live="polite"` wrapping the zone status
- Required indicator: `aria-required="true"` on File 1 select/zone

---

**🔧 Senior Dev Agent — S2-T1 Implementation:**

```javascript
// src/pages/PackageIntakeWizard.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api.js";
import FileZone from "../components/FileZone.jsx";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(String);

export default function PackageIntakeWizard() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [contract, setContract] = useState("");
  const [files, setFiles] = useState({ f1: null, f2: null, f3: null });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!files.f1 || !contract) return;
    setSubmitting(true);
    setError(null);
    try {
      // Step 1: Create project record
      const project = await apiFetch("/projects", {
        method: "POST",
        body: JSON.stringify({ name: contract, baseline: `${month} ${year}` }),
      });
      // Step 2: Upload File 1 PDF
      const formData = new FormData();
      formData.append("pdf", files.f1.raw);
      await fetch(`/api/projects/${project.id}/upload-pdf`, {
        method: "POST",
        body: formData,  // No Content-Type header — browser sets multipart boundary
      });
      // Step 3: Navigate to processing screen
      navigate(`/packages/${project.id}/ingest`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  // NOTE: contracts list should come from GET /api/contracts if that endpoint exists,
  // or from GET /api/projects distinct baseline values. Do NOT hardcode contract names.
  // For Sprint 2, use a text input for contract name if no contracts endpoint exists.

  return (/* JSX implementing the UI/UX spec above */);
}
```

---

**🧪 Testing Agent — S2-T1 Test Gate:**

```
DATA LAYER:
□ After submit: GET /api/projects returns the new project in list
□ After submit: DB row exists in projects table with correct name/baseline
□ File is stored on disk: uploads/ directory contains the PDF
□ Navigate to /packages/:newId/ingest without crash
□ If File 1 not uploaded: "Begin Processing" button is disabled (confirm with keyboard)
□ If backend returns 500: error message shown, user stays on wizard page

VISUAL LAYER:
□ FileZone drag-over state: border-primary color change visible
□ Uploaded state: filename and size displayed, × remove button visible
□ Submitting state: button shows loading indicator, is non-interactive
□ No hardcoded file type strings — accept=".pdf" only

ACCESSIBILITY LAYER:
□ File inputs are keyboard-operable (Enter opens file picker)
□ aria-live region announces "File 1 uploaded — GC_Invoice.pdf, 12.4 MB"
□ Error message has role="alert" and is announced by screen reader
□ Modal-free: this is a full page, not a dialog — no role="dialog" needed
```

---

### S2-T2 — StepRail + ActivityFeed (Screens 2–6 — Agent Progress)

**What this task does:** Builds `AgentProgressRail.jsx` (the vertical 9-step left sidebar) and `ActivityFeed.jsx` (the right log pane). Both adapted directly from `lovable-example-app/StepRail.tsx` and `lovable-example-app/ActivityFeed.tsx`. The StepRail polls `GET /api/projects/:id/phases` every 3 seconds. The ActivityFeed polls `GET /api/projects/:id/logs?after=:lastId` for new log entries.

**Files changed:**
- `src/components/AgentProgressRail.jsx` — adapted from StepRail.tsx
- `src/components/ActivityFeed.jsx` — adapted from ActivityFeed.tsx
- Retire: `src/components/OutputPanel.jsx` (developer log — wrong audience)

---

**🎨 UI/UX Agent — S2-T2 Design Specification:**

**AgentProgressRail layout** (directly from StepRail.tsx — adapt only prop names):
```
w-[380px] shrink-0 border-r border-border bg-card p-5 overflow-y-auto
  Header: "Processing" label (text-[11px] uppercase tracking-wider text-muted-foreground)
           + package title (text-sm font-semibold text-foreground)
  Step list (ol space-y-2):
    Each step card — border p-3 rounded-md transition-colors:
      running:  border-primary/40 bg-primary/5
      pause:    border-warning/40 bg-warning/5  ← HITL Gate steps
      done:     border-border bg-background
      error:    border-destructive/40 bg-destructive/5
      pending:  border-dashed border-border bg-background/50
    Step header row: "Step N" label (flex-1) + icon (right)
      done → <Check h-3.5 w-3.5 text-success />
      running → <Loader2 h-3.5 w-3.5 text-primary animate-spin />
      pause → <Pause h-3.5 w-3.5 text-warning />
      error → <AlertCircle h-3.5 w-3.5 text-destructive />
      pending → grey dot
    Step title: text-sm (text-foreground when active, text-muted-foreground when pending)
    Optional detail: text-xs text-muted-foreground
    Optional progress bar: h-1.5 bg-muted overflow-hidden → inner div bg-primary width %
```

**9 steps mapped to `project_phases` table:**

| Step | title | Source |
|---|---|---|
| 1 | File Upload & Receipt | phases.phase_number = 1 |
| 2 | Preliminary Classification | phases.phase_number = 2 |
| 3 | Extract GC Cover + G703 | phases.phase_number = 3, item_count in detail |
| 4 | Agent Plan: Sub-Contractors | phases.phase_number = 4, **status = "pause" at HITL Gate 1** |
| 5 | Extract File 2: Sub-Contractors | phases.phase_number = 5 |
| 6 | Extract File 3: Supporting Docs | phases.phase_number = 6 |
| 7 | Cross-File Reconciliation | phases.phase_number = 7 |
| 8 | Exception Assembly | phases.phase_number = 8 |
| 9 | Ready for Review | phases.phase_number = 9 |

**ActivityFeed layout:**
```
flex-1 min-w-0 p-6 overflow-y-auto
  h2: "Activity" — text-sm font-semibold text-foreground mb-4
  ol space-y-3:
    Each entry: flex gap-3
      Time: w-14 shrink-0 text-[11px] text-muted-foreground pt-0.5
      Icon: 
        ok → Check h-3.5 w-3.5 text-success
        running → Loader2 h-3.5 w-3.5 text-primary animate-spin
        info → grey dot h-2 w-2 rounded-full bg-muted-foreground/50
        warn → amber dot h-2 w-2 rounded-full bg-warning
        err → red dot h-2 w-2 rounded-full bg-destructive
      Content: text text-sm text-foreground + optional meta text-xs text-muted-foreground
  Bottom slot: children (action card, confirm button, etc.)
```

**ActivityFeed must have** `aria-live="polite"` on the `<ol>` so screen readers announce new entries.

---

**🔧 Senior Dev Agent — S2-T2 Implementation:**

```javascript
// Polling pattern for AgentProgressRail (adapted from JourneyPanel.jsx startPolling):
useEffect(() => {
  let isMounted = true;
  const poll = async () => {
    try {
      const phases = await apiFetch(`/projects/${projectId}/phases`);
      if (!isMounted) return;
      setSteps(mapPhasesToSteps(phases));
      const allDone = phases.every(p => p.status === "complete" || p.status === "error");
      if (!allDone) {
        timeoutRef.current = setTimeout(poll, 3000);
      }
    } catch {
      if (isMounted) timeoutRef.current = setTimeout(poll, 5000); // retry on error
    }
  };
  poll();
  return () => { isMounted = false; clearTimeout(timeoutRef.current); };
}, [projectId]);

// Log polling (adapted from OutputPanel.jsx pattern):
// GET /api/projects/:id/logs?after=:lastId
// Append new entries to existing list (never replace)
// lastIdRef.current = entries[entries.length - 1]?.id ?? 0
// Poll every 2 seconds while phases not complete

// mapPhasesToSteps function:
// project_phases.status values → StepRail step.status values:
//   "pending"  → "pending"
//   "running"  → "running"
//   "complete" → "done"
//   "error"    → "error"
//   "pause"    → "pause"    (Step 4 at HITL Gate 1, Step 9 at HITL Gate 2)
```

---

**🧪 Testing Agent — S2-T2 Test Gate:**

```
DATA LAYER:
□ Network tab: /api/projects/:id/phases called every 3 seconds
□ /api/projects/:id/logs?after=0 called every 2 seconds
□ When all phases = "complete": polling stops (no more network requests)
□ When backend returns phase status "running": Loader2 spinner renders on that step
□ When phase status "pause": Pause icon renders, step card shows warning styling
□ Log entries append (do not replace) on each poll cycle

VISUAL LAYER:
□ Rail width is exactly 380px — does not shrink on small viewport
□ Progress bar width changes when phase item_count is populated
□ "Step 4" in pause state shows border-warning/40 bg-warning/5 (not primary)
□ ActivityFeed time column is 56px wide (w-14)

ACCESSIBILITY LAYER:
□ <ol aria-live="polite"> on ActivityFeed — new entries announced
□ AgentProgressRail <ol> has aria-label="Processing steps"
□ Each step <li> has aria-label="Step N: [title], status: [status]"
□ Spinner has aria-label="Loading" (or screen-reader-only text)
```

---

### S2-T3 — IngestScreen + File1Screen (Screens 2–3)

**What this task does:** Builds the two screens shown while the agent processes File 1. `IngestScreen` triggers `POST /api/projects/:id/run-pipeline` and shows the StepRail in steps 1–2 running. `File1Screen` shows steps 1–3 running with a G702 cover page preview panel from `GET /api/projects/:id/cover-page`, plus a "Continue to Agent Plan →" button that navigates to `/packages/:id/plan` when step 3 is `complete`.

**Files changed:**
- `src/pages/IngestScreen.jsx`
- `src/pages/File1Screen.jsx`

---

**🎨 UI/UX Agent — S2-T3 Design Specification:**

**IngestScreen layout:**
```
flex h-full (fills the AppShell main content area)
  <AgentProgressRail projectId={id} /> (left, 380px)
  <ActivityFeed entries={logs} projectId={id}> (flex-1)
    Bottom slot: confirmation card (rounded-lg border border-border bg-card p-4)
      "Preliminary check complete" — text-sm font-medium
      "All N files parsed. Detected G702/G703 in File 1. Ready to extract." — text-xs text-muted-foreground
      CTA button right-aligned: "Confirm & Extract File 1 →" (primary button)
      Button only enabled when phase 2 = "complete", disabled with loading state otherwise
  </ActivityFeed>
```

**File1Screen layout:**
```
flex h-full
  <AgentProgressRail projectId={id} /> (same component, re-used)
  <ActivityFeed entries={logs} projectId={id}>
    Bottom slot: G702 Cover preview card
      Header: "G702 Cover — Preview" — overline style
      2-col grid of KV pairs from cover_page table:
        "Contract sum" | "Application no."
        "Period"       | "Work completed to date"
        "Retainage"    | "This period"
      All values: text-sm tabular-nums font-medium
      CTA right-aligned: "Continue to Agent Plan →" (primary button)
        Enabled when phase 3 = "complete"
  </ActivityFeed>
```

---

**🔧 Senior Dev Agent — S2-T3 Implementation:**

```javascript
// IngestScreen: trigger pipeline on mount
useEffect(() => {
  apiFetch(`/projects/${id}/run-pipeline`, { method: "POST" })
    .catch(err => setError(err.message));
}, [id]);
// Note: run-pipeline is idempotent — safe to call on mount even if already running

// File1Screen: fetch cover page data
const [cover, setCover] = useState(null);
useEffect(() => {
  apiFetch(`/projects/${id}/cover-page`).then(setCover).catch(setError);
}, [id]);

// Phase 3 completion check: read from AgentProgressRail's polling
// Pass onPhaseComplete callback or use shared state
// Simplest approach: IngestScreen polls phases independently, enables CTA when phase 2 done
// File1Screen enables CTA when phase 3 done

// Cover page field mapping (from cover_page table):
// contract_sum, application_no, period, work_completed_to_date, retainage, this_period
```

---

**🧪 Testing Agent — S2-T3 Test Gate:**

```
DATA LAYER:
□ IngestScreen: POST /api/projects/:id/run-pipeline called on mount (Network tab)
□ File1Screen: GET /api/projects/:id/cover-page called and values displayed
□ "Contract sum" shows real number from DB, not placeholder
□ "Continue to Agent Plan →" disabled until phase 3 = "complete"
□ "Continue" button navigates to /packages/:id/plan (no window.location)

VISUAL LAYER:
□ Cover page KV values use tabular-nums class
□ StepRail step 3 shows Loader2 spinner while running
□ StepRail step 3 shows Check when complete

ACCESSIBILITY LAYER:
□ Cover page KV grid: each label is <dt>, each value is <dd> in a <dl>
□ CTA button aria-disabled="true" when phase 3 not complete
```

---

### S2-T4 — PlanScreen (Screen 4 — HITL Gate 1: Sub-Contractor Plan)

**What this task does:** Builds the HITL Gate 1 screen — the most critical user interaction in the workflow. The agent has identified which sub-contractors have work this period (`work_completed_this != 0`). The reviewer sees the list, can add/remove/edit rows, and confirms before File 2 extraction begins. Adapted directly from `lovable-example-app/packages.$id.plan.tsx`.

**Files changed:**
- `src/pages/PlanScreen.jsx`
- Backend: No changes needed — `GET /api/projects/:id/line-items` already returns all data including `contractor_name` and `work_completed_this`. Frontend filters `work_completed_this != 0`.

---

**🎨 UI/UX Agent — S2-T4 Design Specification:**

**CRITICAL RULE:** This screen pauses the agent. Step 4 in the StepRail must show `status = "pause"` with `border-warning/40 bg-warning/5`. Do NOT advance until the user clicks "Confirm & Begin File 2 Extraction →".

**Page layout:** `p-8` · `max-w-[1100px] mx-auto`

**Header:**
```
h1: "Agent Plan — Sub-Contractors" — text-xl font-semibold tracking-tight
p: "The agent identified N sub-contractors with work this period. Confirm the list
    or edit before extraction begins on File 2." — text-sm text-muted-foreground mt-1
Warning badge: "HITL Gate · Human confirmation required" 
  → bg-warning/10 text-warning border border-warning/20 rounded-full px-3 py-1 text-xs
```

**Sub-contractor table:**
```
rounded-lg border border-border bg-card overflow-hidden
  Column headers (5 cols): [80px Code] [flex Name] [160px Trade] [140px File 1 Value] [60px actions]
  Header row: text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30 px-4 py-2.5
  Each data row: grid with 5 cols, px-4 py-2.5 border-b last:border-0 hover:bg-muted/30
    Code: <input bg-transparent font-mono text-xs focus:ring-1 focus:ring-primary>
    Name: <input flex-1 bg-transparent focus:ring-1 focus:ring-primary>
    Trade: <input bg-transparent focus:ring-1 focus:ring-primary>
    File 1 Value: text-right tabular-nums (display only, not editable)
    Delete: <button opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive aria-label="Remove sub-contractor">
  Add row button: w-full flex items-center justify-center gap-1.5 py-3 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5
```

**Footer:**
```
mt-6 flex justify-between
  Left: "← Go back" ghost link
  Right: "Confirm & Begin File 2 Extraction →" primary button
```

---

**🔧 Senior Dev Agent — S2-T4 Implementation:**

```javascript
// src/pages/PlanScreen.jsx
// Data source: GET /api/projects/:id/line-items
// Filter client-side: items where work_completed_this !== 0 and work_completed_this !== "0"
// Group by contractor_name to get the sub-contractor list
// Each row: { code: item.item_no, name: item.contractor_name, 
//             trade: item.description, file1Value: item.scheduled_value }

const [rows, setRows] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  apiFetch(`/projects/${id}/line-items`)
    .then(items => {
      // Filter: only items where work_completed_this is nonzero
      const active = items.filter(i => 
        i.work_completed_this && parseFloat(i.work_completed_this) !== 0
      );
      // Deduplicate by contractor_name
      const seen = new Set();
      const subs = active.filter(i => {
        if (!i.contractor_name || seen.has(i.contractor_name)) return false;
        seen.add(i.contractor_name);
        return true;
      }).map(i => ({
        code: i.item_no ?? "—",
        name: i.contractor_name,
        trade: i.description ?? "—",
        file1Value: parseFloat(i.work_completed_this) || 0,
        added: false,
      }));
      setRows(subs);
    })
    .catch(setError)
    .finally(() => setLoading(false));
}, [id]);

// On "Confirm & Begin File 2 Extraction →":
const handleConfirm = async () => {
  setSubmitting(true);
  await apiFetch(`/projects/${id}/run-subcontractor-extraction`, { method: "POST" });
  navigate(`/packages/${id}/file2`);
};
```

---

**🧪 Testing Agent — S2-T4 Test Gate:**

```
DATA LAYER:
□ Network tab: GET /api/projects/:id/line-items called
□ Only rows with work_completed_this != 0 appear in the table
□ Rows with work_completed_this = 0 or null do NOT appear
□ "Confirm" button: calls POST /api/projects/:id/run-subcontractor-extraction
□ After confirm: navigates to /packages/:id/file2
□ Edit inline: changes to Code/Name/Trade are preserved in local state (these are UI edits only — no PATCH to backend, by design)

VISUAL LAYER:
□ StepRail step 4 shows pause icon + warning color (not running/done)
□ Warning "HITL Gate" badge visible in page header
□ Add row: new row appears immediately with editable inputs
□ Delete row: row removed immediately with hover interaction

ACCESSIBILITY LAYER:
□ Each <input> in the table has aria-label="Sub-contractor [field] [row N]"
□ Delete button aria-label="Remove [name]"
□ Confirm button aria-label="Confirm sub-contractor plan and begin File 2 extraction"
□ "Added by you" badge has aria-label meaning explained
```

---

### S2-T5 — File2Screen + Sprint 2 Integration Test (Screens 5–6)

**What this task does:** Builds the File2Screen — the auto-running extraction of sub-contractor invoices. No user action required on this screen. Adapted from `lovable-example-app/packages.$id.file2.tsx`. Also runs a full Sprint 2 end-to-end integration test.

**Files changed:**
- `src/pages/File2Screen.jsx`

---

**🎨 UI/UX Agent — S2-T5 Design Specification:**

```
Same flex h-full layout: StepRail (left 380px) + ActivityFeed (right flex-1)
  Steps 5–6 show "running" status
  ActivityFeed shows real-time log messages for each sub-contractor as it's processed:
    ok:   "ABC Structural Steel — Extracted · $250,000"
    warn: "Ironclad Rebar Co — Variance detected · File 1: $92.1K · File 2: $95.5K"
    err:  "GreenLine Site Services — OCR failed on page 33 · retrying"
    running: "[Sub name] — extracting…"
  Bottom slot: dashed-border info card:
    "No action required. This view auto-advances when extraction completes."
    Link: "Skip to Complete Summary →" (text-primary hover:underline)
  Auto-navigate to /packages/:id/complete when phase 8 = "complete"
```

---

**🔧 Senior Dev Agent — S2-T5 Implementation:**

```javascript
// File2Screen.jsx — polling auto-navigates when extraction complete
useEffect(() => {
  let timeout;
  const check = async () => {
    const phases = await apiFetch(`/projects/${id}/phases`);
    const phase8 = phases.find(p => p.phase_number === 8);
    if (phase8?.status === "complete") {
      navigate(`/packages/${id}/complete`);
    } else if (phase8?.status !== "error") {
      timeout = setTimeout(check, 3000);
    }
  };
  check();
  return () => clearTimeout(timeout);
}, [id, navigate]);
```

---

**🧪 Testing Agent — S2-T5 + Full Sprint 2 Integration Test:**

```
FILE2SCREEN:
□ Page shows StepRail + ActivityFeed with real log data
□ Auto-navigates to /packages/:id/complete when phase 8 complete
□ No user action required (no buttons except Skip link)

SPRINT 2 END-TO-END:
□ Full journey: / → "New Package" → /packages/new → fill form → upload PDF →
  → /packages/:id/ingest → confirm → /packages/:id/file1 → cover page shows →
  → /packages/:id/plan → sub list from real DB → confirm → /packages/:id/file2 →
  → auto-advance to /packages/:id/complete
□ Each step: network request visible in DevTools
□ Zero mock data anywhere in Sprint 2 components
□ StepRail updates in real time at each screen (polling works)
□ HITL Gate 1 (Plan): user cannot proceed until sub list is confirmed (button state)
```

---

## Sprint 3 — Validation Workbench (Weeks 5–6)

**Sprint Goal:** Build the complete exception review and HITL confirmation flow — screens 7–8 of the L2 User Journey. At the end of Sprint 3, a reviewer can view the exception navigator, open individual exceptions alongside the PDF evidence, resolve exceptions one-by-one or in bulk, and confirm the package at the final HITL gate.

**Sprint 3 Acceptance Criteria:**
- `GET /api/projects/:id/line-items` drives the exceptions list with real validation_status data
- PDF evidence renders from `GET /api/projects/:id/pdf/pages?from=&to=&src=` (not an iframe)
- `POST /api/projects/:id/validate-ai` triggers real AI validation
- `POST /api/projects/:id/validate-ai/item/:iid` re-validates individual rows
- HITL Gate 2 (HITLScreen) is the absolute final user action — no auto re-validation after this point

---

### S3-T1 — CompleteScreen (Screen 6 — Processing Summary)

**What this task does:** Builds the `CompleteScreen` — the summary view shown when all agent processing is done. Shows 4 stat cards (Extracted, Auto-cleared, Exceptions, $ at Risk) and an exception type breakdown. Adapted from `lovable-example-app/packages.$id.complete.tsx`. All stats come from real API data.

**Files changed:**
- `src/pages/CompleteScreen.jsx`

---

**🎨 UI/UX Agent — S3-T1 Design Specification:**

Directly from `lovable-example-app/packages.$id.complete.tsx`. Adapt to JSX:

```
p-8 · max-w-[820px] mx-auto
  rounded-lg border border-border bg-card overflow-hidden
    Header (p-6 border-b):
      Success badge: "All Steps Complete" — bg-success/10 text-success
      h1: "[contract] · [period]" — text-xl font-semibold tracking-tight mt-3
      p: "Ready for review. Auto-cleared items have been recorded to the audit trail."
    Stat bar (4-col grid, border-b):
      Stat 1: "Extracted" — value from line_items count
      Stat 2: "Auto-cleared" — text-success — items with validation_status = "ok"
      Stat 3: "Exceptions" — text-warning — items with validation_status = "error"/"warn"
      Stat 4: "$ at Risk" — text-destructive — sum of amounts for exception items
    Exception breakdown (p-6):
      h3: "Exceptions by type" — overline style
      list: ExceptionRow per validation category
      CTA: "Begin Review →" primary button → /packages/:id/exceptions
```

**Stat component:**
```
p-4 border-r border-border last:border-0
  label: text-[11px] uppercase tracking-wider text-muted-foreground
  value: text-2xl font-semibold tabular-nums mt-1 [tone color]
```

---

**🔧 Senior Dev Agent — S3-T1 Implementation:**

```javascript
// Derive all stats from real API calls:
// GET /api/projects/:id/line-items → count, filter by validation_status
// GET /api/projects/:id/cover-page → contract name, period
// GET /api/projects/:id/validation-summary → aggregated stats if available

useEffect(() => {
  Promise.all([
    apiFetch(`/projects/${id}/line-items`),
    apiFetch(`/projects/${id}/cover-page`),
  ]).then(([items, cover]) => {
    const total = items.length;
    const cleared = items.filter(i => i.validation_status === "ok").length;
    const exceptions = items.filter(i => 
      i.validation_status === "error" || i.validation_status === "warning"
    ).length;
    const atRisk = items
      .filter(i => i.validation_status === "error")
      .reduce((sum, i) => sum + (parseFloat(i.work_completed_this) || 0), 0);
    setStats({ total, cleared, exceptions, atRisk, cover });
  });
}, [id]);
```

---

**🧪 Testing Agent — S3-T1 Test Gate:**

```
DATA LAYER:
□ "Extracted" count matches SELECT COUNT(*) FROM line_items WHERE project_id = :id
□ "Auto-cleared" matches count of items with validation_status = "ok"
□ "Exceptions" count matches DB
□ "$ at Risk" total matches sum from DB
□ All values are real numbers (no "—", "N/A", or placeholder strings)
□ "Begin Review →" navigates to /packages/:id/exceptions

VISUAL LAYER:
□ Stat bar is 4-col grid even on narrow screens (no wrapping)
□ Financial values use tabular-nums
□ Exception row dots use correct color tokens (destructive/warning/caution)
```

---

### S3-T2 — ExceptionsScreen (Screen 7 — Exception Navigator)

**What this task does:** The main validation workbench. Three-pane layout: (1) exception category navigator (left 280px), (2) data grid for selected category (center flex), (3) context/evidence panel (right — collapsed by default, opens on row click). Adapted from `lovable-example-app/packages.$id.exceptions.tsx`.

**Files changed:**
- `src/pages/ExceptionsScreen.jsx`
- `src/components/ExceptionNavigator.jsx` (left pane)
- Enhance: `src/components/DataTable.jsx` (add checkbox, bulk accept, per-row re-validate)

---

**🎨 UI/UX Agent — S3-T2 Design Specification:**

**Full-screen layout:** `flex flex-col h-full`

**Top action bar:** `flex justify-end px-4 py-2 border-b border-border bg-card`
  - Right: "Mark Ready for Approval →" primary button → /packages/:id/hitl

**Content area:** `flex flex-1 min-h-0`

**Left — Exception Navigator (280px):**
```
w-[280px] shrink-0 border-r border-border bg-card overflow-y-auto p-3 space-y-2
  Category buttons (one per exception group):
    active: border-primary/50 bg-primary/5
    inactive: border-border bg-background hover:bg-muted/40
    Each: 
      top row: group label (text-sm font-medium) + check icon when all resolved
      line 2: "N items · $X" text-xs text-muted-foreground
      progress dots: h-1.5 w-1.5 dots — green if resolved, color if not
```

**Exception categories** (derived from `line_items.validation_status` + `validation_note`):
- Math errors (validation_note contains "math")
- File 1 vs File 2 variance (validation_note contains "variance")
- Low confidence OCR (validation_note contains "ocr" or "confidence")
- Missing evidence (validation_note contains "evidence" or "missing")

**Center — Data Grid (flex-1):**
```
Section header: exception group label + "Select all" + "Bulk accept" button
Table (sticky header):
  Columns: □ checkbox | Sub | Description | File 1 | File 2 | Variance | Action
  Row: hover:bg-muted/30, resolved rows: text-muted-foreground line-through opacity-60
  Action cell: two buttons (per-row):
    Accept: "Accept" ghost button text-xs
    Re-validate: "↺" ghost button text-xs → POST /validate-ai/item/:iid
```

**Right — Evidence Pane (0px collapsed, 480px when open):**
```
Opens when user clicks a row
Contains EvidenceViewer component (built in S3-T3)
Close button top-right
```

---

**🔧 Senior Dev Agent — S3-T2 Implementation:**

```javascript
// Data source: GET /api/projects/:id/line-items
// Filter: items where validation_status = "error" or "warning"
// Group by validation_note category

const [items, setItems] = useState([]);
const [resolvedIds, setResolvedIds] = useState(new Set());
const [selectedIds, setSelectedIds] = useState(new Set());
const [activeCategory, setActiveCategory] = useState(null);
const [activeItem, setActiveItem] = useState(null);

useEffect(() => {
  apiFetch(`/projects/${id}/line-items`)
    .then(all => {
      const exceptions = all.filter(i => 
        i.validation_status === "error" || i.validation_status === "warning"
      );
      setItems(exceptions);
      if (exceptions.length > 0) setActiveCategory(categorize(exceptions[0]));
    });
}, [id]);

// Per-row re-validate:
const revalidateItem = async (itemId) => {
  setRevalidating(prev => new Set([...prev, itemId]));
  await apiFetch(`/projects/${id}/validate-ai/item/${itemId}`, { method: "POST" });
  // Refresh line items to get updated validation_status
  const refreshed = await apiFetch(`/projects/${id}/line-items`);
  setItems(refreshed.filter(i => i.validation_status === "error" || i.validation_status === "warning"));
  setRevalidating(prev => { const s = new Set(prev); s.delete(itemId); return s; });
};

// Bulk accept: mark selected IDs as resolved in local state only
// (Accept = human reviewer signs off, not a backend PATCH — by design)
const bulkAccept = () => {
  setResolvedIds(prev => new Set([...prev, ...selectedIds]));
  setSelectedIds(new Set());
};
```

---

**🧪 Testing Agent — S3-T2 Test Gate:**

```
DATA LAYER:
□ Network: GET /api/projects/:id/line-items called
□ Only exception rows appear (validation_status = error or warning)
□ Per-row re-validate: POST /api/projects/:id/validate-ai/item/:iid called
□ After re-validate: item's validation badge updates to new status
□ Bulk accept: selected items marked resolved in UI (local state)
□ "Mark Ready for Approval →" navigates to /packages/:id/hitl

VISUAL LAYER:
□ Resolved rows: opacity reduced, strikethrough on description
□ Progress dots in navigator update as items are resolved
□ Category "all done" shows Check icon in navigator
□ Evidence pane opens/closes on row click

ACCESSIBILITY LAYER:
□ Checkboxes: aria-label="Select exception item [description]"
□ "Bulk accept" button: aria-label="Accept N selected exceptions"
□ "Select all" button: aria-label="Select all exceptions in this category"
□ Evidence pane: role="complementary" aria-label="Exception evidence"
□ Resolved state announced: aria-live="polite" on resolved count
```

---

### S3-T3 — EvidenceViewer (PDF Evidence with Page Highlighting)

**What this task does:** Replaces the `<iframe>` PDF viewer with a proper PDF canvas renderer using `react-pdf`. The evidence pane shows the specific page where the exception was found (from `line_items.source_page`) alongside the exception details. Uses `GET /api/projects/:id/pdf/pages?from=N&to=N` to serve only the relevant page range.

**Files changed:**
- `src/components/EvidenceViewer.jsx` — full replacement of PDFViewer.jsx
- `package.json` — add `react-pdf`
- Retire: `src/components/PDFViewer.jsx`

---

**🎨 UI/UX Agent — S3-T3 Design Specification:**

```
EvidenceViewer layout (fills the right pane):
  Header (border-b border-border px-4 py-2 flex items-center justify-between):
    Left: "Evidence" overline + exception description as subheading
    Right: tab strip "File 1 | File 2" (for variance exceptions showing both sources)
    Close button: X icon text-muted-foreground hover:text-foreground
  PDF canvas area (flex-1 overflow-auto bg-muted/30):
    react-pdf <Document> + <Page> at 100% container width
    Loading state: skeleton block animate-pulse
    Error state: FileText icon + "PDF unavailable" message
  Exception detail panel (border-t border-border p-4):
    Exception type badge
    validation_note text — text-sm text-foreground
    Source page reference — text-xs text-muted-foreground
    Per-item action buttons: "Accept" + "Override & Re-validate"
```

---

**🔧 Senior Dev Agent — S3-T3 Implementation:**

```javascript
// npm install react-pdf

import { Document, Page, pdfjs } from "react-pdf";
pdfjs.GlobalWorkerOptions.workerSrc = 
  `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

// PDF URL construction — uses the existing backend endpoint:
// GET /api/projects/:id/pdf/pages?from=N&to=N (for GC PDF)
// GET /api/projects/:id/pdf/pages?from=N&to=N&src=sub (for sub-contractor PDF)
const pdfUrl = `/api/projects/${id}/pdf/pages?from=${item.source_page}&to=${item.source_page}`;

// EvidenceViewer component:
export default function EvidenceViewer({ projectId, item, onClose }) {
  const [activeFile, setActiveFile] = useState("file1");
  const url = activeFile === "file1"
    ? `/api/projects/${projectId}/pdf/pages?from=${item.source_page}&to=${item.source_page}`
    : `/api/projects/${projectId}/pdf/pages?from=${item.source_page}&to=${item.source_page}&src=sub`;

  return (
    <aside role="complementary" aria-label="Exception evidence">
      {/* header + tabs + close */}
      <Document file={url} loading={<Skeleton />} error={<ErrorState />}>
        <Page pageNumber={1} width={containerWidth} />
      </Document>
      {/* exception detail */}
    </aside>
  );
}
```

---

**🧪 Testing Agent — S3-T3 Test Gate:**

```
DATA LAYER:
□ Network: /api/projects/:id/pdf/pages?from=N&to=N called when evidence pane opens
□ PDF renders in canvas (not iframe)
□ Page number matches item.source_page from DB
□ File 1 / File 2 tab switch changes ?src= parameter

VISUAL LAYER:
□ PDF renders at full pane width with vertical scroll
□ Loading skeleton visible during fetch (not blank white)
□ Error state shows graceful message (not broken image icon)

ACCESSIBILITY LAYER:
□ <aside role="complementary" aria-label="Exception evidence">
□ Close button aria-label="Close evidence panel"
□ Tab strip: role="tablist" + aria-selected on active tab
□ PDF canvas has aria-label="Invoice page [N] PDF evidence"
```

---

### S3-T4 — HITLScreen (Screen 8 — HITL Gate 2: Final Confirmation)

**What this task does:** Builds the final HITL Gate screen. The reviewer confirms all exceptions have been resolved and the package is ready to route to the Finance Approver. This is the absolute end of the current workflow. No further AI re-validation can be triggered after this button is clicked. Adapted from `lovable-example-app/packages.$id.hitl.tsx`.

**Files changed:**
- `src/pages/HITLScreen.jsx`

---

**🎨 UI/UX Agent — S3-T4 Design Specification:**

Directly from `lovable-example-app/packages.$id.hitl.tsx`. Adapt to JSX.

```
p-8 · max-w-[820px] mx-auto
  rounded-lg border border-border bg-card overflow-hidden
    Header (p-6 border-b):
      Warning badge: "Human-in-the-loop confirmation" — bg-warning/10 text-warning
      h1: "Confirm Package Ready for Formal Validation" — text-xl font-semibold tracking-tight mt-3
      p: "All exceptions resolved. Review the summary before routing to Finance Approver."
    Checklist (divide-y divide-border):
      Each checklist item shows: circle icon (success/pending) + text + meta
      Real checklist items:
        □ "All N exceptions resolved" meta="N accepted · M overrides" — from resolvedIds count
        □ "File 1 extraction complete" — from phase 3 status
        □ "Package totals reconcile" meta="Approved amount: $X" — from cover_page
        □ "Audit trail complete" meta="All changes by [user]"
    Route panel (p-6 bg-muted/30 border-t):
      "Route to" label
      Reviewer card: avatar + name + role (static for now — no user management in Sprint 3)
      Footer: "← Back to exceptions" ghost link (left) + 
              "Confirm & Send for Approval" primary button with ShieldCheck icon (right)
```

**CRITICAL:** The "Confirm & Send for Approval" button must be the last user action. After clicking:
- Mark project as submitted (PATCH /api/projects/:id with status: "submitted")
- Navigate to GlobalDashboard (the package is done)
- The project card on the dashboard shows "Complete" status
- No route back to exceptions or re-validation

---

**🔧 Senior Dev Agent — S3-T4 Implementation:**

```javascript
const handleConfirm = async () => {
  setSubmitting(true);
  try {
    await apiFetch(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "submitted" }),
    });
    navigate("/");  // Return to GlobalDashboard — this package is done
  } catch (err) {
    setError(err.message);
    setSubmitting(false);
  }
};

// Derive checklist item statuses from real data:
// "All N exceptions resolved" — pass resolvedIds set from ExceptionsScreen via route state
//   or re-fetch line items and count unresolved
// "Package totals reconcile" — from GET /api/projects/:id/cover-page
// "File 1 extraction complete" — from GET /api/projects/:id/phases (phase 3 = "complete")

// HARD RULE: After handleConfirm(), no validate-ai endpoint is called.
// No polling starts. The app navigates away immediately on success.
```

---

**🧪 Testing Agent — S3-T4 Test Gate:**

```
DATA LAYER:
□ Checklist items populated from real API data (not hardcoded text)
□ "Confirm" button: PATCH /api/projects/:id called with { status: "submitted" }
□ After confirm: navigate("/") — dashboard shows updated project status
□ After confirm: no additional API calls to validate-ai (check Network tab)
□ If PATCH fails: error message shown, user stays on HITLScreen

VISUAL LAYER:
□ Checklist items with "ok" show bg-success/10 text-success circle
□ Warning badge visible in header
□ Confirm button disabled while submitting

ACCESSIBILITY LAYER:
□ Checklist items: role="list" + role="listitem"
□ Each checklist icon: aria-hidden="true" (text conveys status)
□ Confirm button: aria-label="Confirm package and send for formal approval"
□ Success navigation: focus returns to top of GlobalDashboard
```

---

### S3-T5 — Sprint 3 + Full System Regression Test

**What this task does:** Final sprint — full end-to-end regression test covering the complete 8-screen journey. No new code. Dev agent fixes any regressions found by Testing Agent.

---

**🧪 Testing Agent — S3-T5 Full System Regression:**

```
COMPLETE JOURNEY TEST (run with a fresh DB record):
□ 1. / → Dashboard shows real projects list
□ 2. → "+ New Package" → PackageIntakeWizard loads
□ 3. → Upload real PDF → "Begin Processing" → /packages/:id/ingest
□ 4. → StepRail steps 1–2 run → ActivityFeed shows real log messages
□ 5. → "Confirm & Extract" → /packages/:id/file1
□ 6. → StepRail step 3 runs → G702 cover page loads with real data
□ 7. → "Continue to Agent Plan" → /packages/:id/plan
□ 8. → Sub-contractor list loads from real line_items (work_completed_this != 0 only)
□ 9. → Edit a sub-contractor name → confirm → /packages/:id/file2
□ 10. → StepRail steps 5–8 run → ActivityFeed shows sub extraction progress
□ 11. → Auto-advance to /packages/:id/complete
□ 12. → Stats show real counts from DB (not zeros)
□ 13. → "Begin Review" → /packages/:id/exceptions
□ 14. → Exception navigator loads with real validation data
□ 15. → Click exception row → EvidenceViewer opens with PDF
□ 16. → Accept exception → resolved dot shows green
□ 17. → Re-validate item → POST /validate-ai/item/:iid called
□ 18. → "Mark Ready for Approval" → /packages/:id/hitl
□ 19. → Checklist shows real resolved count
□ 20. → "Confirm & Send for Approval" → / (dashboard)
□ 21. → Package card shows "Complete" or "Submitted" status

SECURITY CHECKS:
□ No hardcoded credentials or secrets in any src/ file
□ All PDF endpoints use project ID from auth context (no path traversal)
□ No user-controlled content rendered with dangerouslySetInnerHTML
□ All fetch calls use relative /api paths (no cross-origin)

WCAG 2.2 AA FULL SWEEP:
□ Axe DevTools: 0 critical violations on all 10 routes
□ Keyboard-only navigation: complete journey without mouse
□ Color contrast: all foreground/background pairs pass 4.5:1
□ No information conveyed by color alone (badges have text labels)
□ All modals (if any) have focus trap
□ All async regions have aria-live

PERFORMANCE:
□ GlobalDashboard first paint < 2 seconds with 10 projects
□ ExceptionsScreen with 50 exceptions: no noticeable lag on scroll
□ PDF Evidence Viewer: page renders < 3 seconds
□ StepRail polling: no memory leaks (useEffect cleanup verified)
```

**SPRINT 3 SHIP CRITERIA:** All 21 journey steps pass. 0 Axe critical violations. Zero mock data. Zero hardcoded colors. Keyboard-only journey completes.

---

## Cross-Sprint Rules (Non-Negotiable)

These rules apply to every task in every sprint. The Testing Agent will reject any task that violates them.

| Rule | Enforcement |
|---|---|
| No mock data | Testing Agent checks for `mockData`, `fakeData`, hardcoded arrays of project names |
| No localhost URLs | `grep -r "localhost" src/` must return 0 |
| No hardcoded hex | `grep -rE "#[0-9a-fA-F]{6}" src/` must return 0 (except index.css comments) |
| No window.location navigation | `grep -r "window.location" src/` must return 0 |
| No dark: Tailwind modifiers | `grep -r "dark:" src/` must return 0 |
| No TypeScript in src/ | All files are `.jsx` or `.js` — never `.tsx` or `.ts` |
| API errors must be user-visible | Every `apiFetch` call has a `.catch` that sets an error state rendered to the user |
| HITL Gate 1 is a hard stop | No code can advance past PlanScreen without user click |
| HITL Gate 2 is final | No validate-ai calls after HITLScreen confirm |
| Sub-contractor filter | Always `work_completed_this != 0` — never show zero-value subs |

---

## Sprint Delivery Summary

| Sprint | Screens | Key Components | HITL Gates |
|---|---|---|---|
| Sprint 1 | — | AppShell, GlobalDashboard, Token System, Routing | — |
| Sprint 2 | Screens 1–6 | PackageIntakeWizard, StepRail, ActivityFeed, PlanScreen | Gate 1 (Plan) |
| Sprint 3 | Screens 7–8 | ExceptionsScreen, EvidenceViewer, HITLScreen | Gate 2 (HITL) |

**Screens 9+ (Formal Invoice Validation):** Out of scope for this plan. Step 16 of the L2 journey is TBD and will be planned separately after Sprint 3 ships.

---

## Document Change Log

| Doc | Update Required | Reason |
|---|---|---|
| `L2_Component_Map.md` | Replace forest green color references with blue primary token (#2563EB / --primary) | Theme is lovable blue (styles 1.css :root), not forest green |
| `L2_Layout_Specifications.md` | Remove any dark theme layout variants | Light theme only — no dark: modifiers |
| `04_Design_Token_Hygiene.md` | Update proposed token table to match exact lovable token names | Token names in styles 1.css differ from prior proposal |
| `02_WCAG_2.2_AA_Audit.md` | Mark violations 1–9 as "In Sprint Plan" with task reference | Each violation has a task owner now |
| All docs | Replace "forest green" / "#1a3a2a" references | Actual lovable primary is blue oklch(0.55 0.20 259) |
