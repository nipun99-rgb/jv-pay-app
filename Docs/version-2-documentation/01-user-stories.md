# User Stories — JV Pay App v2 (LangGraph Agentic Edition)

**Version:** 2.0  
**Date:** July 2026  
**Status:** Planning  
**Architecture:** LangGraph + TypeScript Gateway + React Premium UI  

---

## Epic 0: Client & Contract Management

### US-0.1: Select or Create Client
**As a** project manager  
**I want to** select an existing client or create a new one  
**So that** contracts and packages are organized under the correct client  

**Acceptance Criteria:**
- Dashboard shows client selector (dropdown or card view)
- User can create a new client with name and optional details
- Client selection persists across session
- Database table: `clients` (id, name, code, created_at, is_active)

---

### US-0.2: Select or Create Contract
**As a** project manager  
**I want to** select an existing contract or create a new one under a client  
**So that** each pay application package is associated with the correct contract  

**Acceptance Criteria:**
- After client selection, user sees contracts for that client
- User can create new contract with: contractNo, contractName, contractorName, ownerName, originalContractSum
- Contract detail shows all associated packages with billing periods
- Database table: `contracts` (id, client_id, contract_no, contract_name, contractor_name, owner_name, original_contract_sum, ...)

---

### US-0.3: Create Package Under Contract
**As a** project manager  
**I want to** create a new pay application package under a specific contract  
**So that** the package is linked to the correct contract and billing period  

**Acceptance Criteria:**
- User selects a contract, then clicks "New Package"
- Must specify billing period (month + year) — unique per contract
- Package status starts as DRAFT
- Package inherits client_id and contract_id
- Database table: `packages` (id, client_id, contract_id, billing_period_month, billing_period_year, package_status, ...)
- Unique constraint: one package per contract per billing period

---

## Epic 1: Package Upload & Ingestion

### US-1.1: Upload Payment Application Package
**As a** project manager  
**I want to** upload PDF files for a pay application package  
**So that** the system can process and extract data automatically  

**Acceptance Criteria:**
- User can drag & drop or browse for PDF files
- System accepts up to 100MB per file, PDF format only
- Upload progress is visible per file
- Files are stored in Azure Blob Storage immediately
- System acknowledges receipt within 2 seconds
- Agent activity panel (right side) shows ingestion status in real-time
- Multiple files can be uploaded simultaneously
- User sees page count per document after upload

**Agent Behavior:**
- Ingest Agent downloads blob, generates page images, stores metadata
- Agent panel narrates: "3 documents received (137 pages total). Generating page images for classification."

---

### US-1.2: View Upload History & Dashboard
**As a** project manager  
**I want to** see all packages with their current status  
**So that** I can track processing and revisit past work  

**Acceptance Criteria:**
- Dashboard shows all packages with status badges (Processing, Awaiting Review, Approved)
- Sortable by date, project, status
- Click into any package to see full detail
- Active packages show live progress indicators
- Multi-user: shows who else is viewing the same package

---

## Epic 2: Document Classification

### US-2.1: Automatic Document Classification
**As a** project manager  
**I want** the system to automatically classify uploaded documents  
**So that** I don't have to manually specify what each file is  

**Acceptance Criteria:**
- System classifies each document as File 1 (GC Pay App), File 2 (Sub Pay Apps), or File 3 (Supporting Docs)
- Classification uses 3-tier cascade: heuristic → LLM → vision model
- Each classification shows confidence score (0-100%)
- Documents with ≥90% confidence are auto-confirmed
- Documents with <90% confidence require user confirmation
- Agent panel explains classification reasoning in full sentences

**Agent Behavior:**
- Classification Agent narrates: "I identified this as File 2 because I found 12 separate G702 forms within the document. Confidence: 94%."
- If escalated: "Heuristic was uncertain (48%). I used LLM analysis and believe this is Supporting Documents (72% confidence). Please confirm."

---

### US-2.2: Confirm or Override Classification
**As a** project manager  
**I want to** confirm or override uncertain classifications  
**So that** extraction proceeds with correct file roles  

**Acceptance Criteria:**
- Only uncertain classifications (<90%) are shown for confirmation
- User sees: document name, proposed type, confidence, reasoning
- User can accept or change to a different type via dropdown
- Confirmation triggers next pipeline stage
- Override is logged to audit trail with timestamp
- Agent panel acknowledges: "Classification confirmed. Proceeding to extraction."

---

