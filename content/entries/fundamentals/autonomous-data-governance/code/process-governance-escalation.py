from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
from typing import Literal

ReviewStatus = Literal["open", "approved", "denied", "expired"]


@dataclass(frozen=True)
class EscalationCase:
    case_id: str
    decision_id: str
    required_role: str
    fallback: str
    opened_at: datetime
    deadline: datetime
    evidence_digest: str
    contained: bool


@dataclass(frozen=True)
class SignedOutcome:
    case_id: str
    status: ReviewStatus
    reviewer_id: str
    reviewer_role: str
    rationale: str
    decided_at: datetime
    evidence_digest: str


def open_case(
    decision_id: str,
    required_role: str,
    fallback: str,
    evidence: dict[str, object],
    deadline_minutes: int,
) -> EscalationCase:
    missing = {
        "event",
        "policy_versions",
        "model_output",
        "decision_reason",
        "enforcement_state",
    } - evidence.keys()
    if missing:
        raise ValueError(f"evidence packet is incomplete: {sorted(missing)}")

    canonical = json.dumps(
        evidence, sort_keys=True, separators=(",", ":"), default=str
    ).encode()
    now = datetime.now(timezone.utc)
    return EscalationCase(
        case_id=f"review-{decision_id}",
        decision_id=decision_id,
        required_role=required_role,
        fallback=fallback,
        opened_at=now,
        deadline=now + timedelta(minutes=deadline_minutes),
        evidence_digest=sha256(canonical).hexdigest(),
        contained=True,
    )


def decide_case(
    case: EscalationCase,
    reviewer_id: str,
    reviewer_role: str,
    approve: bool,
    rationale: str,
    now: datetime,
) -> SignedOutcome:
    if not case.contained:
        raise ValueError("review cannot proceed while the request is uncontained")
    if reviewer_role != case.required_role:
        raise PermissionError(
            f"{reviewer_role} does not hold required role {case.required_role}"
        )
    if not rationale.strip():
        raise ValueError("a signed decision needs a review rationale")

    if now > case.deadline:
        status: ReviewStatus = "expired"
        reason = f"Deadline expired. Apply declared fallback: {case.fallback}"
    else:
        status = "approved" if approve else "denied"
        reason = rationale

    outcome_payload = {
        "case_id": case.case_id,
        "status": status,
        "reviewer_id": reviewer_id,
        "reviewer_role": reviewer_role,
        "rationale": reason,
        "decided_at": now.isoformat(),
        "prior_evidence_digest": case.evidence_digest,
    }
    signed_digest = sha256(
        json.dumps(outcome_payload, sort_keys=True).encode()
    ).hexdigest()

    return SignedOutcome(
        case_id=case.case_id,
        status=status,
        reviewer_id=reviewer_id,
        reviewer_role=reviewer_role,
        rationale=reason,
        decided_at=now,
        evidence_digest=signed_digest,
    )
