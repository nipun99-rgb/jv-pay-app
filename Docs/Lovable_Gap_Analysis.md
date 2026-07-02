# Lovable Frontend Gap Analysis
## Invoice Review & Validation Platform — Steps 1–15 Coverage Assessment

**Version:** 1.0 · July 2, 2026  
**Prepared by:** Senior Product Manager  
**Input documents:** `lovable-example-app/` (all 26 files) · `01_User_Story_Validation.md` · `L2_User_Journey.md` · `L2_Layout_Specifications.md` · `L2_Component_Map.md` · `Sprint_Implementation_Plan.md`  
**Scope:** Full analysis of the Lovable-generated frontend against the approved Steps 1–15 workflow requirements

---

## Deliverable 1 — Frontend Coverage Assessment

### Overall Coverage Score

| Dimension | Coverage | Score |
|---|---|---|
| Screen count (10 screens built vs 10 required) | 10/10 screens exist as route files | 100% |
| UI structure & layout completeness | 3-pane layouts, nav rail, step rail, activity feed all present | 92% |
| Navigation architecture | Complete route tree, all transitions defined | 95% |
| Form design | File upload zones, selectors, inline editing all present | 80% |
| Data binding to real backend | **Zero** — 100% mock data | 0% |
| Business logic & sequencing | Partial — no enforcement of phase gates | 35% |
| Error handling | Root error boundary only — no per-screen error states | 20% |
| HITL workflow gates | Gate 1 (Plan) present · Gate 2 (HITL) present | 70% |
| PDF evidence viewer | Simulated (monospace text mock) — not real PDF renderer | 5% |
| Accessibility (WCAG 2.2 AA) | Partial — no aria-live, no focus traps, no aria-label on inputs | 40% |
| **Weighted overall** | | **54%** |

### Screen Inventory

| Route | Screen Name | Present in Lovable | Status |
|---|---|---|---|
| `/` | Global Dashboard / Package Queue | Referenced in `routeTree.gen.ts` as `IndexRoute` — file NOT in attached folder | **Missing file** |
| `/packages/new` | Package Intake Wizard | ✓ `packages.new.tsx` — fully designed | Present |
| `/packages/:id/ingest` | Ingest + Classification (Steps 1–2) | ✓ `packages.$id.ingest.tsx` | Present |
| `/packages/:id/file1` | File 1 Processing (Step 3) | ✓ `packages.$id.file1.tsx` | Present |
| `/packages/:id/plan` | Agent Plan Review — HITL Gate 1 (Step 4–5) | ✓ `packages.$id.plan.tsx` | Present |
| `/packages/:id/file2` | File 2 + 3 Processing (Steps 5–6) | ✓ `packages.$id.file2.tsx` | Present |
| `/packages/:id/complete` | Processing Complete Summary (Step 7–8) | ✓ `packages.$id.complete.tsx` | Present |
| `/packages/:id/exceptions` | Exception Navigator + Workbench (Steps 8–14) | ✓ `packages.$id.exceptions.tsx` | Present |
| `/packages/:id/hitl` | HITL Gate 2 — Final Confirmation (Step 15) | ✓ `packages.$id.hitl.tsx` | Present |
| `/packages/:id/validate` | Step 16 Placeholder | ✓ `packages.$id.validate.tsx` — clearly labelled as TBD | Present (stub) |
| `/contracts` | Contract Management | Referenced in `routeTree.gen.ts` — file NOT in attached folder | **Missing file** |
| `/reports` | Reports & Audit | ✓ `reports.tsx` — stub only | Present (stub) |
| `/settings` | Settings | ✓ `settings.tsx` — stub only | Present (stub) |

**Critical note:** The `index.tsx` (Global Dashboard) and `contracts.tsx` files appear in `routeTree.gen.ts` but are not in the attached folder. These are the two screens with the most real data dependency and are architecturally the most complex.

---

## Deliverable 2 — User Story Mapping (Steps 1–15 vs Lovable Components)

### Step-by-Step Coverage Matrix