## Epic 3: GC Pay Application Extraction (File 1)

### US-3.1: Extract G702 Header (JV PAY Cover Page)

**As a** project manager  
**I want** the system to extract all G702 cover page fields  
**So that** I have structured data for the GC pay application header  

**Extracted Fields → Database Table: `gc_pay_application_headers`**

| # | UI Column Name | DB Column | Type | Description |
|---|---------------|-----------|------|-------------|
| 1 | To Owner | `to_owner` | String | Owner/recipient of application |
| 2 | From Contractor | `from_contractor` | String | JV/contractor submitting application |
| 3 | Project Name | `project_name` | String | Project name or description |
| 4 | Payment Application No. | `application_no` | String | Application or invoice reference number |
| 5 | Period | `period` | String | Billing period label |
| 6 | Period From | `period_from` | String | Start of billing period |
| 7 | Period To | `period_to` | String | End of billing period |
| 8 | Original Contract Sum | `original_contract_sum` | Decimal(18,2) | Original contract value |
| 9 | Net Change by Change Orders | `net_change_orders` | Decimal(18,2) | Net approved change orders to date |
| 10 | Contract Sum to Date | `contract_sum_to_date` | Decimal(18,2) | Current contract value after COs |
| 11 | Total Completed & Stored to Date | `total_completed_stored` | Decimal(18,2) | Total cumulative completed/stored amount |
| 12 | Retainage on Completed Work | `retainage_completed` | Decimal(18,2) | Retainage on completed work |
| 13 | Retainage on Stored Materials | `retainage_materials` | Decimal(18,2) | Retainage on stored materials |
| 14 | Total Retainage | `total_retainage` | Decimal(18,2) | Total retainage withheld |
| 15 | Total Earned Less Retainage | `total_earned_less_ret` | Decimal(18,2) | Earned value after retainage |
| 16 | Less Previous Certificates | `less_prev_certificates` | Decimal(18,2) | Previously certified/paid amount |
| 17 | Current Payment Due | `current_payment_due` | Decimal(18,2) | Current payment requested |
| 18 | Balance to Finish Incl. Retainage | `balance_to_finish` | Decimal(18,2) | Remaining contract balance |
| 19 | Change Order Summary | `change_order_summary` | NVarChar(Max) | Summary of CO additions/deductions |
| 20 | Architect's Signature Present | `architect_signature` | String | Whether architect signature/certification is present |
| 21 | Contractor's Signature Present | `contractor_signature` | String | Whether contractor signature is present |

**Provenance columns (auto-filled by agents, not shown in primary UI but viewable):**
- `source_page`, `extraction_confidence`, `bbox_x`, `bbox_y`, `bbox_width`, `bbox_height`
- `validation_status`, `review_notes`, `agent_run_id`

**Acceptance Criteria:**
- All 21 fields extracted and visible in editable table
- Each field shows confidence score and source page link
- Clicking source page opens PDF iframe at that page with bbox highlight
- Fields are immediately editable (click → type → tab)
- Extraction uses deterministic pdfplumber + regex (primary), LLM vision fallback
- Agent narrates: "G702 header extracted. 21 fields from page 1. All high confidence except 'Net Change Orders' (0.78 — blurry region)."

---

### US-3.2: Extract G703 Continuation Sheet (JV CONTINUATION SHEET)

**As a** project manager  
**I want** the system to extract all G703 SOV line items  
**So that** I have structured schedule of values data  

**Extracted Fields → Database Table: `gc_pay_application_sov_lines`**

| # | UI Column Name | DB Column | Type | Description |
|---|---------------|-----------|------|-------------|
| 1 | Item No. | `item_no` | String | Line item number from continuation sheet |
| 2 | Time Period | `time_period` | String | Billing period/month of the application |
| 3 | Phases | `phases` | String | Project phase/site/WBS grouping |
| 4 | Type of Work | `type_of_work` | String | Work description or billing category |
| 5 | Contractor Name | `contractor_name` | String | Contractor/subcontractor associated with line |
| 6 | Scheduled Original | `scheduled_original` | Decimal(18,2) | Original scheduled value before COs |
| 7 | Scheduled Change Orders | `scheduled_change_orders` | Decimal(18,2) | Change order value applied to line |
| 8 | Scheduled Current | `scheduled_current` | Decimal(18,2) | Current scheduled value after COs |
| 9 | Work Completed Previous | `work_completed_prev` | Decimal(18,2) | Cumulative work completed before current period |
| 10 | Work Completed This Period | `work_completed_this` | Decimal(18,2) | Work billed in current period |
| 11 | Materials Presently Stored | `materials_stored` | Decimal(18,2) | Stored materials not yet installed |
| 12 | Total Completed and Stored | `total_completed` | Decimal(18,2) | Cumulative completed + stored materials |
| 13 | % (G/C) | `pct` | Decimal(18,2) | Completion percentage for line item |
| 14 | Balance to Finish (C-G) | `balance_to_finish` | Decimal(18,2) | Remaining value to complete line item |
| 15 | Retainage (Variable Rate) | `retainage` | Decimal(18,2) | Retainage withheld for line item |

