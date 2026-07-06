"""Tools package — exports all tools grouped by category."""
from app.agents.tools.pdf_tools import (
    get_pdf_page_count,
    read_pdf_page_as_image,
    download_pdf_bytes,
    list_package_documents,
)
from app.agents.tools.vision_tools import (
    extract_fields_from_page,
    classify_document_from_page,
    extract_sov_table_from_page,
)
from app.agents.tools.financial_tools import (
    verify_g702_math,
    verify_sov_totals,
    detect_missing_fields,
)
from app.agents.tools.db_tools import (
    save_gc_header,
    save_gc_sov_lines,
    get_gc_header,
    log_agent_activity,
    create_reconciliation_exception,
)
from app.agents.tools.pdfplumber_tools import (
    extract_all_sov_pages_with_pdfplumber,
)
from app.agents.tools.doc_intelligence_tools import (
    extract_table_with_document_intelligence,
)
from app.agents.tools.parallel_vision_tools import (
    extract_all_sov_pages_parallel,
)
from app.agents.tools.coordinate_tools import (
    extract_g703_with_coordinates,
)

# Grouped tool sets bound to each agent
CLASSIFIER_TOOLS = [
    list_package_documents,
    read_pdf_page_as_image,
    classify_document_from_page,
    log_agent_activity,
]

EXTRACTOR_TOOLS = [
    get_pdf_page_count,
    read_pdf_page_as_image,
    extract_fields_from_page,
    extract_sov_table_from_page,
    extract_all_sov_pages_with_pdfplumber,
    save_gc_header,
    save_gc_sov_lines,
    get_gc_header,
    detect_missing_fields,
    log_agent_activity,
]

SOV_EXTRACTOR_TOOLS = [
    list_package_documents,
    extract_g703_with_coordinates,         # PRIMARY: fast coordinate-based (~14s)
    extract_all_sov_pages_parallel,       # FALLBACK: parallel vision (~55s)
    extract_all_sov_pages_with_pdfplumber, # FALLBACK: fast for digital PDFs
    extract_table_with_document_intelligence, # FALLBACK: Azure DI if configured
    extract_sov_table_from_page,           # LAST RESORT: single page vision
    get_pdf_page_count,
    save_gc_sov_lines,
    log_agent_activity,
]

VERIFIER_TOOLS = [
    get_gc_header,
    detect_missing_fields,
    verify_g702_math,
    verify_sov_totals,
    create_reconciliation_exception,
    log_agent_activity,
]

ALL_TOOLS = list({t.name: t for t in (
    CLASSIFIER_TOOLS + EXTRACTOR_TOOLS + VERIFIER_TOOLS
)}.values())
