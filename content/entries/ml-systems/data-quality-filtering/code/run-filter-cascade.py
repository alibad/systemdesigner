"""Run versioned filter gates and retain an auditable decision trace."""

from dataclasses import asdict, dataclass
from typing import Callable, Iterable


@dataclass(frozen=True)
class Record:
    record_id: str
    text: str
    source_uri: str
    license_id: str | None
    duplicate_of: str | None
    quality_score: float
    safety_score: float


@dataclass(frozen=True)
class Gate:
    reason_code: str
    rejects: Callable[[Record], bool]


@dataclass(frozen=True)
class Decision:
    record_id: str
    disposition: str
    reason_code: str
    policy_version: str
    evaluated_gates: tuple[str, ...]


POLICY_VERSION = "quality-policy-2026-07-23"

GATES = (
    Gate(
        "missing-license",
        lambda record: not record.license_id,
    ),
    Gate(
        "duplicate",
        lambda record: record.duplicate_of is not None,
    ),
    Gate(
        "quality-below-threshold",
        lambda record: record.quality_score < 0.62,
    ),
    Gate(
        "safety-above-threshold",
        lambda record: record.safety_score >= 0.35,
    ),
)


def decide(record: Record, gates: Iterable[Gate] = GATES) -> Decision:
    """Stop at the first failed gate while preserving the evaluation trace."""
    evaluated: list[str] = []
    for gate in gates:
        evaluated.append(gate.reason_code)
        if gate.rejects(record):
            return Decision(
                record_id=record.record_id,
                disposition="quarantine",
                reason_code=gate.reason_code,
                policy_version=POLICY_VERSION,
                evaluated_gates=tuple(evaluated),
            )

    return Decision(
        record_id=record.record_id,
        disposition="publish",
        reason_code="eligible",
        policy_version=POLICY_VERSION,
        evaluated_gates=tuple(evaluated),
    )


def release(records: Iterable[Record]) -> tuple[list[Record], list[dict]]:
    """Return publishable records and a complete decision ledger."""
    published: list[Record] = []
    ledger: list[dict] = []

    for record in records:
        decision = decide(record)
        ledger.append(asdict(decision))
        if decision.disposition == "publish":
            published.append(record)

    return published, ledger