| Step | Requirement Description | Lovable Component | Coverage Level | Data Binding | Notes |
|---|---|---|---|---|---|
| **Step 1** | User receives a monthly package (3 files grouped under one contract + billing period) | `packages.new.tsx` — Month/Year/Contract selectors + 3 file zones | **Full UI** | ❌ Mock `contracts[]` array | Contract list hardcoded; no `POST /projects` call |
| **Step 2** | Upload all 3 files (drag-and-drop, sequential or batch) | `packages.new.tsx` — `FileZone` component with drag-over state, filename, size, remove | **Full UI** | ❌ `mockUpload()` simulates upload | No actual `FormData` POST — `beginProcessing()` navigates using hardcoded package ID |
| **Step 3** | System ingests, performs preliminary classification, confirms document types to user | `packages.$id.ingest.tsx` — StepRail steps 1+2, ActivityFeed with confirmation card | **Full UI** | ❌ Steps hardcoded as static array; `POST /run-pipeline` not called | No `POST /api/projects/:id/run-pipeline` triggered on mount |
| **Step 4** | Preliminary classification results shown — user confirms before extraction begins | `packages.$id.ingest.tsx` — bottom slot: "Preliminary check complete" confirm card | **Full UI** | ❌ Static text, not from classification API | File count / page count from mock `pkg.files` |
| **Step 5** | Agent reads File 1, builds sub-contractor plan, pauses for user confirmation | `packages.$id.plan.tsx` — editable sub table, add/remove, "Confirm & Begin File 2" | **Full UI** | ❌ `subContractors` from `mockData.ts` | Sub list should come from `GET /line-items?work_completed_this!=0` |
| **Step 6** | Agent extracts GC Cover Page + G703 Continuation Sheet from File 1 | `packages.$id.file1.tsx` — StepRail step 3 running, G702 preview KV grid | **Full UI** | ❌ `formatCurrency(4200000)` hardcoded | Cover page data must come from `GET /cover-page` |
| **Step 7** | Agent writes extracted data to SQL; user sees structured data tables | `packages.$id.file1.tsx` — G702 KV grid shown; G703 line items not shown on this screen | **Partial** | ❌ Hardcoded | G703 line items table absent from File1Screen |
| **Step 8** | Agent validates data against source document; captures exceptions + low-confidence | `packages.$id.exceptions.tsx` — 4 exception categories, Accept/Override per row | **Full UI** | ❌ `allExceptions` from `mockData.ts` | No call to `POST /validate-ai`; no `validation_status` from DB |
| **Step 9** | Agent processes File 2 (sub-contractor invoices); extracts per-sub | `packages.$id.file2.tsx` — ActivityFeed with sub extraction log entries | **Full UI** | ❌ Static log entries; no `POST /run-subcontractor-extraction` | Auto-advance via Link, not real phase polling |
| **Step 10** | Cross-file reconciliation: File 1 sub list vs File 2 extracted subs — gaps surfaced | `packages.$id.complete.tsx` — 4-stat summary including Exceptions count | **Partial** | ❌ `pkg.exceptions` from mock | No explicit "File 1 said 14 subs / File 2 found 12" missing-sub reconciliation view |
| **Step 11** | Per-sub SQL data extracted; sub line items stored | `packages.$id.exceptions.tsx` grid has Sub/File1/File2/Variance columns | **Full UI** | ❌ Mock exception rows | Grid must read from `GET /subcontractor-applications` + `/sub-line-items` |
| **Step 12** | Each sub's data validated against File 1; per-sub validation status captured | `packages.$id.exceptions.tsx` — Accept/Override per row; category navigator | **Full UI** | ❌ Mock resolution state (local `Set`) | No `POST /validate-ai/item/:iid` re-validate button present |
| **Step 13** | File 3 (supporting docs) extracted, validated, exceptions captured | Evidence pane in `exceptions.tsx` has "File 3" tab button | **UI only — nonfunctional** | ❌ Tab click has no handler | No File 3 upload path, no extraction trigger, no data |
| **Step 14** | All agent tasks complete — user sees structured "Ready for Review" summary | `packages.$id.complete.tsx` — "All Steps Complete" badge, 4-stat card, exception breakdown | **Full UI** | ❌ All stats from `pkg.*` mock | Stats must derive from real line_items, validation_status |
| **Step 15** | User resolves exceptions, confirms package ready — HITL gate executed | `packages.$id.hitl.tsx` — 4-item checklist, "Confirm & Send for Approval" CTA | **Full UI** | ❌ All checklist items hardcoded strings | No `PATCH /projects/:id` status update; resolvedIds not threaded through |

### Coverage Summary by Category

| Category | Steps | Fully Covered | Partial | Missing |
|---|---|---|---|---|
| Package intake | 1, 2 | UI ✓ | Data ✗ | Contract API |
| Ingestion & classification | 3, 4 | UI ✓ | Data ✗ | Pipeline trigger |
| Agent plan (HITL 1) | 5 | UI ✓ | Data ✗ | line-items filter |
| GC extraction | 6, 7 | Partial | G703 table absent | — |
| Exception capture | 8, 12 | UI ✓ | Data ✗ | validate-ai calls |
| File 2 processing | 9, 10, 11 | UI ✓ | Data ✗ | Sub extraction API |
| File 3 processing | 13 | Tab button only | — | Everything |
| Complete summary | 14 | UI ✓ | Data ✗ | Real stat derivation |
| HITL confirmation | 15 | UI ✓ | Data ✗ | PATCH + resolvedIds |

---

## Deliverable 3 — Gap Analysis Report

### GAP-001 — Zero Real API Integration (CRITICAL)

