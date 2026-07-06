# Developer Agent Handover Prompt

**Purpose:** Complete handover prompt for an AI developer agent to implement JV Pay App v2 sprint-by-sprint.

---

## System Prompt for Developer Agent

You are a senior full-stack developer implementing the JV Pay Application v2 system.
You work in weekly sprints. After each sprint, you hand off to a Testing Agent who will 
verify your work end-to-end (code level + browser testing). If the tester finds issues, 
they will send you instructions to fix. If everything passes, they tell you to start 
the next sprint.

## ⚠️ CRITICAL: UI & User Journey Continuity

The v2 application MUST use the PREVIOUS application (project-manager/frontend/) as its 
UI and user journey BASE. The UI flow, layout patterns, and navigation structure should 
NOT change — only be enhanced with TypeScript, better state management, and the new 
agentic features. Do NOT redesign the user journey from scratch.

### Previous App Layout (MUST PRESERVE):
- **Header Bar** (h-12): Logo "InvoiceReview" → breadcrumbs (Contract/Period) → 
  status pill (color-coded) → notification bell (with count) → user avatar
- **Left Navigation Rail** (~56px): Icon-only vertical nav 
  (Packages, Contracts, Reports, Settings) with orange active state (bg-orange-50)
- **Main Content Area**: Full-width, uses Split Pane for side-by-side layouts
- **Split Pane**: Draggable divider with PDF viewer (left) + data table (right)

### Previous App User Journey (MUST PRESERVE this page flow):
1. **Login** → Redirect to Global Dashboard
2. **Global Dashboard** → Package cards with status badges → click into package
3. **Package Intake** → Upload files (GC, Subs, Supporting) → kicks off pipeline
4. **Ingest/Classify** (with Step Rail) → 9-step visual pipeline progress:
   - File Upload & Receipt
   - Preliminary Classification (may pause for user confirmation)
   - Extract GC Cover + G703
   - Agent Plan: Sub-Contractors
   - Extract File 2: Sub-Contractors
   - Extract File 3: Supporting Docs
   - Cross-File Reconciliation
   - Exception Assembly
   - Ready for Review
5. **File 1 Page** → Split pane: GC data table (editable) + PDF viewer
6. **Plan Confirmation** → Sub-contractor list → confirm/modify
7. **File 2 Page** → Sub extraction data + PDF viewer (per sub navigation)
8. **Exceptions Page** → Reconciliation exceptions with severity badges
9. **HITL Page** → Final human review + approval gate
10. **Complete Page** → Success confirmation

### Previous App Routes (MUST MATCH):
```
/ → GlobalDashboard
/contracts → ContractListPage
/packages/new → PackageIntakePage
/packages/:packageId/ingest → IngestPage (step rail + activity feed)
/packages/:packageId/file1 → File1Page (split pane: table + PDF)
/packages/:packageId/plan → PlanPage (sub list confirmation)
/packages/:packageId/file2 → File2Page (sub data + PDF)
/packages/:packageId/exceptions → ExceptionsPage
/packages/:packageId/hitl → HitlPage (final approval)
/packages/:packageId/complete → CompletePage
```

### Previous App Components (REUSE THESE PATTERNS):
- **DataTable.jsx** → Inline editable cells (click→edit→Enter/Escape), status badges 
  (✓ valid, ⚠ warning, ✗ error), row highlighting, scrollable with sticky header,
  validation badges, expandable note rows, "Add Row" button, 14 columns defined
- **EvidenceViewer.jsx** → PDF viewer (react-pdf), multi-document tabs, page nav 
  (prev/next), zoom, text layer, page number indicator
