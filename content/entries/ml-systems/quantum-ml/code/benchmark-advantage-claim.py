"""A small evidence gate for a quantum-advantage experiment.

The gate does not prove advantage. It prevents a team from publishing a speed
claim before the benchmark includes end-to-end costs and a strong baseline.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class BenchmarkEvidence:
    includes_state_preparation: bool
    includes_compilation_and_queue: bool
    includes_repeated_measurements: bool
    compares_tuned_classical_baseline: bool
    reports_quality_with_uncertainty: bool


def missing_evidence(evidence: BenchmarkEvidence) -> list[str]:
    checks = {
        "state preparation or quantum-native input acquisition": evidence.includes_state_preparation,
        "compilation, queueing, and device execution": evidence.includes_compilation_and_queue,
        "all repeated circuit measurements": evidence.includes_repeated_measurements,
        "a tuned, task-appropriate classical baseline": evidence.compares_tuned_classical_baseline,
        "solution quality with confidence intervals": evidence.reports_quality_with_uncertainty,
    }
    return [label for label, present in checks.items() if not present]


candidate = BenchmarkEvidence(
    includes_state_preparation=True,
    includes_compilation_and_queue=True,
    includes_repeated_measurements=True,
    compares_tuned_classical_baseline=True,
    reports_quality_with_uncertainty=False,
)

gaps = missing_evidence(candidate)
print("Ready for a bounded research claim" if not gaps else "Claim blocked")
for gap in gaps:
    print(f"- Missing: {gap}")
