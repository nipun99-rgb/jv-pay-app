# Phase Plan — JV Pay App v2 (LangGraph Agentic Edition)

**Version:** 2.0  
**Total Duration:** 14 Weeks (6 Phases)  
**Team:** 2-3 Full-Stack Devs, 1 AI/ML Engineer, 1 QA  
**Architecture:** TypeScript API Gateway + Python LangGraph Engine + React Frontend  

---

## Phase Summary

| Phase | Weeks | Focus | Key Deliverables |
|-------|-------|-------|------------------|
| 1 | 1–3 | Foundation & Infrastructure | Azure infra, DB schema, LangGraph skeleton, API scaffold |
| 2 | 4–6 | Core Extraction Pipeline | File 1 extraction, classification, page imaging |
| 3 | 7–9 | Sub Extraction & Verification | File 2 extraction, verification agent, retry |
| 4 | 10–11 | Reconciliation & Human Review | Recon rules, review UI, inline editing |
| 5 | 12–13 | Agent Chat & Premium UX | Agent panel, PDF viewer, multi-user, real-time |
| 6 | 14 | Integration Testing & Hardening | E2E tests, perf optimization, security audit |

---

## Phase 1: Foundation & Infrastructure (Weeks 1–3)

### Week 1: Infrastructure Setup

| Task | Owner | Deliverable | Done When |
|------|-------|-------------|-----------|
| Provision Azure Container Apps (2 services) | DevOps | Terraform/Bicep IaC scripts | Services deploy and respond to health check |
| Create Azure SQL database with Prisma schema | Backend | `schema.prisma` with all 36 tables migrated | `prisma migrate deploy` succeeds |
| Create Azure PostgreSQL for LangGraph checkpoints | Backend | Connection string in Key Vault, checkpoint table exists | LangGraph can write/read checkpoints |
| Set up Azure Blob Storage (PDF uploads) | Backend | Container created, SAS token generation working | Can upload/download blobs via API |
| Set up Azure OpenAI resource | AI/ML | GPT-4o + GPT-4o-mini deployments | API calls succeed from Python service |
| Set up Azure Document Intelligence | AI/ML | prebuilt-layout endpoint configured | OCR API returns text/bboxes for test PDF |
| Create Key Vault + secret references | DevOps | All connection strings, API keys in vault | Services read secrets at startup |
| CI/CD pipeline (GitHub Actions) | DevOps | Build → Test → Deploy for both services | Push to main triggers deploy |

### Week 2: Service Scaffolding

| Task | Owner | Deliverable | Done When |
|------|-------|-------------|-----------|
| TypeScript API Gateway scaffold (Express/Fastify) | Backend | `POST /upload`, `GET /packages`, health endpoint | Postman collection passes |
| Python LangGraph service scaffold (FastAPI) | AI/ML | `/run`, `/resume`, `/status` endpoints | Can trigger empty graph and get state back |
| LangGraph StateGraph skeleton (empty nodes) | AI/ML | Graph with all node names + conditional edges | Graph compiles, visualizable |
| Prisma client generation + CRUD helpers | Backend | Repository layer for all 5 models | Unit tests pass for CRUD operations |
| Azure Blob upload endpoint (presigned URL flow) | Backend | `POST /upload/presign` → `PUT blob` → `POST /upload/confirm` | 50MB PDF uploads in <5s |
| React + Vite + TypeScript project init | Frontend | Build succeeds, router configured, design system tokens | `npm run dev` shows shell |
| WebSocket server setup (Socket.io) | Backend | Room per package, join/leave events | 2 browser tabs see each other's events |
| LangSmith integration | AI/ML | Traces appear in LangSmith dashboard | Every graph run has a trace |

### Week 3: Data Layer & State Machine

| Task | Owner | Deliverable | Done When |
|------|-------|-------------|-----------|
| Define LangGraph State TypedDict (full schema) | AI/ML | `PayAppState` with all fields from design doc | Type-checks, serializes to/from checkpoint |
| Implement PostgreSQL checkpointer | AI/ML | `PostgresSaver` configured with connection pool | Graph state persists across process restarts |
| Implement `interrupt()` / `resume()` pattern | AI/ML | Human gate pauses graph, API resumes | Integration test: pause at classify → resume with override |
| Build page image generator (pdf2image) | AI/ML | Given blob URL → generates PNG per page → stores in blob | 100-page PDF generates images in <30s |
| Implement audit trail logging | Backend | `DataChangeLog` entries on every mutation | Edit a field → log entry appears |
| Seed data: upload test PDFs (3 real packages) | QA | Known-good test packages stored in blob | Test data available for all downstream work |
| API auth middleware (Azure AD / JWT) | Backend | All endpoints require valid token | Unauthorized requests return 401 |

