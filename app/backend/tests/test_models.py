import pytest
from sqlmodel import Session, select, create_engine, SQLModel
from app.backend.models.entities import (
    Player,
    Class,
    Problem,
    Trace,
    Label,
    GoldCheck,
    FlawReport,
    TrainingRun,
    CriticVersion,
    FlightResult,
    CheckerType,
    ProblemSplit,
    ProblemStatus,
    TruthSource,
    TrainingStatus,
    FlightArm,
)


@pytest.fixture
def db_session():
    test_engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(test_engine)
    with Session(test_engine) as session:
        yield session


def test_player_and_class_creation(db_session: Session):
    c = Class(teacher_id="t_1", name="Dragon Flight Academy", join_code="DRAGON77")
    db_session.add(c)
    db_session.commit()

    p = Player(display_name="SkyWatcher", is_anonymous=False, consent_dataset=True, class_id=c.id)
    db_session.add(p)
    db_session.commit()

    fetched = db_session.exec(select(Player).where(Player.display_name == "SkyWatcher")).first()
    assert fetched is not None
    assert fetched.consent_dataset is True
    assert fetched.class_id == c.id


def test_problem_and_trace_relationships(db_session: Session):
    prob = Problem(
        id="prob_test_1",
        subject="physics_units",
        difficulty="easy",
        statement="What is 10 m / 2 s?",
        answer_key="5 m/s",
        checker_type=CheckerType.UNITS,
        split=ProblemSplit.PLAY,
    )
    db_session.add(prob)
    db_session.commit()

    trace = Trace(
        id="trace_test_1",
        problem_id=prob.id,
        model_id="google/gemma-2-2b-it",
        steps=["Step 1: Divide 10 by 2.", "Step 2: Get 5 m/s."],
        final_answer="5 m/s",
        is_final_correct=True,
        first_flaw_index=None,
        flaw_type=None,
        truth_source=TruthSource.CHECKER,
    )
    db_session.add(trace)
    db_session.commit()

    fetched_trace = db_session.exec(select(Trace).where(Trace.id == "trace_test_1")).first()
    assert fetched_trace is not None
    assert len(fetched_trace.steps) == 2
    assert fetched_trace.is_final_correct is True


def test_flight_result_storage(db_session: Session):
    res = FlightResult(
        critic_version_id=None,
        arm=FlightArm.BASE,
        n_problems=50,
        accuracy=0.72,
        eyesight=0.85,
        ci_low=0.64,
        ci_high=0.79,
        seed=42,
    )
    db_session.add(res)
    db_session.commit()

    fetched = db_session.exec(select(FlightResult).where(FlightResult.arm == FlightArm.BASE)).first()
    assert fetched is not None
    assert fetched.accuracy == 0.72
    assert fetched.ci_low == 0.64
