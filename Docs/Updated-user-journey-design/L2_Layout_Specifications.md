# L2 Layout Specifications — Invoice Review & Validation Platform

**Version:** 1.0 · July 1, 2026
**Owner:** Product Management & Design
**Purpose:** Define the spatial layout, zone responsibilities, and information hierarchy for each screen in the L2 User Journey. This document is the direct input to wireframing and React component restructuring.

---

## Global Layout Principles

Before defining per-screen layouts, these principles apply universally:

1. **Operations-first density:** This is not a marketing page. Layouts are information-dense. Every square centimetre of screen space must earn its position.
2. **Status is always visible:** The package processing status (what the agent is currently doing) must be accessible from every screen — not just the processing screen.
3. **No full-page modals for confirmations:** Confirmations are inline cards or panel overlays, not browser `window.confirm` dialogs.
4. **The PDF never disappears without the user choosing to hide it.** Evidence availability is core to the review task.
5. **Viewport:** Designed for 1440px wide desktop. Minimum supported: 1280px. Not responsive to mobile (enterprise operations tool).

---

## Global Shell Layout (All Screens)

```
┌─────────────────────────────────────────────────────────────────────┐
│  GLOBAL HEADER (48px fixed)                                         │
│  [Logo] [Contract name] [Package: Jun 2026]     [Status Badge] [User]│
├──────────┬──────────────────────────────────────────────────────────┤
│          │                                                           │
│  NAV     │  MAIN CONTENT AREA (variable per screen)                 │
│  RAIL    │                                                           │
│  (56px)  │                                                           │
│          │                                                           │
│  Icons   │                                                           │
│  only    │                                                           │
│  + labels│                                                           │
│          │                                                           │
└──────────┴──────────────────────────────────────────────────────────┘
```

**Global Header (48px):**
- Left: Product logo mark + Contract name (breadcrumb: Contracts > Highway Bridge Renovation > Jun 2026)
- Centre: Package status badge — colour-coded pill showing current state: `Processing · File 2 (8/14 subs)` / `In Review · 12 exceptions remain` / `Complete`
- Right: User avatar + name, notifications bell

**Navigation Rail (56px wide, icon + label):**
- Packages (home)
- Contracts
- Reports / Audit
- Settings (admin only)
- Uses icon library (Lucide or Phosphor — no emoji)

---

## SCREEN 1 — Package Intake Layout

**Pattern:** Centred wizard / stepped form — maximum width 720px, centred in main content area

```
┌───────────────────────────────────────────────────────────────────────┐
│  GLOBAL HEADER                                                        │
├────┬──────────────────────────────────────────────────────────────────┤
│NAV │                                                                   │
│    │   ┌──────────────── New Monthly Package ────────────────────┐    │
│    │   │                                                          │    │
│    │   │  STEP INDICATOR:  ① Upload Files  ②Confirm  ③Process   │    │
│    │   │                                                          │    │
│    │   │  Billing Period: [Month ▼] [Year ▼]                     │    │
│    │   │  Contract:       [Highway Bridge Renovation ▼]          │    │
│    │   │                                                          │    │
│    │   │  ┌─────────────────────────────────────────────────┐   │    │
│    │   │  │  FILE 1 — Consolidated Invoice (required)        │   │    │
│    │   │  │  [ Drop PDF here or click to browse ]            │   │    │
│    │   │  │  ✓ GC_Invoice_Jun2026.pdf  (12.4 MB)  [Remove]  │   │    │
│    │   │  └─────────────────────────────────────────────────┘   │    │
│    │   │                                                          │    │
│    │   │  ┌─────────────────────────────────────────────────┐   │    │
│    │   │  │  FILE 2 — Sub-Contractor Breakdown (optional)    │   │    │
│    │   │  │  [ Drop PDF here or click to browse ]            │   │    │
│    │   │  └─────────────────────────────────────────────────┘   │    │
│    │   │                                                          │    │
│    │   │  ┌─────────────────────────────────────────────────┐   │    │
│    │   │  │  FILE 3 — Supporting Documents (optional)        │   │    │
│    │   │  │  [ Drop PDF here or click to browse ]            │   │    │
│    │   │  └─────────────────────────────────────────────────┘   │    │
│    │   │                                                          │    │
│    │   │  [Cancel]                    [Begin Processing →]       │    │
│    │   └──────────────────────────────────────────────────────┘    │    │
│    │                                                                   │
└────┴──────────────────────────────────────────────────────────────────┘
```

