"""Dependency-free simulation of event-time windows and allowed lateness."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Event:
    event_id: str
    event_minute: int
    arrival_minute: int


def window_end(event_minute: int, window_size: int) -> int:
    return ((event_minute // window_size) + 1) * window_size


def process(
    events: list[Event],
    window_size: int = 5,
    out_of_order_bound: int = 2,
    allowed_lateness: int = 4,
) -> dict[int, int]:
    counts: dict[int, int] = {}
    maximum_event_time = -1

    for event in sorted(events, key=lambda item: item.arrival_minute):
        current_watermark = maximum_event_time - out_of_order_bound
        end = window_end(event.event_minute, window_size)
        too_late = current_watermark > end + allowed_lateness

        status = "dropped after lateness boundary" if too_late else "accepted"
        print(
            f"arrival={event.arrival_minute:02d}m "
            f"event={event.event_minute:02d}m "
            f"watermark={current_watermark:02d}m "
            f"window=[{end - window_size:02d},{end:02d}) {status}"
        )

        if not too_late:
            counts[end] = counts.get(end, 0) + 1

        maximum_event_time = max(maximum_event_time, event.event_minute)

    return counts


if __name__ == "__main__":
    sample = [
        Event("on-time-a", event_minute=1, arrival_minute=1),
        Event("on-time-b", event_minute=7, arrival_minute=7),
        Event("late-but-accepted", event_minute=3, arrival_minute=8),
        Event("advances-progress", event_minute=16, arrival_minute=16),
        Event("too-late", event_minute=2, arrival_minute=17),
    ]
    print("final window counts:", process(sample))
