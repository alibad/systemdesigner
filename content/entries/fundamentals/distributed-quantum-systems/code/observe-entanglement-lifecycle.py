from dataclasses import dataclass
from typing import Literal

EventKind = Literal[
    "attempted",
    "heralded",
    "stored",
    "swapped",
    "delivered",
    "expired",
    "discarded",
]


@dataclass(frozen=True)
class PairEvent:
    request_id: str
    reservation_id: str
    pair_id: str
    event: EventKind
    observed_at_ms: int
    fidelity_estimate: float | None = None
    memory_age_ms: float | None = None
    controller_identity: str | None = None
    reason: str | None = None


def audit_pair(events: list[PairEvent], memory_lifetime_ms: float) -> list[str]:
    """Return lifecycle violations without pretending to measure a qubit."""
    findings: list[str] = []
    ordered = sorted(events, key=lambda event: event.observed_at_ms)
    terminal = {"delivered", "expired", "discarded"}

    if not ordered:
        return ["no lifecycle evidence"]

    reservation_ids = {event.reservation_id for event in ordered}
    if len(reservation_ids) != 1:
        findings.append("pair events cross reservation boundaries")

    delivered = [event for event in ordered if event.event == "delivered"]
    if len(delivered) > 1:
        findings.append("a consumable pair was delivered more than once")

    for event in ordered:
        if event.controller_identity is None:
            findings.append(f"{event.event} lacks authenticated controller identity")
        if event.memory_age_ms is not None and event.memory_age_ms >= memory_lifetime_ms:
            findings.append(f"{event.event} used an expired memory state")

    first_terminal = next(
        (index for index, event in enumerate(ordered) if event.event in terminal),
        None,
    )
    if first_terminal is not None and first_terminal != len(ordered) - 1:
        findings.append("events continue after the pair lifecycle terminated")

    return sorted(set(findings))
