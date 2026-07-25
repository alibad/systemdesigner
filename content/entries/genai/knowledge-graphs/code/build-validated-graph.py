"""Resolve source records and admit only sufficiently supported graph edges."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Observation:
    record_id: str
    label: str
    identity_score: int


@dataclass(frozen=True)
class RelationCandidate:
    source_record_id: str
    relation_type: str
    target_id: str
    confidence: int
    supporting_sources: tuple[str, ...]


def resolve_records(
    observations: list[Observation],
    canonical_id: str,
    threshold: int,
) -> dict[str, str]:
    """Map only observations above the declared threshold to a canonical ID."""
    return {
        observation.record_id: (
            canonical_id
            if observation.identity_score >= threshold
            else f"candidate:{observation.record_id}"
        )
        for observation in observations
    }


def admit_relations(
    candidates: list[RelationCandidate],
    resolved_ids: dict[str, str],
    min_confidence: int,
    min_sources: int,
) -> list[dict[str, object]]:
    """Create provenance-bearing edges without losing the resolved source ID."""
    accepted: list[dict[str, object]] = []
    for candidate in candidates:
        independent_sources = tuple(sorted(set(candidate.supporting_sources)))
        if candidate.confidence < min_confidence:
            continue
        if len(independent_sources) < min_sources:
            continue

        accepted.append(
            {
                "from": resolved_ids[candidate.source_record_id],
                "type": candidate.relation_type,
                "to": candidate.target_id,
                "confidence": candidate.confidence,
                "provenance": independent_sources,
            }
        )
    return accepted


records = [
    Observation("hr-104", "Alex Rivera", 100),
    Observation("skills-arivera", "A. Rivera", 91),
    Observation("tickets-alex", "Alex Rivera", 87),
    Observation("crm-alexandra", "Alexandra Rivera", 78),
]
relations = [
    RelationCandidate(
        "skills-arivera",
        "HAS_SKILL",
        "skill:graph-modeling",
        94,
        ("skills-catalog", "project-review"),
    ),
    RelationCandidate(
        "crm-alexandra",
        "MANAGES",
        "project:atlas",
        77,
        ("partner-crm",),
    ),
]

resolved = resolve_records(records, canonical_id="employee:104", threshold=85)
edges = admit_relations(relations, resolved, min_confidence=84, min_sources=2)

assert resolved["skills-arivera"] == "employee:104"
assert resolved["crm-alexandra"] == "candidate:crm-alexandra"
assert len(edges) == 1