**Information hierarchy:**
1. (Dominant) Three file upload zones — each labelled with file type and required/optional status
2. (Secondary) Billing period + contract selectors
3. (Action) Single primary CTA: Begin Processing

**Visual design notes:**
- File 1 upload zone: solid border, slightly elevated background — signals required
- File 2/3 upload zones: dashed border — signals optional
- Uploaded files show: filename, file size, green check, remove button
- "Begin Processing" button: disabled and greyed until File 1 is uploaded

---

## SCREEN 2 — Agent Progress View (Ingestion & Classification)

**Pattern:** Two-column — Progress Rail (left) + Activity Feed (right)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  GLOBAL HEADER                             [● Processing — Ingesting]   │
├────┬────────────────────────────────────────────────────────────────────┤
│    │  ┌───── AGENT PROGRESS RAIL (380px) ──┐  ┌──── ACTIVITY FEED ─────┐│
│NAV │  │                                    │  │                         ││
│    │  │  Processing: Jun 2026 Package      │  │  ▶ Receiving files…     ││
│    │  │  Highway Bridge Renovation         │  │                         ││
│    │  │                                    │  │  ✓ File 1 received      ││
│    │  │  ┌─ Step 1 ──────────────────── ✓ ┐│  │    47 pages · 12.4 MB  ││
│    │  │  │  File Upload & Receipt          ││  │                         ││
│    │  │  └────────────────────────────────┘│  │  ✓ File 2 received      ││
│    │  │                                    │  │    183 pages · 28.1 MB  ││
│    │  │  ┌─ Step 2 ──────────────── ⟳ ────┐│  │                         ││
│    │  │  │  Preliminary Classification     ││  │  ⟳ Checking document   ││
│    │  │  │  [████████░░░░] Checking…       ││  │    integrity…           ││
│    │  │  └────────────────────────────────┘│  │                         ││
│    │  │                                    │  │                         ││
│    │  │  ┌─ Step 3 ──────────────── ○ ────┐│  │                         ││
│    │  │  │  Extract GC Cover + G703        ││  │                         ││
│    │  │  └────────────────────────────────┘│  │                         ││
│    │  │                                    │  │                         ││
│    │  │  ┌─ Step 4 ─────── ◉ PAUSE ───────┐│  │                         ││
│    │  │  │  Agent Plan: Sub-Contractors    ││  │                         ││
│    │  │  └────────────────────────────────┘│  │                         ││
│    │  │                                    │  │                         ││
│    │  │  ○  Step 5: Extract File 2         │  │  ┌──── CONFIRM CARD ───┐││
│    │  │  ○  Step 6: Extract File 3         │  │  │ Preliminary check   │││
│    │  │  ○  Step 7: Cross-File Recon       │  │  │ complete. (details) │││
│    │  │  ○  Step 8: Exception Assembly     │  │  │ [Confirm & Continue]│││
│    │  │  ○  Step 9: Ready for Review       │  │  └─────────────────────┘││
│    │  └────────────────────────────────────┘  └─────────────────────────┘│
└────┴──────────────────────────────────────────────────────────────────────┘
```

**Agent Progress Rail — Step States:**
| State | Visual | Icon |
|---|---|---|
| Pending | Grey background, grey text | ○ empty circle |
| Running | White background, blue border, animated | ⟳ spinning |
| Paused (awaiting user) | Amber/orange background, pulsing dot | ◉ amber dot |
| Complete | Green tinted background, bold | ✓ green check |
| Error | Red tinted background | ✕ red cross |

**Activity Feed:**
- Scrollable, newest at bottom
- Messages in three visual classes: info (grey), success (green), warning (amber)
- No raw server log text — all messages are business-language translations
- When a gate/confirmation is needed, a structured **Confirm Card** appears inline in the feed — NOT a modal

---

## SCREEN 4 — Agent Plan Review Layout (Sub-Contractor Confirmation)

**Pattern:** Two-column — Progress Rail (left) + Interactive Plan Editor (right)

The Progress Rail remains visible. Step 4 glows amber/orange. The right zone transforms from the Activity Feed into the Plan Editor.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  GLOBAL HEADER                    [◉ Waiting for your confirmation]       │
├────┬─────────────────────────────────────────────────────────────────────┤
│    │  ┌── PROGRESS RAIL (380px) ──┐  ┌────── AGENT PLAN EDITOR ─────────┐│
│NAV │  │                           │  │                                   ││
│    │  │  ✓ Step 1: Upload         │  │  🤖 Agent Plan — Sub-Contractors  ││
│    │  │  ✓ Step 2: Classify       │  │  ─────────────────────────────    ││
│    │  │  ✓ Step 3: File 1 Done    │  │  Found 14 sub-contractors in      ││
│    │  │  ┌───────────────────┐    │  │  File 1. Review and confirm.      ││
│    │  │  │◉ Step 4: PLAN     │    │  │                                   ││
│    │  │  │Waiting for you    │    │  │  ┌────────────────────────────┐   ││
│    │  │  └───────────────────┘    │  │  │# │ Sub-Contractor  │App # │$  │   ││
│    │  │                           │  │  ├──┼─────────────────┼──────┼───┤   ││
│    │  │  ○ Step 5: File 2         │  │  │1 │ ABC Electrical  │ #12  │124K│  ││
│    │  │  ○ Step 6: File 3         │  │  │  │ [editable]      │[edit]│   │   ││
│    │  │  ○ Step 7: Recon          │  │  ├──┼─────────────────┼──────┼───┤   ││
│    │  │  ○ Step 8: Exceptions     │  │  │2 │ Delta Plumbing  │  #8  │87K│   ││
│    │  │  ○ Step 9: Ready          │  │  ├──┼─────────────────┼──────┼───┤   ││
│    │  │                           │  │  │…                             … │   ││
│    │  │                           │  │  ├──┼─────────────────┼──────┼───┤   ││
│    │  │                           │  │  │14│ Pinnacle Steel  │  #5  │340K│  ││
│    │  │                           │  │  └──┴─────────────────┴──────┴───┘   ││
│    │  │                           │  │                                   ││
│    │  │                           │  │  [+ Add Sub-Contractor]           ││
│    │  │                           │  │                                   ││
│    │  │                           │  │  ┌─────────────────────────────┐  ││
│    │  │                           │  │  │  ✓ Confirm & Proceed →      │  ││
│    │  │                           │  │  │  ◀ Go Back                  │  ││
│    │  │                           │  │  └─────────────────────────────┘  ││
│    │  └───────────────────────────┘  └───────────────────────────────────┘│
└────┴──────────────────────────────────────────────────────────────────────┘
```

