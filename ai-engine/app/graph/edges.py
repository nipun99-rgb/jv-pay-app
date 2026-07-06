"""Conditional edge routing functions for the PayApp graph."""

from __future__ import annotations

from app.graph.state import PayAppState
from app.config import settings


def route_after_classify(state: PayAppState) -> str:
    """
    Always route through human_classify_gate so the user can review and confirm
    every document classification before extraction begins.
    High-confidence docs show a green badge; low-confidence ones are highlighted.
    """
    return "human_classify_gate"


def route_after_verify(state: PayAppState) -> str:
    """
    Route after verify_node.
    Any field <0.50 AND remaining budget → retry.
    Otherwise → reconcile.
    """
    field_scores = state.get("field_scores", [])
    total_cost = state.get("total_cost_usd", 0.0)
    retry_count = state.get("retry_count", 0)

    has_low_confidence = any(s.get("confidence", 1.0) < 0.50 for s in field_scores)
    budget_available = total_cost < settings.max_cost_per_package_usd
    max_retries_reached = retry_count >= 2

    if has_low_confidence and budget_available and not max_retries_reached:
        return "retry"
    return "reconcile"
