"""
JV Pay Application v2 — AI Engine (FastAPI)

Endpoints:
  GET  /health
  POST /run     — start a new graph run (async background task)
  POST /resume  — resume a paused graph (HITL gate)
  GET  /status/{package_id}
  POST /chat
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

from dotenv import load_dotenv

load_dotenv()

import httpx
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.graph.builder import build_graph
from app.graph.state import PayAppState

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# ─── Checkpointer ─────────────────────────────────────────────────────────────

checkpointer = None  # set during lifespan when PostgreSQL is available

def _get_checkpointer():
    """Return an initialized PostgresSaver, or None if not configured."""
    try:
        import psycopg
        from langgraph.checkpoint.postgres import PostgresSaver
        # from_conn_string() is a context manager; use direct connection instead
        conn = psycopg.connect(settings.postgres_dsn, autocommit=True)
        cp = PostgresSaver(conn)
        cp.setup()
        logger.info("PostgreSQL checkpointer connected: %s", settings.postgres_dsn.split("@")[-1])
        return cp
    except Exception as e:
        logger.warning("PostgreSQL checkpointer unavailable (%s) — running without persistence", e)
        return None


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    global checkpointer
    logger.info("AI Engine starting up — building graph...")
    checkpointer = _get_checkpointer()
    if checkpointer:
        logger.info("Checkpointer ready")
    else:
        logger.info("Running without checkpointer (graph state not persisted)")
    logger.info("AI Engine ready")
    yield
    logger.info("AI Engine shutting down")


app = FastAPI(
    title="JV Pay AI Engine",
    version="2.0.0",
    description="LangGraph-powered extraction and reconciliation engine",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.api_gateway_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── In-memory run status cache (per package_id) ─────────────────────────────

_run_status: dict[str, dict] = {}


def _set_status(package_id: str, **kwargs: object) -> None:
    _run_status[package_id] = {**_run_status.get(package_id, {}), **kwargs}


# ─── Request / Response schemas ───────────────────────────────────────────────

class RunRequest(BaseModel):
    package_id: str = Field(..., description="UUID of the Package record")
    document_urls: list[str] = Field(default_factory=list)
    documents: list[dict] = Field(default_factory=list, description="Original doc metadata with filenames")
    run_id: str | None = Field(None, description="Optional override run ID")


class ResumeRequest(BaseModel):
    package_id: str
    resume_data: dict = Field(default_factory=dict, description="Data to inject at the interrupt point")


class ReExtractSovRequest(BaseModel):
    package_id: str
    start_page: int = Field(2, ge=2)
    end_page: int = Field(8, le=20)
    pages: list[int] = Field(default_factory=list)


class ChatRequest(BaseModel):
    package_id: str
    user_message: str


class StatusResponse(BaseModel):
    package_id: str
    status: str
    current_node: str | None = None
    total_cost_usd: float | None = None
    total_tokens: int | None = None
    classifications: list | None = None
    interrupt_data: dict | None = None
    extraction_plan: list | None = None
    review_summary: dict | None = None


# ─── Background graph runner ──────────────────────────────────────────────────

async def _log_activity(package_id: str, message: str, event_type: str = "info", node: str | None = None) -> None:
    """Fire-and-forget: persist an activity log entry via the API gateway."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                f"{settings.api_gateway_url}/api/packages/{package_id}/activity",
                json={"message": message, "eventType": event_type, "node": node},
            )
    except Exception as e:
        logger.warning("Could not log activity for package %s: %s", package_id, e)


