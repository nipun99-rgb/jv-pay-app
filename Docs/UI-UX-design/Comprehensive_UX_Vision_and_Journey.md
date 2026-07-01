# Comprehensive UX/UI Vision & Journey Definition

**Version:** 1.0  
**Owner:** Product Management & Design  
**Frameworks Applied:** Jobs-to-be-Done (JTBD), Material Design 3 (M3), WCAG 2.2 AA, NNG 10 Heuristics, Google HEART, Contentsquare 3-Layer 

---

## 1. Executive Summary
The current frontend (built with React) was developed iteratively, leading to disjointed user flows and fragmented CSS variables. While the backend functions well for the 12-stage processing spine, the UI lacks macro-level coherence. 

Instead of treating frameworks as separate checkboxes, this document unifies them to define a **future-state user journey** and **target layout architecture**. The overarching goal is to pivot from a "feature-centric" layout (files, extractions, modals) to an "outcome-centric" workspace (exceptions, reviews, approvals) mapped exactly to the 4 Front Doors outlined in the business documentation.

---

## 2. Jobs-to-be-Done (JTBD) & The Revised User Journey

The UI must reflect *why the user is hiring this product*. The user does not want to "Run Extraction"; they want to "Clear a payment application with confidence."

### 2.1 Primary JTBD
* **The Invoice Reviewer:** "When a 1,000-page monthly package arrives, I want the system to isolate the 5% that failed validation, so I can clear the package in 10 minutes instead of 3 days."
* **The Finance Approver:** "When I am asked to approve payment, I want a single-screen summary of financial risk and exceptions, so I can legally sign off without opening the underlying PDFs."

### 2.2 The Unified "Happy Path" Journey (Future State)
1. **The Inbox (Global View):** User lands on a dashboard replacing the raw `ProjectTiles.jsx`. It shows pending packages across workflows (Contract Onboarding vs. Monthly Package).
2. **The Upload & Digest:** User triggers "New Package". A background non-blocking toast (M3 Snackbar) tracks ingest/classification progress. 
3. **The Cockpit (Triage View):** User clicks into the package. Instead of a file browser, the UI defaults to the **Review Summary**:
   * *1,180 line items cleared.*
   * *18 Exceptions grouped by risk.*
4. **The Split-Pane Resolution:** User clicks an exception. The M3 "Supporting Pane" opens: Side-by-side view with extracted value (left) and the source PDF page scaled to the exact coordinate (right).
5. **The Approval Hand-off:** One click bulk-resolves items, immediately routing the clean contract to Finance.

---

## 3. Future Layout Architecture (Material Design 3)

The current codebase utilizes ad-hoc CSS (`App.css`, `JourneyPanel.css`) with hardcoded values (e.g., `#f8f9fc`, `#6366f1`). We will migrate to an **M3 Canonical Layout**.

### 3.1 M3 Spatial System
* **Navigation (Sidebar):** Move from a rigid `260px` sidebar to an **M3 Navigation Rail** (collapsed) / **Navigation Drawer** (expanded) to maximize horizontal real estate for documents.
* **Primary Layout Mode:** **List-Detail Canonical Layout**
  * *Left Pane (35%):* Exception groupings, risk-ranked worklist. 
  * *Right Pane (65%):* Contextual detail (Data grid + PDF Evidence view).
* **Elevation & Tokens:** Replace hardcoded shadows (`0 4px 12px rgba(...)`) with M3 Elevation Tokens (e.g., `var(--md-sys-elevation-2)`).

### 3.2 Design Token Hygiene
To support WCAG 2.2 AA Contrast dynamically (Dark/Light mode), we must refactor `App.css`.
* **Current Gap:** Core colors are hardcoded.
* **Future State Example:** 
  ```css
  :root {
    --md-sys-color-primary: #005ac1;
    --md-sys-color-background: #fdfcff;
    --md-sys-color-surface-container: #ebeef5;
  }
  ```

---

## 4. Current State Gaps Synthesis (The Frameworks)

While I am not delivering separate audits, here is the synthesis of our highest-impact UI/UX violations evaluated against our standard frameworks:

### A. Accessibility (WCAG 2.2 AA)
* **Gap:** Focus Management & ARIA. In `NewProjectModal.jsx` and `Sidebar.jsx`, keyboard focus gets trapped. Contrast ratios on disabled buttons (`#ececec` on `#ffffff`) fail the 4.5:1 AA requirement.
* **Fix:** Introduce `aria-live="polite"` for extraction status updates (currently silent to screen readers) and enforce WCAG color token mapping.

### B. NNG 10 Heuristics
* **Gap:** Visibility of System Status (Heuristic #1). In `JourneyPanel.jsx`, the polling mechanism sets `extracting: true` but provides negligible contextual feedback if a timeout occurs or what *state* the extraction is in.
* **Gap:** User Control and Freedom (Heuristic #3). Users cannot reliably "undo" a deleted project. `ProjectView.jsx` uses standard `window.confirm`, which pauses the single thread and offers no graceful recovery.

### C. Contentsquare "What/Struggle/Cause" Analysis
**(For the Engineering Backlog)**

* **Bug 1:** PDF Viewer Context Loss
  * **What:** Users lose their spot in the data grid when checking the PDF.
  * **Struggle:** Friction and excessive scrolling. Users rage-click between the data table and the PDF modal.
  * **Cause:** Mobile/desktop breakpoints in `SplitPane.jsx` do not properly synchronize the PDF coordinates with the active Data Table row.

* **Bug 2:** Upload Feedback Desert
  * **What:** The upload interaction in `JourneyPanel`. 
  * **Struggle:** Users abandon the page thinking it froze.
  * **Cause:** `handleUpload` blocks UI without an intermediate progress bar or chunking feedback.

---

## 5. Google HEART Metrics (Backlog Framing)

To ensure these improvements are measurable, we will track the UI refactor against these HEART signals:

* **Happiness:** NPS/CSAT on the Monthly package clearance workflow. (Target: +1.5 lift).
* **Engagement:** Number of exceptions bulk-resolved vs individually clicked. 
* **Adoption:** Adoption rate of the new "Cockpit Summary" view versus the legacy file-browser view.
* **Retention:** N/A for internal B2B tooling, but substitute with "Task Abandonment".
* **Task Success:** **Primary Metric** - Time to auto-clear a 100-page package + manually resolve 10 exceptions. (Target: Reduce from 45 mins to < 10 mins).

---

## 6. Next Steps & Execution Plan
1. **Token Migration:** Engineering to implement M3 Design Tokens using CSS Variables or Tailwind preset.
2. **Component Restructure:** Refactor the `SplitPane` and `JourneyPanel` into the `List-Detail` Material pattern.
3. **Cockpit First:** Build the missing "Review Summary" layer before the user enters the file/table view.