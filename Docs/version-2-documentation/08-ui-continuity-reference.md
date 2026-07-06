# UI Continuity Reference — Previous App → v2 App

**Purpose:** This document maps the exact UI patterns, components, and routes from the 
previous application (project-manager/frontend/) that MUST be preserved in v2.

---

## Source Code Reference

The previous application lives at: `project-manager/frontend/src/`  
The v2 application lives at: `frontend/src/`

The developer agent MUST read the previous app's source files as reference when 
implementing any frontend sprint.

---

## Route Mapping

| Previous Route | Previous Component | v2 Route | Notes |
|---|---|---|---|
| `/login` | `LoginPage.jsx` | `/login` | Same flow: form → auth → redirect |
| `/` (index) | `GlobalDashboard.jsx` | `/` or `/dashboard` | Package cards, status badges |
| `/contracts` | `ContractListPage.jsx` | `/contracts` | Table of all contracts |
| `/packages/new` | `PackageIntakePage.jsx` | `/packages/new` | Upload zone, file selection |
| `/packages/:id/ingest` | `IngestPage.jsx` | `/packages/:id/ingest` | Step rail + activity feed |
| `/packages/:id/file1` | `File1Page.jsx` | `/packages/:id/file1` | Split pane: table + PDF |
| `/packages/:id/plan` | `PlanPage.jsx` | `/packages/:id/plan` | Sub list confirm/modify |
| `/packages/:id/file2` | `File2Page.jsx` | `/packages/:id/file2` | Sub data + PDF |
| `/packages/:id/exceptions` | `ExceptionsPage.jsx` | `/packages/:id/exceptions` | Exception cards |
| `/packages/:id/hitl` | `HitlPage.jsx` | `/packages/:id/hitl` | Final approval |
| `/packages/:id/complete` | `CompletePage.jsx` | `/packages/:id/complete` | Success state |
| `/settings` | (inline) | `/settings` | Admin only |
| `/reports` | (inline) | `/reports` | Analytics |

---

## Component Mapping

| Previous Component | File | v2 Equivalent | Reuse Strategy |
|---|---|---|---|
| `AppShell.jsx` | components/ | `AppShell.tsx` | Port to TS, add Agent Panel on right |
| `DataTable.jsx` | components/ | `DataTable.tsx` | Port to TS + TanStack Table, keep inline edit UX |
| `EvidenceViewer.jsx` | components/ | `PdfViewer.tsx` | Port to TS, add bbox overlay (SVG) |
| `SplitPane.jsx` + CSS | components/ | `SplitPane.tsx` | Port directly, same drag behavior |
| `Sidebar.jsx` | components/ | `Sidebar.tsx` | Port, keep collapsible + project list |
| `NewProjectModal.jsx` | components/ | `NewPackageModal.tsx` | Port, same overlay + form pattern |
| `OutputPanel.jsx` | components/ | Merge into `AgentPanel.tsx` | Activity feed moves to agent panel |
| `CoverPageTable.jsx` | components/ | `GcHeaderTable.tsx` | Port, add confidence badges |
| `SubcontractorTable.jsx` | components/ | `SubHeaderTable.tsx` + `SubSovTable.tsx` | Split by concern |
| `ProjectTiles.jsx` | components/ | `PackageCards.tsx` | Same card layout with status |
| `ErrorBoundary.jsx` | components/ | `ErrorBoundary.tsx` | Direct port |

---

## Layout Structure (Previous App)

```
┌──────────────────────────────────────────────────────────────────┐
│ HEADER (h-12): [IV] InvoiceReview / Contract / Period  [Status]  🔔 [Avatar] │
├────┬─────────────────────────────────────────────────────────────┤
│    │                                                             │
│ N  │              MAIN CONTENT AREA                              │
│ A  │                                                             │
│ V  │  ┌────────────────────────┬──┬────────────────────────────┐│
│    │  │                        │  │                            ││
│ R  │  │   PDF VIEWER           │||│   DATA TABLE               ││
│ A  │  │   (EvidenceViewer)     │||│   (DataTable)              ││
│ I  │  │                        │||│                            ││
│ L  │  │   - Page navigation    │||│   - Inline editable        ││
│    │  │   - Multi-doc tabs     │||│   - Status badges          ││
│ 56 │  │   - Zoom               │||│   - Sticky header          ││
│ px │  │                        │||│   - Row highlighting       ││
│    │  │                        │  │                            ││
│    │  └────────────────────────┴──┴────────────────────────────┘│
│    │                                                             │
├────┴─────────────────────────────────────────────────────────────┤
│ (Optional) STEP RAIL: ● Upload ● Classify ● Extract ● Plan ... │
└──────────────────────────────────────────────────────────────────┘
```

