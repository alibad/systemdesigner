"""Model a generation cutover that refuses stale or unvalidated search state."""

from dataclasses import dataclass


@dataclass(frozen=True)
class GenerationEvidence:
    index: str
    source_checkpoint: int
    applied_checkpoint: int
    expected_documents: int
    indexed_documents: int
    relevance_passed: bool
    latency_passed: bool
    snapshot_verified: bool


def cutover_decision(evidence: GenerationEvidence) -> tuple[bool, list[str]]:
    blockers: list[str] = []

    if evidence.applied_checkpoint < evidence.source_checkpoint:
        blockers.append("live change stream has not reached the source checkpoint")
    if evidence.indexed_documents != evidence.expected_documents:
        blockers.append("document reconciliation failed")
    if not evidence.relevance_passed:
        blockers.append("judged relevance queries regressed")
    if not evidence.latency_passed:
        blockers.append("latency release gate failed")
    if not evidence.snapshot_verified:
        blockers.append("rollback snapshot has not been restored successfully")

    return not blockers, blockers


if __name__ == "__main__":
    candidate = GenerationEvidence(
        index="products-v2",
        source_checkpoint=840_000,
        applied_checkpoint=840_017,
        expected_documents=2_400_000,
        indexed_documents=2_400_000,
        relevance_passed=True,
        latency_passed=True,
        snapshot_verified=True,
    )

    approved, reasons = cutover_decision(candidate)
    assert approved and not reasons
    print(f"CUT OVER read alias to {candidate.index}")
