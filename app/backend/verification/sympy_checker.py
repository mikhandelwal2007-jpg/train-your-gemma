import ast
import json
import math
import sys
from typing import Dict, Any, Union
import sympy as sp


ALLOWED_MATH_NAMES = {
    # Math functions
    "sqrt": sp.sqrt,
    "sin": sp.sin,
    "cos": sp.cos,
    "tan": sp.tan,
    "exp": sp.exp,
    "log": sp.log,
    "abs": sp.Abs,
    # Constants
    "pi": sp.pi,
    "E": sp.E,
    # Common physical/math variables
    "x": sp.Symbol("x"),
    "y": sp.Symbol("y"),
    "z": sp.Symbol("z"),
    "t": sp.Symbol("t"),
    "v": sp.Symbol("v"),
    "a": sp.Symbol("a"),
    "m": sp.Symbol("m"),
    "r": sp.Symbol("r"),
    "F": sp.Symbol("F"),
    "g": sp.Symbol("g"),
    "k": sp.Symbol("k"),
    "theta": sp.Symbol("theta"),
}


class SafeMathVisitor(ast.NodeVisitor):
    """
    Validates that an AST contains only safe mathematical expressions.
    Forbids arbitrary attributes, method calls, statements, imports, and dunder access.
    """

    ALLOWED_NODES = (
        ast.Expression,
        ast.BinOp,
        ast.UnaryOp,
        ast.Constant,  # Numbers in Python 3.8+
        ast.Num,       # Fallback for numbers
        ast.Name,
        ast.Call,
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.Pow,
        ast.USub,
        ast.UAdd,
        ast.Mod,
        ast.Load,
    )

    def generic_visit(self, node: ast.AST) -> None:
        if not isinstance(node, self.ALLOWED_NODES):
            raise ValueError(f"Disallowed AST node: {type(node).__name__}")
        super().generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        if node.id.startswith("_"):
            raise ValueError(f"Dunder or private name disallowed: {node.id}")
        if node.id not in ALLOWED_MATH_NAMES:
            # Dynamically allow single-letter symbols or common variable names if safe
            if not (node.id.isalnum() and len(node.id) <= 6):
                raise ValueError(f"Disallowed identifier: {node.id}")
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        if not isinstance(node.func, ast.Name):
            raise ValueError("Only direct function calls are allowed")
        if node.func.id not in ALLOWED_MATH_NAMES or not callable(ALLOWED_MATH_NAMES[node.func.id]):
            raise ValueError(f"Function {node.func.id} is not in the safe math allowlist")
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        raise ValueError("Attribute access is strictly forbidden")


def safe_parse_expr(text: str) -> sp.Expr:
    """
    Parses a string into a SymPy expression after AST safety validation.
    Never calls sympify or eval on unvalidated strings.
    """
    cleaned = text.strip().replace("^", "**")
    # Clean leading '=' or 'x =' if present
    if "=" in cleaned:
        cleaned = cleaned.split("=")[-1].strip()

    try:
        parsed_ast = ast.parse(cleaned, mode="eval")
    except SyntaxError as e:
        raise ValueError(f"Syntax error parsing expression: {e}")

    # Validate AST
    SafeMathVisitor().visit(parsed_ast)

    # Build local symbols dict
    local_dict = dict(ALLOWED_MATH_NAMES)
    # Extract any extra symbols identified in AST
    for node in ast.walk(parsed_ast):
        if isinstance(node, ast.Name) and node.id not in local_dict:
            local_dict[node.id] = sp.Symbol(node.id)

    # Use sympify strictly with explicit locals and evaluate=True
    return sp.sympify(cleaned, locals=local_dict, evaluate=True)


def check_sympy_equivalence(candidate_str: str, key_str: str, tolerance: float = 1e-4) -> Dict[str, Any]:
    """
    Checks if candidate is mathematically equivalent to answer_key.
    Handles exact algebraic simplification and numerical equivalence within tolerance.
    """
    try:
        expr_cand = safe_parse_expr(candidate_str)
        expr_key = safe_parse_expr(key_str)
    except Exception as exc:
        return {
            "is_correct": False,
            "is_verifiable": False,
            "detail": f"Expression parsing failed: {str(exc)}"
        }

    # 1. Direct symbolic equality
    try:
        diff = sp.simplify(expr_cand - expr_key)
        if diff == 0:
            return {"is_correct": True, "is_verifiable": True, "detail": "Symbolically equivalent"}
    except Exception:
        pass

    # 2. Numerical approximation equivalence
    try:
        val_cand = complex(expr_cand.evalf())
        val_key = complex(expr_key.evalf())

        if abs(val_cand - val_key) <= tolerance or (
            abs(val_key) > 0 and abs((val_cand - val_key) / val_key) <= tolerance
        ):
            return {"is_correct": True, "is_verifiable": True, "detail": "Numerically equivalent within tolerance"}
    except Exception:
        pass

    return {
        "is_correct": False,
        "is_verifiable": True,
        "detail": f"Expressions are not equivalent (diff={expr_cand} vs {expr_key})"
    }


if __name__ == "__main__":
    # Support execution via subprocess runner: python -m app.backend.verification.sympy_checker
    try:
        raw_input = sys.stdin.read()
        payload = json.loads(raw_input)
        cand = payload.get("candidate", "")
        key = payload.get("answer_key", "")
        tol = payload.get("tolerance", 1e-4)
        result = check_sympy_equivalence(cand, key, tol)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"is_correct": False, "is_verifiable": False, "detail": str(e)}))
