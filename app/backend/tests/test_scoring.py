import pytest
from app.backend.models.entities import Trace, TruthSource
from app.backend.services.scoring import evaluate_round_submission, calculate_points


def create_dummy_trace(first_flaw_index=None, flaw_type=None, truth_source=TruthSource.CHECKER):
    return Trace(
        id="t_test",
        problem_id="p_test",
        model_id="gemma-2",
        steps=["Step 1", "Step 2", "Step 3", "Step 4"],
        final_answer="Answer",
        first_flaw_index=first_flaw_index,
        flaw_type=flaw_type,
        truth_source=truth_source,
    )


def test_correct_tapped_exact_first_flaw():
    # Flaw at index 1 (Step 2)
    trace = create_dummy_trace(first_flaw_index=1, flaw_type="unit_slip")
    res = evaluate_round_submission(
        trace=trace,
        tapped_index=1,
        response_time_ms=4000,
        difficulty="medium",
        current_streak=2,
    )
    assert res.verdict == "correct"
    assert res.points_awarded > 150
    assert res.streak_updated == 3
    assert "Step 2" in res.explanation


def test_correct_tapped_flawless_on_flawless_trace():
    trace = create_dummy_trace(first_flaw_index=None)
    res = evaluate_round_submission(
        trace=trace,
        tapped_index=None,  # tapped "Flawless"
        response_time_ms=3000,
        difficulty="easy",
        current_streak=0,
    )
    assert res.verdict == "correct"
    assert res.streak_updated == 1
    assert "flawless" in res.explanation.lower()


def test_close_tapped_later_step():
    # First flaw at index 1 (Step 2), player tapped index 2 (Step 3)
    trace = create_dummy_trace(first_flaw_index=1, flaw_type="math_error")
    res = evaluate_round_submission(
        trace=trace,
        tapped_index=2,
        response_time_ms=5000,
        difficulty="medium",
        current_streak=5,
    )
    assert res.verdict == "close"
    assert res.points_awarded == 0
    assert res.streak_updated == 5  # Close does not reset streak
    assert "earlier" in res.explanation.lower()


def test_wrong_tapped_earlier_step():
    # First flaw at index 2 (Step 3), player tapped index 0 (Step 1)
    trace = create_dummy_trace(first_flaw_index=2, flaw_type="formula_inversion")
    res = evaluate_round_submission(
        trace=trace,
        tapped_index=0,
        response_time_ms=5000,
        difficulty="medium",
        current_streak=4,
    )
    assert res.verdict == "wrong"
    assert res.points_awarded == 0
    assert res.streak_updated == 0  # Streak reset


def test_wrong_tapped_flawless_on_flawed_trace():
    trace = create_dummy_trace(first_flaw_index=1, flaw_type="misread_graph")
    res = evaluate_round_submission(
        trace=trace,
        tapped_index=None,  # player missed the flaw
        response_time_ms=3500,
        difficulty="hard",
        current_streak=3,
    )
    assert res.verdict == "wrong"
    assert res.points_awarded == 0
    assert res.streak_updated == 0


def test_ambiguous_trace_never_scored():
    # Section 7: Traces marked ambiguous are NEVER scored
    trace = create_dummy_trace(first_flaw_index=1, truth_source=TruthSource.AMBIGUOUS)
    res = evaluate_round_submission(
        trace=trace,
        tapped_index=1,
        response_time_ms=3000,
        difficulty="easy",
        current_streak=2,
    )
    assert res.verdict == "ambiguous"
    assert res.points_awarded == 0
    assert res.streak_updated == 2