**Cross-reference columns (for reconciliation):**
- `file2_extracted_amount` — matched sub's total for cross-file check
- `cross_file_variance` — calculated mismatch amount
- `file2_matched_sub_app_id` — FK to matching sub header

**Acceptance Criteria:**
- All line items extracted into editable spreadsheet-like table
- All 15 columns visible and editable
- Editing a numeric value recalculates: % (G/C) and Balance to Finish (client-side)
- "Re-validate" button triggers reconciliation re-run
- Uses deterministic pdfplumber coordinate parser (NO LLM — fast, free, reliable)
- Agent narrates: "42 SOV line items extracted from G703 pages 3-8. Deterministic parser — 0.8s processing time."

---

## Epic 4: Extraction Plan & Subcontractor Identification

### US-4.1: Generate Extraction Plan
**As a** project manager  
**I want** the system to identify subcontractors from the G703  
**So that** I can confirm which subs should be extracted from File 2  

**Acceptance Criteria:**
- System groups G703 SOV lines by `contractor_name`
- Presents list of identified subcontractors with line counts
- User can add/remove subcontractors from the plan
- User can mark subs as "confirmed" or "skip"
- Plan confirmation triggers File 2 extraction
- Agent narrates: "I identified 12 subcontractors from the G703. Here's who I'll extract."

### US-4.2: Confirm Extraction Plan
**As a** project manager  
**I want to** confirm the subcontractor list before extraction  
**So that** only relevant subs are processed (saves time and cost)  

**Acceptance Criteria:**
- Confirmation logged to audit trail
- Agent begins File 2 extraction immediately after
- Human gate: graph pauses (`interrupt()`) until user confirms

---

## Epic 5: Subcontractor Extraction (File 2)

### US-5.1: Extract Sub Cover Pages (SUBCONTRACTOR COVER PAGE)

**As a** project manager  
**I want** the system to extract subcontractor G702 header data  
**So that** I have structured cover page data per sub  

**Extracted Fields → Database Table: `sub_pay_application_headers`**

| # | UI Column Name | DB Column | Type | Description |
|---|---------------|-----------|------|-------------|
| 1 | Subcontractor Name | `subcontractor_name` | String | Entity submitting sub pay application |
| 2 | Invoice / Application No. | `application_no` | String | Subcontractor invoice or application number |
| 3 | Application Date | `application_date` | String | Date of subcontractor invoice/application |
| 4 | Period To | `period_to` | String | End date of billed period |
| 5 | Invoice To | `invoice_to` | String | Entity billed by subcontractor |
| 6 | Project Name | `project_name_on_doc` | String | Project or job name |
| 7 | Contract / PO Number | `contract_po_number` | String | Contract, subcontract or PO reference |
| 8 | Original Contract Sum | `original_contract_sum` | Decimal(18,2) | Original subcontract value |
| 9 | Net Change by Change Orders | `net_change_orders` | Decimal(18,2) | Net subcontract CO amount |
| 10 | Contract Sum to Date | `contract_sum_to_date` | Decimal(18,2) | Current subcontract value |
| 11 | Total Completed & Stored | `total_completed_stored` | Decimal(18,2) | Cumulative completed/stored amount |
| 12 | Total Retainage | `total_retainage` | Decimal(18,2) | Total retained amount |
| 13 | Total Earned Less Retainage | `total_earned_less_retainage` | Decimal(18,2) | Earned amount after retainage |
| 14 | Less Previous Certificates | `less_prev_certificates` | Decimal(18,2) | Previously paid/certified amount |
| 15 | Current Payment Due | `current_payment_due` | Decimal(18,2) | Current amount requested |
| 16 | Balance to Finish | `balance_to_finish` | Decimal(18,2) | Remaining subcontract balance |
| 17 | Contractor Signature Present | `contractor_signature` | String | Whether subcontractor signature is present |
| 18 | Architect Signature Present | `architect_signature` | String | Whether architect signature is present |
| 19 | Notarized | `notarized` | String | Whether notary signature/seal/expiry is present |

