import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Header, Cookie, Response
from pydantic import BaseModel, Field
from sqlmodel import Session, select
from app.backend.database import get_session
from app.backend.models.entities import (
    Player,
    Label,
    FlawReport,
    FlightResult,
    FlightArm,
    Trace,
)
from app.backend.services.round_manager import get_or_create_next_round, submit_round_label
from app.backend.services.tells import compute_dragon_tells

router = APIRouter(prefix="", tags=["gameplay"])


# --- Schemas ---

class SessionCreateRequest(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=24)
    is_anonymous: bool = True
    consent_dataset: bool = False
    class_code: Optional[str] = None


class SessionResponse(BaseModel):
    player_id: str
    display_name: str
    is_anonymous: bool
    consent_dataset: bool
    created_at: str


class LabelSubmissionRequest(BaseModel):
    tapped_index: Optional[int] = Field(
        default=None,
        description="0-indexed step number where the first flaw occurred. None means 'Flawless'.",
    )
    response_time_ms: int = Field(default=3000, ge=100)
    client_request_id: Optional[str] = None


class FlawReportRequest(BaseModel):
    trace_id: str
    reason: str = Field(description="answer_key_wrong, ambiguous, broken_image, other")
    comment: Optional[str] = None


# --- Dependency for current player ---

def get_current_player(
    x_player_id: Optional[str] = Header(default=None, alias="X-Player-ID"),
    player_id_cookie: Optional[str] = Cookie(default=None, alias="player_id"),
    session: Session = Depends(get_session),
) -> Player:
    pid = x_player_id or player_id_cookie
    if not pid:
        # Auto-create anonymous guest player if header not supplied
        player = Player(display_name=f"Hatchling_{uuid.uuid4().hex[:5]}", is_anonymous=True)
        session.add(player)
        session.commit()
        session.refresh(player)
        return player

    player = session.exec(select(Player).where(Player.id == pid)).first()
    if not player:
        # Fallback to creating player with this ID
        player = Player(id=pid, display_name=f"Hatchling_{pid[:5]}", is_anonymous=True)
        session.add(player)
        session.commit()
        session.refresh(player)
    return player


# --- Endpoints ---

@router.post("/session", response_model=SessionResponse)
def create_session(req: SessionCreateRequest, response: Response, session: Session = Depends(get_session)):
    """Creates or restores a player session."""
    raw_name = (req.display_name or "").strip()
    # Simple moderation check: forbid empty or excessively long names
    if not raw_name:
        display_name = f"DragonRider_{uuid.uuid4().hex[:5]}"
    else:
        # Sanitize display name
        display_name = "".join(c for c in raw_name if c.isalnum() or c in ("_", "-", " "))[:20]

    player = Player(
        display_name=display_name,
        is_anonymous=req.is_anonymous,
        consent_dataset=req.consent_dataset,
    )
    session.add(player)
    session.commit()
    session.refresh(player)

    # Set cookie for web browsers
    response.set_cookie(key="player_id", value=player.id, httponly=False, samesite="lax")

    return SessionResponse(
        player_id=player.id,
        display_name=player.display_name,
        is_anonymous=player.is_anonymous,
        consent_dataset=player.consent_dataset,
        created_at=player.created_at.isoformat(),
    )


