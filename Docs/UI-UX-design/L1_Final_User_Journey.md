# Final L1 User Journey (Enterprise Operations Architecture)

**Owner:** Product Management & Design
**Goal:** Align UI flow with enterprise operations paradigms: intelligent queuing, automated work allocation, and exception-based triage.

---

### 1. Global Command Center & Queue Management (The Inbox)
*Where work is prioritized, allocated, and monitored against SLAs.*
* **Unified Queues:** Packages are automatically routed to the right persona (Invoice Reviewers, Commercial Reviewers, Finance Approvers, Data Stewards) based on RBAC and business rules.
* **Work Allocation:** Supervisors can manually assign high-value packages, or users can autonomously "pull" the next highest-priority item from the pool.
* **Queue Health:** Visual SLA indicators (e.g., "Due in 2 hrs"), aging workflows, and "Total $ Value at Risk" pending in the queue to drive prioritization.

### 2. Ingestion, AI Processing & Telemetry
*Where the AI acts as the silent, high-speed junior auditor.*
* **Non-Blocking Ingestion:** Users drop packages into the hopper and immediately return to their queue.
* **System Telemetry:** Real-time pipeline statuses (Ingesting → Classifying → Extracting → Reconciling) visible via polite, globally pinned background monitors, rather than obtrusive log dumps.

### 3. The Triage Cockpit (Macro Exception Assembly)
*Where the user makes macro-risk decisions instead of reading files page-by-page.*
* **Decision Summary:** Displays total validation confidence upfront (e.g., "612 of 640 lines auto-cleared. 100% Math Match.").
* **Risk-Ranked Worklist:** Exceptions are aggregated proactively (e.g., grouped as "12 Rate Mismatches", "4 Missing Lien Waivers") and prioritized by highest dollar impact.
* **Micro-Routing:** Capability to escalate specific technical exceptions (like scope/contract baseline changes) to the Commercial Reviewer while continuing to work the rest of the package.

### 4. Contextual Exception Handling (The Validation Workbench)
*Where micro-level overrides and data corrections happen.*
* **Synchronized Evidence:** The Split-Pane View. The left pane houses the editable data grid; the right pane displays the exact PDF location bounding-box evidence, auto-panning as the user navigates rows.
* **AI Recommendations:** The system explicitly suggests the fix (e.g., *"Accept mathematically corrected value of $540"*).
* **Correction & Commenting:** User overrides require standard reason codes (e.g., "Bad OCR", "Agreed Overbill") and an audit comment, preserving strict liability trails for Finance.

### 5. Multi-Tier Approval Hand-off
*Where liability is signed off.*
* **Executive Summary:** The Finance Approver receives a synthesized, one-screen view: Total approved, items overridden, $ at risk bypassed, and reviewer notes. No need to open the PDF.
* **Action Engine:** Approve, Approve-with-exceptions, or automated Rejection emails generated back to the Subcontractor/Vendor. 

### 6. Audit, Reporting & The Learning Loop
*Where the system gets smarter and leadership tracks efficiency.*
* **Data Stewardship:** Master data anomalies (e.g., new unrecognized vendor names) are automatically routed into a secondary Data Steward queue.
* **Operational Analytics:** Leader view tracking Cycle Times (MTTR), Straight-Through-Processing (STP) rates, and AI accuracy metrics to prove ROI.