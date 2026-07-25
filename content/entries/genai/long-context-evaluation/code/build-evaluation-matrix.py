"""Build deterministic length-by-depth cases without calling a model."""

from dataclasses import dataclass
from itertools import product


@dataclass(frozen=True)
class EvaluationCase:
    case_id: str
    context_tokens: int
    evidence_depth_pct: int
    seed: int
    required_fact_ids: tuple[str, ...]


def build_matrix(
    context_lengths: list[int],
    evidence_depths: list[int],
    repeats: int = 3,
) -> list[EvaluationCase]:
    """Create stable case identities for every tested slice."""
    cases: list[EvaluationCase] = []

    for context_tokens, depth_pct, repeat in product(
        context_lengths,
        evidence_depths,
        range(repeats),
    ):
        seed = context_tokens * 1000 + depth_pct * 10 + repeat
        cases.append(
            EvaluationCase(
                case_id=f"ctx-{context_tokens}-depth-{depth_pct}-run-{repeat}",
                context_tokens=context_tokens,
                evidence_depth_pct=depth_pct,
                seed=seed,
                required_fact_ids=("contract", "exception", "effective-date"),
            )
        )

    return cases


def assert_coverage(
    cases: list[EvaluationCase],
    expected_lengths: list[int],
    expected_depths: list[int],
) -> None:
    observed = {
        (case.context_tokens, case.evidence_depth_pct)
        for case in cases
    }
    expected = set(product(expected_lengths, expected_depths))
    missing = expected - observed
    if missing:
        raise ValueError(f"Missing evaluation slices: {sorted(missing)}")


if __name__ == "__main__":
    lengths = [8_000, 32_000, 64_000]
    depths = [10, 30, 50, 70, 90]
    matrix = build_matrix(lengths, depths)
    assert_coverage(matrix, lengths, depths)
    print(f"{len(matrix)} reproducible cases across {len(lengths) * len(depths)} slices")
