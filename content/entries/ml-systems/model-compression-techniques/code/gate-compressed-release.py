from dataclasses import dataclass


@dataclass(frozen=True)
class ReleaseEvidence:
    worst_quality_drop: float
    baseline_p99_ms: float
    candidate_p99_ms: float
    memory_pressure: float
    backend_supported: bool


def approve(evidence: ReleaseEvidence) -> bool:
    speedup = evidence.baseline_p99_ms / evidence.candidate_p99_ms
    return (
        evidence.worst_quality_drop <= 1.0
        and speedup >= 1.15
        and evidence.memory_pressure <= 0.85
        and evidence.backend_supported
    )


if __name__ == "__main__":
    evidence = ReleaseEvidence(0.7, 80, 52, 0.73, True)
    assert approve(evidence)
    print({"release_approved": True})
