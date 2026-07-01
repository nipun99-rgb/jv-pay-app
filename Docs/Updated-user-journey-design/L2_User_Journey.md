# L2 User Journey — Invoice Review & Validation Platform

**Version:** 1.0 · July 1, 2026
**Owner:** Product Management & Design
**Persona:** Invoice Reviewer (primary), with hand-off points to Finance Approver
**Scope:** Full 16-step Day-in-a-Life workflow from package receipt to start of formal invoice validation

---

## Journey Map Overview

```
SCREEN 1            SCREEN 2               SCREEN 3                    SCREEN 4
Package Intake  →   Upload & Ingest    →   File 1 Processing       →   Agent Plan Review
(Upload 3 files)    (Classify & confirm)   (GC Cover + G703)           (Sub list confirm)
                                                ↓
SCREEN 8            SCREEN 7               SCREEN 6                    SCREEN 5
HITL Gate       ←   Exceptions Review  ←   Agent Complete Summary  ←   File 2+3 Processing
(Confirm ready)     (Resolve all flags)     (All files done)            (Subs + Support docs)
                         ↓
                    SCREEN 9
                    Formal Validation
                    (Step 16 — TBD)
```

---

## SCREEN 1 — Package Intake (New Monthly Package)

**User action that triggers this screen:** User clicks "New Package" from the Global Dashboard.

**What the user sees:**
- A stepped intake modal or dedicated page titled **"Start New Monthly Package"**
- Three clearly labelled file upload zones, presented sequentially:
  1. **File 1 — Consolidated / Summary Invoice** *(GC Cover Page + Continuation Sheet)*
  2. **File 2 — Sub-Contractor Breakdown** *(All sub-contractor invoices compiled)*
  3. **File 3 — Supporting Documents** *(Direct cost backup billed by contractor)*
- Each zone accepts drag-and-drop or click-to-upload
- A billing period selector (Month + Year) to tag the package
- A "Contract" selector to associate this package with an existing contract baseline
- A **"Begin Processing"** primary CTA — enabled only when at least File 1 is uploaded

**Rules & logic:**
- File 2 and File 3 can be uploaded now or added later (the user knows which file is which — no classification needed)
- If only File 1 is uploaded, the system notes File 2 and File 3 as "Pending — add before final review"
- Duplicate file detection: if the same file hash exists for this contract + billing period, warn the user before allowing overwrite

**System state:** Idle — no processing started yet

**Transition trigger:** User clicks "Begin Processing"

---

## SCREEN 2 — Ingestion, Classification & Preliminary Confirmation

**User action that triggers this screen:** "Begin Processing" clicked on Screen 1

**What the user sees:**
- The screen transitions to the **Agent Progress View** — a full-width workspace divided into two zones:
  - **Left zone (40%):** A vertical **Agent Progress Rail** showing all upcoming processing stages as a numbered step list (see layout spec for detail). Each step is in `pending` state initially.
  - **Right zone (60%):** A live **Activity Feed** — human-readable, business-language messages replacing the raw developer log. Example messages:
    - *"Receiving File 1 — Consolidated Invoice (12.4 MB)…"*
    - *"✓ File 1 received successfully — 47 pages detected"*
    - *"Receiving File 2 — Sub-Contractor Breakdown (28.1 MB)…"*
    - *"✓ File 2 received — 183 pages detected"*
    - *"Performing preliminary document check…"*

**Agent Progress Rail — Steps shown (all pending at start):**
1. ✓ File Upload & Receipt
2. ⟳ Preliminary Classification
3. ○ File 1: Extract GC Cover + G703
4. ○ Agent Plan: Identify Sub-Contractors ← **PAUSE POINT**
5. ○ File 2: Extract Sub-Contractor Invoices
6. ○ File 3: Extract Supporting Documents
7. ○ Cross-File Reconciliation
8. ○ Exception Assembly
9. ○ Ready for Review