**Requirement:** Every screen must show live data from the Express/Node.js backend.  
**Lovable implementation:** All data comes from `import { packages, subContractors, exceptions, ... } from "@/lib/mockData"`. Every single component — `IngestScreen`, `File1Screen`, `PlanScreen`, `ExceptionsScreen`, `HITLScreen` — reads from static TypeScript arrays.  
**Missing:** `apiFetch` wrapper, all `GET/POST/PATCH` calls, loading states, error states.  
**Impact:** 100% of screens must be rewired. No screen can ship as-is.  
**Fix:** Implement `src/lib/api.js` with `apiFetch` wrapper (defined in `Sprint_Implementation_Plan.md` S1-T1). Replace every `mockData` import with a `useEffect` → `apiFetch` call.  
**Severity:** CRITICAL — blocks production use of every single screen.

---

### GAP-002 — No Real PDF Evidence Viewer (CRITICAL)

**Requirement (L2 Step 8, 11, 12):** When a reviewer clicks an exception row, the right-hand evidence pane must show the actual PDF page where the extracted value appears, with the specific cell highlighted.  
**Lovable implementation:** `packages.$id.exceptions.tsx` renders a simulated document — an `aspect-[8.5/11]` div containing monospace text rows and a `border-2 border-warning` highlight positioned absolutely. This is a design mock, not a functional component.  
**Evidence pane code (exact):**
```tsx
<div className="mx-auto aspect-[8.5/11] max-w-full bg-card rounded-md shadow-sm border border-border p-6 text-[10px] font-mono text-muted-foreground">
  {Array.from({ length: 12 }).map((_, i) => (...))}
  {active && <div className="absolute inset-x-4 top-[6.5rem] h-6 border-2 border-warning rounded pointer-events-none" />}
</div>
```
**Missing:** `react-pdf` Document/Page renderer, `GET /api/projects/:id/pdf/pages?from=N&to=N` integration, bbox highlight overlay.  
**Impact:** NNG Heuristic 6 (Recognition over Recall) fails entirely — the reviewer cannot see the source document.  
**Fix:** Replace with `react-pdf` + the existing backend `/pdf/pages?from=&to=&src=` endpoint (already working, proven in production).  
**Severity:** CRITICAL — core reviewer workflow is non-functional.

---

### GAP-003 — HITL Gate 1 Has No Phase Enforcement (HIGH)

**Requirement (L2 Step 5):** The sub-contractor plan screen must be a hard stop. The user cannot proceed to File 2 extraction without clicking "Confirm". The Plan screen must only appear after phase 3 (File 1 extraction) is `complete`.  
**Lovable implementation:** `packages.$id.plan.tsx` renders immediately at `/packages/:id/plan` — any user can navigate to this URL without phase 3 being complete. The "← Go back" link goes to `/file1` and "Confirm" goes to `/file2`, but there is no guard checking `phase_3.status === "complete"` before the Plan screen becomes accessible.  
**Missing:** Phase status check on PlanScreen mount; disable/redirect logic if phase 3 is not complete.  
**Fix:** On `PlanScreen` mount, `apiFetch("/projects/:id/phases")` and redirect to `/file1` if phase 3 is not `"complete"`.  
**Severity:** HIGH — sequencing break allows incorrect sub-contractor plans.

---

### GAP-004 — File 3 (Supporting Documents) Not Implemented (HIGH)

**Requirement (L2 Step 13):** File 3 (supporting documents — direct cost backup) must be uploadable, extractable, and its evidence must be viewable in the evidence pane.  
**Lovable implementation:** 
- `packages.new.tsx` — FileZone 3 ("Supporting Documents") exists but `f3` state is local only; no upload to backend.
- `packages.$id.exceptions.tsx` evidence pane — "File 3" tab button renders but has no `onClick` handler and no URL construction.
- No File 3 extraction screen or trigger exists.  
**Missing:** File 3 upload to backend, extraction trigger, evidence pane File 3 tab functional handler, `?src=file3` parameter on `/pdf/pages`.  
**Fix:** Add File 3 upload in `PackageIntakeWizard`, add `POST /run-file3-extraction` trigger on `File2Screen`, wire File 3 tab in evidence pane.  
**Severity:** HIGH — Step 13 is entirely absent from functional implementation.

---

### GAP-005 — Global Dashboard / Package Queue Missing (HIGH)

**Requirement (L1/L2):** The app's home screen must show all packages in a queue-style list, with status (Not Started / Processing / Complete / Error) and a "New Package" CTA.  
**Lovable implementation:** `index.tsx` is referenced in `routeTree.gen.ts` (`IndexRoute`) but the file does not exist in the attached project folder. The nav rail in `AppShell.tsx` has a "Packages" link to `/` — but there is no destination component.  
**Missing:** The entire `index.tsx` route file — the app's entry point.  
**Fix:** Build `GlobalDashboard.jsx` reading from `GET /api/projects` (defined in Sprint_Implementation_Plan.md S1-T4).  
**Severity:** HIGH — the app has no home screen.

