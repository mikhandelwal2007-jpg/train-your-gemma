import re
from typing import Dict, Any


def check_exact_match(candidate_str: str, key_str: str, tolerance: float = 1e-4) -> Dict[str, Any]:
    """
    Checks exact or normalized textual and numerical equality.
    Handles stripped punctuation, options (e.g. '(B)' vs 'B'), and float tolerance.
    """
    c_clean = candidate_str.strip()
    k_clean = key_str.strip()

    # Exact string match
    if c_clean.lower() == k_clean.lower():
        return {"is_correct": True, "is_verifiable": True, "detail": "Exact string match"}

    # Strip wrapper parentheses or quotes, e.g. "(B)" -> "B"
    cand_unwrapped = re.sub(r"^[\(\[\{\"\']+|[\)\]\}\"\']+$", "", c_clean).strip()
    key_unwrapped = re.sub(r"^[\(\[\{\"\']+|[\)\]\}\"\']+$", "", k_clean).strip()

    if cand_unwrapped.lower() == key_unwrapped.lower():
        return {"is_correct": True, "is_verifiable": True, "detail": "Normalized option match"}

    # Try numeric conversion
    try:
        cand_num = float(cand_unwrapped)
        key_num = float(key_unwrapped)
        diff = abs(cand_num - key_num)
        denom = abs(key_num)
        if diff <= tolerance or (denom > 0 and (diff / denom) <= tolerance):
            return {"is_correct": True, "is_verifiable": True, "detail": f"Numeric match (diff={diff})"}
    except ValueError:
        pass

    return {
        "is_correct": False,
        "is_verifiable": True,
        "detail": f"Values do not match: '{candidate_str}' vs '{key_str}'"
    }
