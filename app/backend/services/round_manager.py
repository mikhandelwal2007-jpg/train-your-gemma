import random
import logging
from typing import Optional, Dict, Any, Tuple
from sqlmodel import Session, select
from app.backend.models.entities import (
    Problem,
    Trace,
    Label,
    GoldCheck,
    ProblemSplit,
    ProblemStatus,
    Player,
)
from app.backend.services.scoring import evaluate_round_submission, VerdictResult

logger = logging.getLogger("train_your_gemma.round_manager")

# In-memory store of active unsubmitted round per player to handle reloads/resumes
_active_rounds: Dict[str, str] = {}  # player_id -> trace_id


def get_or_create_next_round(session: Session, player_id: str) -> Optional[Dict[str, Any]]:
    """
    Returns the next round trace for the player.
    1. If the player has an active round not yet labeled, resumes that trace (Section 11).
    2. Sprinkles gold traces roughly 1 in 8 rounds (Section 7).
    3. Balances flawed (~55%) and flawless (~45%) traces without revealing the ratio.
    4. Guarantees held-out flight problems are NEVER chosen.
    """
    # Check if there is an active unsubmitted trace for this player
    if player_id in _active_rounds:
        active_trace_id = _active_rounds[player_id]
        # Check if already labeled in DB
        existing_label = session.exec(
            select(Label).where(Label.player_id == player_id, Label.trace_id == active_trace_id)
        ).first()
        if not existing_label:
            trace = session.exec(select(Trace).where(Trace.id == active_trace_id)).first()
            if trace:
                problem = session.exec(select(Problem).where(Problem.id == trace.problem_id)).first()
                if problem:
                    return format_round_response(trace, problem)
        # If already labeled, remove from active rounds
        del _active_rounds[player_id]

    # Find traces already labeled by this player
    labeled_trace_ids = set(
        session.exec(select(Label.trace_id).where(Label.player_id == player_id)).all()
    )

    # Check gold sprinkling: roughly 1 in 8 rounds
    label_count = len(labeled_trace_ids)
    is_gold_round = (label_count > 0 and label_count % 8 == 0)

    target_split = ProblemSplit.GOLD if is_gold_round else ProblemSplit.PLAY

    # Fetch eligible problems in the target split
    eligible_problems = session.exec(
        select(Problem).where(
            Problem.split == target_split,
            Problem.status == ProblemStatus.ACTIVE,
        )
    ).all()

    if not eligible_problems:
        # Fallback to play split if gold split is empty or vice versa
        eligible_problems = session.exec(
            select(Problem).where(
                Problem.split == ProblemSplit.PLAY,
                Problem.status == ProblemStatus.ACTIVE,
            )
        ).all()

    if not eligible_problems:
        return None

    # Pick candidate problem
    random.shuffle(eligible_problems)

    chosen_trace = None
    chosen_problem = None

    # Decide whether we prefer flawed (55%) or flawless (45%)
    prefer_flawed = random.random() < 0.55

    for prob in eligible_problems:
        traces = session.exec(
            select(Trace).where(Trace.problem_id == prob.id)
        ).all()

        unseen_traces = [t for t in traces if t.id not in labeled_trace_ids]
        if not unseen_traces:
            continue

        # Filter by preference if possible
        matched_traces = [t for t in unseen_traces if (t.first_flaw_index is not None) == prefer_flawed]
        if matched_traces:
            chosen_trace = random.choice(matched_traces)
        else:
            chosen_trace = random.choice(unseen_traces)

        chosen_problem = prob
        break

    # If all traces seen, allow replaying with any unseen trace from play split
    if not chosen_trace:
        all_play_problems = session.exec(
            select(Problem).where(
                Problem.split.in_([ProblemSplit.PLAY, ProblemSplit.GOLD]),
                Problem.status == ProblemStatus.ACTIVE,
            )
        ).all()
        for prob in all_play_problems:
            traces = session.exec(select(Trace).where(Trace.problem_id == prob.id)).all()
            unseen = [t for t in traces if t.id not in labeled_trace_ids]
            if unseen:
                chosen_trace = random.choice(unseen)
                chosen_problem = prob
                break

    if not chosen_trace or not chosen_problem:
        # Gracefully handle when all problem/trace pairs are exhausted
        return None

    _active_rounds[player_id] = chosen_trace.id
    return format_round_response(chosen_trace, chosen_problem)


def format_round_response(trace: Trace, problem: Problem) -> Dict[str, Any]:
    """Formats trace and problem for gameplay client without revealing ground truth."""
    return {
        "trace_id": trace.id,
        "problem_id": problem.id,
        "subject": problem.subject,
        "difficulty": problem.difficulty,
        "statement": problem.statement,
        "image_path": problem.image_path,
        "steps": trace.steps,
        "final_answer": trace.final_answer,
        "total_steps": len(trace.steps),
    }


def submit_round_label(
    session: Session,
    player: Player,
    trace_id: str,
    tapped_index: Optional[int],
    response_time_ms: int,
    client_request_id: Optional[str] = None,
) -> Tuple[VerdictResult, bool]:
    """
    Submits player tap or Flawless selection idempotently.
    Returns (verdict_result, is_duplicate).
    """
    trace = session.exec(select(Trace).where(Trace.id == trace_id)).first()
    if not trace:
        raise ValueError(f"Trace not found: {trace_id}")

    problem = session.exec(select(Problem).where(Problem.id == trace.problem_id)).first()
    if not problem:
        raise ValueError(f"Problem not found for trace: {trace.problem_id}")

    # Check for duplicate submission (idempotency)
    existing_label = session.exec(
        select(Label).where(Label.player_id == player.id, Label.trace_id == trace_id)
    ).first()

    # Calculate current streak from past labels
    recent_labels = session.exec(
        select(Label).where(Label.player_id == player.id).order_by(Label.created_at.desc())
    ).all()

    current_streak = 0
    for lbl in recent_labels:
        if lbl.is_correct is True:
            current_streak += 1
        elif lbl.is_correct is False:
            break

    # Evaluate verdict
    verdict = evaluate_round_submission(
        trace=trace,
        tapped_index=tapped_index,
        response_time_ms=response_time_ms,
        difficulty=problem.difficulty,
        current_streak=current_streak,
    )

    if existing_label:
        # Return existing verdict without re-scoring or adding duplicate row
        return verdict, True

    # Record new Label in DB
    new_label = Label(
        player_id=player.id,
        trace_id=trace.id,
        tapped_index=tapped_index,
        is_correct=(verdict.verdict == "correct"),
        response_time_ms=response_time_ms,
        consent_snapshot=player.consent_dataset,
    )
    session.add(new_label)

    # If it was a gold problem, track GoldCheck for label reliability scoring (Section 8)
    if problem.split == ProblemSplit.GOLD:
        gold_check = GoldCheck(
            player_id=player.id,
            trace_id=trace.id,
            passed=(verdict.verdict == "correct"),
            response_time_ms=response_time_ms,
        )
        session.add(gold_check)

    session.commit()

    # Remove from active rounds cache
    if player.id in _active_rounds and _active_rounds[player.id] == trace_id:
        del _active_rounds[player.id]

    return verdict, False
