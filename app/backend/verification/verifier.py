from dataclasses import dataclass
from typing import Optional
from app.backend.models.entities import CheckerType
from app.backend.verification.subprocess_runner import run_sandboxed_checker
from app.backend.verification.exact_checker import check_exact_match


@dataclass
class VerificationResult:
    is_correct: bool
    is_verifiable: bool
    detail: str


def verify_answer(
    checker_type: CheckerType,
    candidate: str,
    answer_key: str,
    tolerance: float = 1e-3,
    use_sandbox: bool = True,
) -> VerificationResult:
    """
    Unified answer verification engine.
    Dispatches to sandboxed subprocesses for SymPy and Pint (units) to prevent code injection,
    and exact checker for text/options.
    """
    if checker_type == CheckerType.MANUAL:
        return VerificationResult(
            is_correct=False,
            is_verifiable=False,
            detail="Problem requires human/manual review",
        )

    if checker_type == CheckerType.EXACT:
        res = check_exact_match(candidate, answer_key, tolerance=tolerance)
        return VerificationResult(
            is_correct=res["is_correct"],
            is_verifiable=res["is_verifiable"],
            detail=res["detail"],
        )

    payload = {
        "candidate": candidate,
        "answer_key": answer_key,
        "tolerance": tolerance,
    }

    if checker_type == CheckerType.SYMPY:
        if use_sandbox:
            res = run_sandboxed_checker("app.backend.verification.sympy_checker", payload)
        else:
            from app.backend.verification.sympy_checker import check_sympy_equivalence
            res = check_sympy_equivalence(candidate, answer_key, tolerance)
        return VerificationResult(
            is_correct=res.get("is_correct", False),
            is_verifiable=res.get("is_verifiable", False),
            detail=res.get("detail", ""),
        )

    if checker_type == CheckerType.UNITS:
        if use_sandbox:
            res = run_sandboxed_checker("app.backend.verification.unit_checker", payload)
        else:
            from app.backend.verification.unit_checker import check_unit_equivalence
            res = check_unit_equivalence(candidate, answer_key, tolerance)
        return VerificationResult(
            is_correct=res.get("is_correct", False),
            is_verifiable=res.get("is_verifiable", False),
            detail=res.get("detail", ""),
        )

    return VerificationResult(
        is_correct=False,
        is_verifiable=False,
        detail=f"Unknown checker type: {checker_type}",
    )