**System doing in background:**
- Ingesting all uploaded files
- Running preliminary classification checks (page count, file integrity, basic type detection)
- If a file fails integrity check (encrypted, corrupt): flag it immediately, quarantine it, continue with others

**Preliminary Confirmation Gate (mid-screen):**
After classification completes, the Activity Feed shows a **confirmation card**:
> *"Preliminary check complete. Here is what I found:"*
> - File 1: 47 pages — GC Pay Application detected ✓
> - File 2: 183 pages — Sub-Contractor Package detected ✓
> - File 3: Not uploaded — you can add it before final review
>
> *Any issues?* **[Confirm & Continue]** **[Cancel]**

**Rules & logic:**
- If the user sees a mismatch (e.g., File 2 was uploaded in the wrong slot), they cancel here and re-upload
- This is a soft gate — the user can override any auto-detected issue and proceed

**Transition trigger:** User clicks "Confirm & Continue"

---

## SCREEN 3 — File 1 Processing: GC Cover Page + Continuation Sheet (G703)

**User action that triggers this screen:** User confirms on Screen 2

**What the user sees:**
- The Agent Progress Rail updates: Step 3 transitions to **Running (animated spinner)**
- Activity Feed streams human-language progress:
  - *"Reading GC Cover Page (G702)…"*
  - *"Extracting contract sum, billing period, retainage…"*
  - *"Reading Continuation Sheet (G703) — 42 line items detected…"*
  - *"Validating math: Scheduled Value totals… ✓"*
  - *"Saving 42 line items to database…"*
  - *"✓ File 1 processing complete"*
- The user is **not blocked**. They can leave this screen, check other projects, and return. The rail persists.

**Completion signal:**
When Step 3 turns to a green check ✓, a **summary pill** appears on the step:
> *"42 line items · $2,340,000 scheduled · 14 sub-contractors billed"*

The sub-contractor count (14) is the key output that feeds into Step 4.

**Transition trigger:** Automatic — system immediately proceeds to Step 4 (Agent Plan) and **pauses**, awaiting user confirmation

---

## SCREEN 4 — Agent Plan Review: Sub-Contractor Confirmation ⭐ (KEY INTERACTION)

**User action that triggers this screen:** Automatic transition when File 1 processing completes — the Progress Rail step 4 turns **amber/orange** (paused state) and the right zone changes.

**What the user sees:**
The right zone (Activity Feed) transitions to a structured **Agent Plan Card**:

---
> ### 🤖 Agent Plan — Ready for Your Review
>
> I have read File 1 and identified the following **14 sub-contractors** billed in this invoice. I will use this list to process File 2.
>
> **Please review, edit if needed, and confirm before I proceed.**
>
> | # | Sub-Contractor Name | Expected Invoice # | Billed Amount (File 1) |
> |---|---|---|---|
> | 1 | ABC Electrical Works | App #12 | $124,500 |
> | 2 | Delta Plumbing Inc | App #8 | $87,200 |
> | 3 | … | … | … |
> | 14 | Pinnacle Steel LLC | App #5 | $340,000 |
>
> **[+ Add Sub-Contractor]** &nbsp;&nbsp; *Edit any row inline*
>
> ---
> Once confirmed, I will locate each sub-contractor's invoice in File 2, extract and validate their data.
>
> **[✓ Confirm & Proceed to File 2]** &nbsp;&nbsp; **[◀ Go Back]**

---

**What the user can do:**
- **Edit inline:** Click any name or invoice number to correct it (e.g., a misspelled name)
- **Add a row:** Click "+ Add Sub-Contractor" to manually add an expected sub that the agent missed
- **Remove a row:** Each row has a delete icon — remove a sub-contractor if it was incorrectly identified
- **Confirm & Proceed:** Locks the plan and instructs the agent to continue

