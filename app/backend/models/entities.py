import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, Any
from sqlmodel import Field, SQLModel, Column, JSON


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CheckerType(str, Enum):
    SYMPY = "sympy"
    UNITS = "units"
    EXACT = "exact"
    MANUAL = "manual"


class ProblemSplit(str, Enum):
    PLAY = "play"
    FLIGHT = "flight"
    GOLD = "gold"


class ProblemStatus(str, Enum):
    ACTIVE = "active"
    DISABLED = "disabled"


class TruthSource(str, Enum):
    CHECKER = "checker"
    HUMAN_REVIEWED = "human_reviewed"
    AMBIGUOUS = "ambiguous"


class TrainingStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMED_OUT = "timed_out"


class FlightArm(str, Enum):
    BASE = "base"
    CRITIC_HUMAN = "critic_human"
    CRITIC_RANDOM = "critic_random"


# --- Database Models ---

class Player(SQLModel, table=True):
    __tablename__ = "players"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    display_name: str = Field(index=True)
    created_at: datetime = Field(default_factory=utc_now)
    is_anonymous: bool = Field(default=True)
    consent_dataset: bool = Field(default=False)
    class_id: Optional[str] = Field(default=None, foreign_key="classes.id", nullable=True)


class Class(SQLModel, table=True):
    __tablename__ = "classes"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    teacher_id: str = Field(index=True)
    name: str = Field(default="My Dragon Class")
    join_code: str = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=utc_now)


class Problem(SQLModel, table=True):
    __tablename__ = "problems"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    subject: str = Field(index=True)  # physics_units, chart_table
    difficulty: str = Field(default="medium")  # easy, medium, hard
    statement: str
    image_path: Optional[str] = Field(default=None, nullable=True)
    answer_key: str
    checker_type: CheckerType = Field(default=CheckerType.EXACT)
    split: ProblemSplit = Field(default=ProblemSplit.PLAY, index=True)  # play, flight, gold
    license: str = Field(default="CC0-1.0")
    source: str = Field(default="original")
    status: ProblemStatus = Field(default=ProblemStatus.ACTIVE)


class Trace(SQLModel, table=True):
    __tablename__ = "traces"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    problem_id: str = Field(foreign_key="problems.id", index=True)
    model_id: str = Field(index=True)
    adapter_version: Optional[str] = Field(default=None, nullable=True)
    steps: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    final_answer: str
    is_final_correct: bool = Field(default=False)
    first_flaw_index: Optional[int] = Field(default=None, nullable=True)  # 0-indexed, None = flawless
    flaw_type: Optional[str] = Field(default=None, nullable=True)  # unit_slip, math_error, misread_graph, etc.
    truth_source: TruthSource = Field(default=TruthSource.CHECKER)
    created_at: datetime = Field(default_factory=utc_now)


class Label(SQLModel, table=True):
    __tablename__ = "labels"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    player_id: str = Field(foreign_key="players.id", index=True)
    trace_id: str = Field(foreign_key="traces.id", index=True)
    tapped_index: Optional[int] = Field(default=None, nullable=True)  # None = tapped "Flawless"
    is_correct: Optional[bool] = Field(default=None, nullable=True)  # null until verified
    response_time_ms: int = Field(default=0)
    created_at: datetime = Field(default_factory=utc_now)
    consent_snapshot: bool = Field(default=False)


class GoldCheck(SQLModel, table=True):
    __tablename__ = "gold_checks"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    player_id: str = Field(foreign_key="players.id", index=True)
    trace_id: str = Field(foreign_key="traces.id", index=True)
    passed: bool = Field(default=False)
    response_time_ms: int = Field(default=0)
    created_at: datetime = Field(default_factory=utc_now)


class FlawReport(SQLModel, table=True):
    __tablename__ = "flaw_reports"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    player_id: str = Field(foreign_key="players.id", index=True)
    trace_id: str = Field(foreign_key="traces.id", index=True)
    reason: str  # answer_key_wrong, ambiguous, broken_image, other
    comment: Optional[str] = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=utc_now)


class TrainingRun(SQLModel, table=True):
    __tablename__ = "training_runs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    requested_by: str = Field(index=True)
    status: TrainingStatus = Field(default=TrainingStatus.QUEUED, index=True)
    label_count: int = Field(default=0)
    config: dict = Field(default_factory=dict, sa_column=Column(JSON))
    adapter_path: Optional[str] = Field(default=None, nullable=True)
    started_at: Optional[datetime] = Field(default=None, nullable=True)
    finished_at: Optional[datetime] = Field(default=None, nullable=True)
    error: Optional[str] = Field(default=None, nullable=True)
    cost_estimate: float = Field(default=0.0)


class CriticVersion(SQLModel, table=True):
    __tablename__ = "critic_versions"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    training_run_id: str = Field(foreign_key="training_runs.id", index=True)
    metrics: dict = Field(default_factory=dict, sa_column=Column(JSON))
    is_active: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=utc_now)


class FlightResult(SQLModel, table=True):
    __tablename__ = "flight_results"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    critic_version_id: Optional[str] = Field(default=None, foreign_key="critic_versions.id", nullable=True)
    arm: FlightArm = Field(index=True)  # base, critic_human, critic_random
    n_problems: int = Field(default=0)
    accuracy: float = Field(default=0.0)
    eyesight: Optional[float] = Field(default=None, nullable=True)
    honesty: Optional[float] = Field(default=None, nullable=True)
    ci_low: float = Field(default=0.0)
    ci_high: float = Field(default=0.0)
    seed: int = Field(default=42)
    created_at: datetime = Field(default_factory=utc_now)