async def _run_graph(package_id: str, document_urls: list[str], run_id: str, doc_meta: list[dict] | None = None) -> None:
    """Execute the full LangGraph run in a background asyncio task."""
    _set_status(package_id, status="RUNNING", current_node="ingest", run_id=run_id)
    logger.info("Starting graph run package_id=%s run_id=%s", package_id, run_id)
    await _log_activity(package_id, "Pipeline started — ingesting documents", "info", "ingest")

    # Build document list using original filenames from API gateway when available
    documents = []
    for i, url in enumerate(document_urls):
        orig_name = (doc_meta[i].get("filename") if doc_meta and i < len(doc_meta) else None) or url.split("/")[-1].split("?")[0]
        documents.append({"blob_url": url, "filename": orig_name})

    initial_state: PayAppState = {
        "package_id": package_id,
        "run_id": run_id,
        "documents": documents,
        "page_images": [],
        "classifications": [],
        "gc_header": {},
        "gc_sov_lines": [],
        "extraction_plan": [],
        "sub_headers": [],
        "sub_sov_lines": [],
        "field_scores": [],
        "exceptions": [],
        "total_tokens": 0,
        "total_cost_usd": 0.0,
        "current_node": "ingest",
        "status": "RUNNING",
        "retry_count": 0,
        "error_message": None,
    }

    try:
        graph = build_graph(checkpointer=checkpointer)
        config = {"configurable": {"thread_id": package_id}}

        # Check if there's an existing checkpoint — if so, resume from it
        # instead of restarting from scratch (avoids re-running ingest)
        existing_checkpoint = None
        if checkpointer:
            try:
                existing_checkpoint = checkpointer.get(config)
            except Exception:
                pass

        if existing_checkpoint:
            logger.info("Resuming from existing checkpoint for package_id=%s", package_id)
            await _log_activity(package_id, "Resuming from last checkpoint…", "info", "ingest")
            final_state = await asyncio.to_thread(graph.invoke, None, config)
        else:
            final_state = await asyncio.to_thread(graph.invoke, initial_state, config)

        # Detect LangGraph interrupt (human gate suspended graph)
        raw_interrupts = final_state.get("__interrupt__", []) if isinstance(final_state, dict) else []
        if raw_interrupts:
            interrupt_obj = raw_interrupts[0]
            interrupt_val: dict = interrupt_obj.value if hasattr(interrupt_obj, "value") else {}
            gate_type: str = interrupt_val.get("type", "unknown")
            classifications: list = interrupt_val.get("classifications", [])
            extraction_plan: list = interrupt_val.get("extraction_plan", [])
            review_summary: dict = interrupt_val.get("summary", {})

            current_node = (
                "human_classify_gate" if gate_type == "classification_review"
                else "human_plan_gate" if gate_type == "plan_review"
                else "human_review_gate" if gate_type == "review_gate"
                else "human_gate"
            )
            _set_status(
                package_id,
                status="AWAITING_INPUT",
                current_node=current_node,
                classifications=classifications or None,
                extraction_plan=extraction_plan or None,
                review_summary=review_summary or None,
                interrupt_data=interrupt_val,
            )
            logger.info("Graph interrupted at %s package_id=%s", current_node, package_id)
            await _log_activity(
                package_id,
                "Classification review required — awaiting your confirmation" if gate_type == "classification_review"
                else "Plan review required — please confirm sub-contractor list",
                "warn",
                current_node,
            )
        else:
            _set_status(
                package_id,
                status=final_state.get("status", "COMPLETE"),
                current_node=final_state.get("current_node"),
                total_cost_usd=final_state.get("total_cost_usd", 0.0),
                total_tokens=final_state.get("total_tokens", 0),
                classifications=final_state.get("classifications") or None,
            )
            logger.info("Graph run complete package_id=%s", package_id)
            await _log_activity(package_id, "Pipeline complete", "success", final_state.get("current_node"))
            await _notify_gateway(package_id, final_state)

    except Exception as exc:
        exc_name = type(exc).__name__
        # Catch LangGraph interrupt raised as exception (version-dependent behaviour)
        if "interrupt" in exc_name.lower():
            _set_status(package_id, status="AWAITING_INPUT", current_node="human_classify_gate")
            await _log_activity(package_id, "Awaiting classification confirmation", "warn")
        else:
            logger.exception("Graph run failed package_id=%s: %s", package_id, exc)
            _set_status(package_id, status="FAILED", error_message=str(exc))
            await _log_activity(package_id, f"Pipeline failed: {exc}", "error")
            await _notify_gateway_error(package_id, str(exc))