**Rules & logic:**
- The agent's identified list is editable because OCR confidence on sub-contractor names may be imperfect
- User additions are flagged as "manually added — no File 1 evidence" to preserve audit trail
- This plan becomes the **reconciliation baseline** for Step 10 (File 2 vs. Plan comparison)
- The system saves this confirmed plan as an immutable record

**System state while waiting:** Step 4 on the Progress Rail shows a pulsing amber dot and the label **"Waiting for your confirmation"**

**Transition trigger:** User clicks "Confirm & Proceed to File 2"

---

## SCREEN 5 — File 2 + File 3 Processing (Agent Runs Unattended)

**User action that triggers this screen:** User confirms on Screen 4

**What the user sees:**
- Progress Rail steps 5 and 6 run sequentially (or concurrently if File 3 is available):
  - **Step 5: File 2 — Sub-Contractor Invoices**
  - **Step 6: File 3 — Supporting Documents** (if uploaded)
- Activity Feed streams per-sub-contractor progress for File 2:
  - *"Locating ABC Electrical Works invoice in File 2… found on pages 12–18 ✓"*
  - *"Extracting ABC Electrical Works: Cover page + 6 continuation lines…"*
  - *"✓ ABC Electrical Works — $124,500 extracted"*
  - *"Locating Delta Plumbing Inc invoice… found on pages 19–24 ✓"*
  - *"⚠ Delta Plumbing Inc — Amount extracted: $91,400. File 1 shows $87,200. Flagged."*
  - *"[2/14] Sub-contractors complete…"*
- A **mini progress bar** within Step 5 shows `2 of 14 sub-contractors processed`

**Cross-file reconciliation (Step 7) runs automatically after Step 5:**
- Activity Feed: *"Comparing File 2 results against confirmed plan…"*
- *"14 sub-contractors expected. 14 found in File 2. ✓"*
- Or: *"⚠ 13 of 14 sub-contractors found. Missing: Pinnacle Steel LLC — flagged as exception."*

**User is non-blocked throughout.** A persistent **status badge** in the top header (global) shows: *"Package Processing — 5 of 14 subs done"* so users can monitor from any screen.

**Transition trigger:** Automatic when Steps 5, 6, 7, 8 all complete → Screen 6

---

## SCREEN 6 — Agent Complete: Processing Summary

**User action that triggers this screen:** Automatic when all agent processing steps finish

**What the user sees:**
The Agent Progress Rail all shows green checks ✓. The right zone transitions to a **Processing Complete Summary Card** — the key "here is what I found" moment before review:

---
> ### ✓ Processing Complete — Package Ready for Your Review
> **Billing Period:** June 2026 &nbsp;|&nbsp; **Contract:** Highway Bridge Renovation
>
> | | Count | Value |
> |---|---|---|
> | Total line items extracted | 642 | — |
> | **Auto-cleared (no issues)** | **612 (95%)** | $2,198,400 |
> | **Exceptions requiring review** | **30 (5%)** | $141,600 at risk |
>
> **Exceptions by type:**
> - 🔴 Math errors: 5 items · $28,400
> - 🟠 Amount variance (File 1 vs File 2): 12 items · $78,900
> - 🟡 Low confidence extraction: 8 items · $21,300
> - 🟡 Missing evidence (File 3): 5 items · $13,000
>
> **[Begin Review →]**

---

**Why this screen matters:** The user makes a **go/no-go decision** before entering the review workbench. If the volume of exceptions is unexpectedly high, they can pause, escalate, or request a re-run before investing review time.

**Transition trigger:** User clicks "Begin Review"

---

## SCREEN 7 — Exception Review: The Validation Workbench

**User action that triggers this screen:** User clicks "Begin Review" on Screen 6

**What the user sees:**
The full validation workbench with a **3-zone layout:**

**Zone A — Left Rail (20%): Exceptions Navigator**
- Grouped list of all 30 exceptions, organised by type (Math Errors, Variance, Low Confidence, Missing Evidence)
- Each group shows item count and total $ at risk
- Clicking a group filters Zone B
- Individual exception rows show: sub-contractor name, amount, exception type
- Resolved exceptions collapse with a green ✓

