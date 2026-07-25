from dataclasses import dataclass


@dataclass(frozen=True)
class ReleasePolicy:
    minimum_judge_human_agreement: float
    required_slices: frozenset[str]
    require_independent_evaluation: bool = True
    require_runtime_controls: bool = True
    require_rollback: bool = True


@dataclass(frozen=True)
class ReleaseEvidence:
    constitution_version: str
    judge_human_agreement: float
    passing_slices: frozenset[str]
    independent_evaluation_passed: bool
    runtime_controls_ready: bool
    rollback_ready: bool


@dataclass(frozen=True)
class ReleaseDecision:
    approved: bool
    failed_gates: tuple[str, ...]


def evaluate_release(
    evidence: ReleaseEvidence,
    policy: ReleasePolicy,
) -> ReleaseDecision:
    """Fail closed when required constitutional-alignment evidence is missing."""
    failures: list[str] = []

    if not evidence.constitution_version.strip():
        failures.append("constitution version is missing")
    if evidence.judge_human_agreement < policy.minimum_judge_human_agreement:
        failures.append("AI-judge calibration is below the release threshold")

    missing_slices = policy.required_slices - evidence.passing_slices
    if missing_slices:
        failures.append(f"critical slices are missing or failing: {sorted(missing_slices)}")
    if policy.require_independent_evaluation and not evidence.independent_evaluation_passed:
        failures.append("independent behavioral evaluation did not pass")
    if policy.require_runtime_controls and not evidence.runtime_controls_ready:
        failures.append("required runtime controls are not ready")
    if policy.require_rollback and not evidence.rollback_ready:
        failures.append("a compatible rollback artifact is not ready")

    return ReleaseDecision(approved=not failures, failed_gates=tuple(failures))


if __name__ == "__main__":
    release_policy = ReleasePolicy(
        minimum_judge_human_agreement=0.85,
        required_slices=frozenset({"bounded-assistance", "honesty", "high-risk"}),
    )
    candidate_evidence = ReleaseEvidence(
        constitution_version="constitution-2026-07",
        judge_human_agreement=0.89,
        passing_slices=frozenset({"bounded-assistance", "honesty"}),
        independent_evaluation_passed=True,
        runtime_controls_ready=True,
        rollback_ready=True,
    )

    decision = evaluate_release(candidate_evidence, release_policy)
    print("APPROVE" if decision.approved else "HOLD")
    for failure in decision.failed_gates:
        print(f"- {failure}")
