"""G703 SOV Extractor Agent -- parallel vision for speed."""
from __future__ import annotations
import logging
from langgraph.prebuilt import create_react_agent
from app.agents import get_llm
from app.agents.tools import SOV_EXTRACTOR_TOOLS

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the G703 Continuation Sheet Extractor Agent.
Extract ALL SOV lines from pages 2-8 of the GC Pay Application PDF (fileType=GC_PAY_APP).
Do NOT touch SubContractors PDF.

Strategy:
1. Call list_package_documents(package_id) to confirm GC doc.
2. Call extract_all_sov_pages_parallel(package_id=..., start_page=2, end_page=8).
   All 7 pages run simultaneously. ~15 seconds.
   If lines >= 100: go to step 4.
3. If < 100 lines: try extract_table_with_document_intelligence as fallback.
4. Call save_gc_sov_lines(package_id=..., lines=<lines>). MANDATORY. Must call this.
5. Report: SAVED N lines.

Rules: monetary=plain floats, pct=decimal 0-1 not percent, confidence=0.85.
"""


def build_sov_agent():
    llm = get_llm()
    return create_react_agent(llm, tools=SOV_EXTRACTOR_TOOLS, prompt=SYSTEM_PROMPT)


async def run_sov_agent(package_id: str, documents: list[dict]) -> dict:
    return run_sov_agent_sync(package_id, documents)


def run_sov_agent_sync(package_id: str, documents: list[dict]) -> dict:
    """Run G703 SOV extraction agent synchronously using parallel vision."""
    agent = build_sov_agent()

    gc_doc = next((d for d in documents if d.get("fileType") in ("GC_PAY_APP", "GC_G702")), None)

    user_message = f"""Extract all G703 continuation sheet lines for package_id="{package_id}".

Use extract_all_sov_pages_parallel(package_id="{package_id}", start_page=2, end_page=8) as primary.
Then save with save_gc_sov_lines. You MUST call save_gc_sov_lines to complete the task."""

    try:
        result = agent.invoke({"messages": [{"role": "user", "content": user_message}]})
    except Exception as e:
        logger.error("[sov_agent] invoke failed: %s", e)
        return {"package_id": package_id, "agent": "sov_extractor", "summary": f"Failed: {e}"}

    messages = result.get("messages", [])
    summary = next(
        (str(m.content if hasattr(m, "content") else m.get("content", ""))
         for m in reversed(messages)
         if (hasattr(m, "role") and m.role == "assistant") or
            (isinstance(m, dict) and m.get("role") == "assistant")),
        "G703 extraction complete"
    )
    return {"package_id": package_id, "agent": "sov_extractor", "summary": summary}
