"""
LangGraph StateGraph builder.

Sprint 1: All nodes are stubs that pass state through unchanged.
Sprint 3: Checkpointer support added; ingest_node implemented.
Full node implementations added in Sprints 3–13.
"""

from __future__ import annotations
from typing import Any

from langgraph.graph import StateGraph, END

from app.graph.state import PayAppState
from app.nodes import (
    ingest_node,
    classify_node,
    human_classify_gate,
    extract_gc_header_node,
    extract_gc_sov_node,
    generate_plan_node,
    human_plan_gate,
    extract_subs_node,
    verify_node,
    retry_node,
    reconcile_node,
    human_review_gate,
    complete_node,
)
from app.graph.edges import (
    route_after_classify,
    route_after_verify,
)


def build_graph(checkpointer: Any = None):
    """Construct and compile the full PayApp StateGraph.
    
    Args:
        checkpointer: Optional LangGraph checkpointer (PostgresSaver for persistence).
    """
    builder: StateGraph = StateGraph(PayAppState)

    # ── Add nodes ─────────────────────────────────────────────────────────────
    builder.add_node("ingest", ingest_node)
    builder.add_node("classify", classify_node)
    builder.add_node("human_classify_gate", human_classify_gate)
    builder.add_node("extract_gc_header", extract_gc_header_node)
    builder.add_node("extract_gc_sov", extract_gc_sov_node)
    builder.add_node("generate_plan", generate_plan_node)
    builder.add_node("human_plan_gate", human_plan_gate)
    builder.add_node("extract_subs", extract_subs_node)
    builder.add_node("verify", verify_node)
    builder.add_node("retry", retry_node)
    builder.add_node("reconcile", reconcile_node)
    builder.add_node("human_review_gate", human_review_gate)
    builder.add_node("complete", complete_node)

    # ── Entry point ───────────────────────────────────────────────────────────
    builder.set_entry_point("ingest")

    # ── Static edges ──────────────────────────────────────────────────────────
    builder.add_edge("ingest", "classify")
    builder.add_edge("human_classify_gate", "extract_gc_header")
    builder.add_edge("extract_gc_header", "extract_gc_sov")
    builder.add_edge("extract_gc_sov", "generate_plan")
    builder.add_edge("generate_plan", "human_plan_gate")
    builder.add_edge("human_plan_gate", "extract_subs")
    builder.add_edge("extract_subs", "verify")
    builder.add_edge("retry", "verify")
    builder.add_edge("reconcile", "human_review_gate")
    builder.add_edge("human_review_gate", "complete")
    builder.add_edge("complete", END)

    # ── Conditional edges ─────────────────────────────────────────────────────
    # After classify: ≥0.90 → extract_gc_header, <0.90 → human_classify_gate
    builder.add_conditional_edges("classify", route_after_classify, {
        "extract_gc_header": "extract_gc_header",
        "human_classify_gate": "human_classify_gate",
    })

    # After verify: low confidence + budget available → retry, else → reconcile
    builder.add_conditional_edges("verify", route_after_verify, {
        "retry": "retry",
        "reconcile": "reconcile",
    })

    return builder.compile(checkpointer=checkpointer)
