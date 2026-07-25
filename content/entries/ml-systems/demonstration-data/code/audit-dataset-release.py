"""Evaluate a demonstration dataset against blocking release gates."""

from dataclasses import dataclass


@dataclass(frozen=True)
class DatasetEvidence:
    verified_provenance_pct: float
    near_duplicate_pct: float
    reviewer_agreement_pct: float
    critical_slice_pass_pct: float
    safety_pass_pct: float
    unresolved_privacy_incidents: int


@dataclass(frozen=True)
class ReleasePolicy:
    min_provenance_pct: float
    max_duplicate_pct: float
    min_agreement_pct: float
    min_slice_pass_pct: float
    min_safety_pass_pct: float


def evaluate_release(
    evidence: DatasetEvidence,
    policy: ReleasePolicy,
) -> dict[str, bool]:
    """Return one result per independently blocking gate."""
    return {
        "provenance": evidence.verified_provenance_pct >= policy.min_provenance_pct,
        "duplicates": evidence.near_duplicate_pct <= policy.max_duplicate_pct,
        "reviewer_agreement": (
            evidence.reviewer_agreement_pct >= policy.min_agreement_pct
        ),
        "critical_slices": (
            evidence.critical_slice_pass_pct >= policy.min_slice_pass_pct
        ),
        "safety": evidence.safety_pass_pct >= policy.min_safety_pass_pct,
        "privacy": evidence.unresolved_privacy_incidents == 0,
    }


def promotable(results: dict[str, bool]) -> bool:
    """Promotion requires every blocking gate; results are never averaged."""
    return bool(results) and all(results.values())


if __name__ == "__main__":
    production = ReleasePolicy(
        min_provenance_pct=95,
        max_duplicate_pct=3,
        min_agreement_pct=82,
        min_slice_pass_pct=90,
        min_safety_pass_pct=99,
    )
    candidate = DatasetEvidence(
        verified_provenance_pct=98,
        near_duplicate_pct=1.8,
        reviewer_agreement_pct=87,
        critical_slice_pass_pct=84,
        safety_pass_pct=99.4,
        unresolved_privacy_incidents=0,
    )

    results = evaluate_release(candidate, production)
    for gate, passed in results.items():
        print(f"{gate:20} {'PASS' if passed else 'FAIL'}")
    print(f"promotion decision   {'PROMOTE' if promotable(results) else 'BLOCK'}")

    assert results["critical_slices"] is False
    assert promotable(results) is False
