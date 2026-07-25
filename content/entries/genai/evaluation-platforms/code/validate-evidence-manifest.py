"""Fail a release when its evaluation evidence is incomplete or out of policy."""

from dataclasses import dataclass


@dataclass(frozen=True)
class EvidenceManifest:
    dataset_version: str | None
    application_revision: str | None
    evaluator_version: str | None
    reviewer_decision_id: str | None
    overall_delta_pct: float
    critical_slice_pct: float
    reviewer_agreement_pct: float
    evidence_age_days: int


REQUIRED_IDS = (
    "dataset_version",
    "application_revision",
    "evaluator_version",
    "reviewer_decision_id",
)


def release_decision(manifest: EvidenceManifest) -> tuple[bool, list[str]]:
    failures: list[str] = []

    for field_name in REQUIRED_IDS:
        if not getattr(manifest, field_name):
            failures.append(f"missing {field_name}")

    if manifest.overall_delta_pct < -0.5:
        failures.append("aggregate regression exceeds 0.5 percentage points")
    if manifest.critical_slice_pct < 90:
        failures.append("critical slice is below 90 percent")
    if manifest.reviewer_agreement_pct < 80:
        failures.append("reviewer agreement is below 80 percent")
    if manifest.evidence_age_days > 14:
        failures.append("evidence is older than 14 days")

    return not failures, failures


if __name__ == "__main__":
    candidate = EvidenceManifest(
        dataset_version="support-v18",
        application_revision="git:74ae91d",
        evaluator_version="groundedness-v4",
        reviewer_decision_id=None,
        overall_delta_pct=2.1,
        critical_slice_pct=93,
        reviewer_agreement_pct=84,
        evidence_age_days=4,
    )

    passed, reasons = release_decision(candidate)
    print("release:", "canary" if passed else "hold")
    for reason in reasons:
        print("-", reason)
