import sys
import json
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional
from app.backend.config import settings


def run_sandboxed_checker(module_name: str, payload: Dict[str, Any], timeout: Optional[float] = None) -> Dict[str, Any]:
    """
    Executes a verification check in a separate sandboxed Python subprocess with a strict timeout.
    Prevents memory leaks, hangs, or unexpected code execution in the main API server process.
    """
    if timeout is None:
        timeout = settings.VERIFICATION_TIMEOUT_SECONDS

    import os
    env = os.environ.copy()
    workspace_root = str(Path(__file__).resolve().parent.parent.parent.parent)
    env["PYTHONPATH"] = workspace_root

    # Execute Python in isolated unbuffered mode
    cmd = [
        sys.executable,
        "-s",
        "-m",
        module_name,
    ]

    try:
        proc = subprocess.run(
            cmd,
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=workspace_root,
            env=env,
        )

        if proc.returncode != 0:
            return {
                "is_correct": False,
                "is_verifiable": False,
                "detail": f"Subprocess error (exit code {proc.returncode}): {proc.stderr.strip()[:200]}"
            }

        try:
            return json.loads(proc.stdout)
        except json.JSONDecodeError:
            return {
                "is_correct": False,
                "is_verifiable": False,
                "detail": f"Invalid JSON returned from checker: {proc.stdout.strip()[:200]}"
            }

    except subprocess.TimeoutExpired:
        return {
            "is_correct": False,
            "is_verifiable": False,
            "detail": f"Verification timed out after {timeout} seconds (treated as unverifiable)"
        }
    except Exception as exc:
        return {
            "is_correct": False,
            "is_verifiable": False,
            "detail": f"Subprocess execution failed: {str(exc)}"
        }
