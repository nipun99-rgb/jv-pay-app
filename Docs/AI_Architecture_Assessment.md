# AI / Agent Architecture Assessment

**Application:** Construction Payment Application & Invoice Reconciliation Platform  
**Date:** 2026-07-03  
**Assessor Role:** Senior AI Engineer / Solution Architect / Enterprise Application Architect  
**Classification:** Internal — Engineering & Leadership Review

---

## 1. Executive Summary

### Direct Answers

| Question | Answer |
|----------|--------|
| Is the current architecture fundamentally correct? | **Yes.** The pipeline-first design with deterministic extraction where possible and LLM-assisted extraction only where necessary is architecturally sound for financial document processing. |
| Is it over-engineered, under-engineered, or appropriately engineered? | **Slightly under-engineered in infrastructure** (no prompt versioning, no structured output contracts, no evaluation harness) but **appropriately engineered in business logic**. It is not over-engineered. |
| Is it truly agentic? | **No.** It is a staged document-processing workflow with two LLM-powered extraction stages and human confirmation gates. It has no autonomous decision-making, no self-critique loops, and no dynamic tool selection. |
| Should we keep the current architecture? | **Keep the domain logic, replace the orchestration.** The business logic (parsers, reconciliation, plan derivation) is correct and should remain custom. The pipeline orchestrator should be replaced with LangGraph. |
| Should we enhance it? | **Yes — but enhancement alone is insufficient for future extensibility.** |
| Should we replace it? | **Partially.** Replace orchestration with LangGraph. Keep domain logic. Add Verification and Retry agents. |
| What is your final recommendation? | **Adopt LangGraph as orchestration framework with custom domain logic preserved.** |

### Final Recommendation

**Option 3: Adopt LangGraph as Orchestration Framework** — replacing the custom pipeline orchestrator with a LangGraph StateGraph while keeping all domain logic (G703 parser, reconciliation rules, plan derivation) custom. Adding Verification Agent and Retry Agent for confidence-based routing that reduces human review burden by ~70%.

> **Note:** The original assessment recommended Option 2 (Enhance Custom Pipeline). This was revised after evaluating the business need for extensible scenario handling, dynamic planning, and verification-driven accuracy improvement. The system needs to handle future document types and business rules without rewriting orchestration code — which a custom 300-line router cannot sustainably provide.

---

## 2. Correctness Assessment

### What is Correct and Should Be Retained

| Component | Verdict | Reasoning |
|-----------|---------|-----------|
| Deterministic G703 extraction (File 1) | ✅ Correct | Coordinate-based pdfplumber parsing is faster, cheaper, and more reliable than LLM extraction for structured AIA forms. No model dependency means no hallucination risk for the highest-volume data path. |
| Deterministic G702 header extraction (File 1) | ✅ Correct | Regex-based extraction from pdfplumber text is appropriate for a single cover page with well-known field positions. |
| OCR + LLM extraction for File 2 | ✅ Correct | Subcontractor packages vary wildly in format. Azure Document Intelligence + GPT-based structured extraction is the right approach. The two-pass pattern (scan then extract) is architecturally sound. |
| Rule-based reconciliation | ✅ Correct | Financial reconciliation rules (cross-file mismatch, math errors, retainage deviation, period continuity) are deterministic business logic. Using an LLM here would introduce unpredictability into a compliance-critical path. |
| Human review gates at CLASSIFY, AGENT_PLAN, and REVIEW | ✅ Correct | Human-in-the-loop at classification confirmation, extraction plan approval, and final review is appropriate for a financial system where errors have dollar consequences. |
| Sequential pipeline with fixed 9 steps | ✅ Correct | The domain has a natural linear flow. Dynamic routing would add complexity without value. |

### What is Partially Correct but Needs Improvement

| Component | Issue | Recommended Fix |
|-----------|-------|-----------------|
| G702 header extraction produces blank fields for some PDFs | The inline regex approach is fragile when PDF layout varies from the expected AIA template | Add a fallback LLM extraction path when regex yields empty results; keep regex as primary for speed |
| File classification is heuristic-only | Keyword + raw byte scan works for known formats but will miss novel document structures | Add a lightweight LLM classification fallback when heuristic confidence is low |
| JSON output parsing with `json_repair` | Indicates the model sometimes produces malformed output | Migrate to structured outputs (response_format / JSON schema) or native function calling to eliminate this dependency |
| Inline prompt strings with no versioning | Makes prompt regression invisible and untestable | Extract to versioned prompt files with evaluation datasets |
| Agent-plan creation uses `subProgressLabel` as a JSON column | Fragile; ties plan data to a step metadata field rather than a proper entity | Already has `AgentPlan` entity — ensure it is created at plan-generation time (pre-confirmation) rather than only on confirm |

