"""Small, dependency-free model of an authorized hybrid retrieval stage."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Candidate:
    chunk_id: str
    tenant: str
    lexical_rank: int | None
    dense_rank: int | None


def reciprocal_rank(rank: int | None, constant: int = 60) -> float:
    return 0.0 if rank is None else 1.0 / (constant + rank)


def retrieve(candidates: list[Candidate], tenant: str, top_k: int) -> list[tuple[str, float]]:
    """Filter first, fuse ranks second, and return a bounded candidate set."""
    authorized = [item for item in candidates if item.tenant == tenant]
    scored = [
        (
            item.chunk_id,
            reciprocal_rank(item.lexical_rank) + reciprocal_rank(item.dense_rank),
        )
        for item in authorized
    ]
    return sorted(scored, key=lambda item: (-item[1], item[0]))[:top_k]


if __name__ == "__main__":
    corpus = [
        Candidate("policy-17", "acme", 1, 3),
        Candidate("policy-22", "acme", 4, 1),
        Candidate("private-9", "other-tenant", 2, 2),
    ]
    result = retrieve(corpus, tenant="acme", top_k=2)
    assert [chunk_id for chunk_id, _ in result] == ["policy-17", "policy-22"]
    assert all(chunk_id != "private-9" for chunk_id, _ in result)
    print(result)