---

## Phase 2: Core Extraction Pipeline (Weeks 4–6)

### Week 4: Classification & File 1 Header

| Task | Owner | Deliverable | Done When |
|------|-------|-------------|-----------|
| Classification Agent (heuristic tier) | AI/ML | Keyword/pattern matching for doc type | Classifies 5/5 test docs correctly via heuristic |
| Classification Agent (LLM tier) | AI/ML | GPT-4o-mini text classification prompt | Correctly classifies docs that fail heuristic |
| Classification Agent (Vision tier) | AI/ML | GPT-4o vision classification for ambiguous docs | Handles scanned docs without text layer |
| Confidence routing (3-tier cascade logic) | AI/ML | Conditional edges: ≥90% auto-confirm, <90% pause | Integration test covers all 3 tiers |
| G702 Header Extractor (pdfplumber + regex) | AI/ML | Deterministic extraction of 19 header fields | Extracts 100% of fields from 3 test G702s |
| G702 Vision Fallback | AI/ML | LLM vision extraction for fields regex misses | Fills gaps on low-quality scans |
| Frontend: Package upload UI | Frontend | Drag-drop zone, progress bar, file list | Can upload 3 PDFs, see them in dashboard |
| Frontend: Dashboard with package cards | Frontend | Status badges, sort, click-through | Shows real packages from API |

### Week 5: File 1 SOV + Plan Generation

| Task | Owner | Deliverable | Done When |
|------|-------|-------------|-----------|
| G703 SOV Extractor (coordinate-based parser) | AI/ML | pdfplumber coordinate parser for line items | Extracts 42+ lines from test G703 correctly |
| G703 multi-page handling | AI/ML | Stitches lines across page boundaries | Handles 6-page G703 without gaps |
| Plan Generation Agent (group by contractor) | AI/ML | Groups SOV lines by `contractor_name` | Produces correct sub list for 3 test packages |
| Human gate: extraction plan confirmation | AI/ML | `interrupt()` after plan, resume on confirm | Graph pauses, API resumes |
| Frontend: SOV table component (editable) | Frontend | Spreadsheet-like grid with all 15 columns | Edit a cell → value persists → recalc fires |
| Frontend: Classification confirmation modal | Frontend | Shows type, confidence, reasoning, confirm/override | Interaction resumes graph |
| API: `/packages/:id/resume` endpoint | Backend | Resumes graph from interrupt with payload | Classification override flows through |
| Real-time recalculation (client-side) | Frontend | Edit → %, Balance auto-update | Math verified against manual calculation |

### Week 6: Frontend Table Views + Provenance

| Task | Owner | Deliverable | Done When |
|------|-------|-------------|-----------|
| G702 header table component | Frontend | 19-field card/table, editable, confidence badges | Matches design mockups |
| Confidence color coding (green/yellow/red) | Frontend | ≥0.85 green, 0.50-0.84 yellow, <0.50 red | Visual matches spec |
| Source page links ("📄 Pg 3") | Frontend | Click navigates to page | Cursor lands on correct page |
| PDF iframe viewer (basic) | Frontend | Renders PDF in split view | Can page through uploaded PDF |
| Data change log API | Backend | `GET /packages/:id/changelog` | Returns all edits with timestamps |
| WebSocket: live extraction progress events | Backend | `extraction:progress` event per sub | Frontend receives events in real-time |
| End-to-end test: Upload → Classify → Extract G702 → SOV | QA | Cypress test covering full File 1 flow | Green in CI |

---

## Phase 3: Sub Extraction & Verification (Weeks 7–9)

### Week 7: File 2 Extraction Engine

