from dataclasses import dataclass
from enum import Enum
from time import monotonic_ns


class Decision(str, Enum):
    EXECUTE = "execute"
    HOLD = "hold"
    STOP = "stop"


@dataclass(frozen=True)
class ActionProposal:
    sequence_id: int
    created_ns: int
    target_zone: str
    speed_mps: float
    force_newtons: float
    confidence: float


@dataclass(frozen=True)
class SafetyEnvelope:
    allowed_zones: frozenset[str]
    max_speed_mps: float
    max_force_newtons: float
    min_confidence: float
    max_age_ms: float


@dataclass(frozen=True)
class SafetyVerdict:
    decision: Decision
    reason: str
    safe_command: str


class ActionGate:
    """Owns execution authority; the learned policy only proposes actions."""

    def __init__(self, envelope: SafetyEnvelope) -> None:
        self._envelope = envelope
        self._last_sequence_id = -1

    def authorize(self, proposal: ActionProposal, human_nearby: bool) -> SafetyVerdict:
        age_ms = (monotonic_ns() - proposal.created_ns) / 1_000_000

        if proposal.sequence_id <= self._last_sequence_id:
            return SafetyVerdict(Decision.HOLD, "replayed proposal", "hold_position")
        if age_ms > self._envelope.max_age_ms:
            return SafetyVerdict(Decision.HOLD, "stale world state", "reobserve")
        if proposal.target_zone not in self._envelope.allowed_zones:
            return SafetyVerdict(Decision.STOP, "target outside geofence", "remove_motion")
        if proposal.force_newtons > self._envelope.max_force_newtons:
            return SafetyVerdict(Decision.STOP, "force exceeds envelope", "remove_torque")
        if human_nearby and proposal.speed_mps > 0.2:
            return SafetyVerdict(Decision.HOLD, "human proximity speed limit", "slow_mode")
        if proposal.speed_mps > self._envelope.max_speed_mps:
            return SafetyVerdict(Decision.HOLD, "speed exceeds envelope", "slow_mode")
        if proposal.confidence < self._envelope.min_confidence:
            return SafetyVerdict(Decision.HOLD, "insufficient evidence", "request_help")

        self._last_sequence_id = proposal.sequence_id
        return SafetyVerdict(Decision.EXECUTE, "inside verified envelope", "execute_once")
