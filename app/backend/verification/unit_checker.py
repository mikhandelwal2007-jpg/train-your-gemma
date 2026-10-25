import re
import sys
import json
from typing import Dict, Any, Tuple
import pint

# Initialize Pint Unit Registry
ureg = pint.UnitRegistry()

# Define common synonyms that LLMs or human users frequently use
SYNONYMS = [
    (r"\bkph\b", "km/hour"),
    (r"\bk/h\b", "km/hour"),
    (r"\bkmph\b", "km/hour"),
    (r"\bmps\b", "m/s"),
    (r"\bmph\b", "mile/hour"),
    (r"\bhrs\b", "hour"),
    (r"\bhr\b", "hour"),
    (r"\bmins\b", "minute"),
    (r"\bsec\b", "second"),
    (r"\bsecs\b", "second"),
]


def normalize_unit_string(text: str) -> str:
    """Normalize common unit representations and synonyms."""
    s = text.strip()
    # Remove leading '=' if present
    if "=" in s:
        s = s.split("=")[-1].strip()

    for pattern, replacement in SYNONYMS:
        s = re.sub(pattern, replacement, s, flags=re.IGNORECASE)
    return s


def parse_quantity(text: str) -> Tuple[bool, Any, str]:
    """Attempts to parse a physical quantity with units using Pint."""
    clean = normalize_unit_string(text)
    try:
        qty = ureg(clean)
        # Verify it has parsed into a Quantity or dimensionless number
        return True, qty, ""
    except Exception as exc:
        return False, None, str(exc)


def check_unit_equivalence(candidate_str: str, key_str: str, tolerance: float = 1e-3) -> Dict[str, Any]:
    """
    Checks if candidate physical quantity matches the ground truth answer key.
    Enforces unit dimensionality compatibility (e.g. length vs length), unit conversion (e.g. 1 km == 1000 m),
    and numeric closeness within tolerance.
    """
    ok_cand, q_cand, err_cand = parse_quantity(candidate_str)
    if not ok_cand:
        return {
            "is_correct": False,
            "is_verifiable": False,
            "detail": f"Could not parse candidate quantity: {err_cand}"
        }

    ok_key, q_key, err_key = parse_quantity(key_str)
    if not ok_key:
        return {
            "is_correct": False,
            "is_verifiable": False,
            "detail": f"Could not parse answer key quantity: {err_key}"
        }

    # If both are dimensionless scalars
    if not hasattr(q_cand, "units") and not hasattr(q_key, "units"):
        try:
            diff = abs(float(q_cand) - float(q_key))
            key_val = abs(float(q_key))
            is_close = diff <= tolerance or (key_val > 0 and (diff / key_val) <= tolerance)
            return {
                "is_correct": is_close,
                "is_verifiable": True,
                "detail": f"Dimensionless comparison diff={diff}"
            }
        except Exception as e:
            return {"is_correct": False, "is_verifiable": False, "detail": str(e)}

    # Dimensionality check
    try:
        if q_cand.dimensionality != q_key.dimensionality:
            return {
                "is_correct": False,
                "is_verifiable": True,
                "detail": f"Incompatible units: {q_cand.dimensionality} vs {q_key.dimensionality}"
            }

        # Convert candidate into key's units
        converted_cand = q_cand.to(q_key.units)
        diff = abs(converted_cand.magnitude - q_key.magnitude)
        key_mag = abs(q_key.magnitude)

        is_close = diff <= tolerance or (key_mag > 0 and (diff / key_mag) <= tolerance)
        return {
            "is_correct": is_close,
            "is_verifiable": True,
            "detail": f"Converted: {converted_cand} vs {q_key} (diff={diff})"
        }
    except Exception as exc:
        return {
            "is_correct": False,
            "is_verifiable": False,
            "detail": f"Unit conversion failed: {str(exc)}"
        }


if __name__ == "__main__":
    try:
        raw_input = sys.stdin.read()
        payload = json.loads(raw_input)
        cand = payload.get("candidate", "")
        key = payload.get("answer_key", "")
        tol = payload.get("tolerance", 1e-3)
        res = check_unit_equivalence(cand, key, tol)
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({"is_correct": False, "is_verifiable": False, "detail": str(e)}))
