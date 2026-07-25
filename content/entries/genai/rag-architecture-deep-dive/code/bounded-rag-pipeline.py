from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Protocol, Sequence


@dataclass(frozen=True)
class RequestContext:
    tenant_id: str
    principal_id: str
    allowed_groups: frozenset[str]
    as_of_version: int


@dataclass(frozen=True)
class Candidate:
    chunk_id: str
    source_id: str
    text: str
    tenant_id: str
    allowed_groups: frozenset[str]
    source_version: int
    retrieval_score: float


class SearchIndex(Protocol):
    def hybrid_search(
        self,
        query: str,
        *,
        tenant_id: str,
        allowed_groups: frozenset[str],
        source_version_lte: int,
        limit: int,
    ) -> Sequence[Candidate]: ...


class Reranker(Protocol):
    def rank(self, query: str, candidates: Sequence[Candidate]) -> Sequence[Candidate]: ...


def retrieve_evidence(
    query: str,
    request: RequestContext,
    index: SearchIndex,
    reranker: Reranker,
    *,
    candidate_limit: int = 40,
    evidence_limit: int = 6,
) -> list[Candidate]:
    """Return bounded, policy-safe evidence with stable provenance."""
    if evidence_limit > candidate_limit:
        raise ValueError("evidence_limit cannot exceed candidate_limit")

    # Security trimming belongs inside the search request. The checks below are
    # defense in depth, not a substitute for index-level filtering.
    candidates = index.hybrid_search(
        query,
        tenant_id=request.tenant_id,
        allowed_groups=request.allowed_groups,
        source_version_lte=request.as_of_version,
        limit=candidate_limit,
    )

    safe_candidates = [
        item
        for item in candidates
        if item.tenant_id == request.tenant_id
        and item.source_version <= request.as_of_version
        and bool(item.allowed_groups & request.allowed_groups)
    ]

    ranked = reranker.rank(query, safe_candidates)
    return deduplicate_by_source(ranked)[:evidence_limit]


def deduplicate_by_source(candidates: Iterable[Candidate]) -> list[Candidate]:
    """Keep the strongest passage per source so duplicates cannot crowd context."""
    selected: list[Candidate] = []
    seen_sources: set[str] = set()
    for candidate in candidates:
        if candidate.source_id in seen_sources:
            continue
        selected.append(candidate)
        seen_sources.add(candidate.source_id)
    return selected


def build_evidence_packet(evidence: Sequence[Candidate]) -> str:
    """Delimit retrieved data and retain IDs for claim-level citations."""
    return "\n\n".join(
        f"<evidence source_id={item.source_id!r} chunk_id={item.chunk_id!r}>\n"
        f"{item.text}\n"
        "</evidence>"
        for item in evidence
    )