## Layout Structure (v2 App — Previous + Agent Panel)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER (h-12): [IV] InvoiceReview / Contract / Period  [Status]  🔔 [Avatar] │
├────┬─────────────────────────────────────────────────────────┬───────────────┤
│    │                                                         │               │
│ N  │              MAIN CONTENT AREA                          │  AGENT PANEL  │
│ A  │                                                         │  (320px, new) │
│ V  │  ┌──────────────────┬──┬──────────────────────────────┐│               │
│    │  │                  │  │                              ││  - Chat msgs  │
│ R  │  │   PDF VIEWER     │||│   DATA TABLE                 ││  - Progress   │
│ A  │  │                  │||│   + confidence badges (new)  ││  - Explain    │
│ I  │  │   + bbox overlay │||│   + recalc (new)            ││  - Commands   │
│ L  │  │     (new)        │||│                              ││               │
│    │  │                  │  │                              ││  - Cost footer│
│ 56 │  └──────────────────┴──┴──────────────────────────────┘│               │
│ px │                                                         │  [Chat input] │
│    │                                                         │               │
├────┴─────────────────────────────────────────────────────────┴───────────────┤
│ STEP RAIL: ● Upload ● Classify ● Extract GC ● Plan ● Extract Subs ● Recon   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Interaction Patterns (MUST PRESERVE)

### Inline Cell Editing (DataTable)
```
User clicks cell → Cell becomes input (focus, select all)
User types new value → Input shows new value
User presses Enter → PATCH API call → Update state → Show saved value
User presses Escape → Revert to original value → Exit edit mode
Cell shows: status badge (✓/⚠/✗) based on validation state
```

### Split Pane Drag
```
User hovers divider → cursor: col-resize, divider turns darker (#d0d5dd)
User mousedown on divider → Start tracking
User mousemove → Both panels resize proportionally
User mouseup → Stop tracking, divider returns to default (#e8e8e8)
Active state: indigo (#4f46e5) while dragging
Min-width constraint on both sides (prevent collapse)
```

### Step Rail Navigation
```
States: pending (gray) → running (purple-blue, animated) → complete (green) → paused (orange) → error (red)
Complete steps are clickable (navigate to that page)
Running step shows activity indicator
Paused step shows "Waiting for confirmation" label
```

### Status Pill (Header)
```
Tones: neutral (gray), info (blue), warn (orange), success (green)
Format: [color dot] + [label text]
Pill is rounded-full with border
Updates in real-time via WebSocket
```

### Notification Bell
```
Bell icon in header → click → dropdown panel
Shows unread count badge (red circle, 9+ max)
Panel: scrollable list of notification items
Each item: icon + message + timestamp
Dismiss button per item
Poll every 30s (v1) → WebSocket in v2
```

---

## CSS Variables (MUST USE)

```css
:root {
  --color-brand-primary: oklch(0.51 0.23 264);
  --color-background: oklch(0.985 0 0);
  --color-surface: oklch(0.97 0 0);
  --color-card: oklch(1 0 0);
  --color-foreground: oklch(0.13 0 0);
  --color-muted-foreground: oklch(0.45 0 0);
  --color-border: oklch(0.90 0 0);
  --color-primary: oklch(0.51 0.23 264);
  --color-primary-foreground: oklch(1 0 0);
  
  /* Status colors */
  --color-valid: oklch(0.60 0.17 145);
  --color-warning: oklch(0.72 0.18 60);
  --color-error: oklch(0.55 0.21 25);
  --color-unchecked: oklch(0.65 0 0);
  
  /* Step rail */
  --step-pending: oklch(0.90 0 0);
  --step-running: oklch(0.51 0.23 264);
  --step-complete: oklch(0.60 0.17 145);
  --step-paused: oklch(0.72 0.18 60);
  --step-error: oklch(0.55 0.21 25);
  
  /* Layout */
  --header-height: 3rem;
  --nav-rail-width: 56px;
  --agent-panel-width: 320px;
  --border-radius: 0.625rem;
}
```

---

## Key Dependencies (Previous App → Carry Forward)

| Package | Previous Version | Purpose | v2 Equivalent |
|---|---|---|---|
| `react-pdf` | 10.4.1 | PDF rendering | Same or iframe+pdf.js |
| `lucide-react` | 1.23.0 | Icons | Same |
| `@fontsource-variable/geist` | — | Typography | Same |
| tailwindcss | 4.3.2 | Styling | Same (v4) |
| shadcn/ui | — | Component primitives | Same |
| react-router-dom | 7.18.1 | Routing | 6.x (same patterns) |

---

*End of UI Continuity Reference*
