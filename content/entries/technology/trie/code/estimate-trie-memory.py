"""Compare approximate Trie child-container memory for one workload."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Workload:
    words: int
    average_length: float
    unique_node_ratio: float
    average_branching: float
    alphabet_size: int


def estimate_bytes(workload: Workload) -> dict[str, int]:
    nodes = 1 + round(
        workload.words * workload.average_length * workload.unique_node_ratio
    )
    edges = round(nodes * workload.average_branching)

    return {
        "fixed_array": nodes * (16 + workload.alphabet_size * 8),
        "hash_map": nodes * 40 + edges * 24,
        "sorted_vector": nodes * 24 + edges * 12,
        "compressed_radix": round(nodes * 0.48) * 48 + edges * 10,
    }


def mebibytes(byte_count: int) -> float:
    return byte_count / 1024**2


if __name__ == "__main__":
    autocomplete = Workload(
        words=1_000_000,
        average_length=10,
        unique_node_ratio=0.58,
        average_branching=1.18,
        alphabet_size=26,
    )
    estimates = estimate_bytes(autocomplete)

    assert estimates["fixed_array"] > estimates["hash_map"]
    assert estimates["hash_map"] > estimates["sorted_vector"]

    for representation, byte_count in sorted(estimates.items(), key=lambda item: item[1]):
        print(f"{representation:18} {mebibytes(byte_count):8.1f} MiB")
