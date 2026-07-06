"""
PayAppState — the shared state object that flows through the LangGraph.

All fields are Optional or have defaults so nodes can mutate only what they own.
"""

from __future__ import annotations

from typing import Any, Optional
from typing_extensions import TypedDict


class DocumentInfo(TypedDict, total=False):
    blob_url: str
    filename: str
    page_count: int
    classification: str
    confidence: float


class PageImage(TypedDict, total=False):
    page_num: int
    image_url: str
    doc_index: int


class ClassificationResult(TypedDict, total=False):
    doc_index: int
    file_type: str          # GC_G702 | GC_G703 | SUB_G702 | SUB_G703 | OTHER
    confidence: float
    method: str             # heuristic | llm | vision
    reasoning: str


class ExtractionPlanEntry(TypedDict, total=False):
    contractor_name: str
    line_count: int
    page_range_est: list[int]


class FieldScore(TypedDict, total=False):
    field_id: str
    table: str
    row_id: str
    confidence: float
    status: str             # AUTO_APPROVED | SPOT_CHECK | ESCALATED


class ReconExceptionEntry(TypedDict, total=False):
    type: str
    severity: str
    sub_name: str
    delta: float
    evidence: str
    status: str             # OPEN | ACCEPTED | DISMISSED | OVERRIDDEN


class PayAppState(TypedDict, total=False):
    # Identifiers
    package_id: str
    run_id: str

    # Input documents
    documents: list[DocumentInfo]

    # Page images (after ingest)
    page_images: list[PageImage]

    # Classification results
    classifications: list[ClassificationResult]

    # GC header (19 fields + per-field confidence)
    gc_header: dict[str, Any]

    # GC SOV lines (list of 15-field dicts)
    gc_sov_lines: list[dict[str, Any]]

    # Extraction plan
    extraction_plan: list[ExtractionPlanEntry]

    # Sub application data
    sub_headers: list[dict[str, Any]]
    sub_sov_lines: list[dict[str, Any]]

    # Field verification scores
    field_scores: list[FieldScore]

    # Reconciliation exceptions
    exceptions: list[ReconExceptionEntry]

    # Cost tracking
    total_tokens: int
    total_cost_usd: float

    # Graph control
    current_node: str
    status: str
    retry_count: int
    error_message: Optional[str]
