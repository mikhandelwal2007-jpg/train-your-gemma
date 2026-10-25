import pytest
from app.backend.models.entities import CheckerType
from app.backend.verification import verify_answer
from app.backend.verification.sympy_checker import check_sympy_equivalence
from app.backend.verification.unit_checker import check_unit_equivalence
from app.backend.verification.exact_checker import check_exact_match


def test_sympy_algebraic_equivalence():
    res = check_sympy_equivalence("(x + 2)**2", "x**2 + 4*x + 4")
    assert res["is_correct"] is True
    assert res["is_verifiable"] is True


def test_sympy_powers_and_fractions():
    res = check_sympy_equivalence("(1/2) * m * v**2", "0.5 * m * v^2")
    assert res["is_correct"] is True
    assert res["is_verifiable"] is True


def test_sympy_incorrect_expression():
    res = check_sympy_equivalence("x**2 + 1", "x**2 - 1")
    assert res["is_correct"] is False
    assert res["is_verifiable"] is True


def test_sympy_security_injection_blocked():
    # Attempting to call system or import must fail verification
    res = verify_answer(CheckerType.SYMPY, "__import__('os').system('echo pwned')", "1")
    assert res.is_correct is False
    assert res.is_verifiable is False

    # Attempting attribute access like [].__class__ must fail
    res2 = verify_answer(CheckerType.SYMPY, "().__class__.__base__", "1")
    assert res2.is_correct is False
    assert res2.is_verifiable is False


def test_unit_conversion_and_synonyms():
    # km/h vs kph vs m/s
    res = check_unit_equivalence("72 km/h", "20 m/s")
    assert res["is_correct"] is True
    assert res["is_verifiable"] is True

    res2 = check_unit_equivalence("72 kph", "20 m/s")
    assert res2["is_correct"] is True

    # Centimeters to meters
    res3 = check_unit_equivalence("250 cm", "2.5 m")
    assert res3["is_correct"] is True


def test_unit_incompatible_dimensions():
    # Force (N) vs Energy (J)
    res = check_unit_equivalence("10 N", "10 J")
    assert res["is_correct"] is False
    assert res["is_verifiable"] is True
    assert "Incompatible" in res["detail"]


def test_exact_checker_normalization():
    # Option unwrapping
    assert check_exact_match("(B)", "B")["is_correct"] is True
    assert check_exact_match("Potential", "potential")["is_correct"] is True

    # Numeric tolerance
    assert check_exact_match("10.0001", "10.0")["is_correct"] is True
    assert check_exact_match("15.5", "10.0")["is_correct"] is False