**Information hierarchy:**
1. (Dominant) The editable sub-contractor table — this is where the user's attention must go
2. (Contextual) Agent summary message — brief, not verbose
3. (Action) Add row / Confirm / Go Back

**Table interaction rules:**
- All cells are click-to-edit inline (no separate edit modal)
- Row delete: trash icon appears on row hover, far right
- Manually added rows are visually tagged with `[Added by you]` in a muted pill
- On confirm, the table locks (read-only) and the agent plan is committed to the audit trail

---

## SCREEN 5 — File 2 + 3 Processing Layout

**Pattern:** Same two-column as Screen 2 (Progress Rail + Activity Feed) but Step 5 is now running.

**Additional element — Per-step sub-progress:**
When Step 5 is running, the step card in the Progress Rail expands to show a mini progress indicator:

```
┌─ Step 5 ──────────────────── ⟳ ─────────────────┐
│  Extract File 2: Sub-Contractors                  │
│  [████████████░░░░░░░░░░░░░░░] 8 of 14            │
│  Currently: Delta Plumbing Inc (pages 19–24)      │
└───────────────────────────────────────────────────┘
```

This gives the user precise progress without forcing them to read the Activity Feed.

**Activity Feed continues streaming** per-sub-contractor outcomes with colour coding:
- Green: normal extraction
- Amber: variance detected (flagged for exception)
- Red: extraction failed (will require manual entry)

