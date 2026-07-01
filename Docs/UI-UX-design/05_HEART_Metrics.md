# 05 — Google HEART Framework: Metrics for the Backlog

**Date:** July 1, 2026
**Reviewer:** Senior PM / Design Specialist
**Purpose:** Map every identified UX gap to a measurable product signal so engineering decisions are tied to real outcomes, not vague "usability improvements". This framing allows the backlog to be prioritised by impact.

---

## Framework Overview

For an invoice review operations platform, the most critical HEART dimension is **Task Success** — the system either correctly clears invoices or it doesn't. The other four dimensions support it.

---

## H — Happiness (User Satisfaction)

**Goal:** Users feel *in control* and *confident* when reviewing invoice packages, not anxious or confused.

**Current state producing unhappiness:**
- Users see `OutputPanel.jsx` developer logs during processing. Raw messages like `"✓ Azure GPT returned 14 items"` do not tell users whether their package is progressing correctly or heading toward failure.
- No extraction completion summary. When `JourneyPanel.jsx` phase completes, the card turns green and shows an item count. There is no moment of "here is what the agent found" to build user trust.
- `window.confirm()` delete dialogs. These look broken/archaic in a modern operations UI and undermine confidence in the product's quality.

**Signal to track:**
- Post-session CSAT survey: "How confident are you that the invoice was reviewed correctly?" (Target: ≥4.2/5.0)
- Measure rate at which users click away from the application mid-processing (session abandonment during a running extraction).

**Backlog items:**
- Replace `OutputPanel` with a structured agent progress card showing business-language milestone messages.
- Add a "Completed — Here's What We Found" confirmation card after each phase, before proceeding to the next.

---

## E — Engagement (Depth of Feature Use)

**Goal:** Users engage with the validation tools provided (badges, corrections, bulk actions) rather than bypassing the system and making decisions outside the application.

**Current state producing low engagement:**
- `handleRevalidateItem()` exists in `ProjectDetail.jsx` and correctly re-validates a single row via `POST /validate-ai/item/:id`. It is never exposed to the user. They cannot selectively re-validate after making a correction.
- `DataTable.jsx` has a `filterThisPeriod` state variable but the toggle button that controls it is never rendered. The power feature exists in code but is dead in the UI.
- `SubcontractorTable.jsx` requires users to manually expand each sub-contractor row. There is no "Show only exceptions" or "Expand all with warnings" shortcut.

**Signal to track:**
- Ratio of exceptions resolved in the application vs. approved-without-resolution (proxy: warnings accepted without a comment).
- Number of cells manually edited per session (higher = AI accuracy issues; lower = users trusting the system).

**Backlog items:**
- Surface the "Re-validate this row" button per-row in `DataTable.jsx` once a cell is edited.
- Add a "Filter: Exceptions only" toggle to both `DataTable.jsx` and `SubcontractorTable.jsx`.
- Expose the `filterThisPeriod` toggle in the UI as a labelled button.

---

## A — Adoption (Using the Right Workflow)

**Goal:** Users process all three files through the application for every monthly package, not just File 1 (the current default behaviour).

**Current state causing low adoption of File 2/3:**
- Phase 3 (File 3 supporting documents) is not implemented. `JourneyPanel.jsx` renders it as a permanently locked card. Users have no choice but to process this file outside the application.
- File 2 (sub-contractor breakdown) has a dedicated extraction flow in Phase 2, but the upload UI (`JourneyPanel.jsx` Phase 2 setup area) only appears when `activePhase === 2 && phase2.status !== "complete"`. This is buried inside the validation view and requires the user to know to look there.

**Signal to track:**
- Percentage of projects that have all three phases in `status: "complete"`.
- Percentage of monthly packages that reach Step 15 (HITL confirmation gate).

**Backlog items:**
- Build File 3 (Phase 3) upload and extraction flow end-to-end.
- Move all three file upload actions to a dedicated "New Package" intake flow at the beginning, not scattered across the project detail view.

---

## R — Retention (Users Return for Every Monthly Cycle)

**Goal:** Every monthly invoice cycle, users choose to process the package through this system. The alternative is Excel/manual review.

**Current state causing churn risk:**
- `ProjectDetail.jsx` models one extraction run per project. There is no concept of a "billing period" or "monthly package." If a user wants to process next month's invoice for the same contractor, they must create a new project, re-upload the baseline, and lose historical context.
- No audit trail or historical view. Users cannot review last month's cleared items or compare trends. This eliminates the compounding value that builds retention.

**Signal to track:**
- Month-over-month active project count (are projects being used for ongoing monthly cycles or one-off use?).
- Time between project creation events per user (are users coming back monthly?).

**Backlog items:**
- Introduce a `Package` model with a billing period tied to a parent `Contract`. One contract should have many monthly packages.
- Build a "History" view showing prior billing period results per contract.

---

## T — Task Success (The Primary Metric)

**Goal:** An Invoice Reviewer can complete the full 16-step day-in-a-life workflow — from package upload to HITL confirmation — with zero manual fallback to external tools.

**Current state producing task failure:**
- **Step 4 (Classification):** There is no classification confirmation screen. Users cannot verify the system correctly identified which file is which.
- **Step 5 (Agent Plan):** There is no plan confirmation step. Users cannot verify the sub-contractor count before File 2 processing starts.
- **Steps 10 (Cross-file reconciliation):** There is no UI showing whether File 2 subcontractor count matched the plan from File 1.
- **Step 13 (File 3):** No implementation. Task fails at this step.
- **Step 14 (Ready for Review):** No explicit "agent complete" state. Users infer completion from logs going quiet.
- **Step 15 (HITL confirmation gate):** No confirmation gate exists. There is no button for the reviewer to formally declare "I have reviewed all exceptions and confirm this is ready for validation."

**Signal to track:**
- **Primary:** Mean Time To Complete (MTTC) a full package — upload to HITL confirmation. (Target: <30 minutes for a standard 3-file package.)
- **Secondary:** Percentage of packages reaching the HITL gate vs. abandoned mid-process.
- **Tertiary:** Number of exceptions present when HITL gate is triggered (lower is better for AI quality; non-zero means the human is needed).

**Backlog items (P0):**
1. Implement the Agent Plan confirmation screen (Step 5).
2. Implement cross-file reconciliation summary (Step 10).
3. Implement File 3 end-to-end (Step 13).
4. Implement the "Agent Complete" summary state (Step 14).
5. Implement the HITL confirmation gate button and state (Step 15).