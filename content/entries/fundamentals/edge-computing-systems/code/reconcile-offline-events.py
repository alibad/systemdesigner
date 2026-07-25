"""Model buffer pressure and deterministic replay after an edge outage."""

from dataclasses import dataclass
from math import floor


@dataclass(frozen=True)
class RecoveryResult:
    generated_events: int
    retained_events: int
    dropped_events: int
    conflict_events: int
    unresolved_events: int
    duplicate_effects: int
    replay_seconds: float


def model_recovery(
    *,
    event_rate_per_second: int,
    outage_minutes: int,
    event_bytes: int,
    buffer_capacity_mb: int,
    replay_rate_per_second: int,
    conflict_rate_percent: float,
    unresolved_percent: float,
    retry_percent: float,
    deduplicates: bool,
) -> RecoveryResult:
    generated = event_rate_per_second * outage_minutes * 60
    capacity_events = floor(buffer_capacity_mb * 1_000_000 / event_bytes)
    retained = min(generated, capacity_events)
    dropped = generated - retained
    conflicts = round(retained * conflict_rate_percent / 100)
    unresolved = round(conflicts * unresolved_percent / 100)
    retries = round(retained * retry_percent / 100)
    duplicate_effects = 0 if deduplicates else retries

    return RecoveryResult(
        generated_events=generated,
        retained_events=retained,
        dropped_events=dropped,
        conflict_events=conflicts,
        unresolved_events=unresolved,
        duplicate_effects=duplicate_effects,
        replay_seconds=retained / replay_rate_per_second,
    )


if __name__ == "__main__":
    recovery = model_recovery(
        event_rate_per_second=80,
        outage_minutes=45,
        event_bytes=900,
        buffer_capacity_mb=256,
        replay_rate_per_second=600,
        conflict_rate_percent=1.5,
        unresolved_percent=4,
        retry_percent=4,
        deduplicates=True,
    )

    assert recovery.generated_events == 216_000
    assert recovery.dropped_events == 0
    assert recovery.duplicate_effects == 0
    assert recovery.replay_seconds == 360

    print(recovery)