@router.get("/me")
def get_player_profile(
    player: Player = Depends(get_current_player),
    session: Session = Depends(get_session),
):
    """
    Returns player stats, score, streak, and dragon evolution stage.
    NON-NEGOTIABLE PRINCIPLE 1:
    Accuracy, Eyesight, and Honesty stats come ONLY from real flight-test runs.
    If no flight test has run yet, returns 'Not measured yet' with progress details.
    """
    labels = session.exec(select(Label).where(Label.player_id == player.id)).all()
    total_labels = len(labels)
    correct_labels = sum(1 for l in labels if l.is_correct is True)

    # Compute current streak
    streak = 0
    for l in reversed(labels):
        if l.is_correct is True:
            streak += 1
        elif l.is_correct is False:
            break

    # Total points estimate from correct labels
    score = sum(150 for l in labels if l.is_correct is True)

    # Fetch latest active flight test result (if available)
    latest_flight = session.exec(
        select(FlightResult)
        .where(FlightResult.arm == FlightArm.CRITIC_HUMAN)
        .order_by(FlightResult.created_at.desc())
    ).first()

    # Determine stats honestly
    if latest_flight and latest_flight.n_problems >= 10:
        accuracy_display = f"{round(latest_flight.accuracy * 100, 1)}%"
        eyesight_display = f"{round(latest_flight.eyesight * 100, 1)}%" if latest_flight.eyesight else "N/A"
        honesty_display = f"{round(latest_flight.honesty * 100, 1)}%" if latest_flight.honesty else "N/A"
        has_measured_stats = True
    else:
        accuracy_display = "Not measured yet"
        eyesight_display = "Not measured yet"
        honesty_display = "Not measured yet"
        has_measured_stats = False

    # Dragon growth stage based on verified catches
    if correct_labels >= 50:
        dragon_stage = "Adult"
    elif correct_labels >= 15:
        dragon_stage = "Juvenile"
    else:
        dragon_stage = "Hatchling"

    return {
        "player_id": player.id,
        "display_name": player.display_name,
        "is_anonymous": player.is_anonymous,
        "consent_dataset": player.consent_dataset,
        "score": score,
        "current_streak": streak,
        "total_labels": total_labels,
        "correct_labels": correct_labels,
        "dragon_stage": dragon_stage,
        "stats": {
            "has_measured_stats": has_measured_stats,
            "accuracy": accuracy_display,
            "eyesight": eyesight_display,
            "honesty": honesty_display,
            "status_message": "Flight test needed to measure stats" if not has_measured_stats else "Verified by Flight Test",
        },
    }


@router.get("/rounds/next")
def get_next_round(
    player: Player = Depends(get_current_player),
    session: Session = Depends(get_session),
):
    """
    Returns the next problem & reasoning trace.
    Resumes unfinished round if player refreshed or abandoned, without double scoring.
    """
    round_data = get_or_create_next_round(session, player.id)
    if not round_data:
        raise HTTPException(
            status_code=404,
            detail="No more available rounds right now. Check back soon for new generated problems!",
        )
    return round_data


@router.post("/rounds/{trace_id}/label")
def submit_label(
    trace_id: str,
    req: LabelSubmissionRequest,
    player: Player = Depends(get_current_player),
    session: Session = Depends(get_session),
):
    """
    Evaluates step tap or flawless button click.
    Returns verdict, points, streak, and plain-language explanation.
    Idempotent: repeating the submission does not score twice.
    """
    try:
        verdict, is_duplicate = submit_round_label(
            session=session,
            player=player,
            trace_id=trace_id,
            tapped_index=req.tapped_index,
            response_time_ms=req.response_time_ms,
            client_request_id=req.client_request_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {
        "verdict": verdict.verdict,  # "correct", "close", "wrong", "ambiguous"
        "points_awarded": verdict.points_awarded,
        "streak": verdict.streak_updated,
        "flaw_type": verdict.flaw_type,
        "explanation": verdict.explanation,
        "is_duplicate": is_duplicate,
    }


@router.post("/flaw-reports")
def report_flaw(
    req: FlawReportRequest,
    player: Player = Depends(get_current_player),
    session: Session = Depends(get_session),
):
    """Player flags a problem or trace as ambiguous / answer key wrong / broken image."""
    report = FlawReport(
        player_id=player.id,
        trace_id=req.trace_id,
        reason=req.reason,
        comment=req.comment,
    )
    session.add(report)
    session.commit()
    return {"status": "reported", "message": "Thank you! Our trainers will review this trace."}


@router.get("/tells")
def get_tells_report(
    player: Player = Depends(get_current_player),
    session: Session = Depends(get_session),
):
    """Returns dragon habits computed from the player's real verified catches."""
    return compute_dragon_tells(session, player.id)