| Task | Owner | Deliverable | Done When |
|------|-------|-------------|-----------|
| OCR pipeline (Azure Document Intelligence) | AI/ML | Batch OCR for all sub pages → text cache | 100 pages OCR in <60s |
| Page Scanner (GPT-4o-mini) | AI/ML | Identifies page type and subcontractor per page | Correct page→sub mapping for test docs |
| Sub Packet Boundary Detection | AI/ML | Identifies start/end page per subcontractor | Correct boundaries for 12+ subs |
| Sub Cover Page Extractor (LLM) | AI/ML | Extracts 19 header fields per sub | 100% field extraction on 5 test subs |
| Sub SOV Extractor (LLM) | AI/ML | Extracts SOV line items per sub | Correct line counts for test subs |
| Parallel extraction (3 subs concurrently) | AI/ML | asyncio.gather with concurrency limit | 12 subs complete in ~45s (not 3min serial) |
| Frontend: Extraction progress cards per sub | Frontend | Status per sub: Queued/Processing/Done/Error | Matches WebSocket events |
| Token cost tracking | AI/ML | Counts tokens per agent call, stores in state | Total cost visible in agent panel |

### Week 8: Verification Agent & Retry

| Task | Owner | Deliverable | Done When |
|------|-------|-------------|-----------|
| Verification Agent (field-level confidence) | AI/ML | Re-reads source image, scores each field 0-1 | Scores correlate with actual accuracy on test data |
| Confidence routing logic | AI/ML | ≥0.85 auto-approve, 0.50-0.84 spot-check, <0.50 retry | Correct routing for 100+ test fields |
| Retry Agent (strategy 1: different prompt) | AI/ML | Alternative prompt template for retry | Improves confidence on 60%+ of retried fields |
| Retry Agent (strategy 2: page-by-page) | AI/ML | Isolates single page for focused extraction | Handles multi-page confusion cases |
| Retry Agent (strategy 3: vision model) | AI/ML | GPT-4o vision for blurry/scanned content | Recovers fields from low-quality scans |
| Token budget guard | AI/ML | Stops retries if package cost > threshold | Never exceeds budget in test |
| Frontend: Spot-check review list | Frontend | Shows yellow items with accept/override | User can resolve items |
| API: field-level status update | Backend | `PATCH /fields/:id` with new value + status | Persists and logs changes |

### Week 9: End-to-End File 2 Flow

| Task | Owner | Deliverable | Done When |
|------|-------|-------------|-----------|
| Full File 2 pipeline integration | AI/ML | Upload → OCR → Scan → Extract → Verify → Route | All 12 subs extract correctly for test package |
| Sub header table component | Frontend | Sub-level card with 19 fields, editable | Matches G702 pattern |
| Sub SOV table component | Frontend | Line items per sub, editable grid | All 9 columns visible, editable |
| Navigation: drill from sub list → sub detail | Frontend | Click sub → see header + SOV | Smooth navigation |
| Error handling: OCR failures, timeout, LLM errors | AI/ML | Graceful degradation, retry, user notification | No unhandled crashes |
| E2E test: Upload → Classify → Plan → File 2 Extract → Verify | QA | Cypress + backend integration test | Green in CI |

---

## Phase 4: Reconciliation & Human Review (Weeks 10–11)

### Week 10: Reconciliation Engine

| Task | Owner | Deliverable | Done When |
|------|-------|-------------|-----------|
| Recon Rule 1: Cross-file mismatch | Backend | GC G703 line vs Sub total per contractor | Detects known mismatches in test data |
| Recon Rule 2: Math errors | Backend | Column arithmetic validation | Catches intentional math errors in test |
| Recon Rule 3: Retainage deviation | Backend | Flags >5% deviation from standard rate | Correctly flags unusual retainage |
| Recon Rule 4: Period continuity | Backend | Previous period total vs last submission | Catches period breaks |
| Recon Rule 5: Missing supporting docs | Backend | Cross-references File 3 against required docs | Flags missing lien waivers |
| Exception card component | Frontend | Type, severity, sub, delta, evidence links | Visual matches spec |
| Exception resolution UI | Frontend | Accept / Dismiss / Override with reason | Saves resolution to audit trail |
| "Re-validate" button | Frontend | Triggers recon re-run with current data | Shows before/after comparison |

### Week 11: Human Review Workflow

| Task | Owner | Deliverable | Done When |
|------|-------|-------------|-----------|
| Escalation queue (fields + exceptions combined) | Frontend | Single review screen: flagged fields + exceptions | User sees only items needing attention |
| Bulk accept controls | Frontend | "Accept all >0.80" button, multi-select | Bulk action logs individually |
| Source evidence popover | Frontend | Click evidence → PDF viewer navigates + highlights | Correct page + bbox shown |
| Approval gate | Frontend/Backend | Cannot approve with unresolved items | Button disabled until clear |
| Package approval endpoint | Backend | `POST /packages/:id/approve` | Locks package, creates seal |
| Audit trail viewer | Frontend | Chronological log of all actions | Complete history viewable |

