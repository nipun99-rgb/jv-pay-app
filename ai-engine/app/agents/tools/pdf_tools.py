"""
PDF & Blob Storage tools — used by agents to read documents without hardcoding paths.
"""
from __future__ import annotations
import base64
import io
import logging
import os
from typing import Annotated

import httpx
from langchain_core.tools import tool

from app.agents import get_blob_service, CONTAINER

logger = logging.getLogger(__name__)


@tool
def get_pdf_page_count(package_id: str) -> int:
    """Return the number of pages in the primary PDF document for a package."""
    svc = get_blob_service()
    container = svc.get_container_client(CONTAINER)
    prefix = f"page-images/{package_id}/"
    count = sum(1 for _ in container.list_blobs(name_starts_with=prefix))
    return max(count, 1)


@tool
def read_pdf_page_as_image(package_id: str, page_number: int) -> str:
    """
    Download a specific PDF page image and return it as a base64-encoded JPEG string.
    Page numbers are 1-based. Use this to visually inspect document content.
    """
    svc = get_blob_service()
    # Find the page image blob
    container = svc.get_container_client(CONTAINER)
    prefix = f"page-images/{package_id}/"
    blobs = sorted(
        [b.name for b in container.list_blobs(name_starts_with=prefix)],
        key=lambda n: n
    )
    if not blobs:
        raise ValueError(f"No page images found for package {package_id}")
    idx = min(page_number - 1, len(blobs) - 1)
    blob_data = svc.get_blob_client(container=CONTAINER, blob=blobs[idx]).download_blob().readall()
    return base64.b64encode(blob_data).decode()


@tool
def download_pdf_bytes(blob_url: str) -> str:
    """
    Download the raw PDF from blob storage by its URL and return as base64.
    Use read_pdf_page_as_image instead for visual inspection.
    """
    from urllib.parse import urlparse
    parsed = urlparse(blob_url)
    parts = parsed.path.lstrip('/').split('/', 1)
    container_name = parts[0]
    blob_path = parts[1] if len(parts) > 1 else ''
    svc = get_blob_service()
    data = svc.get_blob_client(container=container_name, blob=blob_path).download_blob().readall()
    return base64.b64encode(data).decode()


@tool
def list_package_documents(package_id: str) -> list[dict]:
    """
    List all documents associated with a package from the API gateway.
    Returns filename, fileType (GC_PAY_APP / SUB_PAY_APP / SUPPORTING), and blobUrl.
    """
    try:
        resp = httpx.get(
            f"{os.environ.get('API_GATEWAY_URL', 'http://localhost:3001')}/api/packages/{package_id}",
            timeout=10,
        )
        pkg = resp.json()
        return [
            {"filename": d.get("filename"), "fileType": d.get("fileType"), "blobUrl": d.get("blobUrl")}
            for d in pkg.get("documents", [])
        ]
    except Exception as e:
        logger.error("list_package_documents failed: %s", e)
        return []
