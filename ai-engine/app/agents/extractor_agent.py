"""
GC Header & SOV Extractor Agent.
Uses create_react_agent so it can reason about which pages to read,
which fields are missing, and retry extraction with different strategies.
"""
from __future__ import annotations
import logging
from langgraph.prebuilt import create_react_agent
from app.agents import get_llm
from app.agents.tools import EXTRACTOR_TOOLS

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the **GC G702 Cover Page Extractor Agent**.
Your ONLY job: extract the 18 fields from the G702 Application for Payment cover sheet (page 1).

## The 18 G702 Fields (use EXACTLY these key names):
1. from_contractor       - JV/contractor submitting (e.g. "BE&K | HITT")
2. project_name          - Project name (e.g. "Boeing/25/BSC Site Expansion")
3. application_no        - Application number string (e.g. "12")
4. period_to             - Payment application period end date (e.g. "2/28/26")
5. original_contract_sum - Original contract value (plain float, e.g. 915480436.0)
6. net_change_orders     - Net change orders to date (float, can be negative)
7. contract_sum_to_date  - original + net_change_orders (float)
8. total_completed_stored - Total completed & stored to date (float)
9. retainage_completed   - Retainage on completed work (float)
10. retainage_materials  - Retainage on stored materials (float)
11. total_retainage      - Total retainage = retainage_completed + retainage_materials (float)
12. total_earned_less_ret - Total earned less retainage (float)
13. less_prev_certificates - Less previous certificates for payment (float)
14. current_payment_due  - CURRENT PAYMENT DUE (float) — this is the most important field
15. balance_to_finish    - Balance to finish including retainage (float)
16. change_order_summary - Summary text of change orders (string)
17. to_owner             - Owner name/address (string)
18. period               - Full period description (string)

## Rules:
- All monetary values MUST be plain floats WITHOUT commas or $ (e.g. 45576547.0 NOT "$45,576,547")
- application_no MUST be a string (e.g. "12" not 12)
- Use null for fields you cannot find
- Set extraction_confidence as float 0-1

## Strategy:
1. Call `log_agent_activity(package_id, "📋 GC Cover Extractor starting — reading page 1 with vision", "extract_gc_header", "info")`
2. Call `extract_fields_from_page(package_id=..., page_number=1, fields_to_extract=[list all 18 keys above])`
3. Parse the result — if current_payment_due or original_contract_sum is missing, try page 1 again with different prompt
4. Call `save_gc_header(package_id, {all fields + extraction_confidence + source_page=1})`
5. Call `log_agent_activity(package_id, "✅ G702 cover extracted: {N}/18 fields, confidence={X}", "extract_gc_header", "success")`
6. Report your summary
"""


def build_extractor_agent():
    """Build the GC extractor ReAct agent."""
    llm = get_llm()
    return create_react_agent(
        llm,
        tools=EXTRACTOR_TOOLS,
        prompt=SYSTEM_PROMPT,
    )


async def run_extractor_agent(package_id: str, document_urls: list[str]) -> dict:
    """Run the extractor agent (async wrapper for compatibility)."""
    return run_extractor_agent_sync(package_id, document_urls)


def run_extractor_agent_sync(package_id: str, document_urls: list[str]) -> dict:
    """
    Run the GC G702 cover page extractor agent synchronously.
    Uses .invoke() to avoid asyncio event loop conflicts in threads.
    """
    agent = build_extractor_agent()

    user_message = f"""Extract all 18 G702 cover page fields for package_id="{package_id}".
Read page 1 with vision and extract every field. The most critical fields are:
current_payment_due, original_contract_sum, contract_sum_to_date.
All monetary values must be plain floats (no commas, no $ signs).
Log your progress and save the results."""

    try:
        result = agent.invoke({"messages": [{"role": "user", "content": user_message}]})
    except Exception as e:
        logger.error("[extractor_agent] invoke failed: %s", e)
        return {"package_id": package_id, "agent": "extractor", "summary": f"Failed: {e}"}

    messages = result.get("messages", [])
    summary = ""
    for msg in reversed(messages):
        content = msg.content if hasattr(msg, "content") else msg.get("content", "")
        if content and len(str(content)) > 10:
            summary = str(content)
            break

    return {
        "package_id": package_id,
        "agent": "extractor",
        "summary": summary,
        "message_count": len(messages),
    }
