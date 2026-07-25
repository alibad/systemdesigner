"""Evaluate graph paths against depth, state, freshness, and access policy."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Citation:
    source_id: str
    accessible: bool
    fresh: bool


@dataclass(frozen=True)
class Edge:
    source: str
    relation: str
    target: str
    hop: int
    status: str
    citations: tuple[Citation, ...]


@dataclass(frozen=True)
class EvidencePolicy:
    max_depth: int
    allow_proposed: bool
    require_citation: bool
    require_fresh: bool


def evaluate_path(
    path: list[Edge],
    policy: EvidencePolicy,
) -> tuple[bool, list[str]]:
    reasons: list[str] = []

    for edge in path:
        if edge.hop > policy.max_depth:
            reasons.append(f"{edge.relation}: outside the hop budget")
            continue
        if edge.status != "verified" and not policy.allow_proposed:
            reasons.append(f"{edge.relation}: edge is {edge.status}")

        visible = [citation for citation in edge.citations if citation.accessible]
        if policy.require_citation and not visible:
            reasons.append(f"{edge.relation}: no accessible citation")
        elif policy.require_fresh and not any(item.fresh for item in visible):
            reasons.append(f"{edge.relation}: evidence is stale")

    return not reasons, reasons


ownership_path = [
    Edge(
        "checkout",
        "DEPENDS_ON",
        "token-service",
        1,
        "verified",
        (Citation("trace-map-v42", accessible=True, fresh=True),),
    ),
    Edge(
        "token-service",
        "OWNED_BY",
        "identity-platform",
        2,
        "verified",
        (Citation("catalog-2025-q4", accessible=True, fresh=False),),
    ),
]

release_policy = EvidencePolicy(
    max_depth=2,
    allow_proposed=False,
    require_citation=True,
    require_fresh=True,
)

may_answer, blocked_by = evaluate_path(ownership_path, release_policy)
assert not may_answer
assert blocked_by == ["OWNED_BY: evidence is stale"]
