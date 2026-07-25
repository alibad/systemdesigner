from dataclasses import dataclass
from typing import Literal

Owner = Literal["cloud", "site", "device"]


@dataclass(frozen=True)
class VersionedField:
    name: str
    owner: Owner
    version: int
    value: object


@dataclass(frozen=True)
class EdgeEvent:
    event_id: str
    device_id: str
    sequence: int
    observed_at_ms: int
    kind: str
    payload: dict[str, object]


FIELD_OWNERS: dict[str, Owner] = {
    "desired_model_digest": "cloud",
    "rollout_ring": "cloud",
    "site_admission": "site",
    "safety_override": "device",
}


def accept_field(current: VersionedField, incoming: VersionedField) -> VersionedField:
    expected_owner = FIELD_OWNERS.get(incoming.name)
    if expected_owner is None or incoming.owner != expected_owner:
        raise ValueError(f"{incoming.owner} cannot write {incoming.name}")
    if incoming.version <= current.version:
        return current
    return incoming


def merge_events(
    stored: dict[str, EdgeEvent],
    incoming: list[EdgeEvent],
    last_sequence: dict[str, int],
) -> list[EdgeEvent]:
    accepted: list[EdgeEvent] = []

    for event in incoming:
        if event.event_id in stored:
            continue
        if event.sequence <= last_sequence.get(event.device_id, -1):
            continue

        stored[event.event_id] = event
        last_sequence[event.device_id] = event.sequence
        accepted.append(event)

    return accepted


def command_is_fresh(issued_at_ms: int, expires_at_ms: int, now_ms: int) -> bool:
    return issued_at_ms <= now_ms < expires_at_ms