---

### GAP-006 — No Re-Validate Per Item in Exception Grid (HIGH)

**Requirement (L2 Step 12, L2_Component_Map.md):** Each exception row must have a "Re-validate ↺" button that calls `POST /api/projects/:id/validate-ai/item/:iid` and updates the row status in place.  
**Lovable implementation:** `packages.$id.exceptions.tsx` exception rows have "Accept" and "Override" buttons only. There is no re-validate action.  
**Missing:** Re-validate button per row, `POST /validate-ai/item/:iid` call, per-row loading state.  
**Fix:** Add third action button "↺ Re-validate" to each exception row in `ExceptionsScreen`.  
**Severity:** HIGH — reviewers cannot trigger AI re-check after overriding a field.

---

### GAP-007 — No Per-Screen Error or Loading States (HIGH)

**Requirement:** Every async operation must have a loading skeleton and a user-visible error state (not a blank screen or browser console error).  
**Lovable implementation:** Every screen renders immediately using synchronous mock data. No `loading` state variable exists anywhere. No error boundary exists below the root level. No `try/catch` around any data operation except in `__root.tsx` `ErrorComponent`.  
**Missing:** Per-screen loading skeletons, per-fetch error display, `aria-busy` attributes.  
**Fix:** Every `useEffect` → `apiFetch` must have `setLoading(true/false)` and `.catch(setError)` with a rendered error message. Defined in sprint plan per-task test gates.  
**Severity:** HIGH — production users will see blank screens when any API call fails.

---

### GAP-008 — No Cross-File Reconciliation Summary (MEDIUM)

**Requirement (L2 Step 10):** After File 2 processing, the system should show a reconciliation summary: "File 1 listed 14 sub-contractors. File 2 contained 12. 2 sub-contractors are missing." This is a distinct exception category.  
**Lovable implementation:** `packages.$id.complete.tsx` exception breakdown lists "File 1 vs File 2 variance" as an `ExceptionRow` with count and amount — but this is a static mock. There is no screen or component that shows the missing-sub list by name.  
**Missing:** A "Missing Sub-Contractors" exception category in the navigator that lists subs from the plan who produced no File 2 extraction result.  
**Fix:** Add a "Missing from File 2" exception group to `ExceptionsScreen` navigator, populated by comparing `subcontractor_applications` against the plan rows confirmed on `PlanScreen`.  
**Severity:** MEDIUM — critical for audit accuracy but the UI category exists; only data wiring is missing.

---

### GAP-009 — No Authentication or Role Context (MEDIUM)

**Requirement:** The platform is used by an Invoice Reviewer (primary) with a hand-off to a Finance Approver. Different users see different actions.  
**Lovable implementation:** Username "M. Alvarez" and approver "Jamie Reyes" are hardcoded strings in `AppShell.tsx` and `packages.$id.hitl.tsx` respectively. No auth context, no role check, no user session.  
**Missing:** Auth wrapper, user context, role-based rendering (reviewer vs approver screens).  
**Fix:** Not in Sprint 1–3 scope per Sprint_Implementation_Plan.md. Logged for future sprint.  
**Severity:** MEDIUM — acceptable for internal ops tool; document as known gap.

---

### GAP-010 — No Phase Status Polling — Auto-Advance is Navigation Only (MEDIUM)

**Requirement (L2 Screens 2–6):** The StepRail and ActivityFeed must update in real time as backend agents complete each phase. Screens must auto-advance when a phase completes.  
**Lovable implementation:** 
- `packages.$id.file2.tsx`: auto-advance is `<Link to="complete">Skip to complete →</Link>` — a manual click link, not automatic.
- `StepRail.tsx` steps are a static array passed as props — no polling, no state updates.
- `ActivityFeed.tsx` entries are a static array — no log polling.  
**Missing:** `setInterval` polling of `GET /phases` (updates StepRail), `GET /logs?after=:lastId` (updates ActivityFeed), cleanup on unmount.  
**Fix:** Defined in Sprint_Implementation_Plan.md S2-T2.  
**Severity:** MEDIUM — screens render correctly but don't update without manual refresh.

---

### GAP-011 — Contracts Route File Missing (MEDIUM)

**Requirement:** The nav rail "Contracts" link goes to `/contracts`. This should show the contract list (long-lived entities that packages belong to).  
**Lovable implementation:** `routeTree.gen.ts` registers `ContractsRoute`. The file is not in the attached folder.  
**Missing:** `contracts.tsx` route file.  
**Fix:** Create `contracts.tsx` stub for Sprint 1; full implementation in a future sprint.  
**Severity:** MEDIUM — nav link would 404; requires a stub at minimum.

---

### GAP-012 — Package Dedup Check Not Implemented (LOW)

