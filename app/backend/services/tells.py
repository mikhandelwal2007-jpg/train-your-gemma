from collections import Counter
from typing import Dict, Any, List
from sqlmodel import Session, select
from app.backend.models.entities import Label, Trace
from app.backend.services.scoring import format_flaw_type


def compute_dragon_tells(session: Session, player_id: str) -> Dict[str, Any]:
    """
    Computes real dragon reasoning habits from verified player labels.
    Never invents statistics.
    Requirements:
    - Analyzes flaws caught by the player.
    - If fewer than 20 labels, reports progress towards the first milestone.
    """
    labels = session.exec(
        select(Label).where(Label.player_id == player_id)
    ).all()

    total_labels = len(labels)
    milestone = 20
    has_enough_data = total_labels >= milestone

    # Gather flaw types from verified correctly caught traces
    flaw_counts = Counter()
    total_flaws_caught = 0

    for lbl in labels:
        if lbl.is_correct and lbl.tapped_index is not None:
            trace = session.exec(select(Trace).where(Trace.id == lbl.trace_id)).first()
            if trace and trace.flaw_type:
                flaw_counts[trace.flaw_type] += 1
                total_flaws_caught += 1

    breakdown: List[Dict[str, Any]] = []
    if total_flaws_caught > 0:
        for flaw_key, count in flaw_counts.most_common():
            pct = round((count / total_flaws_caught) * 100, 1)
            breakdown.append({
                "flaw_type": flaw_key,
                "label": format_flaw_type(flaw_key),
                "count": count,
                "percentage": pct,
                "description": f"{format_flaw_type(flaw_key)}: {pct}% of flaws caught",
            })

    # Summary insight
    top_habit = breakdown[0]["label"] if breakdown else "None detected yet"

    return {
        "total_labels": total_labels,
        "labels_to_next_report": max(0, milestone - (total_labels % milestone)),
        "has_enough_data": has_enough_data,
        "progress_percentage": min(100.0, round((total_labels / float(milestone)) * 100, 1)),
        "total_flaws_caught": total_flaws_caught,
        "breakdown": breakdown,
        "top_habit": top_habit if has_enough_data else "Discovering dragon habits...",
    }