**Additional tracked fields:**
- `period_from`, `completed_work_this_period`, `retainage_percent`
- `g703_scheduled_value`, `g703_work_prev`, `g703_work_this_period`, `g703_materials_stored`, `g703_total_completed`, `g703_retainage`, `g703_earned_less_ret`, `g703_balance_to_finish` — sub-level G703 grand totals
- `recon_flag`, `start_page`, `end_page`, `seq_id`

**Acceptance Criteria:**
- System extracts all fields per subcontractor using OCR + LLM
- Progress shown per sub (live in UI)
- Each sub's data independently editable
- Agent narrates per sub with confidence and page range

---

### US-5.2: Extract Sub Continuation Sheet Lines (SUBCONTRACTOR SOV)

**As a** project manager  
**I want** the system to extract sub G703 line items  
**So that** I have detailed line-item data per subcontractor  

**Extracted Fields → Database Table: `sub_pay_application_sov_lines`**

| # | UI Column Name | DB Column | Type | Description |
|---|---------------|-----------|------|-------------|
| 1 | Item No. | `item_no` | String | Line item number |
| 2 | Description of Work | `description` | String | Line item work description |
| 3 | Scheduled Value | `scheduled_value` | Decimal(18,2) | Line item scheduled value |
| 4 | Work Completed Previous | `work_completed_prev` | Decimal(18,2) | Prior period completed amount |
| 5 | Work Completed This Period | `work_completed_this` | Decimal(18,2) | Current period completed amount |
| 6 | Materials Stored | `materials_stored` | Decimal(18,2) | Stored material amount |
| 7 | Total Completed & Stored | `total_completed` | Decimal(18,2) | Line cumulative completed/stored |
| 8 | % Complete | `pct_complete` | Decimal(18,2) | Line completion percentage |
| 9 | Retainage | `retainage` | Decimal(18,2) | Line-level retainage amount |

**Note:** Contractor Signature and Notary Details are on the header level (`sub_pay_application_headers`), not per line.

**Acceptance Criteria:**
- All SOV lines extracted per sub in editable table
- Linked to parent sub header via `sub_app_id`
- Source page and bbox stored for provenance
- All cells editable with real-time recalculation

---

### US-5.3: Monitor Extraction Progress
**As a** project manager  
**I want to** watch live extraction progress per subcontractor  
**So that** I know how long it will take and can spot issues early  