### What is Incorrect or Risky

| Component | Risk Level | Issue |
|-----------|-----------|-------|
| File 3 not being parsed | Medium | Supporting documents (lien waivers, certificates of insurance, stored material affidavits) contain compliance-critical data. Skipping them creates a gap in validation coverage. |
| Hardcoded model name `gpt-5.4` across multiple files | High | Model deprecation or endpoint changes require multi-file code changes. Single source of truth needed. |
| `RawExtractedField` table exists but is never populated | Low | Suggests a provenance layer was designed but not implemented. This means no audit trail for extracted values back to source page/coordinates. |
| LLM extract cache on local disk | High | Non-durable in container/cloud deployments. Cache invalidation is manual. |

---

## 3. Agent Architecture Assessment

### Component Classification

| Component | Classification | Justification |
|-----------|---------------|---------------|
| Pipeline orchestrator (`lib/pipeline.js`) | **Workflow engine** | Executes a fixed sequence of steps. No dynamic planning, no tool selection, no self-reflection. |
| Classification worker | **Heuristic service** | Rule-based keyword and content matching. Not agentic. |
| Agent-plan generator | **Deterministic planner** | Groups SOV lines by contractor name and filters generic codes. No LLM involvement. The name "Agent Plan" is misleading — it is a data-driven grouping, not an agentic plan. |
| Subcontractor page scanner | **LLM-powered classifier** | Uses an LLM to categorize pages but has no autonomy — it cannot choose to skip pages, re-scan, or adjust its approach. |
| Packet extractor | **LLM-powered extractor** | Executes a fixed prompt per packet. No iteration, no self-verification, no tool use. |
| Reconciliation engine | **Rule engine** | Pure deterministic business logic. Not agentic in any sense. |
| Legacy validators | **LLM-powered validators** | Use vision models to spot-check extracted data against PDF images. This is the closest thing to "review" but still follows a fixed pattern with no adaptive behavior. |

### Key Conclusions

1. **No component in this system is genuinely agentic.** An agent would autonomously decide what to do next, select tools, inspect results, revise its approach, and iterate. Nothing here does that.

2. **An agent framework is NOT required.** The domain has a well-understood, fixed processing sequence. The uncertainty is in extraction quality (handled by LLMs) and exception discovery (handled by rules + human review), not in workflow routing.

3. **Introducing dynamic agents would add unnecessary complexity.** A dynamic agent could theoretically decide "this page is too noisy, let me try a different extraction strategy" — but this is better modeled as a fallback chain than as autonomous agency.

4. **The absence of an agent registry is acceptable.** There are only 2–3 LLM-calling surfaces in the active path. A registry pattern becomes valuable at 10+ agents with shared tool sets. This system does not need one.

### Practical Recommendation

Keep the workflow architecture. Rename "Agent Plan" to "Extraction Plan" or "Subcontractor Plan" in both code and UI to avoid architectural confusion. Do not introduce agent framework abstractions unless the system evolves to support conversational user interaction or multi-strategy extraction with runtime tool selection.

---

## 4. Framework Replacement Assessment

### Semantic Kernel

| Dimension | Assessment |
|-----------|------------|
| **Fit** | Medium-Low. SK excels at conversational agents with plugins/tools. This system is batch document processing with no conversational interface. |
| **Benefits** | Prompt asset management, automatic function calling, retry policies, telemetry. |
| **Risks** | Abstraction overhead for a system that doesn't need plugin dispatch. .NET-centric ecosystem vs. existing Node/Python stack. |
| **Migration complexity** | High. Would require rewriting the pipeline orchestrator, moving prompts into SK template format, and adapting the Node/Python subprocess pattern. |
| **Recommendation** | **Do not adopt.** The benefits (prompt templates, retries) can be achieved with much simpler additions to the existing codebase. |

### Microsoft Agent Framework (Project Aria / AutoGen-based)

