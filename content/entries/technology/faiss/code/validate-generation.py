from dataclasses import dataclass


@dataclass(frozen=True)
class IndexManifest:
    embedding_model: str
    dimensions: int
    metric: str
    normalized: bool
    vector_count: int
    metadata_generation: str


def compatible(current: IndexManifest, candidate: IndexManifest) -> bool:
    return (
        current.embedding_model == candidate.embedding_model
        and current.dimensions == candidate.dimensions
        and current.metric == candidate.metric
        and current.normalized == candidate.normalized
        and candidate.vector_count > 0
        and bool(candidate.metadata_generation)
    )


if __name__ == "__main__":
    live = IndexManifest("embed-v7", 768, "inner_product", True, 9_800_000, "meta-41")
    next_index = IndexManifest("embed-v7", 768, "inner_product", True, 10_000_000, "meta-42")
    assert compatible(live, next_index)
    print({"candidate_compatible": True})
