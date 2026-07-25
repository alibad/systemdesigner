from dataclasses import dataclass


@dataclass(frozen=True)
class ReleaseEvidence:
    artifact_digest: str
    lineage_run_id: str
    critical_slice_delta_pct: float
    error_rate_delta_points: float
    rollback_digest: str


def decide_release(evidence: ReleaseEvidence) -> tuple[bool, list[str]]:
    """Return a reproducible gate decision and every blocking reason."""
    blockers: list[str] = []

    if not evidence.artifact_digest.startswith("sha256:"):
        blockers.append("candidate artifact is not content-addressed")
    if not evidence.lineage_run_id:
        blockers.append("training and evaluation lineage is missing")
    if evidence.critical_slice_delta_pct < -0.5:
        blockers.append("critical slice regressed beyond the release floor")
    if evidence.error_rate_delta_points > 0.2:
        blockers.append("online error-rate delta exceeds the canary budget")
    if not evidence.rollback_digest.startswith("sha256:"):
        blockers.append("known-good rollback artifact is not pinned")

    return (not blockers, blockers)
