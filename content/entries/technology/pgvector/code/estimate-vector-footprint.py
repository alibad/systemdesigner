"""Estimate pgvector payload and filtered candidate demand."""

from dataclasses import dataclass


@dataclass(frozen=True)
class SearchPlan:
    rows: int
    dimensions: int
    bytes_per_dimension: int
    initial_candidates: int
    filter_selectivity: float
    top_k: int

    def estimate(self) -> dict[str, float]:
        payload_bytes = self.rows * (self.dimensions * self.bytes_per_dimension + 8)
        return {
            "payload_gib": payload_bytes / 1024**3,
            "expected_filtered_candidates": self.initial_candidates * self.filter_selectivity,
            "candidates_needed_for_top_k": self.top_k / self.filter_selectivity,
        }


if __name__ == "__main__":
    plan = SearchPlan(10_000_000, 768, 4, 80, 0.05, 10)
    result = plan.estimate()
    assert result["expected_filtered_candidates"] == 4
    assert result["candidates_needed_for_top_k"] == 200
    print(f"vector payload: {result['payload_gib']:.1f} GiB")
    print(f"expected post-filter candidates: {result['expected_filtered_candidates']:.0f}")
    print(f"candidate target for top 10: {result['candidates_needed_for_top_k']:.0f}")
