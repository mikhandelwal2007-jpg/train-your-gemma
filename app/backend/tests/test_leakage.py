import pytest
from app.backend.services.problem_loader import load_problems_from_files, load_traces_from_files
from app.backend.models.entities import ProblemSplit


def test_flight_test_split_integrity_and_no_leakage():
    """
    NON-NEGOTIABLE PRINCIPLE 2:
    Flight-test problems are NEVER shown in gameplay, never used for training,
    and never used to build the critic's training data. Split by PROBLEM, not by trace.
    This test verifies:
    1. Problem IDs in the 'flight' split have ZERO overlap with 'play' or 'gold' splits.
    2. No trace intended for gameplay/training points to a 'flight' problem.
    """
    problems = load_problems_from_files("./data/problems")
    assert len(problems) > 0, "Problems must be loaded"

    flight_problem_ids = set()
    play_problem_ids = set()
    gold_problem_ids = set()

    for p in problems:
        p_id = p["id"]
        split = p.get("split", "play")

        if split == ProblemSplit.FLIGHT.value:
            flight_problem_ids.add(p_id)
        elif split == ProblemSplit.PLAY.value:
            play_problem_ids.add(p_id)
        elif split == ProblemSplit.GOLD.value:
            gold_problem_ids.add(p_id)
        else:
            pytest.fail(f"Unknown split: {split} on problem {p_id}")

    # Assert mutually disjoint splits
    flight_play_intersection = flight_problem_ids.intersection(play_problem_ids)
    assert len(flight_play_intersection) == 0, (
        f"DATA LEAKAGE DETECTED! Flight problems found in play split: {flight_play_intersection}"
    )

    flight_gold_intersection = flight_problem_ids.intersection(gold_problem_ids)
    assert len(flight_gold_intersection) == 0, (
        f"DATA LEAKAGE DETECTED! Flight problems found in gold split: {flight_gold_intersection}"
    )

    play_gold_intersection = play_problem_ids.intersection(gold_problem_ids)
    assert len(play_gold_intersection) == 0, (
        f"Problem IDs overlap between play and gold splits: {play_gold_intersection}"
    )

    # Check that traces used for gameplay/training DO NOT reference flight problems
    traces = load_traces_from_files("./data/traces")
    for t in traces:
        assert t["problem_id"] not in flight_problem_ids, (
            f"LEAKAGE IN TRACES: Trace {t['id']} references held-out flight problem {t['problem_id']}"
        )