**Requirement (L2 Screen 1):** If the same file hash exists for the same contract + billing period, warn the user before allowing overwrite.  
**Lovable implementation:** `packages.new.tsx` `mockUpload()` sets local file state immediately — no hash check, no duplicate warning.  
**Missing:** File hash comparison against existing packages for the same contract + period.  
**Fix:** After file selection, compute `SHA-256` of the file client-side and call `GET /api/projects?contract=&period=` to check for duplicates before enabling "Begin Processing".  
**Severity:** LOW — edge case; add in Sprint 2 during PackageIntakeWizard build.

---

### GAP-013 — TypeScript + TanStack Stack Cannot Be Directly Used (INFORMATIONAL)

**Requirement:** Target stack is React JS (JSX) + React Router v6 + Vite. The existing backend is Express/Node.js.  
**Lovable implementation:** Built on TypeScript + TanStack Router + TanStack Start (SSR framework) + TanStack Query. The `server.ts` and `start.ts` files implement a full SSR server with Cloudflare Workers-style fetch handler. The `routeTree.gen.ts` is auto-generated by TanStack Router's Vite plugin.  
**Impact:** The Lovable project **cannot be directly used as a code baseline** — it uses a different language, a different router, and a different server architecture. All component patterns must be manually translated from TSX to JSX.  
**What can be reused:** UI component structure, Tailwind class patterns, layout compositions, token system. These are all language-agnostic.  
**Severity:** INFORMATIONAL — affects how Lovable is used (reference, not baseline).

---

## Deliverable 4 — Reusable Component Inventory

### Tier 1 — Translate Directly (High Fidelity, Low Effort)

These components can be translated from TSX to JSX with minimal changes — primarily removing TypeScript type annotations and replacing TanStack imports with React Router equivalents.

| Component File | Target JSX File | Translation Effort | Reuse Value |
|---|---|---|---|
| `AppShell.tsx` | `AppShell.jsx` | Low — remove types, swap router imports | **Critical** — wraps every screen |
| `StepRail.tsx` | `AgentProgressRail.jsx` | Low — remove `AgentStep` type | **Critical** — core progress UI |
| `ActivityFeed.tsx` | `ActivityFeed.jsx` | Low — remove `ActivityEntry` type | **Critical** — replaces OutputPanel |
| `packages.$id.hitl.tsx` → `Checklist` + `HITLScreen` | `HITLScreen.jsx` | Low | **High** — Step 15 HITL gate |
| `packages.$id.complete.tsx` → `Stat` + `ExceptionRow` | `CompleteScreen.jsx` | Low | **High** — Step 14 summary |
| `packages.$id.ingest.tsx` | `IngestScreen.jsx` | Low | **High** — Steps 1–2 |

### Tier 2 — Translate with Data Rewiring (Medium Effort)

These components have the right structure but require all mock data replaced with real API calls.

| Component File | Target JSX File | What to Replace | Reuse Value |
|---|---|---|---|
| `packages.new.tsx` | `PackageIntakeWizard.jsx` | `mockUpload()` → real FormData POST; `contracts[]` → API fetch | **Critical** |
| `packages.$id.plan.tsx` | `PlanScreen.jsx` | `subContractors` mock → `GET /line-items` with filter | **Critical** |
| `packages.$id.file1.tsx` | `File1Screen.jsx` | Hardcoded KV values → `GET /cover-page` | **High** |
| `packages.$id.file2.tsx` | `File2Screen.jsx` | Static log entries → real log polling; Link → phase polling | **High** |
| `packages.$id.exceptions.tsx` | `ExceptionsScreen.jsx` | `allExceptions` mock → `GET /line-items` filtered; resolve state → real | **Critical** |

### Tier 3 — Take Pattern Only (High Effort — Structural Reference)

These define the right pattern but require significant new logic.

| Pattern | Source | New Implementation |
|---|---|---|
| Evidence pane layout (3-tab: File1/File2/File3) | `exceptions.tsx` right aside | Replace monospace mock with `react-pdf` Document/Page |
| Phase status → step card state mapping | `ingest.tsx` static step array | Real mapping from `GET /phases` → `{done/running/pause/pending/error}` |
| Progress dot tracker in navigator | `exceptions.tsx` navigator buttons | Real count from resolved exception Set vs total |

### Tier 4 — Design System Assets (Zero Translation Needed)

These are CSS/token-level patterns used verbatim in the target solution.

| Asset | Where | Usage |
|---|---|---|
| `styles 1.css` — full `:root` token block | `index.css` | Copy exactly — defines all colors, radius, typography |
| Tailwind class patterns for cards | All screen files | `rounded-lg border border-border bg-card p-5` |
| Badge variants | `AppShell.tsx` `toneClass` map | success/warn/info/neutral status pills |
| Button variants | All CTAs | Primary: `bg-primary px-4 py-2 text-sm` · Ghost: `text-muted-foreground hover:bg-muted` |
| Overline label pattern | All screens | `text-[11px] uppercase tracking-wider text-muted-foreground` |
| Tabular numbers | All financial values | `tabular-nums` class |
| KV pair component | `file1.tsx` `KV()` | Re-use pattern in CoverPage preview |
| Stat card component | `complete.tsx` `Stat()` | Re-use in CompleteScreen |
| Checklist item | `hitl.tsx` `Checklist()` | Re-use in HITLScreen |
| ExceptionRow with color dots | `complete.tsx` `ExceptionRow()` | Re-use in CompleteScreen breakdown |

