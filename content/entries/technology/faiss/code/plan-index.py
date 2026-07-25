from dataclasses import dataclass


@dataclass(frozen=True)
class Corpus:
    vectors: int
    dimensions: int
    ram_gib: int


def raw_vector_gib(corpus: Corpus) -> float:
    return corpus.vectors * corpus.dimensions * 4 / 1024**3


def candidate(corpus: Corpus, exact_required: bool) -> str:
    raw_gib = raw_vector_gib(corpus)
    if exact_required:
        return "Flat"
    if raw_gib <= corpus.ram_gib * 0.6:
        return "HNSW or IVFFlat benchmark"
    return "IVFPQ benchmark"


if __name__ == "__main__":
    corpus = Corpus(vectors=10_000_000, dimensions=768, ram_gib=128)
    print({"raw_gib": round(raw_vector_gib(corpus), 1), "candidate": candidate(corpus, False)})
