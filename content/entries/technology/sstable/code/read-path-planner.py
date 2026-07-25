"""Estimate SSTable point-read work from transparent planning assumptions."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ReadPlan:
    candidate_runs: float
    disk_reads: float
    expected_latency_ms: float
    bloom_false_positive_pct: float


def bloom_false_positive_rate(bits_per_key: int) -> float:
    """Return the optimal Bloom-filter false-positive approximation."""
    if bits_per_key <= 0:
        return 1.0
    return 0.6185**bits_per_key


def plan_point_read(
    *,
    run_count: int,
    present_probability: float,
    bits_per_key: int,
    cache_hit_probability: float,
    random_read_ms: float = 3.5,
) -> ReadPlan:
    if run_count < 1:
        raise ValueError("run_count must be positive")
    if not 0 <= present_probability <= 1:
        raise ValueError("present_probability must be between 0 and 1")
    if not 0 <= cache_hit_probability <= 1:
        raise ValueError("cache_hit_probability must be between 0 and 1")

    false_positive_rate = bloom_false_positive_rate(bits_per_key)
    absent_candidates = run_count * false_positive_rate
    present_candidates = 1 + (run_count - 1) * false_positive_rate * 0.5
    candidates = (
        present_probability * present_candidates
        + (1 - present_probability) * absent_candidates
    )
    disk_reads = candidates * (1 - cache_hit_probability)
    cached_reads = candidates - disk_reads
    latency_ms = disk_reads * random_read_ms + cached_reads * 0.08

    return ReadPlan(
        candidate_runs=candidates,
        disk_reads=disk_reads,
        expected_latency_ms=latency_ms,
        bloom_false_positive_pct=false_positive_rate * 100,
    )


if __name__ == "__main__":
    baseline = plan_point_read(
        run_count=10,
        present_probability=0.10,
        bits_per_key=10,
        cache_hit_probability=0.70,
    )
    no_filter = plan_point_read(
        run_count=10,
        present_probability=0.10,
        bits_per_key=0,
        cache_hit_probability=0.70,
    )

    assert baseline.candidate_runs < 1
    assert no_filter.candidate_runs > 9
    assert baseline.disk_reads < no_filter.disk_reads
    print(baseline)
