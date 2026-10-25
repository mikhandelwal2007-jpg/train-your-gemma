import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple
from sqlmodel import Session, select
from app.backend.models.entities import Problem, Trace, ProblemSplit, ProblemStatus, CheckerType, TruthSource

logger = logging.getLogger("train_your_gemma.problem_loader")


def load_problems_from_files(base_dir: str = "./data/problems") -> List[Dict[str, Any]]:
    """Loads all problem JSON definitions from data/problems."""
    problems_dir = Path(base_dir)
    all_problems = []
    if not problems_dir.exists():
        return all_problems

    for p_file in problems_dir.glob("*.json"):
        try:
            with open(p_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    all_problems.extend(data)
        except Exception as e:
            logger.error(f"Error loading {p_file}: {e}")
    return all_problems


def load_traces_from_files(base_dir: str = "./data/traces") -> List[Dict[str, Any]]:
    """Loads all trace JSON definitions from data/traces."""
    traces_dir = Path(base_dir)
    all_traces = []
    if not traces_dir.exists():
        return all_traces

    for t_file in traces_dir.glob("*.json"):
        try:
            with open(t_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    all_traces.extend(data)
        except Exception as e:
            logger.error(f"Error loading {t_file}: {e}")
    return all_traces


def seed_database_from_json(session: Session, base_path: str = "./data") -> Tuple[int, int]:
    """
    Inserts problems and traces into DB if not already present.
    Enforces that problem IDs are unique and strictly adheres to split tagging.
    """
    problems_data = load_problems_from_files(f"{base_path}/problems")
    traces_data = load_traces_from_files(f"{base_path}/traces")

    num_problems_added = 0
    num_traces_added = 0

    for p in problems_data:
        existing = session.exec(select(Problem).where(Problem.id == p["id"])).first()
        if not existing:
            problem = Problem(
                id=p["id"],
                subject=p["subject"],
                difficulty=p.get("difficulty", "medium"),
                statement=p["statement"],
                image_path=p.get("image_path"),
                answer_key=p["answer_key"],
                checker_type=CheckerType(p.get("checker_type", "exact")),
                split=ProblemSplit(p.get("split", "play")),
                license=p.get("license", "CC0-1.0"),
                source=p.get("source", "original"),
                status=ProblemStatus.ACTIVE,
            )
            session.add(problem)
            num_problems_added += 1

    session.commit()

    for t in traces_data:
        existing_t = session.exec(select(Trace).where(Trace.id == t["id"])).first()
        if not existing_t:
            trace = Trace(
                id=t["id"],
                problem_id=t["problem_id"],
                model_id=t.get("model_id", "google/gemma-2-2b-it"),
                adapter_version=t.get("adapter_version"),
                steps=t.get("steps", []),
                final_answer=t["final_answer"],
                is_final_correct=t.get("is_final_correct", False),
                first_flaw_index=t.get("first_flaw_index"),
                flaw_type=t.get("flaw_type"),
                truth_source=TruthSource(t.get("truth_source", "checker")),
            )
            session.add(trace)
            num_traces_added += 1

    session.commit()
    logger.info(f"Seeded {num_problems_added} problems and {num_traces_added} traces.")
    return num_problems_added, num_traces_added
