# Architecture Layers — JV Pay App v2 (LangGraph Agentic Edition)

**Version:** 2.0  
**Architecture Style:** Two-service microservices + React SPA  
**Deployment:** Azure Container Apps  

---

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER (Browser)                          │
│  React 18 + TypeScript + Vite + TanStack Query + Socket.io Client      │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌────────────────┐  │
│  │ Dashboard   │ │ Package View │ │ PDF Viewer  │ │ Agent Panel    │  │
│  │ (upload,    │ │ (tables,     │ │ (iframe,    │ │ (chat, status, │  │
│  │  status)    │ │  edit, recon)│ │  bbox)      │ │  explanations) │  │
│  └─────────────┘ └──────────────┘ └─────────────┘ └────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ HTTPS + WebSocket (wss://)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    API GATEWAY LAYER (Service 1)                        │
│  TypeScript + Express/Fastify + Prisma ORM + Socket.io Server          │
│  Port: 3001 | Azure Container App                                       │
│  ┌───────────┐ ┌───────────┐ ┌────────────┐ ┌───────────────────────┐ │
│  │ Auth MW   │ │ REST API  │ │ WebSocket  │ │ LangGraph Client      │ │
│  │ (Azure AD │ │ (CRUD,    │ │ (rooms,    │ │ (HTTP calls to        │ │
│  │  JWT)     │ │  upload)  │ │  presence) │ │  Python service)      │ │
│  └───────────┘ └───────────┘ └────────────┘ └───────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Prisma ORM → Azure SQL (business data)                           │ │
│  │ Tables: GcPayApplicationHeader, GcPayApplicationSovLine,          │ │
│  │         SubPayApplicationHeader, SubPayApplicationSovLine,        │ │
│  │         SupportingDocumentItem, DataChangeLog, Package, User      │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ HTTP (internal VNet)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   AI ENGINE LAYER (Service 2)                           │
│  Python 3.11 + LangGraph + FastAPI + Azure OpenAI SDK                  │
│  Port: 8000 | Azure Container App                                       │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────────────────┐ │
│  │ FastAPI Router │ │ LangGraph      │ │ Agent Nodes               │ │
│  │ /run           │ │ StateGraph     │ │ - ingest_node             │ │
│  │ /resume        │ │ (PayAppState)  │ │ - classify_node           │ │
│  │ /status        │ │                │ │ - extract_header_node     │ │
│  │ /chat          │ │ Checkpointer:  │ │ - extract_sov_node        │ │
│  │                │ │ PostgresSaver  │ │ - plan_node               │ │
│  │                │ │                │ │ - extract_subs_node       │ │
│  │                │ │ Human Gates:   │ │ - verify_node             │ │
│  │                │ │ interrupt()    │ │ - retry_node              │ │
│  │                │ │ resume()       │ │ - reconcile_node          │ │
│  │                │ │                │ │ - chat_node               │ │
│  └────────────────┘ └────────────────┘ └────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Tools Layer (called by agent nodes)                               │ │
│  │ - pdf_to_pages(), ocr_page(), extract_with_regex()                │ │
│  │ - llm_extract(), llm_classify(), llm_verify()                     │ │
│  │ - reconcile_cross_file(), reconcile_math()                        │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ Azure SQL    │ │ Azure        │ │ Azure Blob   │ │ Azure OpenAI │  │
│  │ (business    │ │ PostgreSQL   │ │ Storage      │ │ (GPT-4o,     │  │
│  │  data,       │ │ (LangGraph   │ │ (PDFs, page  │ │  GPT-4o-mini)│  │
│  │  Prisma)     │ │  checkpoints)│ │  images)     │ │              │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ Azure Doc    │ │ Azure Key    │ │ LangSmith    │ │ App Insights │  │
│  │ Intelligence │ │ Vault        │ │ (traces,     │ │ (monitoring, │  │
│  │ (OCR)        │ │ (secrets)    │ │  debugging)  │ │  alerts)     │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Client Layer (React Frontend)

### Technology Stack
- **Framework:** React 18 + TypeScript
- **Build:** Vite 5
- **State Management:** TanStack Query (server state) + Zustand (UI state)
- **Real-time:** Socket.io Client
- **Tables:** TanStack Table (editable cells, sorting, filtering)
- **PDF Viewer:** react-pdf or iframe with pdf.js
- **Styling:** Tailwind CSS + shadcn/ui components
- **Router:** React Router v6

### Component Architecture

```
src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx          # Main layout (sidebar + content + agent panel)
│   │   ├── Sidebar.tsx           # Navigation
│   │   └── AgentPanel.tsx        # Right-side agent chat/status panel
│   ├── dashboard/
│   │   ├── PackageCard.tsx       # Package summary card
│   │   ├── UploadZone.tsx        # Drag & drop upload
│   │   └── StatusBadge.tsx       # Processing / Review / Approved
│   ├── tables/
│   │   ├── EditableCell.tsx      # Click-to-edit cell wrapper
│   │   ├── GcHeaderTable.tsx     # G702 header fields (19 columns)
│   │   ├── GcSovTable.tsx        # G703 SOV lines (15 columns)
│   │   ├── SubHeaderTable.tsx    # Sub cover page (19 columns)
│   │   ├── SubSovTable.tsx       # Sub SOV lines (9 columns)
│   │   └── ConfidenceBadge.tsx   # Green/Yellow/Red indicator
│   ├── review/
│   │   ├── ExceptionCard.tsx     # Reconciliation exception
│   │   ├── SpotCheckList.tsx     # Yellow-confidence items
│   │   ├── BulkActions.tsx       # Accept all, multi-select
│   │   └── ApprovalGate.tsx      # Final approval button + checks
│   ├── pdf/
│   │   ├── PdfViewer.tsx         # iframe-based PDF viewer
│   │   ├── BboxOverlay.tsx       # SVG overlay for bounding boxes
│   │   └── PageNavigator.tsx     # Page controls
│   ├── agent/
│   │   ├── ChatInput.tsx         # Message input
│   │   ├── ChatMessage.tsx       # Agent message bubble
│   │   ├── ProgressCard.tsx      # Per-sub extraction progress
│   │   └── CostFooter.tsx        # Token cost display
│   └── common/
│       ├── Modal.tsx
│       ├── Toast.tsx
│       └── Skeleton.tsx
├── hooks/
│   ├── usePackage.ts             # TanStack Query: package CRUD
│   ├── useWebSocket.ts           # Socket.io connection + events
│   ├── useRecalculate.ts         # Client-side field recalculation
│   └── useAgentChat.ts           # Chat send/receive
├── pages/
│   ├── DashboardPage.tsx
│   ├── PackagePage.tsx           # Main work area
│   └── SettingsPage.tsx
└── lib/
    ├── api.ts                    # Axios/fetch wrapper
    ├── recalc.ts                 # Math formulas for recalculation
    └── types.ts                  # Shared TypeScript types
```

### Key UI Behaviors
- **Editable Cells:** Click any table cell → inline input → Tab/Enter saves → emits PATCH + logs change
- **Recalculation:** Editing a monetary field triggers `recalc.ts` functions — client-side, instant
- **Confidence Colors:** `≥0.85` green background, `0.50-0.84` yellow, `<0.50` red
- **PDF Navigation:** Clicking "📄 Pg 14" sets iframe `#page=14` and draws bbox overlay
- **Agent Panel:** Always visible on right (collapsible). Shows chat + progress + explanations
- **Real-time:** WebSocket events update tables/progress without polling

---

## Layer 2: API Gateway (TypeScript Service)

### Technology Stack
- **Runtime:** Node.js 20 LTS
- **Framework:** Express 4.x (or Fastify 4.x)
- **ORM:** Prisma 5.x → Azure SQL
- **Auth:** Azure AD JWT validation (passport-azure-ad)
- **Real-time:** Socket.io 4.x
- **Validation:** Zod schemas
- **File Storage:** @azure/storage-blob SDK

### API Endpoints

```
# Package Management
POST   /api/packages                    # Create package + upload files
GET    /api/packages                    # List all packages (with status)
GET    /api/packages/:id                # Get package detail + current state
DELETE /api/packages/:id                # Soft-delete package
POST   /api/packages/:id/approve       # Final approval (locks package)

# Upload
POST   /api/upload/presign             # Get presigned URL for blob upload
POST   /api/upload/confirm             # Confirm upload complete → trigger pipeline

# Extraction Data (Read + Edit)
GET    /api/packages/:id/gc-header     # G702 header data
GET    /api/packages/:id/gc-sov        # G703 SOV line items
GET    /api/packages/:id/sub-headers   # All sub cover pages
GET    /api/packages/:id/sub-sov/:subId # Sub SOV lines for one sub
PATCH  /api/fields/:fieldId            # Update single field value

# LangGraph Interaction
POST   /api/packages/:id/run           # Trigger AI pipeline start
POST   /api/packages/:id/resume        # Resume from human gate
GET    /api/packages/:id/ai-status     # Get current graph state/position

# Agent Chat
POST   /api/packages/:id/chat          # Send chat message to agent
GET    /api/packages/:id/chat/history   # Get chat history

# Reconciliation
POST   /api/packages/:id/reconcile     # Trigger reconciliation re-run
GET    /api/packages/:id/exceptions    # Get exception list

# Audit
GET    /api/packages/:id/changelog     # Full audit trail
```

### Responsibilities
1. **Authentication & Authorization** — Validate JWT, check user permissions
2. **Request Validation** — Zod schemas for all inputs
3. **Data Persistence** — Prisma CRUD for all business tables
4. **File Management** — Presigned URLs, blob operations
5. **LangGraph Orchestration** — HTTP calls to Python service (`/run`, `/resume`, `/chat`)
6. **WebSocket Management** — Rooms per package, broadcast events
7. **Audit Logging** — Log every mutation to `DataChangeLog`

---

## Layer 3: AI Engine (Python LangGraph Service)

### Technology Stack
- **Runtime:** Python 3.11
- **Framework:** FastAPI + uvicorn
- **Graph Engine:** LangGraph 0.2+ (StateGraph, conditional_edge, interrupt)
- **Checkpointing:** langgraph-checkpoint-postgres (PostgresSaver)
- **LLM:** Azure OpenAI SDK (openai Python package)
- **OCR:** Azure AI Document Intelligence SDK
- **PDF:** pdfplumber, pdf2image
- **Tracing:** LangSmith (langchain-core callbacks)

### LangGraph State Schema

```python
from typing import TypedDict, Optional, Literal
from dataclasses import dataclass

class PayAppState(TypedDict):
    # Identity
    package_id: str
    run_id: str
    
    # Documents
    documents: list[dict]  # [{blob_url, filename, page_count, classification, confidence}]
    page_images: list[dict]  # [{page_num, image_url, doc_index}]
    
    # Classification
    classifications: list[dict]  # [{doc_index, file_type, confidence, method, reasoning}]
    classification_confirmed: bool
    
    # File 1: GC Header
    gc_header: Optional[dict]  # All 19 fields + confidence per field
    gc_header_confidence: float
    
    # File 1: GC SOV
    gc_sov_lines: list[dict]  # List of 15-field dicts per line
    
    # Plan
    extraction_plan: list[dict]  # [{contractor_name, line_count, page_range_est}]
    plan_confirmed: bool
    
    # File 2: Sub Extraction
    sub_headers: list[dict]  # Per-sub header data (19 fields each)
    sub_sov_lines: list[dict]  # All sub SOV lines (9 fields each)
    extraction_progress: dict  # {sub_name: status}
    
    # Verification
    field_scores: list[dict]  # [{field_id, table, row_id, confidence, status}]
    auto_approved_count: int
    spot_check_count: int
    retry_count: int
    escalated_count: int
    
    # Retry
    retry_results: list[dict]  # [{field_id, attempt, strategy, old_conf, new_conf}]
    
    # Reconciliation
    exceptions: list[dict]  # [{type, severity, sub_name, delta, evidence}]
    
    # Chat
    chat_history: list[dict]  # [{role, content, timestamp}]
    
    # Cost tracking
    total_tokens: int
    total_cost_usd: float
    
    # Status
    current_node: str
    status: Literal["running", "paused", "complete", "error"]
    error_message: Optional[str]
```

### Graph Topology

```python
from langgraph.graph import StateGraph, END

graph = StateGraph(PayAppState)

# Add nodes
graph.add_node("ingest", ingest_node)
graph.add_node("classify", classify_node)
graph.add_node("human_classify", human_classify_gate)  # interrupt()
graph.add_node("extract_gc_header", extract_gc_header_node)
graph.add_node("extract_gc_sov", extract_gc_sov_node)
graph.add_node("generate_plan", generate_plan_node)
graph.add_node("human_plan", human_plan_gate)  # interrupt()
graph.add_node("extract_subs", extract_subs_node)
graph.add_node("verify", verify_node)
graph.add_node("retry", retry_node)
graph.add_node("reconcile", reconcile_node)
graph.add_node("human_review", human_review_gate)  # interrupt()
graph.add_node("complete", complete_node)

# Edges
graph.set_entry_point("ingest")
graph.add_edge("ingest", "classify")

# Classification routing
graph.add_conditional_edges("classify", route_classification, {
    "auto_confirmed": "extract_gc_header",
    "needs_human": "human_classify"
})
graph.add_edge("human_classify", "extract_gc_header")

graph.add_edge("extract_gc_header", "extract_gc_sov")
graph.add_edge("extract_gc_sov", "generate_plan")

# Plan routing
graph.add_conditional_edges("generate_plan", route_plan, {
    "auto_confirmed": "extract_subs",
    "needs_human": "human_plan"
})
graph.add_edge("human_plan", "extract_subs")

graph.add_edge("extract_subs", "verify")

# Verification routing
graph.add_conditional_edges("verify", route_verification, {
    "all_good": "reconcile",
    "needs_retry": "retry"
})
graph.add_edge("retry", "reconcile")

graph.add_edge("reconcile", "human_review")  # Always pause for final review
graph.add_edge("human_review", "complete")
graph.add_edge("complete", END)
```

### FastAPI Endpoints

```python
@app.post("/run")
async def start_run(package_id: str, documents: list[dict]):
    """Start a new extraction pipeline run."""
    
@app.post("/resume")
async def resume_run(package_id: str, run_id: str, payload: dict):
    """Resume from human gate with user input."""
    
@app.get("/status/{package_id}")
async def get_status(package_id: str):
    """Get current graph state and position."""
    
@app.post("/chat")
async def chat(package_id: str, message: str):
    """Send a chat message, route to appropriate action."""
```

---

## Layer 4: Data Layer

### Azure SQL (Business Data) — Full 36-Table Prisma Schema

The v2 application uses the **SAME schema as the previous application** (36 tables across 15 families).
The full schema lives at: `api-gateway/prisma/schema.prisma` (copied from `project-manager/backend/prisma/schema.prisma`).

#### Schema Families Overview

| Family | Tables | Purpose |
|--------|--------|---------|
| 1. Identity & Access | Client, User, Role, UserRole, UserSession | Multi-tenant auth |
| 2. Contract Master | Contract, ContractConfig | Contracts with configurable rules |
| 3. Reference/Lookup | RefExceptionType, RefDocumentType, RefValidationRuleType | Enum tables |
| 4. Packages & Documents | Package, PackageDocument, DocumentPage, ProcessingPipelineStep | Core workflow |
| 5. Agent Planning | AgentPlan, AgentPlanItem | Sub-contractor identification |
| 6. AI Extraction Staging | RawExtractedField | Raw OCR/LLM output before normalization |
| 7. GC Data (File 1) | GcPayApplicationHeader, GcPayApplicationSovLine | JV G702/G703 |
| 8. Sub Data (File 2) | SubPayApplicationHeader, SubPayApplicationSovLine | Sub G702/G703 |
| 9. Supporting Docs (File 3) | SupportingDocumentItem | Lien waivers, COIs |
| 10. Validation Engine | ValidationRun, ReconciliationResult, ExceptionGroup, Exception | Recon rules |
| 11. Review & Resolution | ExceptionResolution, ReviewActionLog | Human decisions |
| 12. Audit & Change History | AuditEvent, ActivityLog, DataChangeLog | Full audit trail |
| 13. Notifications | Notification, NotificationPreference | User alerts |
| 14. External Integration | ApiIntegrationLog, SharepointDocumentRef | LLM cost tracking |
| 15. System Configuration | SystemConfig | Runtime config |

#### Key Relationship: Contract → Package

```prisma
model Contract {
  id                  Int       @id @default(autoincrement())
  clientId            Int       @map("client_id")
  contractNo          String?   @map("contract_no")
  contractName        String    @map("contract_name")
  contractorName      String?   @map("contractor_name")
  ownerName           String?   @map("owner_name")
  originalContractSum Decimal?  @map("original_contract_sum") @db.Decimal(18, 2)
  // ... more fields
  packages  Package[]
  config    ContractConfig?
}

model Package {
  id                   Int       @id @default(autoincrement())
  clientId             Int       @map("client_id")
  contractId           Int       @map("contract_id")     // ← BELONGS TO CONTRACT
  billingPeriodMonth   Int       @map("billing_period_month")
  billingPeriodYear    Int       @map("billing_period_year")
  packageStatus        String    @default("DRAFT") @map("package_status")
  // Statuses: DRAFT → INGESTING → CLASSIFYING → FILE1_EXTRACTING → 
  //           PLAN_PENDING → FILE2_EXTRACTING → VALIDATING → 
  //           EXCEPTION_REVIEW → READY_FOR_APPROVAL → APPROVED → REJECTED
  submittedBy          Int?      @map("submitted_by")
  reviewedBy           Int?      @map("reviewed_by")
  approvedBy           Int?      @map("approved_by")
  
  client    Client   @relation(...)
  contract  Contract @relation(...)    // ← FK TO CONTRACT
  documents PackageDocument[]
  pipelineSteps ProcessingPipelineStep[]
  // ... all extraction tables link here
  
  @@unique([contractId, billingPeriodMonth, billingPeriodYear])
}
```

#### Key Extraction Tables (UI-Visible Fields)

```prisma
model GcPayApplicationHeader {
  // 19 UI-visible fields:
  toOwner, fromContractor, projectName, applicationNo, period, periodFrom, periodTo,
  originalContractSum, netChangeOrders, contractSumToDate, totalCompletedStored,
  retainageCompleted, retainageMaterials, totalRetainage, totalEarnedLessRet,
  lessPrevCertificates, currentPaymentDue, balanceToFinish, changeOrderSummary,
  architectSignature, contractorSignature
  // + provenance: sourcePage, extractionConfidence, bbox*, validationStatus
}

model GcPayApplicationSovLine {
  // 15 UI-visible fields:
  itemNo, timePeriod, phases, typeOfWork, contractorName,
  scheduledOriginal, scheduledChangeOrders, scheduledCurrent,
  workCompletedPrev, workCompletedThis, materialsStored, totalCompleted,
  pct, balanceToFinish, retainage
  // + reconciliation: file2ExtractedAmount, crossFileVariance, file2MatchedSubAppId
  // + provenance: sourcePage, extractionConfidence, bbox*, validationStatus
  // + FK: agentPlanItemId (links to AgentPlanItem)
}

model SubPayApplicationHeader {
  // 19+ UI-visible fields:
  subcontractorName, applicationNo, applicationDate, periodFrom, periodTo,
  invoiceTo, projectNameOnDoc, contractPoNumber, originalContractSum,
  netChangeOrders, contractSumToDate, totalCompletedStored,
  completedWorkThisPeriod, totalRetainage, retainagePercent,
  totalEarnedLessRetainage, lessPrevCertificates, currentPaymentDue, balanceToFinish,
  contractorSignature, architectSignature, notarized
  // + G703 totals: g703ScheduledValue, g703WorkPrev, g703WorkThisPeriod, etc.
  // + metadata: seqId, startPage, endPage, reconFlag
  // + FK: agentPlanItemId
}

model SubPayApplicationSovLine {
  // 9+ UI-visible fields:
  itemNo, description, scheduledValue, workCompletedPrev, workCompletedThis,
  materialsStored, totalCompleted, pctComplete, retainage, balanceToFinish
  // + provenance: sourcePage, extractionConfidence, bbox*, validationStatus
  // + FK: subAppId
}
```

#### Pipeline Steps (Step Rail in UI)

```prisma
model ProcessingPipelineStep {
  packageId   Int     @map("package_id")
  stepNo      Int     @map("step_no")      // 1-9
  stepName    String  @map("step_name")    // Maps to UI step rail
  status      String  @default("pending")  // pending, running, complete, paused, error
  subProgressCurrent Int?                  // For progress bars
  subProgressTotal   Int?
  startedAt   DateTime?
  completedAt DateTime?
  errorMessage String?
  retryCount  Int?    @default(0)
}
// Steps: 1=Upload, 2=Classify, 3=ExtractGC, 4=Plan, 5=ExtractSubs,
//        6=ExtractSupporting, 7=Reconciliation, 8=ExceptionAssembly, 9=ReadyForReview
```

#### Validation & Exceptions (Reconciliation Engine)

```prisma
model ValidationRun {
  packageId, runNumber, runStatus, totalItems,
  autoClearedCount, exceptionsCount, blockingExceptionsCount, dollarAtRisk
}

model ExceptionGroup {
  exceptionTypeCode, displayLabel, severity, itemCount, resolvedCount, dollarAtRisk, status
}

model Exception {
  exceptionTypeCode, entityType, entityId, title, description,
  file1Value, file2Value, expectedValue, variance, dollarAtRisk,
  status (open/accepted/dismissed/overridden),
  evidenceDocumentId, evidencePageNo, evidenceBbox*,
  evidence2DocumentId, evidence2PageNo, evidence2Bbox*
}

model ExceptionResolution {
  exceptionId, resolvedBy, resolutionType, overrideValue, comment
}
```

#### Integer IDs (NOT UUIDs)

The previous app uses `Int @id @default(autoincrement())` for all tables.
The v2 app MUST continue using integer IDs for compatibility.

### Azure PostgreSQL (LangGraph Checkpoints)
- Used exclusively by `langgraph-checkpoint-postgres`
- Stores serialized `PayAppState` at each node transition
- Enables resume after crash, human gates, time-travel debugging
- Tables created automatically by `PostgresSaver.setup()`

### API Endpoints (Contract & Package)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/clients/:clientId/contracts` | List contracts for client |
| POST | `/api/clients/:clientId/contracts` | Create a new contract |
| GET | `/api/contracts/:id` | Get contract details with packages |
| PUT | `/api/contracts/:id` | Update contract |
| GET | `/api/contracts/:contractId/packages` | List packages for contract |
| POST | `/api/contracts/:contractId/packages` | Create package (requires billingPeriodMonth/Year) |
| GET | `/api/packages/:id` | Get package with documents & pipeline steps |
| PUT | `/api/packages/:id/status` | Update package status |

---

## Layer 5: External Services

| Service | Purpose | SDK | Model/Endpoint |
|---------|---------|-----|----------------|
| Azure OpenAI | LLM extraction, classification, verification | `openai` Python SDK | `gpt-4o` (vision), `gpt-4o-mini` (scan/classify) |
| Azure Document Intelligence | OCR (text + bboxes from scans) | `azure-ai-documentintelligence` | `prebuilt-layout` |
| Azure Blob Storage | PDF storage, page images | `@azure/storage-blob` (TS), `azure-storage-blob` (Py) | — |
| Azure Key Vault | Secrets management | `@azure/keyvault-secrets` | — |
| LangSmith | Trace observability, debugging | `langsmith` | — |
| Application Insights | APM, error monitoring, alerts | `applicationinsights` | — |

---

## Layer 6: Security & Networking

```
┌─────────────────────────────────────────────┐
│              Azure VNet                       │
│  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Container App 1  │  │ Container App 2  │ │
│  │ (TS Gateway)     │──│ (Python AI)      │ │
│  │ Public ingress   │  │ Internal only    │ │
│  └──────────────────┘  └──────────────────┘ │
│            │                     │           │
│  ┌─────────┴─────────────────────┴─────────┐│
│  │        Private Endpoints                 ││
│  │  Azure SQL │ PostgreSQL │ Blob │ OpenAI  ││
│  └──────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

- **Frontend:** Static files on CDN (Azure Static Web Apps or Container App)
- **API Gateway:** Public-facing, Azure AD JWT required on all routes
- **AI Engine:** Internal-only (no public access), called only by Gateway
- **Databases:** Private endpoints, no public access
- **Secrets:** Azure Key Vault with managed identity access
- **TLS:** Enforced everywhere (Azure provides certificates)

---

## Data Flow: End-to-End Request

```
User uploads PDF
    → Frontend: POST /api/upload/presign
    → Gateway: generates presigned Blob URL
    → Frontend: uploads directly to Blob Storage
    → Frontend: POST /api/upload/confirm
    → Gateway: creates Package + Document records (Prisma → Azure SQL)
    → Gateway: POST to AI Engine /run {package_id, documents}
    → AI Engine: LangGraph starts → ingest → classify → ...
    → AI Engine: emits WebSocket events via callback to Gateway
    → Gateway: broadcasts to frontend via Socket.io room
    → Frontend: updates progress in real-time
    
Human Gate (e.g., classification confirmation):
    → AI Engine: interrupt() → graph pauses → checkpoint saved
    → Gateway: notifies frontend "waiting for input"
    → Frontend: shows confirmation modal
    → User: confirms classification
    → Frontend: POST /api/packages/:id/resume {classification_override}
    → Gateway: forwards to AI Engine /resume
    → AI Engine: graph resumes from checkpoint
```

---

*End of Architecture Layers*