**No user action required on this screen.** The status badge in the Global Header updates live: *"Processing · File 2 · 8/14 subs"*

---

## SCREEN 6 — Processing Complete Summary Layout

**Pattern:** Centred summary card — max-width 800px, centred in main content area

```
┌─────────────────────────────────────────────────────────────────────────┐
│  GLOBAL HEADER                               [✓ Processing Complete]    │
├────┬────────────────────────────────────────────────────────────────────┤
│NAV │                                                                     │
│    │   ┌─────────── Processing Complete ─────────────────────────┐     │
│    │   │  ✓ All Steps Complete                                    │     │
│    │   │  Highway Bridge Renovation · June 2026                   │     │
│    │   │                                                          │     │
│    │   │  ┌──────────┬──────────────┬──────────┬───────────────┐│     │
│    │   │  │ Extracted│ Auto-cleared │Exceptions│  $ at Risk    ││     │
│    │   │  │   642    │ 612 (95%)    │    30    │   $141,600    ││     │
│    │   │  └──────────┴──────────────┴──────────┴───────────────┘│     │
│    │   │                                                          │     │
│    │   │  Exceptions by type:                                    │     │
│    │   │  🔴 Math errors              5 items · $28,400          │     │
│    │   │  🟠 File 1 vs File 2 variance  12 items · $78,900       │     │
│    │   │  🟡 Low confidence OCR        8 items · $21,300         │     │
│    │   │  🟡 Missing evidence (File 3) 5 items · $13,000         │     │
│    │   │                                                          │     │
│    │   │                     [Begin Review →]                    │     │
│    │   └──────────────────────────────────────────────────────┘     │
└────┴────────────────────────────────────────────────────────────────────┘
```

**Information hierarchy:**
1. (Dominant) The 4-stat summary row — the "how did it go?" answer
2. (Secondary) Exception breakdown by type with colour-coded risk levels
3. (Single action) Begin Review — no secondary options, no back button

---

## SCREEN 7 — Validation Workbench (Exception Review) Layout

**Pattern:** Three-zone master-detail — Exceptions Navigator (left) + Data Grid (centre) + Evidence Viewer (right)

This is the highest-density, highest-use screen in the application. Every pixel is deliberate.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ GLOBAL HEADER                    [In Review · 12 exceptions remain]  [Mark Ready]│
├────┬──────────────────┬──────────────────────────────┬───────────────────────────┤
│    │ EXCEPTIONS NAV   │   DATA GRID                  │   EVIDENCE VIEWER         │
│    │ (280px fixed)    │   (flexible, ~45%)           │   (flexible, ~35%)        │
│NAV │                  │                              │                           │
│    │ ┌─ Math Errors ─┐│ ┌──────────────────────────┐│ ┌─────────────────────────┐│
│    │ │ 5 items $28K  ││ │ ≡ Math Errors             ││ │  FILE 1  │  FILE 2       ││
│    │ │ ● ● ● ● ●    ││ │ [Select All] [Bulk Accept]││ │  Page 12                ││
│    │ └───────────────┘│ ├──────────────────────────┤│ │  ┌──────────────────┐  ││
│    │                  │ │Sub │Desc    │F1    │F2    ││ │  │  [PDF RENDERED]  │  ││
│    │ ┌─ Variance ────┐│ ├────┼────────┼──────┼──────┤│ │  │                  │  ││
│    │ │ 12 items $79K ││ │ABC │Matl Strd│$45K │$50K  ││ │  │  ┌────────────┐  │  ││
│    │ │ ● ✓ ● ● ✓... ││ │    │        │      │      ││ │  │  │ $45,000 ←  │  │  ││
│    │ └───────────────┘│ │    │[Accept]│[Ovrd]│      ││ │  │  │ HIGHLIGHTED│  │  ││
│    │                  │ ├────┼────────┼──────┼──────┤│ │  │  └────────────┘  │  ││
│    │ ┌─ Low Conf. ───┐│ │Dlta│Sched V │$87K  │$91K  ││ │  │                  │  ││
│    │ │ 8 items $21K  ││ │    │[Accept]│[Ovrd]│      ││ │  └──────────────────┘  ││
│    │ └───────────────┘│ ├────┼────────┼──────┼──────┤│ │                         ││
│    │                  │ │... │        │      │      ││ │  ◀ Prev exception        ││
│    │ ┌─ Missing Evid ┐│ └──────────────────────────┘│ │  ▶ Next exception        ││
│    │ │ 5 items $13K  ││                              │ └─────────────────────────┘│
│    │ └───────────────┘│                              │                           │
├────┴──────────────────┴──────────────────────────────┴───────────────────────────┤
│  ACTION BAR (fixed 48px)   [Accept Selected (3)]  [Override Selected]  [Escalate]│
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**

