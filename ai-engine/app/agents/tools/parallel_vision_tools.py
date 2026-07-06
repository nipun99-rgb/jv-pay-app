"""
Fast parallel G703 SOV extraction using concurrent vision calls.
All 7 G703 pages are processed simultaneously via ThreadPoolExecutor.
Expected time: ~15-20 seconds (vs 105 seconds sequential).
"""
from __future__ import annotations
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from langchain_core.tools import tool
from app.agents.tools.vision_tools import extract_sov_table_from_page

logger = logging.getLogger(__name__)


@tool
def extract_all_sov_pages_parallel(
    package_id: str,
    start_page: int = 2,
    end_page: int = 8,
) -> dict:
    """
    Extract G703 Continuation Sheet from ALL pages in PARALLEL using vision AI.
    Processes all pages simultaneously — 7× faster than sequential extraction.

    Args:
        package_id: UUID of the GC Pay Application package
        start_page: First G703 page (default 2)
        end_page: Last G703 page (default 8)

    Returns:
        {
          "lines": [ all SOV line items ],
          "pages_processed": int,
          "pages_failed": list of failed page numbers,
          "method": "parallel_vision"
        }
    """
    import httpx as _httpx
    _gw = os.environ.get("API_GATEWAY_URL", "http://localhost:3001")

    try:
        _httpx.post(f"{_gw}/api/packages/{package_id}/activity",
            json={"message": f"[SOV Parser → Vision (Parallel)]: Starting parallel extraction for pages {start_page}-{end_page} simultaneously...",
                  "node": "extract_gc_sov", "eventType": "info"}, timeout=3)
    except Exception:
        pass

    pages = list(range(start_page, end_page + 1))
    results: dict[int, list[dict]] = {}
    failed: list[int] = []

    def extract_page(page_num: int) -> tuple[int, list[dict]]:
        """Extract a single page — called concurrently."""
        try:
            rows = extract_sov_table_from_page.invoke({
                "package_id": package_id,
                "page_number": page_num,
            })
            logger.info("[parallel_vision] Page %d: %d rows", page_num, len(rows))
            return page_num, rows
        except Exception as e:
            logger.error("[parallel_vision] Page %d failed: %s", page_num, e)
            return page_num, []

    # Run all pages in parallel — max_workers matches page count for true concurrency
    with ThreadPoolExecutor(max_workers=len(pages)) as executor:
        futures = {executor.submit(extract_page, pg): pg for pg in pages}
        for future in as_completed(futures):
            page_num, rows = future.result()
            if rows:
                results[page_num] = rows
            else:
                failed.append(page_num)

    # Merge in page order
    all_lines = []
    for pg in sorted(results.keys()):
        all_lines.extend(results[pg])

    total = len(all_lines)
    logger.info("[parallel_vision] Total: %d lines from %d pages (%d failed)", total, len(results), len(failed))

    try:
        _httpx.post(f"{_gw}/api/packages/{package_id}/activity",
            json={"message": f"[Vision (Parallel) → SOV Parser]: {'✅ ' + str(total) + ' lines from ' + str(len(results)) + ' pages' if total > 0 else '⚠️ No lines extracted'}",
                  "node": "extract_gc_sov", "eventType": "success" if total > 0 else "warn"}, timeout=3)
    except Exception:
        pass

    return {
        "lines": all_lines,
        "pages_processed": len(results),
        "pages_failed": sorted(failed),
        "method": "parallel_vision",
    }
