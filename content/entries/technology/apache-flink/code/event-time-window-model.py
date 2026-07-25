"""Executable model of Flink event-time window cleanup.

This is a dependency-free teaching model, not a replacement for Flink's runtime.
It makes the watermark and allowed-lateness decisions explicit and testable.
"""

from dataclasses import dataclass
from enum import Enum


class Outcome(str, Enum):
    MAIN_RESULT = "main result"
    LATE_UPDATE = "late update"
    TOO_LATE = "too late"


@dataclass(frozen=True)
class Event:
    name: str
    event_time_seconds: int


@dataclass(frozen=True)
class Decision:
    event: Event
    watermark_before: int | None
    window_start: int
    window_end: int
    outcome: Outcome


def classify(
    events_in_arrival_order: list[Event],
    *,
    window_size_seconds: int,
    out_of_orderness_seconds: int,
    allowed_lateness_seconds: int,
) -> list[Decision]:
    """Classify records using a simplified whole-second watermark model."""
    maximum_event_time: int | None = None
    decisions: list[Decision] = []

    for event in events_in_arrival_order:
        watermark = (
            None
            if maximum_event_time is None
            else maximum_event_time - out_of_orderness_seconds
        )
        window_start = (event.event_time_seconds // window_size_seconds) * window_size_seconds
        window_end = window_start + window_size_seconds

        if watermark is None or watermark < window_end:
            outcome = Outcome.MAIN_RESULT
        elif watermark <= window_end + allowed_lateness_seconds:
            outcome = Outcome.LATE_UPDATE
        else:
            outcome = Outcome.TOO_LATE

        decisions.append(
            Decision(event, watermark, window_start, window_end, outcome)
        )
        maximum_event_time = max(
            event.event_time_seconds,
            maximum_event_time if maximum_event_time is not None else event.event_time_seconds,
        )

    return decisions


if __name__ == "__main__":
    trace = classify(
        [
            Event("reading-a", 2),
            Event("reading-b", 12),
            Event("delayed-reading-c", 8),
            Event("reading-d", 18),
            Event("very-late-reading-e", 9),
        ],
        window_size_seconds=10,
        out_of_orderness_seconds=2,
        allowed_lateness_seconds=5,
    )

    assert [decision.outcome for decision in trace] == [
        Outcome.MAIN_RESULT,
        Outcome.MAIN_RESULT,
        Outcome.LATE_UPDATE,
        Outcome.MAIN_RESULT,
        Outcome.TOO_LATE,
    ]

    for decision in trace:
        watermark = (
            "not emitted"
            if decision.watermark_before is None
            else f"t={decision.watermark_before}s"
        )
        print(
            f"{decision.event.name:22} event=t={decision.event.event_time_seconds:2}s "
            f"watermark={watermark:11} window=[{decision.window_start}, "
            f"{decision.window_end}) -> {decision.outcome.value}"
        )
