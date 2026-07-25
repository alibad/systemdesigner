from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class FusedResult:
    document_id: str
    score: float
    ranks: dict[str, int]


def reciprocal_rank_fusion(
    ranked_lists: Mapping[str, Sequence[str]],
    *,
    rank_constant: int = 60,
    depth: int | None = None,
) -> list[FusedResult]:
    """Fuse ordered document IDs without comparing ranker-specific scores."""
    if rank_constant < 1:
        raise ValueError("rank_constant must be positive")

    contributions: dict[str, float] = {}
    observed_ranks: dict[str, dict[str, int]] = {}

    for list_name, document_ids in ranked_lists.items():
        visible_ids: Iterable[str] = document_ids
        if depth is not None:
            if depth < 1:
                raise ValueError("depth must be positive")
            visible_ids = document_ids[:depth]

        for rank, document_id in enumerate(visible_ids, start=1):
            contributions[document_id] = (
                contributions.get(document_id, 0.0)
                + 1.0 / (rank_constant + rank)
            )
            observed_ranks.setdefault(document_id, {})[list_name] = rank

    return sorted(
        (
            FusedResult(
                document_id=document_id,
                score=score,
                ranks=observed_ranks[document_id],
            )
            for document_id, score in contributions.items()
        ),
        key=lambda result: (-result.score, result.document_id),
    )


if __name__ == "__main__":
    lists = {
        "lexical": ["role-policy", "export-help", "residency-rule"],
        "dense": ["residency-rule", "incident-exception", "export-help"],
        "reformulated": ["incident-exception", "residency-rule", "role-policy"],
    }

    for item in reciprocal_rank_fusion(lists, rank_constant=60):
        print(f"{item.document_id:20} {item.score:.6f} {item.ranks}")