**Exceptions Navigator (left, 280px fixed):**
- Each group is a collapsible accordion showing resolved ✓ and unresolved ● dots per item
- Groups are ordered by $ at risk (highest first)
- Resolved groups collapse to a single green check row to de-clutter

**Data Grid (centre, flexible):**
- Shows ONLY exceptions for the selected group (not all 642 rows)
- Columns always include: File 1 value, File 2 value, Variance
- Row selection with checkboxes for bulk actions
- Inline editing opens within the row — no separate modal

**Evidence Viewer (right, flexible):**
- PDF rendered using `react-pdf` (canvas-based, not `<iframe>`)
- Bounding box of the extracted value is highlighted in amber on the canvas
- Tab strip to switch between File 1 and File 2 evidence
- Synchronised: clicking a different row in the grid updates the PDF automatically

**Action Bar (bottom, 48px fixed):**
- Context-sensitive: shows actions relevant to selected rows
- Bulk Accept, Override (requires comment), Escalate

---

## SCREEN 8 — HITL Confirmation Gate Layout

**Pattern:** Overlay panel (not full-screen modal) sliding in from the right — the workbench remains visible behind it, greyed out

```
┌──────────────────────────────────────────────────────────┬─────────────────────┐
│  WORKBENCH (dimmed / inert)                              │  CONFIRMATION PANEL │
│                                                          │  (400px slide-in)   │
│                                                          │                     │
│                                                          │  ✓ Review Complete  │
│                                                          │                     │
│                                                          │  Summary:           │
│                                                          │  612 auto-cleared   │
│                                                          │  25 accepted        │
│                                                          │  3 overridden       │
│                                                          │  2 escalated        │
│                                                          │                     │
│                                                          │  Your name + date   │
│                                                          │  will be logged.    │
│                                                          │                     │
│                                                          │  [Confirm & Submit] │
│                                                          │  [◀ Back to Review] │
└──────────────────────────────────────────────────────────┴─────────────────────┘
```

**Why a slide-in panel, not a modal:**
- Users can still see the workbench behind them — they are not abruptly removed from context
- Feels deliberate and weighty (this is a significant action) without being disruptive

---

## Design System Requirements (Cross-Screen)

### Typography Scale
| Role | Size | Weight | Usage |
|---|---|---|---|
| Screen title | 20px | 600 | Section headers |
| Table header | 11px | 700 uppercase | `<th>` labels |
| Table body | 13px | 400 | Data cells |
| Label | 11px | 600 | Form labels, step names |
| Caption | 10px | 500 | Metadata, timestamps |
| Activity feed | 13px | 400 | Log messages |

### Status Colour System (Semantic, token-mapped)
| State | Background | Border | Text | Token |
|---|---|---|---|---|
| Processing / Running | `#eff6ff` | `#3b82f6` | `#1d4ed8` | `--status-running` |
| Paused / Awaiting | `#fffbeb` | `#f59e0b` | `#92400e` | `--status-paused` |
| Complete / Valid | `#f0fdf4` | `#22c55e` | `#15803d` | `--status-complete` |
| Error | `#fef2f2` | `#ef4444` | `#991b1b` | `--status-error` |
| Warning / Exception | `#fff7ed` | `#f97316` | `#9a3412` | `--status-warning` |

### Icon System
Replace all emoji with **Lucide React** icon components. Key mappings:
- 📄 → `<FileText />` — documents
- 🤖 → `<Bot />` — AI agent actions
- ✓ → `<CheckCircle2 />` — completed states
- ⚠ → `<AlertTriangle />` — warnings
- 🗑 → `<Trash2 />` — delete actions
- ← → `<ChevronLeft />` — navigation