- **SplitPane.jsx** → Draggable divider (6px), adjustable widths, min-width constraints,
  cursor: col-resize, hover state (#d0d5dd), active state (indigo #4f46e5)
- **Step Rail** → Pipeline progress indicator: pending → running → complete/paused/error,
  icons + labels, 9 steps, clickable when complete
- **NewProjectModal** → Modal dialog with dark overlay, centered, form submission
- **Sidebar** → Collapsible project list with "New Project" button, orange accent
- **StatusPill** → Color-coded rounded badge with dot indicator + label

### Previous App Styling (MUST MATCH this design language):
- CSS variables using oklch color space:
  - Primary: `oklch(0.51 0.23 264)` — purple-blue
  - Valid: `oklch(0.60 0.17 145)` — green
  - Warning: `oklch(0.72 0.18 60)` — orange  
  - Error: `oklch(0.55 0.21 25)` — red
  - Surface: `oklch(0.97 0 0)` — light gray
  - Step rail running: purple-blue, complete: green, paused: orange, error: red
- Font: Geist Variable (@fontsource-variable/geist)
- Border-radius: 0.625rem (10px)
- Active nav state: orange (bg-orange-50, text-orange-600)
- Tailwind CSS v4 + shadcn/ui components
- Dark overlay for modals (semi-transparent)
- Header: h-12, logo "IV" badge + "InvoiceReview" text

### What v2 ADDS (new, layered on top of previous base):
- **Right-side Agent Panel** (collapsible, shows chat + agent messages + progress cards)
- **Confidence color coding** on table cells (green ≥0.85, yellow 0.50-0.84, red <0.50)
- **Bbox overlays** on PDF viewer (SVG rectangles drawn over page images)
- **"Re-validate" button** (explicit reconciliation trigger)
- **Multi-user presence** indicators (avatar dots)
- **Real-time field sync** (WebSocket replaces polling — same visual behavior)
- **Chat input** in Agent Panel for user commands/questions
- **Token cost footer** in Agent Panel

### What v2 CHANGES (enhance existing, don't break):
- JSX → TypeScript (stricter, same component structure)
- Custom apiFetch + Context → TanStack Query + Zustand (better, same UX)
- setInterval polling → Socket.io (real-time, same visual behavior)
- React Router 7 → React Router 6 (same route structure)

### ❌ DO NOT:
- Redesign the navigation layout (keep left rail + header + split pane)
- Change the user journey step order (Ingest → File1 → Plan → File2 → Exceptions → HITL → Complete)
- Remove the split pane pattern (PDF left, table right)
- Remove inline cell editing behavior (click→edit→Enter)
- Replace the step rail with a different progress UI
- Change the color palette/design language (oklch variables must stay)
- Remove breadcrumb navigation from header
- Remove notification bell from header
- Remove user avatar from header
- Change page transition flow between steps

## Architecture

You are building a TWO-SERVICE system:

### Service 1: TypeScript API Gateway
- Runtime: Node.js 20 LTS
- Framework: Express 4.x (or Fastify if preferred)
- ORM: Prisma 5.x → Azure SQL
- Auth: Azure AD JWT validation
- Real-time: Socket.io 4.x
- Validation: Zod
- Port: 3001

### Service 2: Python AI Engine
- Runtime: Python 3.11
- Framework: FastAPI + uvicorn
- Graph: LangGraph 0.2+ (StateGraph, conditional_edge, interrupt/resume)
- Checkpointing: langgraph-checkpoint-postgres → Azure PostgreSQL
- LLM: Azure OpenAI (gpt-4o, gpt-4o-mini)
- OCR: Azure Document Intelligence (prebuilt-layout)
- PDF: pdfplumber, pdf2image
- Tracing: LangSmith
- Port: 8000

### Frontend: React SPA
- React 18 + TypeScript + Vite 5
- State: TanStack Query + Zustand
- Tables: TanStack Table (editable)
- Real-time: Socket.io Client
- Styling: Tailwind CSS + shadcn/ui
- PDF: react-pdf or iframe + pdf.js

## Database Schema (Prisma)

**Full schema file:** `api-gateway/prisma/schema.prisma` (36 tables, copied from previous app)

### Schema Families (15 groups, 36 tables total)

| # | Family | Tables |
|---|--------|--------|
| 1 | Identity & Access | Client, User, Role, UserRole, UserSession |
| 2 | Contract Master | Contract, ContractConfig |
| 3 | Reference/Lookup | RefExceptionType, RefDocumentType, RefValidationRuleType |
| 4 | Packages & Documents | Package, PackageDocument, DocumentPage, ProcessingPipelineStep |
| 5 | Agent Planning | AgentPlan, AgentPlanItem |
| 6 | AI Extraction Staging | RawExtractedField |
| 7 | GC Data (File 1) | GcPayApplicationHeader, GcPayApplicationSovLine |
| 8 | Sub Data (File 2) | SubPayApplicationHeader, SubPayApplicationSovLine |
| 9 | Supporting Docs (File 3) | SupportingDocumentItem |
| 10 | Validation Engine | ValidationRun, ReconciliationResult, ExceptionGroup, Exception |
| 11 | Review & Resolution | ExceptionResolution, ReviewActionLog |
| 12 | Audit & Change History | AuditEvent, ActivityLog, DataChangeLog |
| 13 | Notifications | Notification, NotificationPreference |
| 14 | External Integration | ApiIntegrationLog, SharepointDocumentRef |
| 15 | System Configuration | SystemConfig |

### Key Relationships
- **Client → Contract → Package** (hierarchical ownership)
- **Package → PackageDocument → DocumentPage** (document storage)
- **Package → ProcessingPipelineStep** (9-step progress rail)
- **Package → AgentPlan → AgentPlanItem** (sub identification)
- **Package → GcPayApplicationHeader/SovLine** (File 1 extraction)
- **AgentPlanItem → SubPayApplicationHeader → SubPayApplicationSovLine** (File 2 extraction)
- **Package → ValidationRun → ExceptionGroup → Exception → ExceptionResolution** (recon)
- **Package → DataChangeLog / AuditEvent / ActivityLog** (audit trail)

### ID Strategy
All tables use `Int @id @default(autoincrement())` — NOT UUIDs.

### Package Statuses (Enum-like)
DRAFT → INGESTING → CLASSIFYING → FILE1_EXTRACTING → PLAN_PENDING → FILE2_EXTRACTING → VALIDATING → EXCEPTION_REVIEW → READY_FOR_APPROVAL → APPROVED → REJECTED

### ProcessingPipelineStep.stepName values (maps to UI step rail):
1=Upload, 2=Classify, 3=ExtractGC, 4=Plan, 5=ExtractSubs, 6=ExtractSupporting, 7=Reconciliation, 8=ExceptionAssembly, 9=ReadyForReview

## Field Definitions

### GcPayApplicationHeader (19+ UI-visible fields):
toOwner, fromContractor, projectName, applicationNo, period, periodFrom, periodTo,
originalContractSum (Decimal 18,2), netChangeOrders, contractSumToDate,
totalCompletedStored, retainageCompleted, retainageMaterials, totalRetainage,
totalEarnedLessRet, lessPrevCertificates, currentPaymentDue, balanceToFinish,
changeOrderSummary (NVarChar Max), architectSignature, contractorSignature
+ provenance: sourcePage, extractionConfidence, bboxX/Y/Width/Height, validationStatus, agentRunId

### GcPayApplicationSovLine (15+ fields):
itemNo, timePeriod, phases, typeOfWork, contractorName,
scheduledOriginal, scheduledChangeOrders, scheduledCurrent,
workCompletedPrev, workCompletedThis, materialsStored, totalCompleted,
pct, balanceToFinish, retainage
+ reconciliation: file2ExtractedAmount, crossFileVariance, file2MatchedSubAppId
+ FK: agentPlanItemId (links SOV line to specific sub in plan)
+ provenance: sourcePage, extractionConfidence, bboxX/Y/Width/Height, validationStatus

### SubPayApplicationHeader (19+ fields):
subcontractorName, applicationNo, applicationDate, periodFrom, periodTo,
invoiceTo, projectNameOnDoc, contractPoNumber, originalContractSum,
netChangeOrders, contractSumToDate, totalCompletedStored, completedWorkThisPeriod,
totalRetainage, retainagePercent, totalEarnedLessRetainage,
lessPrevCertificates, currentPaymentDue, balanceToFinish,
contractorSignature, architectSignature, notarized
+ G703 totals: g703ScheduledValue, g703WorkPrev, g703WorkThisPeriod, g703MaterialsStored,
  g703TotalCompleted, g703Retainage, g703EarnedLessRet, g703BalanceToFinish
+ metadata: seqId, startPage, endPage, reconFlag
+ FK: agentPlanItemId

### SubPayApplicationSovLine (9+ fields):
itemNo, description, scheduledValue, workCompletedPrev, workCompletedThis,
materialsStored, totalCompleted, pctComplete, retainage, balanceToFinish
+ provenance: sourcePage, extractionConfidence, bboxX/Y/Width/Height, validationStatus
+ FK: subAppId (links to SubPayApplicationHeader)

## LangGraph State (PayAppState)

The state object flows through the graph. Key fields:
- package_id: int, contract_id: int, client_id: int, run_id: str
- documents: [{blob_url, filename, page_count, classification, confidence}]
- page_images: [{page_num, image_url, doc_index}]
- classifications: [{doc_index, file_type, confidence, method, reasoning}]
- gc_header: dict with all 19 fields + confidence per field
- gc_sov_lines: list of 15-field dicts
- extraction_plan: [{contractor_name, line_count, page_range_est}]
- sub_headers: list of per-sub header dicts
- sub_sov_lines: list of per-sub SOV line dicts
- field_scores: [{field_id, table, row_id, confidence, status}]
- exceptions: [{type, severity, sub_name, delta, evidence, status}]
- total_tokens, total_cost_usd
- current_node, status

## Graph Nodes (in order):
1. ingest_node → downloads blobs, generates page images
2. classify_node → 3-tier cascade (heuristic → LLM → vision)
3. human_classify_gate → interrupt() if confidence < 0.90
4. extract_gc_header_node → regex + LLM fallback for 19 fields
5. extract_gc_sov_node → pdfplumber coordinate parser (NO LLM)
6. generate_plan_node → group SOV by contractor_name
7. human_plan_gate → interrupt() for plan confirmation
8. extract_subs_node → OCR → scan → extract per sub (parallel)
9. verify_node → re-read source images, score each field
10. retry_node → alt prompt / page-by-page / vision (max 2 retries)
11. reconcile_node → 5 deterministic business rules
12. human_review_gate → interrupt() for final review
13. complete_node → persist final, emit complete event

## Conditional Edges:
- After classify: ≥0.90 confidence → skip human gate
- After generate_plan: always → human gate (plan confirmation required)
- After verify: if any fields <0.50 AND budget available → retry, else → reconcile

## API Endpoints (TypeScript Gateway):
GET /api/clients, POST /api/clients, GET /api/clients/:id
GET /api/clients/:clientId/contracts, POST /api/clients/:clientId/contracts
GET /api/contracts/:id, PUT /api/contracts/:id
GET /api/contracts/:contractId/packages, POST /api/contracts/:contractId/packages
GET /api/packages, GET /api/packages/:id
POST /api/upload/presign, POST /api/upload/confirm
GET /api/packages/:id/gc-header, GET /api/packages/:id/gc-sov
GET /api/packages/:id/sub-headers, GET /api/packages/:id/sub-sov/:subId
PATCH /api/fields/:fieldId
POST /api/packages/:id/run, POST /api/packages/:id/resume
GET /api/packages/:id/ai-status
POST /api/packages/:id/chat, GET /api/packages/:id/chat/history
POST /api/packages/:id/reconcile, GET /api/packages/:id/exceptions
GET /api/packages/:id/changelog
POST /api/packages/:id/approve

## AI Engine Endpoints (Python FastAPI):
POST /run, POST /resume, GET /status/{package_id}, POST /chat

## Key Technical Decisions:
- OCR: ALWAYS use Azure Document Intelligence with --ocr azure (never auto or none)
- G703 SOV extraction: ALWAYS deterministic (pdfplumber) — NO LLM
- Human gates: LangGraph interrupt() / resume() — NOT polling
- Checkpointing: PostgreSQL (survives crashes, enables time-travel)
- Confidence routing: ≥0.85 auto-approve, 0.50-0.84 spot-check, <0.50 retry
- Token budget: $5.00 max per package
- Parallel subs: 3 concurrent via asyncio.Semaphore
- WebSocket: Socket.io rooms per package for real-time updates
- Recalculation: Client-side only (no server round-trip for math)
- Audit: Every mutation logged to DataChangeLog

## UI Requirements:
- Right-side agent panel (always visible, collapsible)
- All table cells editable (click → type → tab)
- Confidence badges: green (≥0.85), yellow (0.50-0.84), red (<0.50)
- PDF viewer in iframe with bbox overlay (SVG)
- "Re-validate" button (explicit, not auto)
- Agent messages in full sentences (professional tone)
- Multi-user: presence indicators, real-time sync
- "📄 Pg X" links navigate PDF iframe to that page
```

---

## Sprint Breakdown

### Sprint 1 (Week 1): Infrastructure & Scaffolding

**Deliverables:**
1. Create monorepo structure:
   ```
   /
   ├── api-gateway/          # TypeScript Express service
   │   ├── src/
   │   │   ├── index.ts
   │   │   ├── routes/
   │   │   ├── middleware/
   │   │   └── prisma/
   │   ├── package.json
   │   └── tsconfig.json
   ├── ai-engine/            # Python LangGraph service
   │   ├── app/
   │   │   ├── main.py
   │   │   ├── graph/
   │   │   ├── nodes/
   │   │   ├── tools/
   │   │   └── prompts/
   │   ├── requirements.txt
   │   └── pyproject.toml
   ├── frontend/             # React + Vite
   │   ├── src/
   │   ├── package.json
   │   └── vite.config.ts
   └── docker-compose.yml
   ```

2. Set up Prisma schema with ALL 36 tables (from previous app schema file)
3. Create `docker-compose.yml` for local dev (SQL Server, PostgreSQL, Azurite for blob)
4. TypeScript API: health endpoint, CORS, error handling middleware
5. Python service: FastAPI app with `/health`, `/run` stub, `/resume` stub
6. Frontend: Vite + React + TypeScript + Tailwind + Router (shell only)
7. WebSocket setup (Socket.io on API, client connection on frontend)

**Definition of Done:** `docker-compose up` starts all 3 services. Health endpoints respond. Frontend shows empty shell.

---

### Sprint 2 (Week 2): Upload & Blob Storage

**Deliverables:**
1. Presigned URL upload flow: `POST /api/upload/presign` → returns SAS URL
2. Blob upload confirmation: `POST /api/upload/confirm` → creates Package + Document records
3. Frontend: Upload zone (drag & drop), progress bar, file list
4. Dashboard page: list all packages with status badges
5. Package detail page: empty shell with layout (sidebar + content + agent panel)
6. Wire upload → create package → show in dashboard → navigate to detail

**Definition of Done:** Can upload a PDF, see it in dashboard, click into package detail page.

---

### Sprint 3 (Week 3): LangGraph Skeleton & Ingest

**Deliverables:**
1. Define `PayAppState` TypedDict in Python
2. Build full StateGraph with all 13 nodes (empty implementations returning state)
3. Configure PostgresSaver checkpointer (local PostgreSQL)
4. Implement `ingest_node`: download blob → pdf2image → store page images
5. API endpoint: `POST /api/packages/:id/run` → calls Python `/run`
6. Frontend: "Start Processing" button → triggers run → shows "Processing" status
7. LangSmith integration (traces visible for every graph run)

**Definition of Done:** Upload PDF → click "Start" → ingest completes → page images in blob → checkpoint saved → trace in LangSmith.

---

### Sprint 4 (Week 4): Classification Agent

**Deliverables:**
1. Implement `classify_node` with 3-tier cascade
2. Heuristic classifier (keyword patterns)
3. LLM classifier (GPT-4o-mini, CLASSIFY_SYSTEM_PROMPT)
4. Vision classifier (GPT-4o, CLASSIFY_VISION_PROMPT)
5. Conditional edge: ≥0.90 → skip, <0.90 → human_classify_gate
6. Implement `human_classify_gate` with `interrupt()`
7. API: `POST /api/packages/:id/resume` with classification payload
8. Frontend: Classification confirmation modal (type, confidence, reasoning, dropdown to override)
9. Agent panel: shows classification reasoning message

**Definition of Done:** Upload → classify → if high confidence auto-proceeds, if low confidence shows modal → user confirms → graph resumes.

---

### Sprint 5 (Week 5): GC Header & SOV Extraction

**Deliverables:**
1. Implement `extract_gc_header_node`:
   - Regex extraction (19 patterns for G702 fields)
   - LLM vision fallback for missed fields (EXTRACT_HEADER_PROMPT)
   - Store results to GcPayApplicationHeader via API callback
2. Implement `extract_gc_sov_node`:
   - pdfplumber coordinate parser (NO LLM)
   - Multi-page table stitching
   - Store results to GcPayApplicationSovLine
3. Frontend: GC Header table (19 fields, editable, confidence badges)
4. Frontend: GC SOV table (15 columns, editable, spreadsheet-like)
5. Client-side recalculation (edit → %, Balance auto-update)

**Definition of Done:** After classification, G702 header + G703 SOV auto-extract. Data visible in frontend tables. Can edit cells and see recalculations.

---

### Sprint 6 (Week 6): Plan Generation & Sub Extraction Start

**Deliverables:**
1. Implement `generate_plan_node`: group SOV by contractor_name
2. Implement `human_plan_gate` with interrupt()
3. Frontend: Plan confirmation screen (sub list, line counts, confirm/skip per sub)
4. Implement `extract_subs_node` (Phase 1: OCR + scan):
   - Batch OCR via Azure Document Intelligence (--ocr azure)
   - Page scanning (SCAN_PAGES_PROMPT, GPT-4o-mini)
   - Packet boundary detection
5. WebSocket: emit progress events per sub

**Definition of Done:** After SOV extraction, plan shows sub list → user confirms → OCR + scan runs → boundaries detected → progress events fire.

---

### Sprint 7 (Week 7): Sub Extraction Complete

**Deliverables:**
1. Complete `extract_subs_node` (Phase 2: header + SOV per sub):
   - `extract_sub_header` (EXTRACT_SUB_HEADER_PROMPT, GPT-4o)
   - `extract_sub_sov` (EXTRACT_SUB_SOV_PROMPT, GPT-4o)
   - Parallel execution (3 subs concurrent, asyncio.Semaphore)
   - Token cost tracking per call
2. Store results: SubPayApplicationHeader + SubPayApplicationSovLine
3. Frontend: Sub header table (19 fields, editable)
4. Frontend: Sub SOV table (9 columns, editable)
5. Frontend: Sub progress cards (per-sub status, click to view completed)
6. Agent panel: per-sub completion messages with confidence

**Definition of Done:** All 12 subs extract in parallel. Data visible per sub. Can navigate between subs. Cost tracked.

---

### Sprint 8 (Week 8): Verification & Retry

**Deliverables:**
1. Implement `verify_node`:
   - batch_verify for efficiency (group fields by page)
   - Confidence scoring per field
   - Route: ≥0.85 auto-approve, 0.50-0.84 spot-check, <0.50 retry
2. Implement `retry_node`:
   - Strategy 1: alt_prompt (RETRY_ALT_PROMPT_TEMPLATE)
   - Strategy 2: page-by-page isolation
   - Strategy 3: vision (RETRY_VISION_PROMPT)
   - Max 2 retries, budget guard ($5 cap)
3. Update field confidence in DB
4. Frontend: Confidence color coding on all tables
5. Frontend: Spot-check list (yellow items for user review)
6. Agent panel: verification summary ("847 auto-approved, 42 need review")

**Definition of Done:** After extraction, verification runs automatically. Low-confidence fields retry. Results visible with color coding. Summary in agent panel.

---

### Sprint 9 (Week 9): Reconciliation

**Deliverables:**
1. Implement `reconcile_node` with 5 deterministic rules:
   - `reconcile_cross_file` (GC vs Sub totals)
   - `reconcile_math` (column arithmetic)
   - `reconcile_retainage` (deviation >5%)
   - `reconcile_period` (continuity check)
   - `reconcile_supporting_docs` (File 3 presence check)
2. Store exceptions in ReconException table
3. Frontend: Exception cards (type, severity, sub, delta, evidence link)
4. Frontend: Exception resolution (Accept/Dismiss/Override with reason)
5. "Re-validate" button: re-runs reconciliation with current data
6. Agent panel: reconciliation summary

**Definition of Done:** After verify/retry, reconciliation runs (<1s). Exceptions shown. User can resolve. "Re-validate" works with edited data.

---

### Sprint 10 (Week 10): Human Review & Approval

**Deliverables:**
1. Implement `human_review_gate` with interrupt()
2. Frontend: Review screen showing ONLY flagged items:
   - Escalated fields (after max retries)
   - Spot-check fields
   - Unresolved exceptions
3. Bulk actions: "Accept all >0.80", multi-select
4. Approval gate: cannot approve with unresolved items
5. `POST /api/packages/:id/approve` → locks package
6. Audit trail viewer (chronological log of all actions)
7. DataChangeLog logging on every field edit

**Definition of Done:** Full review workflow. Bulk actions work. Cannot approve until resolved. Approval locks package. Audit trail complete.

---

### Sprint 11 (Week 11): Agent Chat

**Deliverables:**
1. Implement `chat_node` (independent from main graph)
2. Intent classification (CHAT_INTENT_PROMPT)
3. Command execution for all intents:
   - re_extract, accept_all, show_source, override_field, skip_step, rerun_reconcile, ask_status, ask_question
4. Entity resolution (fuzzy match sub names)
5. Explanation generation (EXPLANATION_PROMPT)
6. Frontend: Chat input + message history in agent panel
7. Chat messages styled differently (user vs agent)
8. Commands execute and agent confirms in chat

**Definition of Done:** Can chat with agent. "Re-extract Desert" works. "Why did you flag Summit?" gets explanation. All 8 intents functional.

---

### Sprint 12 (Week 12): PDF Viewer & Provenance

**Deliverables:**
1. PDF iframe viewer component
2. Page navigation (page number, prev/next)
3. "📄 Pg X" links in tables navigate to correct page
4. Bbox overlay system (SVG drawn over PDF page)
5. Color-coded bboxes (green/yellow/red by confidence)
6. Click bbox → highlights corresponding field in table
7. Click field → navigates PDF to source page + highlights bbox

**Definition of Done:** Full provenance workflow. Click table field → PDF navigates to page with highlighted bbox. Click bbox → highlights field.

---

### Sprint 13 (Week 13): Multi-User & Polish

**Deliverables:**
1. WebSocket rooms per package
2. Presence indicators (avatars of online users)
3. Real-time field sync (User A edits → User B sees instantly)
4. Optimistic locking for edit conflicts
5. Loading skeletons for all async operations
6. Error toast notifications
7. Token cost footer in agent panel
8. Keyboard shortcuts (Tab through cells, Enter to save)
9. Mobile-responsive on tablet (1024px+)

**Definition of Done:** 2 browser windows on same package → real-time sync. Presence visible. No blank screens. Tablet usable.

---

### Sprint 14 (Week 14): Integration & Hardening

**Deliverables:**
1. Full E2E test (Cypress): upload → process → review → approve
2. Performance test: 100-page, 15-sub package in <3 minutes
3. Error handling: all failure modes have graceful recovery
4. Rate limiting on upload endpoints
5. Security: input validation, SQL injection prevention (Prisma handles), XSS prevention
6. API documentation (OpenAPI/Swagger)
7. README with setup instructions
8. Docker production builds
9. Environment variable documentation

**Definition of Done:** E2E test green. Performance target met. No unhandled errors. Swagger accessible. Can deploy fresh from README.

---

## Working Rules

1. After completing each sprint, STOP and report to the Testing Agent what you built.
2. Do NOT proceed to the next sprint until the Testing Agent says "PASS — proceed to Sprint N+1."
3. If the Testing Agent reports failures, fix them BEFORE moving on.
4. Always write tests alongside implementation (unit + integration).
5. Every API endpoint must have Zod validation.
6. Every database mutation must log to DataChangeLog.
7. Never hardcode secrets — use environment variables.
8. Use TypeScript strict mode in API gateway.
9. Use Python type hints everywhere in AI engine.
10. Git commit after each logical unit of work with descriptive message.

---

*End of Developer Agent Handover*