async def _notify_gateway(package_id: str, state: PayAppState) -> None:
    """Fire-and-forget: tell API gateway the run is done."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{settings.api_gateway_url}/api/packages/{package_id}/run-complete",
                json={
                    "status": state.get("status", "COMPLETE"),
                    "current_node": state.get("current_node"),
                    "total_cost_usd": state.get("total_cost_usd", 0.0),
                    "total_tokens": state.get("total_tokens", 0),
                },
            )
    except Exception as e:
        logger.warning("Could not notify gateway for package %s: %s", package_id, e)


async def _notify_gateway_error(package_id: str, error: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{settings.api_gateway_url}/api/packages/{package_id}/run-complete",
                json={"status": "FAILED", "error_message": error},
            )
    except Exception as e:
        logger.warning("Could not notify gateway of failure for package %s: %s", package_id, e)


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "jv-pay-ai-engine",
        "version": "2.0.0",
        "checkpointer": "postgres" if checkpointer else "none",
    }


@app.post("/run", status_code=202)
async def run(req: RunRequest, background_tasks: BackgroundTasks) -> dict:
    """Start a new LangGraph run for the given package (async background task)."""
    run_id = req.run_id or str(uuid.uuid4())
    logger.info("POST /run package_id=%s run_id=%s docs=%d", req.package_id, run_id, len(req.document_urls))
    _set_status(req.package_id, status="QUEUED", run_id=run_id)
    background_tasks.add_task(_run_graph, req.package_id, req.document_urls, run_id, req.documents or None)
    return {
        "accepted": True,
        "package_id": req.package_id,
        "run_id": run_id,
        "message": "Run accepted — graph executing in background.",
    }


@app.post("/resume", status_code=202)
async def resume(req: ResumeRequest) -> dict:
    """Resume a paused graph at a human gate interrupt."""
    logger.info("POST /resume package_id=%s", req.package_id)
    if checkpointer is None:
        raise HTTPException(status_code=503, detail="Checkpointer not available — cannot resume")
    try:
        graph = build_graph(checkpointer=checkpointer)
        config = {"configurable": {"thread_id": req.package_id}}
        # Update state with resume_data then stream to completion
        run_id = str(uuid.uuid4())
        asyncio.create_task(_resume_graph(graph, config, req.package_id, req.resume_data, run_id))
        return {"accepted": True, "package_id": req.package_id, "run_id": run_id}
    except Exception as exc:
        logger.exception("Resume failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


async def _resume_graph(graph, config: dict, package_id: str, resume_data: dict, run_id: str) -> None:
    try:
        from langgraph.types import Command
        _set_status(package_id, status="RUNNING", run_id=run_id)
        await _log_activity(package_id, "Resuming pipeline after user confirmation", "info")

        final_state = await asyncio.to_thread(graph.invoke, Command(resume=resume_data), config)

        # Check for another interrupt (e.g. human_plan_gate after classification)
        raw_interrupts = final_state.get("__interrupt__", []) if isinstance(final_state, dict) else []
        if raw_interrupts:
            interrupt_obj = raw_interrupts[0]
            interrupt_val: dict = interrupt_obj.value if hasattr(interrupt_obj, "value") else {}
            gate_type: str = interrupt_val.get("type", "unknown")
            extraction_plan_val: list = interrupt_val.get("extraction_plan", [])
            review_summary_val: dict = interrupt_val.get("summary", {})
            current_node = (
                "human_plan_gate" if gate_type == "plan_review"
                else "human_review_gate" if gate_type == "review_gate"
                else "human_gate"
            )
            _set_status(
                package_id,
                status="AWAITING_INPUT",
                current_node=current_node,
                interrupt_data=interrupt_val,
                extraction_plan=extraction_plan_val or None,
                review_summary=review_summary_val or None,
            )
            await _log_activity(package_id, f"Awaiting user input at {current_node}", "warn", current_node)
        else:
            _set_status(
                package_id,
                status=final_state.get("status", "COMPLETE"),
                current_node=final_state.get("current_node"),
                classifications=final_state.get("classifications") or None,
                interrupt_data=None,  # clear interrupt state now that resume is done
            )
            await _log_activity(package_id, "Pipeline resumed and completed", "success")
            await _notify_gateway(package_id, final_state)
    except Exception as exc:
        logger.exception("Resume graph failed: %s", exc)
        _set_status(package_id, status="FAILED", error_message=str(exc))
        await _log_activity(package_id, f"Resume failed: {exc}", "error")


@app.get("/status/{package_id}", response_model=StatusResponse)
async def get_status(package_id: str) -> StatusResponse:
    cached = _run_status.get(package_id)
    if not cached:
        return StatusResponse(package_id=package_id, status="UNKNOWN")
    return StatusResponse(
        package_id=package_id,
        status=cached.get("status", "UNKNOWN"),
        current_node=cached.get("current_node"),
        total_cost_usd=cached.get("total_cost_usd"),
        total_tokens=cached.get("total_tokens"),
        classifications=cached.get("classifications"),
        interrupt_data=cached.get("interrupt_data"),
        extraction_plan=cached.get("extraction_plan"),
        review_summary=cached.get("review_summary"),
    )


@app.post("/reextract-sov", status_code=202)
async def reextract_sov(req: ReExtractSovRequest, background_tasks: BackgroundTasks) -> dict:
    """Re-run G703 SOV extraction on specific pages and auto-update the database."""
    logger.info("POST /reextract-sov package_id=%s pages=%s-%s", req.package_id, req.start_page, req.end_page)

    async def _do_reextract():
        try:
            from app.agents.tools.parallel_vision_tools import extract_all_sov_pages_parallel
            from app.agents.tools.pdfplumber_tools import extract_all_sov_pages_with_pdfplumber
            import httpx as _httpx

            _gw = os.environ.get("API_GATEWAY_URL", "http://localhost:3001")
            await _log_activity(req.package_id, f"[SOV Re-extractor → Vision]: Re-extracting pages {req.start_page}–{req.end_page}...", "info", "reextract_sov")

            # Run parallel vision extraction on selected pages
            result = await asyncio.to_thread(
                extract_all_sov_pages_parallel.invoke,
                {"package_id": req.package_id, "start_page": req.start_page, "end_page": req.end_page}
            )
            lines = result.get("lines", []) if isinstance(result, dict) else []

            if lines:
                # POST the re-extracted lines back (replaces existing lines from those pages)
                async with _httpx.AsyncClient(timeout=30) as client:
                    await client.post(
                        f"{_gw}/api/packages/{req.package_id}/gc-sov",
                        json=lines,
                        headers={"Content-Type": "application/json"},
                    )
                await _log_activity(req.package_id, f"[SOV Re-extractor → System]: Re-extracted {len(lines)} lines from pages {req.start_page}–{req.end_page}. Values auto-updated.", "success", "reextract_sov")
            else:
                await _log_activity(req.package_id, f"[SOV Re-extractor → System]: No lines extracted from pages {req.start_page}–{req.end_page}. Please check the PDF.", "warning", "reextract_sov")
        except Exception as e:
            logger.exception("[reextract-sov] failed for %s: %s", req.package_id, e)
            await _log_activity(req.package_id, f"[SOV Re-extractor → Error]: Re-extraction failed: {e}", "error", "reextract_sov")

    background_tasks.add_task(_do_reextract)
    return {"accepted": True, "package_id": req.package_id, "pages": f"{req.start_page}-{req.end_page}"}


@app.post("/chat")
async def chat(req: ChatRequest) -> dict:
    """Sprint 11: Agent chat — intent classification + tool execution + LLM response."""
    import json as _json
    from openai import AzureOpenAI

    package_id = req.package_id
    message = req.user_message.strip()
    if not message:
        return {"package_id": package_id, "reply": "Please type a question.", "intent": "empty", "cost_usd": 0.0, "tokens": 0}

    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_GPT4O", "gpt-5.4")
    gateway = settings.api_gateway_url
    total_tokens = 0

    _INTENT_PROMPT = (
        "You are a routing agent for a construction pay-application review system.\n"
        "Classify the user's message into one intent:\n"
        "- lookup_field      : user asks for a specific financial or text field value\n"
        "- explain_exception : user asks about a flagged exception or discrepancy\n"
        "- ask_status        : user asks about pipeline progress or current node\n"
        "- re_extract        : user wants to re-run or retry field extraction (keywords: re-extract, retry, missing fields, try again, re-run extraction, find fields again)\n"
        "- general_qa        : anything else\n\n"
        "Return ONLY valid JSON: {\"intent\": \"...\", \"entity\": \"...\", \"confidence\": 0.9}"
    )

    _RESPONSE_PROMPT = (
        "You are a helpful AI assistant reviewing a construction pay application.\n"
        "Use only the context below to answer. Be concise (2-4 sentences). "
        "Never invent numbers — if data is missing, say so.\n\n"
        "Context:\n{context}\n\nQuestion: {question}"
    )

    def _flt(v: object) -> str:
        try:
            return f"${float(v):,.2f}"  # type: ignore[arg-type]
        except Exception:
            return str(v)

    async def _get_header() -> dict:
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                r = await c.get(f"{gateway}/api/packages/{package_id}/gc-header")
                return r.json() if r.status_code == 200 else {}
        except Exception:
            return {}

    async def _get_exceptions() -> list:
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                r = await c.get(f"{gateway}/api/packages/{package_id}/exceptions")
                return r.json() if r.status_code == 200 else []
        except Exception:
            return []

    async def _get_pkg() -> dict:
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                r = await c.get(f"{gateway}/api/packages/{package_id}")
                return r.json() if r.status_code == 200 else {}
        except Exception:
            return {}

    def _lookup_field_context(header: dict, entity: str) -> str:
        if not header:
            return "No GC header data available yet."
        _MAP = {
            "payment due": "currentPaymentDue", "current payment": "currentPaymentDue",
            "contract sum": "contractSumToDate", "original contract": "originalContractSum",
            "net change": "netChangeOrders", "retainage": "totalRetainage",
            "balance": "balanceToFinish", "total completed": "totalCompletedStored",
            "application": "applicationNo", "period": "period",
            "project": "projectName", "contractor": "fromContractor", "owner": "toOwner",
            "earned less": "totalEarnedLessRet", "prev cert": "lessPrevCertificates",
        }
        entity_l = entity.lower()
        hits = []
        for phrase, key in _MAP.items():
            if phrase in entity_l and header.get(key) is not None:
                hits.append(f"{key}: {_flt(header[key])}")
        if hits:
            return "GC Header:\n" + "\n".join(hits)
        # fallback — return the 5 key financial fields
        keys = ["applicationNo", "currentPaymentDue", "contractSumToDate", "totalRetainage", "balanceToFinish"]
        lines = [f"{k}: {_flt(header[k])}" for k in keys if header.get(k) is not None]
        return ("Key GC values:\n" + "\n".join(lines)) if lines else "No financial data found."

    def _exceptions_context(exceptions: list, entity: str) -> str:
        if not exceptions:
            return "No exceptions found for this package."
        open_ex = [e for e in exceptions if e.get("status") == "OPEN"]
        high_ex = [e for e in open_ex if e.get("severity") == "HIGH"]
        summary = (f"{len(exceptions)} exceptions total — {len(open_ex)} open, "
                   f"{len(high_ex)} high severity.")
        entity_l = entity.lower()
        relevant = next(
            (e for e in open_ex
             if entity_l in (e.get("evidence") or "").lower()
             or entity_l in (e.get("subName") or "").lower()),
            open_ex[0] if open_ex else None,
        )
        if relevant:
            summary += (
                f"\n\nTop exception: [{relevant.get('severity')}] {relevant.get('type')}"
                + (f" — {relevant['subName']}" if relevant.get("subName") else "")
                + (f"\nEvidence: {relevant['evidence']}" if relevant.get("evidence") else "")
                + (f"\nDelta: {_flt(relevant['delta'])}" if relevant.get("delta") else "")
            )
        return summary

    async def _full_context() -> str:
        pkg, header = await asyncio.gather(_get_pkg(), _get_header())
        lines = [
            f"Package: {pkg.get('projectName', 'Unknown')} (status: {pkg.get('status', 'Unknown')})",
        ]
        for k, label in [
            ("applicationNo", "App No"), ("currentPaymentDue", "Payment Due"),
            ("contractSumToDate", "Contract Sum"), ("totalRetainage", "Retainage"),
            ("balanceToFinish", "Balance"),
        ]:
            if header.get(k) is not None:
                lines.append(f"{label}: {_flt(header[k])}")
        return "\n".join(lines)

    try:
        aoai = AzureOpenAI(
            azure_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT", ""),
            api_key=os.environ.get("AZURE_OPENAI_API_KEY", ""),
            api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
        )

        # ── Step 1: intent classification ────────────────────────────────────
        intent_resp = aoai.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": _INTENT_PROMPT},
                {"role": "user", "content": message},
            ],
            temperature=0.0,
            max_completion_tokens=80,
            response_format={"type": "json_object"},
        )
        total_tokens += intent_resp.usage.total_tokens if intent_resp.usage else 0
        intent_data = _json.loads(intent_resp.choices[0].message.content or "{}")
        intent: str = intent_data.get("intent", "general_qa")
        entity: str = intent_data.get("entity", "")

        # ── Step 2: tool execution ────────────────────────────────────────────
        if intent == "lookup_field":
            header = await _get_header()
            context = _lookup_field_context(header, entity)
        elif intent == "explain_exception":
            exceptions = await _get_exceptions()
            context = _exceptions_context(exceptions, entity)
        elif intent == "ask_status":
            cached = _run_status.get(package_id, {})
            context = (
                f"Pipeline status: {cached.get('status', 'UNKNOWN')}. "
                f"Current node: {cached.get('current_node', 'unknown')}. "
                + (f"Cost so far: ${cached.get('total_cost_usd', 0):.4f}." if cached.get('total_cost_usd') else "")
            )
        elif intent == "re_extract":
            # Check which fields are missing and trigger re-extraction
            header = await _get_header()
            missing = [k for k, v in header.items() if v is None and k not in ("id", "packageId", "createdAt", "updatedAt", "changeOrderSummary")]
            if missing:
                # Emit re-extract action that frontend can pick up
                context = f"Missing fields detected: {', '.join(missing[:8])}. I will trigger a re-extraction of GC header fields."
                # Schedule background re-run
                asyncio.create_task(_re_extract_header(package_id))
                reply = (
                    f"I found **{len(missing)} missing fields**: {', '.join(missing[:5])}{'…' if len(missing) > 5 else ''}. "
                    f"I'm re-running the GC Cover extraction now with enhanced analysis. "
                    f"This takes about 15–20 seconds — I'll notify you when it's done."
                )
                cost_usd = 0.0
                return {"package_id": package_id, "reply": reply, "intent": intent, "entity": "re_extract", "cost_usd": cost_usd, "tokens": 0}
            else:
                context = "All fields appear to be extracted. No re-extraction needed."
        else:
            context = await _full_context()

        # ── Step 3: response generation ───────────────────────────────────────
        gen_resp = aoai.chat.completions.create(
            model=deployment,
            messages=[{
                "role": "user",
                "content": _RESPONSE_PROMPT.format(context=context, question=message),
            }],
            temperature=0.3,
            max_completion_tokens=300,
        )
        total_tokens += gen_resp.usage.total_tokens if gen_resp.usage else 0
        reply = (gen_resp.choices[0].message.content or "I could not generate a response.").strip()

        cost_usd = round((total_tokens / 1000) * 0.01, 4)  # ~$0.01 per 1K tokens estimate
        logger.info("[chat] package=%s intent=%s tokens=%d cost=$%.4f", package_id, intent, total_tokens, cost_usd)

        return {"package_id": package_id, "reply": reply, "intent": intent,
                "entity": entity, "cost_usd": cost_usd, "tokens": total_tokens}

    except Exception as exc:
        logger.exception("[chat] failed for package %s: %s", package_id, exc)
        return {"package_id": package_id,
                "reply": "Sorry, the agent encountered an error. Please try again.",
                "intent": "error", "cost_usd": 0.0, "tokens": 0}