**Zone B — Centre (45%): Data Grid (active exceptions)**
- Shows only the exception items relevant to the selected group
- Columns: Sub-Contractor, Description, File 1 Amount, File 2 Extracted, Variance, AI Confidence, Status
- Each row has: **[Accept AI]** **[Override]** **[Flag for Escalation]** actions
- Bulk action toolbar: select multiple rows of same type → **[Bulk Accept]** **[Bulk Reject]**
- Accepted rows turn green and move to "Resolved"
- Override opens an inline edit field + mandatory comment/reason

**Zone C — Right Pane (35%): Evidence Viewer**
- Displays the source PDF synchronized to the selected row
- **Auto-highlights the exact bounding box** of the extracted value on the PDF
- Tabs to switch between File 1 evidence and File 2 evidence for cross-file exceptions
- Navigation arrows to move to adjacent exceptions without returning to the grid

**User flow within this screen:**
1. Start with highest-risk group (Math Errors, $28,400)
2. Review each item with evidence in Zone C
3. Accept or override with comment
4. Move to next group
5. When all 30 are resolved (Exceptions Navigator shows all green), the **"Mark as Ready" CTA activates**

**Transition trigger:** User clicks **"Mark as Ready for Validation"** — all exceptions must be resolved or formally escalated

---

## SCREEN 8 — HITL Confirmation Gate

**User action that triggers this screen:** User clicks "Mark as Ready for Validation"

**What the user sees:**
A confirmation dialog (not `window.confirm` — a styled modal):

---
> ### ✅ Confirm Review Complete
>
> You are about to mark this package as reviewed and ready for formal invoice validation.
>
> **Summary of your review:**
> - 612 items auto-cleared ✓
> - 25 exceptions accepted (with AI recommendation)
> - 3 exceptions overridden (comments recorded)
> - 2 items escalated to Commercial Reviewer
>
> This action is recorded in the audit trail with your name and timestamp.
>
> **[Confirm & Submit for Validation]** &nbsp;&nbsp; **[Go Back to Review]**

---

**Rules & logic:**
- This action is logged: reviewer name, timestamp, exception resolution summary
- If any exception remains unresolved, the "Confirm" button is disabled with a tooltip: *"2 unresolved exceptions remain"*
- Escalated items route to the Commercial Reviewer's queue in parallel — this does not block submission

**Transition trigger:** User confirms → Package status changes to **"Awaiting Formal Validation"**

---

## SCREEN 9 — Formal Invoice Validation (Entry Point — Step 16)

**Status:** To be designed in next sprint based on formal validation rules.

**Entry state handed off from Screen 8:**
- All 3 files extracted and stored in SQL
- Confirmed agent plan (sub-contractor list) saved
- All exceptions resolved or escalated with audit comments
- Package status: `HITL_COMPLETE`

**Known inputs for the validation engine:**
- Extracted GC Cover Page + G703 data (File 1)
- Extracted sub-contractor application data per sub (File 2)
- Extracted supporting document data (File 3)
- Cross-file reconciliation results
- HITL reviewer decisions and override comments

---

## State Transition Diagram

```
[DRAFT]
  → User uploads files + clicks Begin Processing
[INGESTING]
  → Classification complete + user confirms
[FILE_1_PROCESSING]
  → File 1 done, agent pauses
[AWAITING_PLAN_CONFIRMATION]  ← USER GATE
  → User edits/confirms sub-contractor list
[FILE_2_3_PROCESSING]
  → All files done, reconciliation complete
[PROCESSING_COMPLETE]
  → User clicks Begin Review
[IN_REVIEW]
  → All exceptions resolved, user confirms
[AWAITING_PLAN_CONFIRMATION]
  → User clicks Confirm & Submit
[HITL_COMPLETE]
  → Formal validation pipeline triggered
[IN_VALIDATION]  ← Step 16
```