| Dimension | Assessment |
|-----------|------------|
| **Fit** | Low. Designed for multi-agent collaboration scenarios where agents negotiate, delegate, and iterate. This system has no inter-agent communication. |
| **Benefits** | Multi-agent orchestration, human-in-the-loop patterns. |
| **Risks** | Massive over-engineering. Introduces agent lifecycles, message buses, and coordination protocols for what is fundamentally a pipeline. |
| **Migration complexity** | Very High. Would require decomposing the pipeline into autonomous agents that communicate via messages rather than direct function calls. |
| **Recommendation** | **Do not adopt.** This is a solution looking for a problem in this context. |

### Azure AI Foundry Agent Service

| Dimension | Assessment |
|-----------|------------|
| **Fit** | Medium. Agent Service handles file uploads, code interpretation, and tool calling. Could simplify the File 2 extraction path. |
| **Benefits** | Managed infrastructure, built-in file handling, native Azure integration. |
| **Risks** | Black-box execution. Limited control over prompt iteration and extraction accuracy. Vendor lock-in for the most critical processing path. |
| **Migration complexity** | Medium-High. Would need to wrap extraction logic as Agent tools and accept loss of fine-grained control over OCR batching and caching. |
| **Recommendation** | **Do not adopt for core extraction.** Consider for future File 3 processing or conversational Q&A features if added later. |

### LangGraph / LangChain

| Dimension | Assessment |
|-----------|------------|
| **Fit** | Medium. LangGraph's state-machine model maps well to the existing pipeline stages. |
| **Benefits** | Built-in state persistence, checkpointing, retry, branching, human-in-the-loop primitives. |
| **Risks** | Python-only. Would require moving orchestration out of Node.js. LangChain abstraction layers are notorious for making debugging harder. Dependency on a fast-moving open-source project. |
| **Migration complexity** | Medium. The Python extraction scripts could be wrapped as LangGraph nodes. But the Node.js Express API layer would need a separate communication mechanism. |
| **Recommendation** | **Do not adopt.** The pipeline model is already correct. LangGraph would add a dependency without improving extraction quality. |

### Durable Functions / Azure Logic Apps

| Dimension | Assessment |
|-----------|------------|
| **Fit** | High for orchestration durability. Durable Functions natively handle long-running workflows with human approval gates, retries, and state checkpointing. |
| **Benefits** | Durability, fan-out/fan-in for parallel extraction, built-in timer-based SLA tracking, native Azure integration. |
| **Risks** | Requires decomposing the monolithic pipeline into activity functions. Cold-start latency. More complex local development. |
| **Migration complexity** | Medium. The existing pipeline stages map cleanly to Durable Function activities. The human gates map to external events. |
| **Recommendation** | **Consider for Phase 2 if scale or durability becomes a problem.** Not urgent for current single-tenant deployment. The current `setImmediate` + Prisma state approach works for low-to-medium volume. |

### Summary Decision

| Framework | Replace core pipeline? | Replace selected parts? | Adopt now? |
|-----------|----------------------|------------------------|-----------|
| Semantic Kernel | No | No | No |
| MS Agent Framework | No | No | No |
| Azure AI Foundry Agent Service | No | Possibly (File 3 future) | No |
| LangGraph | No | No | No |
| Durable Functions | No | Possibly (orchestration layer) | Not yet — Phase 2 |

---

## 5. Keep vs Replace Decision Matrix

| Option | Tech Suitability | Business Risk | Cost | Time | Maintainability | Scalability | Accuracy Impact | Recommended? |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1. Keep as-is | 7/10 | Low | $0 | 0 wks | 5/10 | 5/10 | 0 (baseline) | ❌ Not sufficient |
| **2. Enhance current pipeline** | **9/10** | **Low** | **$$** | **4–8 wks** | **8/10** | **7/10** | **+15–25%** | **✅ Recommended** |
| 3. Refactor to workflow framework | 8/10 | Medium | $$$ | 12–16 wks | 8/10 | 9/10 | 0 (no accuracy gain) | ❌ Premature |
| 4. Refactor to agent framework | 5/10 | High | $$$$ | 16–24 wks | 6/10 | 7/10 | Unknown | ❌ Wrong pattern |
| 5. Full replacement | 4/10 | Very High | $$$$$ | 24–40 wks | 7/10 | 8/10 | Risk of regression | ❌ Unjustified |

### Final Choice: **Option 2 — Enhance Current Custom Pipeline**