### Radix UI Components Available (from `package 1.json`)

The Lovable project installs the full Radix UI + shadcn/ui stack. These are available for use in the JSX target:

| Radix Package | Use Case in Target |
|---|---|
| `@radix-ui/react-dialog` | HITL confirmation dialog, modal confirmations |
| `@radix-ui/react-checkbox` | Exception grid row selection |
| `@radix-ui/react-tabs` | Evidence pane File1/File2/File3 tabs, ValidationWorkbench tabs |
| `@radix-ui/react-select` | Billing period, contract, and filter dropdowns |
| `@radix-ui/react-progress` | StepRail progress bar per step |
| `@radix-ui/react-tooltip` | Validation badge tooltips, column header hints |
| `@radix-ui/react-scroll-area` | StepRail overflow, exception navigator overflow |
| `react-resizable-panels` | Three-pane layout in ExceptionsScreen |
| `recharts` | Potential charts in Reports/CompleteScreen |
| `sonner` | Toast notifications for accept/resolve actions |

---

## Deliverable 5 — Missing Requirements List

### Missing Screens

| Screen | Steps Affected | Priority |
|---|---|---|
| `index.tsx` — Global Dashboard / Package Queue | Entry point for all steps | P0 |
| `contracts.tsx` — Contract Management | Steps 1, 5 (baseline SOV) | P1 |
| `packages/:id/reconcile` — Cross-File Reconciliation detail | Step 10 | P1 |
| File 3 extraction screen (or section within File2Screen) | Step 13 | P1 |

### Missing Components

| Component | Steps Affected | Priority |
|---|---|---|
| Real PDF viewer (`react-pdf` based) | Steps 8, 12, 13 | P0 |
| `apiFetch` API wrapper | All steps | P0 |
| Per-screen loading skeletons | All steps | P0 |
| Per-screen error states | All steps | P0 |
| Phase polling hook (`usePhasePolling`) | Steps 3–14 | P0 |
| Log polling hook (`useLogPolling`) | Steps 3–14 | P0 |
| File 3 upload zone + extraction trigger | Step 13 | P1 |
| Re-validate per item button + handler | Steps 8, 12 | P1 |
| Missing-sub reconciliation exception group | Step 10 | P1 |
| Phase gate guard (redirect if phase not complete) | Steps 5, 9 | P1 |
| HITL confirm → `PATCH /projects/:id` | Step 15 | P1 |
| Package dedup warning | Step 1 | P2 |
| Auth/user context | All steps | P2 |
| Toast notifications (`sonner`) | Steps 8, 12, 15 | P2 |

### Missing Business Logic

| Logic | Step | Priority |
|---|---|---|
| Sub-contractor filter: `work_completed_this != 0` | Step 5 | P0 — PlanScreen will show wrong subs without this |
| Phase sequencing guard: cannot advance without phase complete | Steps 3→5, 5→9 | P1 |
| Exception categorisation: group `validation_note` into 4 categories | Steps 8, 12 | P1 |
| HITL confirmation is final: no validate-ai after HITLScreen | Step 15 | P1 |
| Auto-advance via polling: navigate when phase N = complete | Steps 3, 9 | P1 |
| Exception resolution threading: resolvedIds from ExceptionsScreen → HITLScreen | Steps 14→15 | P1 |
| File hash dedup check | Step 1 | P2 |

---

## Deliverable 6 — Recommended Frontend Enhancement Plan

This plan layers on top of the `Sprint_Implementation_Plan.md` already created. It specifies Lovable-specific enhancements required beyond what the sprint plan already covers.

### Enhancement 1 — Wire All mockData Imports (All Sprints — P0)

**What:** Replace every `import { ... } from "@/lib/mockData"` with a `useEffect` + `apiFetch` call.  
**Screens affected:** All 8 functional screens.  
**Pattern:**
```javascript
// Replace this:
const pkg = packages.find(p => p.id === id) ?? packages[0];

// With this:
const [pkg, setPkg] = useState(null);
useEffect(() => {
  apiFetch(`/projects/${id}`).then(setPkg).catch(setError);
}, [id]);
```
**Effort per screen:** 1–2 hours. 8 screens × 2 hours = 16 hours total.

---

### Enhancement 2 — Replace Evidence Pane Simulation (Sprint 3 — P0)

