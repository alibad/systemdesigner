"""Small production-style routing and quality-gate example.

The scores are illustrative replay data, not universal thresholds. In a real system,
calibrate policy values on labeled documents and version the policy with each result.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Iterable


class Outcome(str, Enum):
    STRAIGHT_THROUGH = "straight-through"
    SPECIALIST = "specialist-route"
    REVIEW = "human-review"
    QUARANTINE = "quarantine"


@dataclass(frozen=True)
class Candidate:
    document_id: str
    source_hash: str
    known_family: bool
    readable_pct: int
    received_pages: int
    expected_pages: int
    classifier_pct: int
    critical_field_pct: int
    structure_pct: int
    source_coverage_pct: int
    reconciles: bool


@dataclass(frozen=True)
class GatePolicy:
    version: str
    route_unknown_to_specialist: bool
    minimum_classifier_pct: int
    minimum_critical_field_pct: int
    minimum_structure_pct: int
    minimum_source_coverage_pct: int
    require_complete_pages: bool
    require_reconciliation: bool
    quarantine_below_readable_pct: int


@dataclass(frozen=True)
class GateResult:
    outcome: Outcome
    route: str
    failed_gates: tuple[str, ...]
    policy_version: str


def failed_gates(candidate: Candidate, policy: GatePolicy) -> Iterable[str]:
    if policy.require_complete_pages and candidate.received_pages != candidate.expected_pages:
        yield "page-complete"
    if candidate.critical_field_pct < policy.minimum_critical_field_pct:
        yield "critical-field-confidence"
    if candidate.structure_pct < policy.minimum_structure_pct:
        yield "structure-coverage"
    if candidate.source_coverage_pct < policy.minimum_source_coverage_pct:
        yield "source-evidence"
    if policy.require_reconciliation and not candidate.reconciles:
        yield "cross-field-reconciliation"


def decide(candidate: Candidate, policy: GatePolicy) -> GateResult:
    """Return a route and outcome without mutating the candidate."""
    if candidate.readable_pct < policy.quarantine_below_readable_pct:
        return GateResult(
            outcome=Outcome.QUARANTINE,
            route="none",
            failed_gates=("readable-source",),
            policy_version=policy.version,
        )

    classifier_is_uncertain = candidate.classifier_pct < policy.minimum_classifier_pct
    if policy.route_unknown_to_specialist and (
        not candidate.known_family or classifier_is_uncertain
    ):
        return GateResult(
            outcome=Outcome.SPECIALIST,
            route="bundle-split-and-specialist",
            failed_gates=("document-family",),
            policy_version=policy.version,
        )

    failures = tuple(failed_gates(candidate, policy))
    if "page-complete" in failures:
        outcome = Outcome.QUARANTINE
    elif failures:
        outcome = Outcome.REVIEW
    else:
        outcome = Outcome.STRAIGHT_THROUGH

    return GateResult(
        outcome=outcome,
        route="general-extraction",
        failed_gates=failures,
        policy_version=policy.version,
    )


EVIDENCE_BOUND = GatePolicy(
    version="quality-policy-2026-07",
    route_unknown_to_specialist=True,
    minimum_classifier_pct=84,
    minimum_critical_field_pct=90,
    minimum_structure_pct=88,
    minimum_source_coverage_pct=95,
    require_complete_pages=True,
    require_reconciliation=True,
    quarantine_below_readable_pct=45,
)


REPLAY_CANDIDATES = (
    Candidate(
        document_id="invoice-1042",
        source_hash="sha256:7be1...4a90",
        known_family=True,
        readable_pct=76,
        received_pages=3,
        expected_pages=3,
        classifier_pct=93,
        critical_field_pct=89,
        structure_pct=90,
        source_coverage_pct=86,
        reconciles=False,
    ),
    Candidate(
        document_id="application-8821",
        source_hash="sha256:61aa...0d72",
        known_family=True,
        readable_pct=96,
        received_pages=3,
        expected_pages=4,
        classifier_pct=98,
        critical_field_pct=96,
        structure_pct=94,
        source_coverage_pct=74,
        reconciles=True,
    ),
)


if __name__ == "__main__":
    results = [decide(candidate, EVIDENCE_BOUND) for candidate in REPLAY_CANDIDATES]

    assert results[0].outcome is Outcome.REVIEW
    assert "cross-field-reconciliation" in results[0].failed_gates
    assert results[1].outcome is Outcome.QUARANTINE
    assert "page-complete" in results[1].failed_gates

    for candidate, result in zip(REPLAY_CANDIDATES, results):
        print(
            f"{candidate.document_id}: {result.outcome.value} "
            f"via {result.route}; failed={list(result.failed_gates)}"
        )