---

## Phase 5: Agent Chat & Premium UX (Weeks 12–13)

### Week 12: Agent Chat Panel

| Task | Owner | Deliverable | Done When |
|------|-------|-------------|-----------|
| Chat input component (right panel) | Frontend | Message input + history | Messages send and display |
| Chat routing (intent → action mapping) | AI/ML | LLM classifies user intent → triggers action | "Re-extract Desert" triggers re-extraction |
| Command: "Re-extract [sub]" | AI/ML | Triggers re-extraction for named sub | Sub re-extracted with fresh results |
| Command: "Accept all for [sub]" | AI/ML | Bulk approves all items for named sub | Items marked approved in DB |
| Command: "Show source for [field]" | AI/ML | Returns page number → PDF navigates | Correct page shown |
| Command: "Override [field] to [value]" | AI/ML | Updates field value + audit log | Value persisted, log entry created |
| Agent explanation messages | AI/ML | Full-sentence reasoning per decision | Style matches spec (professional, clear) |
| Chat context: package state awareness | AI/ML | Chat agent knows current package state | Can answer "What's the status?" accurately |

### Week 13: Premium UX Polish

| Task | Owner | Deliverable | Done When |
|------|-------|-------------|-----------|
| PDF bbox overlay system | Frontend | Draw colored rectangles on PDF pages | Bboxes align with actual field locations |
| Multi-user presence indicators | Frontend | Avatar dots showing who's online | Appears within 2s of join |
| Real-time field sync (WebSocket) | Frontend | Edit by User A → User B sees instantly | Cross-browser verified |
| Loading states & skeletons | Frontend | All async operations show loading state | No blank screens ever |
| Error toast notifications | Frontend | Graceful error messages for failures | Covers all API error codes |
| Token cost footer (agent panel) | Frontend | Running cost for current package | Accurate against LangSmith data |
| Mobile-responsive layout (basic) | Frontend | Usable on tablet (1024px+) | No broken layouts on tablet |
| Keyboard shortcuts (Tab through cells, Ctrl+S) | Frontend | Quick review without mouse | Shortcuts documented in help |

---

## Phase 6: Integration Testing & Hardening (Week 14)

### Week 14: Final Testing & Security

| Task | Owner | Deliverable | Done When |
|------|-------|-------------|-----------|
| Full E2E test suite (3 real packages) | QA | Cypress E2E covering all 13 epics | All green in CI |
| Performance test: 100-page, 15-sub package | QA | Benchmark: target <3min total extraction | Meets target on standard infra |
| Security audit: OWASP Top 10 check | QA/DevOps | No Critical/High findings | Pen test report clean |
| API rate limiting & abuse prevention | Backend | Rate limits on upload, LLM endpoints | Cannot exceed 10 uploads/min |
| Error monitoring (Application Insights) | DevOps | Alerts for 5xx errors, LLM failures | Alert fires within 1min of error |
| Data encryption: at-rest + in-transit | DevOps | TLS everywhere, encrypted blob storage | Verified via security scan |
| User acceptance testing with real users | QA | 2 project managers test full workflow | Sign-off document |
| Documentation: API docs (OpenAPI), runbook | Backend | Swagger UI accessible, runbook complete | Team can deploy without original devs |
| Production deployment | DevOps | All services running in production | Health checks green, first real package processed |

---

## Sprint Cadence

- **Sprint Length:** 1 week
- **Ceremonies:** Monday standup (15min), Friday demo (30min)
- **Definition of Done:** Code merged, tests pass, no regressions, deployed to staging
- **Code Review:** All PRs require 1 approval
- **Testing Agent:** Runs after every sprint to validate all cumulative functionality (see `07-testing-agent-prompt.md`)

---

## Risk Mitigations

| Risk | Mitigation | Trigger |
|------|-----------|---------|
| OCR quality too low for subs | Add image preprocessing (deskew, contrast) | <80% accuracy on test set |
| LLM costs exceed budget | Reduce retries, use mini model for scan | Cost >$1 per package |
| LangGraph state too large | Paginate state, store line items by reference | State >5MB |
| Multi-page table stitching errors | Add overlap detection + merge logic | >5% missed lines |
| Azure rate limits hit | Add retry with exponential backoff + queue | 429 errors >5/min |

---

*End of Phase Plan*
