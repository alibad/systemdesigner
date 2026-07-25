from collections.abc import Callable, Sequence
from dataclasses import dataclass
from enum import StrEnum


class Route(StrEnum):
    HYBRID = "hybrid"
    FUSION = "fusion"
    HIERARCHICAL = "hierarchical"
    HYDE = "hyde"


@dataclass(frozen=True)
class QueryPlan:
    route: Route
    reason: str
    max_searches: int
    allow_fallback: bool


@dataclass(frozen=True)
class Evidence:
    source_id: str
    facts: frozenset[str]
    authorized: bool
    current: bool


@dataclass(frozen=True)
class RetrievalDecision:
    plan: QueryPlan
    evidence: tuple[Evidence, ...]
    missing_facts: frozenset[str]
    outcome: str
    fallback_used: bool


Retriever = Callable[[str, QueryPlan], Sequence[Evidence]]


def evidence_gate(
    candidates: Sequence[Evidence],
    required_facts: frozenset[str],
) -> tuple[tuple[Evidence, ...], frozenset[str]]:
    approved = tuple(
        item for item in candidates if item.authorized and item.current
    )
    covered = frozenset().union(*(item.facts for item in approved))
    return approved, required_facts - covered


def retrieve_with_one_fallback(
    query: str,
    required_facts: frozenset[str],
    primary: QueryPlan,
    fallback: QueryPlan,
    retrieve: Retriever,
) -> RetrievalDecision:
    """Run a typed plan, one optional fallback, then answer or abstain."""
    evidence, missing = evidence_gate(retrieve(query, primary), required_facts)
    if not missing:
        return RetrievalDecision(
            plan=primary,
            evidence=evidence,
            missing_facts=frozenset(),
            outcome="answer",
            fallback_used=False,
        )

    if not primary.allow_fallback:
        return RetrievalDecision(
            plan=primary,
            evidence=evidence,
            missing_facts=missing,
            outcome="abstain",
            fallback_used=False,
        )

    fallback_evidence, fallback_missing = evidence_gate(
        retrieve(query, fallback),
        required_facts,
    )
    return RetrievalDecision(
        plan=fallback,
        evidence=fallback_evidence,
        missing_facts=fallback_missing,
        outcome="answer" if not fallback_missing else "abstain",
        fallback_used=True,
    )