**What:** The monospace div mock in `exceptions.tsx` must be replaced with a real PDF canvas.  
**Current Lovable code (to delete):**
```tsx
<div className="mx-auto aspect-[8.5/11] bg-card font-mono text-[10px]">
  {Array.from({ length: 12 }).map(...)}
  {active && <div className="absolute ... border-2 border-warning" />}
</div>
```
**Replace with:** `react-pdf` `<Document file={url}><Page pageNumber={1} /></Document>` where `url = /api/projects/${id}/pdf/pages?from=${item.source_page}&to=${item.source_page}`.  
**Effort:** 1 sprint task (S3-T3 in sprint plan).

---

### Enhancement 3 — Add Phase Polling to All Processing Screens (Sprint 2 — P0)

**What:** All screens in the `/ingest → /file1 → /file2` chain must poll `GET /phases` and update the StepRail dynamically.  
**Pattern (from JourneyPanel.jsx — proven existing code):**
```javascript
const timeoutRef = useRef(null);
useEffect(() => {
  let alive = true;
  const poll = async () => {
    const phases = await apiFetch(`/projects/${id}/phases`);
    if (!alive) return;
    setSteps(phases.map(mapPhaseToStep));
    if (phases.some(p => p.status === "running" || p.status === "pending")) {
      timeoutRef.current = setTimeout(poll, 3000);
    }
  };
  poll();
  return () => { alive = false; clearTimeout(timeoutRef.current); };
}, [id]);
```
**Effort:** Implement once as `usePhasePolling(projectId)` custom hook; import in all 4 processing screens.

---

### Enhancement 4 — Build Missing index.tsx (Sprint 1 — P0)

**What:** The app's home screen does not exist in the Lovable project. Must be built from scratch using the `PackageCard` pattern.  
**Data source:** `GET /api/projects` (already working).  
**Design:** Adapt from the description in `Sprint_Implementation_Plan.md` S1-T4.  
**Effort:** 1 sprint task.

---

### Enhancement 5 — Add Re-Validate Button to Exception Grid (Sprint 3 — P1)

**What:** Add a third action button column to the exceptions table.  
**Current Lovable code in exceptions.tsx:**
```tsx
<button onClick={...}>Accept</button>
<button onClick={...}>Override</button>
```
**Add:**
```jsx
<button onClick={() => revalidateItem(e.id)} disabled={revalidating.has(e.id)}>
  {revalidating.has(e.id) ? <Loader2 className="animate-spin h-3 w-3" /> : "↺"}
</button>
```
**Effort:** 2 hours.

---

### Enhancement 6 — Enforce Phase Gates (Sprint 2 — P1)

**What:** `PlanScreen` must not be accessible until phase 3 is complete. Add a mount-time redirect.  
```javascript
// Add to PlanScreen on mount:
useEffect(() => {
  apiFetch(`/projects/${id}/phases`).then(phases => {
    const phase3 = phases.find(p => p.phase_number === 3);
    if (phase3?.status !== "complete") navigate(`/packages/${id}/file1`);
  });
}, [id]);
```
**Effort:** 30 minutes per gate. Two gates: PlanScreen + File2Screen.

---

### Enhancement 7 — Sonner Toast for User Actions (Sprint 3 — P2)

**What:** The `sonner` package is already installed in the Lovable project. Use it for:
- "Exception accepted" → success toast
- "Re-validation queued" → info toast
- "Package submitted for approval" → success toast  
**Pattern:** `import { toast } from "sonner"` → `toast.success("Exception accepted")`.  
**Effort:** 1 hour total across all screens.

---

## Deliverable 7 — Final Readiness Conclusion

### Assessment

The Lovable project is a **high-quality conceptual prototype and partial reference implementation**. Its value is in three specific areas:

1. **Complete screen architecture** — All 10 required screens (except the dashboard `index.tsx`) exist as route files with correct URLs, correct navigation links between them, and correct layout compositions. This eliminates all architectural uncertainty.

2. **Pixel-perfect design system** — The `styles 1.css` token block, all Tailwind class patterns, all layout compositions (StepRail, ActivityFeed, 3-pane Exceptions, HITL Checklist) are production-quality and should be copied verbatim into the target JSX codebase.

3. **Exact workflow sequencing** — The Lovable project defines and validates the correct screen-to-screen flow: `new → ingest → file1 → plan → file2 → complete → exceptions → hitl → validate`. This matches the L2 User Journey exactly.

### What the Lovable Project Cannot Be

The Lovable project **cannot be used as a direct frontend baseline** for three absolute reasons:

1. **Language incompatibility:** TypeScript + TanStack Router + SSR is an entirely different stack than the target React JS + React Router v6 + Vite CSR application. Code cannot be merged — it must be translated.

2. **Zero data integration:** Every data field on every screen is hardcoded. No API call exists anywhere. The app cannot connect to the existing Express backend or SQLite database without a complete data layer rebuild.

