"""
Financial verification tools — pure math checks, no AI needed.
The verifier agent uses these to check extracted values for consistency.
"""
from __future__ import annotations
import logging
from langchain_core.tools import tool

logger = logging.getLogger(__name__)


@tool
def verify_g702_math(
    original_contract_sum: float,
    net_change_orders: float,
    contract_sum_to_date: float,
    total_completed_stored: float,
    total_retainage: float,
    total_earned_less_ret: float,
    less_prev_certificates: float,
    current_payment_due: float,
    balance_to_finish: float,
) -> dict:
    """
    Verify that G702 financial fields are mathematically consistent.
    Returns a dict with 'passed' (bool), 'errors' (list of issues), and 'warnings'.
    
    Rules:
    - contract_sum_to_date = original_contract_sum + net_change_orders
    - total_earned_less_ret = total_completed_stored - total_retainage
    - current_payment_due = total_earned_less_ret - less_prev_certificates
    - balance_to_finish = contract_sum_to_date - total_completed_stored
    """
    errors = []
    warnings = []
    TOLERANCE = 5.0  # allow $5 rounding error

    def check(label: str, expected: float, actual: float) -> None:
        diff = abs(expected - actual)
        if diff > TOLERANCE:
            errors.append(f"{label}: expected {expected:,.2f}, got {actual:,.2f} (diff {diff:,.2f})")
        elif diff > 0.01:
            warnings.append(f"{label}: minor rounding difference {diff:.2f}")

    check("Contract Sum to Date", original_contract_sum + net_change_orders, contract_sum_to_date)
    check("Total Earned Less Retainage", total_completed_stored - total_retainage, total_earned_less_ret)
    check("Current Payment Due", total_earned_less_ret - less_prev_certificates, current_payment_due)
    check("Balance to Finish", contract_sum_to_date - total_completed_stored, balance_to_finish)

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "summary": f"{'PASS' if not errors else 'FAIL'}: {len(errors)} errors, {len(warnings)} warnings",
    }


@tool
def verify_sov_totals(sov_lines: list[dict], gc_header_total: float) -> dict:
    """
    Verify that SOV line item totals match the GC header's totalCompletedStored value.
    
    Args:
        sov_lines: List of SOV line dicts with 'total_completed' field
        gc_header_total: The totalCompletedStored value from the GC header
    
    Returns: {'passed': bool, 'sov_sum': float, 'header_total': float, 'diff': float}
    """
    sov_sum = 0.0
    for line in sov_lines:
        val = line.get("total_completed") or line.get("totalCompleted")
        if val:
            try:
                sov_sum += float(val)
            except (TypeError, ValueError):
                pass

    diff = abs(sov_sum - gc_header_total)
    TOLERANCE = 100.0  # Allow $100 rounding
    return {
        "passed": diff <= TOLERANCE,
        "sov_sum": round(sov_sum, 2),
        "header_total": round(gc_header_total, 2),
        "diff": round(diff, 2),
        "message": f"SOV sum ${sov_sum:,.2f} vs header ${gc_header_total:,.2f} — {'MATCH' if diff <= TOLERANCE else f'MISMATCH by ${diff:,.2f}'}",
    }


@tool  
def detect_missing_fields(header: dict) -> dict:
    """
    Detect which G702 fields are missing or have suspiciously low values.
    Returns {'missing': [...], 'suspicious': [...], 'score': 0-1}
    """
    required = [
        "from_contractor", "project_name", "application_no",
        "original_contract_sum", "contract_sum_to_date",
        "total_completed_stored", "total_retainage",
        "total_earned_less_ret", "less_prev_certificates",
        "current_payment_due", "balance_to_finish",
    ]
    # Accept either snake_case or camelCase keys
    def get_val(d: dict, snake: str) -> object:
        camel = ''.join(w.capitalize() if i else w for i, w in enumerate(snake.split('_')))
        return d.get(snake) or d.get(camel)

    missing = [f for f in required if not get_val(header, f)]
    suspicious = []

    # Check for suspiciously small monetary values (likely extraction errors)
    monetary = [
        "original_contract_sum", "contract_sum_to_date",
        "total_completed_stored", "current_payment_due",
    ]
    for field in monetary:
        val = get_val(header, field)
        if val:
            try:
                n = float(val)
                if 0 < n < 100:  # Contract sum of $50 is suspicious
                    suspicious.append(f"{field}={val} (unusually small)")
            except (TypeError, ValueError):
                pass

    total = len(required)
    score = (total - len(missing)) / total
    return {
        "missing": missing,
        "suspicious": suspicious,
        "completeness_score": round(score, 2),
        "summary": f"{total - len(missing)}/{total} fields extracted, {len(suspicious)} suspicious values",
    }
