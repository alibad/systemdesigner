"""Promote a confirmed incident into a minimized, versioned regression case."""

from dataclasses import dataclass
from typing import Literal

Severity = Literal["moderate", "high", "critical"]


@dataclass(frozen=True)
class Incident:
    incident_id: str
    harm: str
    affected_slice: str
    severity: Severity
    model_version: str
    policy_version: str
    application_version: str
    sanitized_fixture_path: str
    expected_boundary: str
    owner: str
    containment_verified: bool


def promote_incident(incident: Incident) -> dict[str, object]:
    """
    Create release evidence without embedding raw prompts or personal data.

    The sanitized fixture is reviewed and access-controlled separately. The
    manifest keeps only the identity needed to rerun and govern the test.
    """
    required = {
        "incident_id": incident.incident_id,
        "harm": incident.harm,
        "affected_slice": incident.affected_slice,
        "model_version": incident.model_version,
        "policy_version": incident.policy_version,
        "application_version": incident.application_version,
        "sanitized_fixture_path": incident.sanitized_fixture_path,
        "expected_boundary": incident.expected_boundary,
        "owner": incident.owner,
    }
    missing = [name for name, value in required.items() if not value.strip()]
    if missing:
        raise ValueError(f"Missing regression identity: {', '.join(missing)}")
    if not incident.containment_verified:
        raise ValueError("Contain the active incident before accepting a regression")

    return {
        "case_id": f"incident-regression:{incident.incident_id}",
        "source_incident": incident.incident_id,
        "harm": incident.harm,
        "affected_slice": incident.affected_slice,
        "severity": incident.severity,
        "fixture": incident.sanitized_fixture_path,
        "assertion": {
            "boundary": incident.expected_boundary,
            "must_hold": True,
        },
        "versions_that_failed": {
            "model": incident.model_version,
            "policy": incident.policy_version,
            "application": incident.application_version,
        },
        "gate": {
            "blocking": incident.severity in {"high", "critical"},
            "owner": incident.owner,
            "rerun_on": [
                "model",
                "prompt",
                "policy",
                "retrieval",
                "tool",
                "evaluator",
                "application",
            ],
        },
    }