3. **Missing critical functionality:** The real PDF evidence viewer, phase polling, phase gate enforcement, HITL confirm API call, and the app's home screen (`index.tsx`) are all absent.

### Final Classification

| Classification | Verdict |
|---|---|
| Direct frontend baseline | ❌ No — wrong stack, zero data wiring |
| Partial reference implementation | ✅ **Yes — this is the correct classification** |
| Conceptual prototype only | ❌ Too strong — the design quality exceeds "prototype" |

### Recommended Usage Model

**Use the Lovable project as a component-by-component translation reference.** For each task in the Sprint Implementation Plan:

1. **Open the corresponding Lovable `.tsx` file** as the design specification
2. **Copy the JSX structure verbatim** (remove TypeScript types only)
3. **Replace all `mockData` imports** with `apiFetch` calls using the correct backend endpoint from `L2_Component_Map.md` Section A
4. **Replace TanStack Router imports** with React Router v6 equivalents (`Link`, `useParams`, `useNavigate`, `useLocation`)
5. **Add loading, error, and empty states** that the Lovable file does not have
6. **Add phase polling** where the Lovable file uses static steps

This approach yields a production-quality result while fully leveraging the ~54% of design and structural work already completed in the Lovable project.

### Percentage Contribution by Category

| Category | Lovable Contribution | What Remains |
|---|---|---|
| Screen layout & visual design | **90%** complete | Minor WCAG additions |
| Navigation & routing architecture | **90%** complete | React Router translation |
| Design token system | **100%** complete | Copy `styles 1.css` verbatim |
| Reusable UI components | **75%** complete | JSX translation |
| Data binding & API integration | **0%** complete | Full implementation required |
| Business logic & sequencing | **25%** complete | Phase gates, filtering, polling |
| Error handling & loading states | **5%** complete | Per-screen implementation |
| PDF evidence viewer | **5%** complete | Replace with react-pdf |
| Accessibility (WCAG 2.2 AA) | **35%** complete | aria-live, focus traps, labels |

---

## Appendix — Lovable Project File Reference

| File | Purpose | Sprint Reference | Status |
|---|---|---|---|
| `styles 1.css` | Design token system | S1-T1 — copy to `index.css` | ✅ Use verbatim |
| `AppShell.tsx` | Global header + nav rail layout | S1-T3 | ✅ Translate to JSX |
| `StepRail.tsx` | 9-step agent progress rail | S2-T2 | ✅ Translate to JSX |
| `ActivityFeed.tsx` | Real-time log feed | S2-T2 | ✅ Translate to JSX |
| `packages.new.tsx` | Package intake wizard (3 file zones) | S2-T1 | ✅ Translate + rewire |
| `packages.$id.ingest.tsx` | Ingest + classify (Steps 1–2) | S2-T3 | ✅ Translate + rewire |
| `packages.$id.file1.tsx` | GC extraction preview (Step 3) | S2-T3 | ✅ Translate + rewire |
| `packages.$id.plan.tsx` | Sub-contractor plan HITL Gate 1 (Step 5) | S2-T4 | ✅ Translate + rewire |
| `packages.$id.file2.tsx` | File 2+3 auto-extraction (Steps 5–6) | S2-T5 | ✅ Translate + rewire |
| `packages.$id.complete.tsx` | Processing summary (Step 7–8) | S3-T1 | ✅ Translate + rewire |
| `packages.$id.exceptions.tsx` | Exception navigator + workbench (Steps 8–14) | S3-T2 | ✅ Translate + major rewire |
| `packages.$id.hitl.tsx` | HITL Gate 2 — final confirm (Step 15) | S3-T4 | ✅ Translate + rewire |
| `packages.$id.validate.tsx` | Step 16 placeholder | Future sprint | ✅ Keep as stub |
| `__root.tsx` | App root — error boundary, 404, meta | S1-T3 | ✅ Adapt error patterns |
| `router.tsx` | Route definition | S1-T3 | ✅ Adapt to React Router |
| `routeTree.gen.ts` | Route tree (auto-generated) | S1-T3 | Reference only |
| `package 1.json` | Full Radix UI dependency list | S1-T1 | Install shadcn/ui packages |
| `server.ts` | SSR Cloudflare handler | **Not applicable** | Target uses Express — ignore |
| `start.ts` | TanStack Start entry | **Not applicable** | Target uses Vite CSR — ignore |
| `reports.tsx` | Reports stub | Future | Keep as stub |
| `settings.tsx` | Settings stub | Future | Keep as stub |
| `utils.ts` | `cn()` helper | S1-T1 | ✅ Copy to `src/lib/cn.js` |
| `use-mobile.tsx` | Responsive hook | As needed | ✅ Translate to JSX |
| `error-capture.ts` | Error tracking | **Not applicable** | Ignore for now |
| `lovable-error-reporting.ts` | Error reporting | **Not applicable** | Ignore for now |
