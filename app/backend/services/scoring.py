from dataclasses import dataclass
from typing import Optional
from app.backend.models.entities import Trace, TruthSource


@dataclass
class VerdictResult:
    verdict: str  # "correct", "close", "wrong", "ambiguous"
    points_awarded: int
    streak_updated: int
    flaw_type: Optional[str]
    explanation: str
    is_gold: bool


def evaluate_round_submission(
    trace: Trace,
    tapped_index: Optional[int],  # None = player tapped "Flawless"
    response_time_ms: int,
    difficulty: str,
    current_streak: int,
) -> VerdictResult:
    """
    Evaluates player label submission according to Section 7:
    - Correct = tapped_index == first_flaw_index, or tapped 'Flawless' (None) on a trace with no flaw.
    - Close = tapped a LATER flawed step than the first flaw. No points; explanation states first mistake was earlier.
    - Wrong = tapped a step BEFORE the first flaw, or 'Flawless' on a flawed trace.
    - Ambiguous traces are NEVER scored.
    """
    # 1. Check if ground truth is ambiguous
    if trace.truth_source == TruthSource.AMBIGUOUS:
        return VerdictResult(
            verdict="ambiguous",
            points_awarded=0,
            streak_updated=current_streak,
            flaw_type=trace.flaw_type,
            explanation="This trace is marked ambiguous for evaluation and was not scored.",
            is_gold=False,
        )

    is_flawed = trace.first_flaw_index is not None
    actual_first_flaw = trace.first_flaw_index

    # 2. Case: Player tapped Flawless (tapped_index is None)
    if tapped_index is None:
        if not is_flawed:
            # Correct! Trace was indeed flawless
            pts = calculate_points(difficulty, response_time_ms, current_streak)
            return VerdictResult(
                verdict="correct",
                points_awarded=pts,
                streak_updated=current_streak + 1,
                flaw_type=None,
                explanation="Spot on! The model's reasoning steps and final answer were flawless.",
                is_gold=False,
            )
        else:
            # Wrong! Trace had a flaw at step actual_first_flaw + 1
            step_num = actual_first_flaw + 1
            return VerdictResult(
                verdict="wrong",
                points_awarded=0,
                streak_updated=0,
                flaw_type=trace.flaw_type,
                explanation=f"A flaw slipped through! The first mistake occurred at Step {step_num} ({format_flaw_type(trace.flaw_type)}).",
                is_gold=False,
            )

    # 3. Case: Player tapped a specific step index
    if not is_flawed:
        # Player claimed a flaw on a flawless trace -> Wrong
        return VerdictResult(
            verdict="wrong",
            points_awarded=0,
            streak_updated=0,
            flaw_type=None,
            explanation=f"False alarm! Step {tapped_index + 1} was mathematically and logically sound. This trace was flawless.",
            is_gold=False,
        )

    # Trace is flawed and player tapped tapped_index
    if tapped_index == actual_first_flaw:
        # Correct! Caught the exact first flaw
        pts = calculate_points(difficulty, response_time_ms, current_streak)
        step_num = tapped_index + 1
        return VerdictResult(
            verdict="correct",
            points_awarded=pts,
            streak_updated=current_streak + 1,
            flaw_type=trace.flaw_type,
            explanation=f"Eagle eye! You caught the very first mistake at Step {step_num}: {format_flaw_type(trace.flaw_type)}.",
            is_gold=False,
        )
    elif tapped_index > actual_first_flaw:
        # Close! Tapped a later flawed step
        earlier_num = actual_first_flaw + 1
        return VerdictResult(
            verdict="close",
            points_awarded=0,
            streak_updated=current_streak,  # "Close" doesn't reset streak, but gives no points
            flaw_type=trace.flaw_type,
            explanation=f"Close! Step {tapped_index + 1} was indeed invalid, but the first slip happened earlier at Step {earlier_num}.",
            is_gold=False,
        )
    else:
        # Tapped a step BEFORE the first flaw -> Wrong
        return VerdictResult(
            verdict="wrong",
            points_awarded=0,
            streak_updated=0,
            flaw_type=trace.flaw_type,
            explanation=f"Not quite. Step {tapped_index + 1} was still correct. The first mistake appeared at Step {actual_first_flaw + 1}.",
            is_gold=False,
        )


def calculate_points(difficulty: str, response_time_ms: int, current_streak: int) -> int:
    """Calculates points with base difficulty value + capped speed bonus + small streak bonus."""
    base_points = {"easy": 100, "medium": 150, "hard": 200}.get(difficulty.lower(), 150)

    # Speed bonus: max 25 points if answered accurately under 8 seconds, decays to 0 at 25s
    speed_bonus = 0
    if 1500 <= response_time_ms <= 25000:
        ratio = max(0.0, 1.0 - (response_time_ms - 1500) / 23500.0)
        speed_bonus = int(25 * ratio)

    # Streak bonus: 5 points per streak count, capped at 25 points
    streak_bonus = min(25, current_streak * 5)

    return base_points + speed_bonus + streak_bonus


def format_flaw_type(flaw_type: Optional[str]) -> str:
    """Converts internal snake_case flaw types to human-readable names."""
    if not flaw_type:
        return "Unknown mistake"
    labels = {
        "unit_slip": "Unit conversion error",
        "math_error": "Arithmetic mistake",
        "formula_inversion": "Inverted formula",
        "misread_graph": "Misread graph axis",
        "sign_error": "Sign flip (+/-)",
        "rounding_cascade": "Premature rounding error",
    }
    return labels.get(flaw_type, flaw_type.replace("_", " ").capitalize())