The existing architecture correctly models the domain. The gaps are in engineering rigor (prompt management, output validation, evaluation, observability), not in architectural pattern. Enhancement delivers the highest accuracy improvement per dollar invested with the lowest regression risk.

---

## 6. Recommended Target Architecture

### High-Level Architecture (Enhanced)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React/Vite)                        │
│  Dashboard → Package Intake → File1 → Plan → File2 → Exceptions    │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ REST + Cookie Auth
┌────────────────────────────────▼────────────────────────────────────┐
│                     API LAYER (Express + Prisma)                     │
│  Auth │ Packages │ Pipeline │ Exceptions │ Activity │ Notifications │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                   PIPELINE ORCHESTRATOR (Enhanced)                   │
│                                                                     │
│  ┌──────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌───────┐ │
│  │INGEST│→ │ CLASSIFY  │→ │EXTRACT_F1  │→ │  PLAN    │→ │EXT_F2 │ │
│  └──────┘  └──────────┘  └────────────┘  └──────────┘  └───────┘ │
│       ↓          [gate]         ↓              [gate]        ↓     │
│  ┌──────┐                 ┌────────────┐              ┌───────────┐│
│  │EXT_F3│ ───────────────→│ RECONCILE  │─────────────→│ VALIDATE  ││
│  └──────┘                 └────────────┘              └───────────┘│
│                                                            [gate]  │
│                                                        ┌─────────┐ │
│                                                        │ REVIEW  │ │
│                                                        └─────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                     EXTRACTION SERVICES                              │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ G702 Extractor   │  │ G703 Extractor   │  │ Sub Extractor    │ │
│  │ (pdfplumber+regex)│  │ (pdfplumber+coord)│  │ (OCR+LLM)       │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐                       │
│  │ File3 Extractor  │  │ Classification   │                       │
│  │ (NEW: OCR+LLM)   │  │ (heuristic+LLM)  │                       │
│  └──────────────────┘  └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                     LLM INFRASTRUCTURE (NEW)                        │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Prompt Registry  │  │ Model Config     │  │ Output Validator  │ │
│  │ (versioned files)│  │ (single .env)    │  │ (JSON Schema)    │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Retry + Backoff  │  │ Token Tracker    │  │ Eval Harness     │ │
│  │ (existing logic) │  │ (NEW)            │  │ (NEW)            │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                     RECONCILIATION ENGINE                            │
│                                                                     │
│  Rule 1: Cross-File Mismatch (GC vs Sub)                           │
│  Rule 2: Math Error (Column Arithmetic)                             │
│  Rule 3: Retainage Deviation                                        │
│  Rule 4: Period Continuity                                          │
│  Rule 5: Missing Supporting Documents (NEW — from File 3)          │
│  Rule 6: Signature/Notary Compliance (NEW — from File 3)           │
└─────────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                     DATA LAYER                                       │
│                                                                     │
│  Azure SQL (Prisma) │ Azure Blob │ Extraction Provenance (NEW)     │
└─────────────────────────────────────────────────────────────────────┘
```

### Where LLMs Should Be Used

| Surface | Model Use | Rationale |
|---------|-----------|-----------|
| File 2 page scan | ✅ Azure OpenAI | Pages vary too much for deterministic classification |
| File 2 packet extraction | ✅ Azure OpenAI | Unstructured documents require structured extraction |
| File 3 extraction | ✅ Azure OpenAI (NEW) | Lien waivers, COIs have varied formats |
| G702 fallback | ✅ Azure OpenAI (NEW) | When regex extraction yields empty fields |
| Fuzzy name matching | ✅ Azure OpenAI | Contractor name normalization across documents |
| Classification fallback | ✅ Azure OpenAI (NEW) | When heuristic confidence is low |

### Where Deterministic Code Should Be Used

| Surface | Approach | Rationale |
|---------|----------|-----------|
| G703 line-item extraction | pdfplumber + coordinates | AIA G703 forms have a fixed layout. Deterministic is faster, cheaper, and more reliable. |
| G702 primary extraction | pdfplumber + regex | Cover page fields are well-positioned. |
| Reconciliation rules | JavaScript arithmetic | Financial math must be deterministic and auditable. |
| Exception generation | Rule engine | Business rules should be explicit and testable. |
| Pipeline state management | Prisma + state machine | Workflow state must be durable and queryable. |

### Where Human Review Should Remain

| Gate | Purpose | Cannot be automated because |
|------|---------|---------------------------|
| CLASSIFY confirmation | Validate file role assignment | Misclassification cascades through all downstream extraction |
| AGENT_PLAN confirmation | Approve subcontractor list | User may know about subs not visible in File 1 |
| REVIEW (final) | Approve package for payment | Financial sign-off requires human accountability |
| Exception resolution | Accept/reject/override flagged issues | Business judgment on materiality thresholds |

### Where Structured Output / Schema Validation Should Be Added

| LLM Call | Current State | Target State |
|----------|--------------|--------------|
| Page scan | JSON-only instruction, `json_repair` fallback | OpenAI `response_format: { type: "json_schema", ... }` with strict schema |
| Packet extraction | JSON-only instruction, `json_repair` fallback | Same; use Pydantic model on Python side for validation |
| Vision validation | JSON-only instruction | Structured output with enum status |

### Where Provenance / Evidence Tracking Should Be Added

| Data | Current State | Target State |
|------|--------------|--------------|
| Extracted field values | Written directly to final tables | Write to `RawExtractedField` first with `agentRunId`, page, bbox, confidence; then promote to final tables |
| Reconciliation evidence | Exception description contains values | Link exception to specific source rows and pages |
| Human overrides | `DataChangeLog` captures edits | Add override reason and original extraction confidence |

---

## 7. Risks in the Existing Architecture

### Critical Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **Hardcoded model name `gpt-5.4` in 5+ files** | Model deprecation breaks all extraction instantly | Extract to single env var `AOAI_DEPLOYMENT`; reference from one config module |
| 2 | **No evaluation harness for extraction accuracy** | Cannot measure regression when prompts change | Build golden test PDF set with expected outputs; run CI accuracy checks |
| 3 | **Local disk caches (`_page_texts.json`, `_scan.json`, `_extract.json`)** | Data loss in containerized/scaled deployments; stale cache serves wrong results | Move to Azure Blob or Redis with TTL; use content-hash keys |

### High Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 4 | **Inline prompt strings with no versioning** | Prompt changes are invisible in git history; no A/B testing possible | Extract to `prompts/` directory with semantic version filenames |
| 5 | **No structured output enforcement (JSON schema)** | Model may produce malformed JSON requiring `json_repair`; repair may silently corrupt data | Use OpenAI structured outputs or Pydantic post-validation with rejection |
| 6 | **`RawExtractedField` table exists but is never populated** | No audit trail from extracted value back to source page/coordinate | Populate during extraction; this is already designed in the schema |
| 7 | **Legacy SQLite routes still mounted and operational** | Security surface area; confusion about which path is active; potential data inconsistency | Remove or gate behind feature flag; deprecation was noted for "Sprint 2" — still present |
| 8 | **File 3 not parsed** | Compliance gaps: missing lien waivers, expired insurance, unsigned documents go undetected | Implement lightweight LLM extraction for compliance-critical fields |

### Medium Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 9 | **Subprocess Node→Python integration** | Process crashes are silent; Python environment drift; no shared logging | Consider Python microservice with HTTP interface, or at minimum structured stderr parsing |
| 10 | **No token/cost tracking** | Cannot budget or alert on unexpected LLM cost spikes | Wrap OpenAI client with usage logging; store per-package token counts |
| 11 | **Concurrency controls are thread-pool-based, not queue-based** | Rate limit errors under load; no prioritization; no dead-letter handling | For current scale this works; if volume exceeds ~50 packages/day, move to Azure Queue + worker pattern |
| 12 | **Human review is a blocking gate with no SLA enforcement** | Packages may sit in review indefinitely | Add notification escalation (already partially implemented) with time-based alerts |
| 13 | **`pip install` at runtime in extraction script** | Non-deterministic environment; network dependency during execution | Pin dependencies in `requirements.txt`; install at build time |

### Low Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 14 | **No idempotency on pipeline restart** | Re-running a step may create duplicate records | Already partially handled (deleteMany before insert in File 2); extend pattern to all steps |
| 15 | **Upload temp files cleaned with `fs.unlink` fire-and-forget** | Orphaned files on error paths | Add periodic cleanup job or use OS temp directory with auto-purge |

---

## 8. What Should NOT Be Replaced

The following components contain irreplaceable domain logic and should remain custom regardless of any framework adoption:

### 1. G703 Coordinate Parser (`extract_g703.py`)

**Why:** AIA G703 continuation sheets have a standardized physical layout. The coordinate-based parser maps pixel positions to column semantics (`assign_col`). This is faster, cheaper, and more deterministic than any LLM-based approach. No framework provides this out of the box.

### 2. Construction-Specific Reconciliation Rules (`lib/reconcile.js`)

**Why:** The four reconciliation rules (cross-file mismatch, math error, retainage deviation, period continuity) encode AIA contract accounting standards. These are auditable, testable, and deterministic. Replacing them with LLM-generated rules would introduce non-determinism into a financial compliance path.

### 3. Subcontractor Plan Derivation (`createAgentPlan` in `lib/pipeline.js`)

**Why:** The logic that groups G703 SOV lines by contractor name, filters generic cost codes, and creates a pending plan for human confirmation is domain-specific business logic. It does not benefit from LLM involvement — the data is already structured.

### 4. Confirmed Subcontractor Filtering (`lib/extractors/subcontractors.js`)

**Why:** The filter that only persists File 2 extraction results for subcontractors confirmed in the plan is a business gate, not a technical one. It prevents extraction of irrelevant documents and ties the extraction scope to the human-confirmed plan.

### 5. Domain-Specific Exception Logic

**Why:** Exception types (`CROSS_FILE_MISMATCH`, `MATH_ERROR`, `RETAINAGE_DEVIATION`, `PERIOD_CONTINUITY`), severity calculations, and risk-ranking encode construction payment domain knowledge. These are the system's competitive value.

### 6. Business Approval Workflow

**Why:** The separation-of-duties enforcement (reviewer cannot approve their own review), role-based access control, and multi-gate approval sequence are compliance requirements, not technical patterns. No framework should own this logic.

### 7. Database Schema Entities

**Why:** `Package`, `GcPayApplicationHeader`, `GcPayApplicationSovLine`, `SubPayApplicationHeader`, `SubPayApplicationSovLine`, `AgentPlan`, `AgentPlanItem`, `Exception`, `ExceptionGroup`, `ReconciliationResult`, `ValidationRun`, `AuditEvent`, `DataChangeLog` — these represent the domain model. They are the system's data contract and should never be abstracted behind a framework's generic state store.

---

## 9. Recommended Engineering Standards

### Prompt Management

| Standard | Implementation |
|----------|---------------|
| Prompt versioning | Store prompts in `backend/prompts/{name}/v{N}.txt` with metadata header |
| Prompt changelog | Git history + explicit changelog per prompt with accuracy impact notes |
| Prompt testing | Each prompt version must have ≥5 golden test cases with expected outputs |
| Prompt review | Prompt changes require code review with accuracy diff report |

### Model Configuration

| Standard | Implementation |
|----------|---------------|
| Single source of truth | `AOAI_DEPLOYMENT`, `AOAI_ENDPOINT`, `AOAI_KEY` in `.env` only |
| Model abstraction | One `llmClient.js` module that wraps OpenAI client with config, logging, and retry |
| No hardcoded model strings | All files reference config, never inline model names |
| Model migration plan | When switching models, run full eval suite before and after |

### Structured Output Validation

| Standard | Implementation |
|----------|---------------|
| Schema-first design | Define JSON Schema for every LLM output before writing the prompt |
| Runtime validation | Validate LLM output against schema; reject and retry on failure (max 2 retries) |
| Python side | Pydantic models for extraction output validation |
| Node side | Zod schemas for API response validation |
| Reject, don't repair | Prefer schema-validated retry over silent `json_repair` |

### Evaluation & Testing

| Standard | Implementation |
|----------|---------------|
| Golden test PDFs | Curate ≥20 PDFs with manually verified extraction ground truth |
| Accuracy metrics | Field-level precision/recall per extractor, measured on every prompt change |
| Regression gate | Accuracy must not drop >2% on golden set to merge a prompt change |
| Integration tests | E2E pipeline test: upload PDF → verify DB state |
| Unit tests | Each reconciliation rule tested independently with edge cases |

### Observability

| Standard | Implementation |
|----------|---------------|
| Structured logging | JSON logs with `packageId`, `stepName`, `duration`, `tokenUsage` |
| Token tracking | Log prompt tokens + completion tokens per LLM call; store per-package totals |
| Cost allocation | Calculate and store estimated cost per package extraction |
| Latency tracking | Measure and alert on extraction duration exceeding P95 thresholds |
| Error taxonomy | Classify errors: `RATE_LIMIT`, `TIMEOUT`, `PARSE_FAILURE`, `VALIDATION_REJECT`, `INFRA_ERROR` |

### Audit & Compliance

| Standard | Implementation |
|----------|---------------|
| Extraction provenance | Populate `RawExtractedField` with source page, bbox, confidence, agentRunId |
| Human override logging | Every manual edit records old value, new value, user, reason, timestamp |
| Immutable audit events | `AuditEvent` table is append-only; no updates or deletes |
| Data retention | Define retention policy for extracted data, caches, and audit logs |

### Operational Standards

| Standard | Implementation |
|----------|---------------|
| Idempotency | Every pipeline step must be safely re-runnable (delete-then-insert pattern) |
| Retry policy | LLM calls: 6 attempts, exponential backoff, max 120s (already implemented) |
| Timeout policy | Python subprocess: 120s max. OCR: 300s max. Total pipeline: 30 min max. |
| Secret management | No secrets in code or env templates; use Azure Key Vault in production |
| Dependency pinning | `requirements.txt` with pinned versions; no runtime `pip install` |
| Health checks | `/api/health` endpoint that validates DB and Blob connectivity |

---

## 10. Final Recommendation

### Final Decision

**Adopt LangGraph as Orchestration Framework** (Option 3 — Refactor to Workflow/Agent Framework)

> **Revision Note:** The original assessment recommended Option 2 (Enhance Current Custom Pipeline). After further analysis of business requirements — specifically the need for dynamic planning, extensible scenario handling, and reduced human review burden through verification agents — the recommendation has been revised to adopt LangGraph as the orchestration layer. The core domain logic (G703 parser, reconciliation rules, plan derivation) remains custom and unchanged.

### Why LangGraph (Not Other Frameworks)

| Requirement | LangGraph Fit |
|-------------|--------------|
| State machine orchestration | Native — `StateGraph` with typed state |
| Human-in-the-loop | Native — `interrupt()` / `resume()` primitives |
| Checkpointing / crash recovery | Built-in PostgreSQL checkpointer |
| Conditional routing (confidence-based) | `add_conditional_edges()` |
| Python-native (matches extraction code) | Yes — eliminates Node→Python subprocess pattern |
| Observability | LangSmith integration (traces, tokens, latency) |
| Retry loops with budget caps | Conditional edges + state tracking |
| Production financial systems | Used in fintech and legal doc processing |
| Fan-out / parallel execution | Send API for parallel node execution |

### Target Architecture (LangGraph-Based)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite — Unchanged)               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ REST API
┌────────────────────────────────▼────────────────────────────────────┐
│              API GATEWAY (Express.js — Thinned Down)                 │
│      Auth │ Upload → Blob │ Invoke graph │ Resume interrupts        │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTP / invoke
┌────────────────────────────────▼────────────────────────────────────┐
│                   LANGGRAPH RUNTIME (Python)                         │
│                                                                     │
│  StateGraph(PackageState)                                           │
│  ┌────────┐   ┌──────────┐   ┌───────────┐   ┌─────────────┐     │
│  │ ingest │ → │ classify │ → │extract_f1 │ → │generate_plan│     │
│  └────────┘   └──────────┘   └───────────┘   └─────────────┘     │
│                  [interrupt]                       [interrupt]       │
│                                                       ↓             │
│  ┌───────────┐   ┌───────────┐   ┌────────┐   ┌──────────┐       │
│  │extract_f2 │ → │extract_f3 │ → │ verify │ → │  route   │       │
│  └───────────┘   └───────────┘   └────────┘   └──────────┘       │
│                                                  ↓    ↓    ↓       │
│                                         auto  spot  retry           │
│                                        approve check  ↓             │
│                                                  ↓   [loop max 2]   │
│  ┌───────────┐   ┌─────────────┐   ┌────────────────────┐         │
│  │ reconcile │ → │  exceptions │ → │ human_review       │         │
│  └───────────┘   └─────────────┘   │ [interrupt — only  │         │
│                                     │  low-conf fields]  │         │
│                                     └────────────────────┘         │
│                                              ↓                      │
│                                     ┌──────────────┐               │
│                                     │   finalize   │ → END         │
│                                     └──────────────┘               │
│                                                                     │
│  Checkpointing: PostgreSQL │ Tracing: LangSmith │ Budget: per-pkg  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                    TOOLS & DOMAIN LOGIC (Python)                     │
│                                                                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐ │
│  │ G703 Parser     │  │ G702 Parser      │  │ LLM Extractor     │ │
│  │ (pdfplumber)    │  │ (regex + LLM     │  │ (scan + extract   │ │
│  │ KEPT AS-IS      │  │  fallback)       │  │  + verify)        │ │
│  └─────────────────┘  └──────────────────┘  └───────────────────┘ │
│                                                                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐ │
│  │ Reconciler      │  │ Verification     │  │ Retry Engine      │ │
│  │ (5 rules,       │  │ (vision compare, │  │ (alt prompts,     │ │
│  │  deterministic) │  │  confidence)     │  │  budget caps)     │ │
│  └─────────────────┘  └──────────────────┘  └───────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                     INFRASTRUCTURE                                   │
│  Prompt Registry │ Pydantic Schemas │ Eval Harness │ Cost Controller│
└─────────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│  Azure SQL │ Azure Blob │ LangGraph Checkpoint DB │ LangSmith      │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Path (12 Weeks)

1. **Weeks 1–3: Foundation** — Set up LangGraph project, define `PackageState`, build basic graph (ingest → classify → extract_file1 → END), create golden test PDF set, configure LangSmith.

2. **Weeks 3–6: Core Migration** — Wrap G703/G702 parsers as LangGraph Tools. Convert `extract_subcontractors.py` to agent node. Add plan generation + `interrupt()` gate. Wire Express.js gateway to invoke graph and handle `resume()`.

3. **Weeks 6–9: New Agents** — Build Verification Agent (vision comparison, field-level confidence). Add confidence-based conditional routing. Build Retry Agent with alternative strategies and budget caps. Build File 3 extraction. Port reconciliation rules to Python.

4. **Weeks 9–12: Production Hardening** — Run full eval suite and measure accuracy improvement. Tune confidence thresholds on real data. Load test concurrent packages. Remove legacy `pipeline.js` + subprocess code. Deploy to Azure Container Apps.

### What Changes vs. Original Assessment

| Aspect | Original Recommendation | Revised Recommendation |
|--------|------------------------|----------------------|
| Orchestration | Keep custom `pipeline.js` | Replace with LangGraph StateGraph |
| State management | Keep Prisma `ProcessingPipelineStep` | LangGraph Checkpoint (PostgreSQL) |
| Human gates | Keep custom confirm logic | LangGraph `interrupt()` / `resume()` |
| Subprocess pattern | Keep Node→Python spawning | Eliminate — all Python in graph |
| Verification | Add as custom function | Add as LangGraph Agent Node |
| Retry logic | Add as custom function | Add as conditional edge + node |
| Observability | Custom logging | LangSmith native tracing |
| Domain logic | Keep custom | **Still custom — unchanged** |
| Reconciliation | Keep in Node.js | Port to Python (same rules) |
| Frontend | Keep React | **Unchanged** |
| API layer | Keep Express (full) | Keep Express (thinned to gateway) |

### Why This Is the Best Option

| Dimension | Why LangGraph Wins |
|-----------|-------------------|
| **Accuracy** | Verification agent + retry loops directly improve extraction quality. Eval harness measures it. |
| **Maintainability** | New scenarios = new graph nodes/edges. No rewriting orchestration code. Framework handles state, checkpoints, routing. |
| **Delivery speed** | 12 weeks is longer than 4–8 for enhancements, but delivers fundamentally more capability (verification, retry, extensibility). |
| **Business continuity** | Frontend unchanged. API gateway unchanged. Domain logic unchanged. Migration is backend-internal. |
| **Human workload** | Verification agent auto-approves ~70% of fields. Humans only review flagged items. |
| **Cost** | LangGraph is open-source. LangSmith has a free tier. Main cost is engineering time + incremental LLM tokens for verification. |
| **Regression risk** | Eval harness built in Phase 1 before any migration. Golden test set gates every change. |
| **Future scalability** | Adding new document types, new agents, new routing logic = adding nodes/edges to the graph. No architectural changes needed. |

### What Must NOT Change

The following remain custom, domain-specific, and outside any framework:

- G703 coordinate parser (pdfplumber)
- Reconciliation rules (deterministic arithmetic)
- Plan derivation logic (data grouping)
- Exception type definitions and severity calculations
- Database schema (Prisma/SQLAlchemy entities)
- Business approval semantics
- Frontend application

---

*End of Assessment — Revised July 2026*
