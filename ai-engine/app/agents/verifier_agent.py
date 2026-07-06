"""
Verifier Agent — checks extracted data for mathematical consistency and completeness.
Runs AFTER the extractor agent and creates exceptions for any issues found.
"""
from __future__ import annotations
import logging
from langgraph.prebuilt import create_react_agent
from app.agents import get_llm
from app.agents.tools import VERIFIER_TOOLS

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the **Data Verifier Agent** for a construction payment application review system.

Your mission: After the extractor agent has saved data, verify it is mathematically correct and complete.

## Your Strategy:
1. Call `get_gc_header(package_id)` to retrieve the extracted data
2. Call `detect_missing_fields(header)` to find any missing required fields
3. Call `verify_g702_math(...)` using the financial fields to check calculations
4. For any MATH_ERROR: call `create_reconciliation_exception` with type="MATH_ERROR"
5. For any MISSING_FIELD: call `create_reconciliation_exception` with type="MISSING_FIELD"  
6. For SUSPICIOUS_VALUE: call `create_reconciliation_exception` with type="SUSPICIOUS_VALUE"
7. Log your verification summary

## Mathematical Rules to Check:
- contract_sum_to_date = original_contract_sum + net_change_orders
- total_earned_less_ret = total_completed_stored - total_retainage
- current_payment_due = total_earned_less_ret - less_prev_certificates
- balance_to_finish = contract_sum_to_date - total_completed_stored

## Output:
Always end with a clear summary: "VERIFICATION COMPLETE: X issues found" or "VERIFICATION PASSED: All fields consistent"
"""


def build_verifier_agent():
    llm = get_llm()
    return create_react_agent(llm, tools=VERIFIER_TOOLS, prompt=SYSTEM_PROMPT)


def run_verifier_agent_sync(package_id: str) -> dict:
    """Run verification synchronously — no asyncio.run needed."""
    agent = build_verifier_agent()
    try:
        result = agent.invoke({
            "messages": [{
                "role": "user",
                "content": f'Verify the extracted G702 data for package_id="{package_id}". Check all financial calculations and report any issues. If a tool fails, try an alternative approach.',
            }]
        })
    except Exception as e:
        logger.error("[verifier_agent] invoke failed: %s", e)
        return {"package_id": package_id, "agent": "verifier", "summary": f"Failed: {e}"}

    messages = result.get("messages", [])
    summary = next(
        (m.content if hasattr(m, "content") else m.get("content", "")
         for m in reversed(messages)
         if (hasattr(m, "role") and m.role == "assistant") or
            (isinstance(m, dict) and m.get("role") == "assistant")),
        "Verification complete"
    )
    return {"package_id": package_id, "agent": "verifier", "summary": summary}
