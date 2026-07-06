"""
Database tools — agents use these to persist and retrieve data.
No direct DB access in agents — all goes through the API gateway.
"""
from __future__ import annotations
import logging
import os
import httpx
from langchain_core.tools import tool

logger = logging.getLogger(__name__)
_GW = lambda: os.environ.get("API_GATEWAY_URL", "http://localhost:3001")


@tool
def save_gc_header(package_id: str, fields: dict) -> dict:
    """
    Save extracted GC Header fields to the database via the API gateway.
    Fields should use snake_case keys matching the G702 schema.
    Returns {'success': bool, 'message': str}.
    """
    filled = sum(1 for v in fields.values() if v is not None and v != "")
    try:
        httpx.post(f"{_GW()}/api/packages/{package_id}/activity",
            json={"message": f"[GC Cover Extractor → Database]: Saving G702 header — {filled} fields extracted",
                  "node": "extract_gc_header", "eventType": "info"}, timeout=3)
    except Exception:
        pass
    try:
        resp = httpx.post(
            f"{_GW()}/api/packages/{package_id}/gc-header",
            json={**fields, "package_id": package_id},
            timeout=15,
        )
        success = resp.status_code < 300
        try:
            httpx.post(f"{_GW()}/api/packages/{package_id}/activity",
                json={"message": f"[Database → GC Cover Extractor]: {'✅ G702 header saved successfully' if success else '⚠️ Save failed: ' + str(resp.status_code)}",
                      "node": "extract_gc_header", "eventType": "success" if success else "error"}, timeout=3)
        except Exception:
            pass
        return {"success": success, "message": f"HTTP {resp.status_code}"}
    except Exception as e:
        logger.error("save_gc_header error: %s", e)
        return {"success": False, "message": str(e)}


@tool
def save_gc_sov_lines(package_id: str, lines: list[dict]) -> dict:
    """
    Save extracted G703 Schedule of Values lines to the database.
    Returns {'success': bool, 'count': int, 'message': str}.
    """
    try:
        httpx.post(f"{_GW()}/api/packages/{package_id}/activity",
            json={"message": f"[SOV Parser → Database]: Saving {len(lines)} G703 continuation sheet lines...",
                  "node": "extract_gc_sov", "eventType": "info"}, timeout=3)
    except Exception:
        pass
    try:
        resp = httpx.post(
            f"{_GW()}/api/packages/{package_id}/gc-sov",
            json=lines,  # API expects array directly, not wrapped in {"lines": [...]}
            timeout=30,
        )
        success = resp.status_code < 300
        try:
            httpx.post(f"{_GW()}/api/packages/{package_id}/activity",
                json={"message": f"[Database → SOV Parser]: {'✅ Saved ' + str(len(lines)) + ' SOV lines' if success else '⚠️ Save failed'}",
                      "node": "extract_gc_sov", "eventType": "success" if success else "error"}, timeout=3)
        except Exception:
            pass
        return {"success": success, "count": len(lines), "message": f"Saved {len(lines)} SOV lines (HTTP {resp.status_code})"}
    except Exception as e:
        logger.error("save_gc_sov_lines error: %s", e)
        return {"success": False, "count": 0, "message": str(e)}


@tool
def get_gc_header(package_id: str) -> dict:
    """
    Retrieve the current GC header for a package from the database.
    Returns the header dict or an empty dict if not found.
    """
    try:
        resp = httpx.get(f"{_GW()}/api/packages/{package_id}/gc-header", timeout=10)
        if resp.status_code == 200:
            return resp.json()
        return {}
    except Exception as e:
        logger.error("get_gc_header error: %s", e)
        return {}


@tool
def log_agent_activity(package_id: str, message: str, node: str, event_type: str = "info") -> None:
    """
    Log an agent activity message to the pipeline activity log.
    Appears in the frontend Activity Log and Pipeline Agents tab.

    For agent-to-agent conversations, format message as:
      "[AgentName → Recipient]: message"
    e.g. "[GC Cover Extractor → Vision Tool]: Reading page 1 with high detail..."
    e.g. "[Vision Tool → GC Cover Extractor]: Extracted 17/18 fields, confidence=0.95"

    event_type: 'info' | 'success' | 'warn' | 'error'
    """
    try:
        httpx.post(
            f"{_GW()}/api/packages/{package_id}/activity",
            json={"message": message, "node": node, "eventType": event_type},
            timeout=5,
        )
    except Exception as e:
        logger.warning("log_agent_activity failed: %s", e)


@tool
def create_reconciliation_exception(
    package_id: str,
    exception_type: str,
    field_name: str,
    expected_value: str,
    actual_value: str,
    severity: str = "MEDIUM",
    message: str = "",
) -> dict:
    """
    Create a reconciliation exception when the verifier detects an issue.
    exception_type: 'MATH_ERROR' | 'MISSING_FIELD' | 'SUSPICIOUS_VALUE' | 'RETAINAGE_DEVIATION'
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
    """
    try:
        payload = {
            "packageId": package_id,
            "type": exception_type,
            "fieldName": field_name,
            "expectedValue": str(expected_value),
            "actualValue": str(actual_value),
            "severity": severity,
            "message": message or f"{exception_type}: {field_name}",
            "status": "OPEN",
        }
        resp = httpx.post(
            f"{_GW()}/api/packages/{package_id}/exceptions",
            json={"exceptions": [payload]},
            timeout=10,
        )
        return {"success": resp.status_code < 300, "exception_type": exception_type}
    except Exception as e:
        logger.error("create_reconciliation_exception error: %s", e)
        return {"success": False, "error": str(e)}
