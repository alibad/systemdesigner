"""Teaching fixture for command-policy structure, not a device safety controller."""

from dataclasses import dataclass
from enum import Enum


class Decision(str, Enum):
    PERMIT_BOUNDED = "permit_bounded"
    REQUIRE_CONFIRMATION = "require_confirmation"
    HOLD = "hold"
    SAFE_STOP = "safe_stop"


@dataclass(frozen=True)
class Evidence:
    confidence: float
    artifact_fraction: float
    frame_age_ms: float
    calibration_age_hours: float
    output_heartbeat: bool
    calibration_id: str
    decoder_version: str


@dataclass(frozen=True)
class CommandPolicy:
    minimum_confidence: float
    maximum_artifact_fraction: float
    maximum_frame_age_ms: float
    maximum_calibration_age_hours: float
    always_confirm: bool
    safe_state: str


@dataclass(frozen=True)
class GateResult:
    decision: Decision
    reasons: tuple[str, ...]
    safe_state: str
    evidence_ref: str


def gate_command(evidence: Evidence, policy: CommandPolicy) -> GateResult:
    evidence_ref = f"{evidence.calibration_id}:{evidence.decoder_version}"

    if not evidence.output_heartbeat:
        return GateResult(
            decision=Decision.SAFE_STOP,
            reasons=("Output-device heartbeat is absent.",),
            safe_state=policy.safe_state,
            evidence_ref=evidence_ref,
        )

    reasons: list[str] = []
    if evidence.frame_age_ms > policy.maximum_frame_age_ms:
        reasons.append("The source frame is older than the command-class limit.")
    if evidence.calibration_age_hours > policy.maximum_calibration_age_hours:
        reasons.append("The active calibration is outside its freshness limit.")
    if evidence.artifact_fraction > policy.maximum_artifact_fraction:
        reasons.append("The artifact estimate exceeds the accepted signal limit.")
    if evidence.confidence < policy.minimum_confidence:
        reasons.append("Decoder confidence is below the policy threshold.")

    if reasons:
        return GateResult(
            decision=Decision.HOLD,
            reasons=tuple(reasons),
            safe_state=policy.safe_state,
            evidence_ref=evidence_ref,
        )

    if policy.always_confirm:
        return GateResult(
            decision=Decision.REQUIRE_CONFIRMATION,
            reasons=("This command class requires independent confirmation.",),
            safe_state=policy.safe_state,
            evidence_ref=evidence_ref,
        )

    return GateResult(
        decision=Decision.PERMIT_BOUNDED,
        reasons=("Fresh evidence clears every configured gate.",),
        safe_state=policy.safe_state,
        evidence_ref=evidence_ref,
    )
