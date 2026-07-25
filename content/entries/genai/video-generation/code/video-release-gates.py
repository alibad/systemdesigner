"""Fail-closed release gates for one video-generation candidate."""

from dataclasses import dataclass


@dataclass(frozen=True)
class CandidateEvidence:
    temporal_score: int
    identity_score: int
    safety_risk: int
    rights_complete: bool
    provenance_valid: bool
    peak_capacity_ready: bool


@dataclass(frozen=True)
class ReleasePolicy:
    temporal_floor: int
    identity_floor: int
    safety_risk_ceiling: int


def failed_gates(
    evidence: CandidateEvidence,
    policy: ReleasePolicy,
) -> list[str]:
    failures: list[str] = []
    if evidence.temporal_score < policy.temporal_floor:
        failures.append("temporal-quality")
    if evidence.identity_score < policy.identity_floor:
        failures.append("identity-consistency")
    if evidence.safety_risk > policy.safety_risk_ceiling:
        failures.append("safety")
    if not evidence.rights_complete:
        failures.append("rights-lineage")
    if not evidence.provenance_valid:
        failures.append("provenance")
    if not evidence.peak_capacity_ready:
        failures.append("serving-capacity")
    return failures


if __name__ == "__main__":
    production = ReleasePolicy(
        temporal_floor=80,
        identity_floor=78,
        safety_risk_ceiling=25,
    )
    candidate = CandidateEvidence(
        temporal_score=86,
        identity_score=72,
        safety_risk=12,
        rights_complete=True,
        provenance_valid=True,
        peak_capacity_ready=True,
    )
    failures = failed_gates(candidate, production)
    assert failures == ["identity-consistency"]
    print({"decision": "block" if failures else "release", "failed": failures})