**Acceptance Criteria:**
- Progress card per subcontractor: Queued → Processing → Complete / Error
- Token cost accumulator visible in agent panel footer
- Can click into a completed sub immediately (don't wait for all to finish)
- Agent narrates completions: "ABC Electrical: 8 pages, 12 SOV lines. Confidence: 0.91 avg."

---

## Epic 6: AI Verification & Confidence Scoring

### US-6.1: Automatic Field Verification
**As a** project manager  
**I want** the system to self-verify extractions against source documents  
**So that** I only review uncertain items (not all 1,000+ fields)  

**Acceptance Criteria:**
- Verification Agent compares each field against source page image (vision)
- Confidence score (0-1) per field
- ≥ 0.85 → auto-approved (green, user never sees)
- 0.50–0.84 → spot-check (yellow, quick review)
- < 0.50 → retry then escalate (orange/red)
- Summary: "847 auto-approved (72%), 42 need your review"

### US-6.2: Retry Low-Confidence Extractions
**As a** project manager  
**I want** the system to automatically retry poor extractions  
**So that** accuracy improves without my effort  

**Acceptance Criteria:**
- Max 2 retries per field
- Strategies: different prompt, page-by-page, vision model
- Token budget cap per package
- Agent explains: "Retried 'Total Completed' — improved from 0.38 to 0.82."
- After max retries: escalates to human with explanation

---

## Epic 7: Reconciliation & Exception Detection

### US-7.1: Automatic Reconciliation (Deterministic Rules)
**As a** project manager  
**I want** the system to run reconciliation rules automatically  
**So that** discrepancies are caught before my review  

**Rules:**
1. CROSS_FILE_MISMATCH — GC G703 line amount vs. Sub total per contractor
2. MATH_ERROR — Column arithmetic (prev + this period ≠ total)
3. RETAINAGE_DEVIATION — Retainage % deviates >5% from standard
4. PERIOD_CONTINUITY — Previous period's total matches prior submission
5. MISSING_SUPPORTING_DOCS — Required lien waivers/COIs not present in File 3

**Acceptance Criteria:**
- Runs in <1 second (no LLM — pure arithmetic + business rules)
- Exception cards show: type, severity, affected sub, delta, evidence links
- User can: Accept, Dismiss (with reason), Override value
- "Re-validate" button re-runs with edited data

---

## Epic 8: Human Review (Minimal, Focused)

### US-8.1: Review Only Flagged Items
**As a** project manager  
**I want to** see ONLY items that need my attention  
**So that** I don't waste time reviewing what the AI already verified  

**Acceptance Criteria:**
- Review shows: escalated fields + spot-checks + unresolved exceptions
- NOT shown: auto-approved fields (72%+ of total)
- Each item: extracted value, source highlight, confidence, agent explanation
- One-click: Accept / Override / Flag
- Override requires reason (audit trail)

### US-8.2: Bulk Actions
- "Accept all above 0.80" button
- Multi-select + bulk accept/reject
- Chat command: "Accept all for ABC Electrical"

---

## Epic 9: Interactive Agent Chat (Right Panel)

### US-9.1: Ask Questions
- "Why did you flag Summit HVAC?" → natural language explanation
- "Show me source for Desert Landscaping retainage" → PDF viewer navigates

### US-9.2: Command Actions
- "Re-extract Desert Landscaping using vision" → triggers re-extraction
- "Accept all spot-checks" → bulk approve
- "Override Contract Sum to $450,000" → field update + audit log
- "Skip File 3" → graph skips node
- "Re-run reconciliation" → re-triggers rules with current data

### US-9.3: Full Sentence Explanations
- Agents explain in professional full sentences (not brief labels)
- Style: junior analyst reporting to senior reviewer
- Every decision includes: what, why, evidence, confidence

---

## Epic 10: Inline Editing & Reactivity

### US-10.1: Edit Any Field
- All cells editable (click → type → tab)
- Logs old/new value, user, timestamp to `DataChangeLog`
- Confidence badge → "✏️ Manual"
- Manual edits never overwritten by re-extraction (protected)

### US-10.2: Real-Time Recalculation
- Edit "Work Completed This Period" → recalculates Total, %, Balance
- Edit "Original Contract Sum" → recalculates Contract Sum to Date
- Math violations show inline red border
- Recalculation is client-side (instant)

### US-10.3: Re-Validate Button
- Explicit button (not automatic on every edit)
- Triggers reconciliation re-run with current edited values
- Shows before/after: "Exception resolved" or "New exception found"

---

## Epic 11: PDF Document Viewer (iframe)

### US-11.1: View Source Documents
- PDF rendered in iframe (bottom or split view)
- Navigate by page, zoom, fit width
- Clicking "📄 Pg 14" in any table navigates iframe to that page
- Bounding boxes drawn as overlay on relevant fields

### US-11.2: Provenance Highlighting
- Bbox coordinates from DB (`bbox_x/y/width/height`) draw colored rectangles
- Green bbox = high confidence, Yellow = medium, Red = low
- Click a bbox to see which field it corresponds to

---

## Epic 12: Multi-User Collaboration

### US-12.1: Concurrent Package Review
- Multiple users can view/edit same package simultaneously
- Real-time sync via WebSocket (rooms per package)
- See who else is online: avatar indicators

### US-12.2: Edit Conflict Resolution
- Optimistic locking: last write wins
- User B sees notification: "Field X was just updated by User A"
- Manual edits are protected: "Override by [user] — not overwritten by re-extraction"

### US-12.3: Approval Requires Completeness
- Cannot approve if unresolved exceptions exist
- Cannot approve if another user has uncommitted changes
- Approval locks the package for further edits (read-only after)

---

## Epic 13: Package Approval & Audit

### US-13.1: Final Approval
- All exceptions resolved + all escalated fields reviewed → can approve
- Approval seals audit trail (immutable)
- Package moves to "Approved" status
- Agent narrates: "Package #12 approved. 1,175 fields extracted. $0.38 LLM cost. 4m 12s processing time."

### US-13.2: Audit Trail
- Every action logged: agent decisions, human edits, overrides, approvals
- Timestamp, user, action, old value, new value, reason
- Viewable in package detail
- Exportable for compliance

---

*End of User Stories*
