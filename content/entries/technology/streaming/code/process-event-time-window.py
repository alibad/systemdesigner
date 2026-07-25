"""Close an event-time window while making lateness and replay explicit."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Event:
    event_id: str
    event_time_seconds: int
    arrival_time_seconds: int
    amount: int


def close_window(
    events: list[Event], *, window_end: int, allowed_lateness: int
) -> tuple[int, list[Event]]:
    watermark = window_end + allowed_lateness
    accepted_by_id: dict[str, Event] = {}
    late: list[Event] = []

    for event in events:
        if event.event_time_seconds >= window_end:
            continue
        if event.arrival_time_seconds > watermark:
            late.append(event)
            continue
        # A replay with the same immutable event ID updates the same logical fact.
        accepted_by_id[event.event_id] = event

    return sum(event.amount for event in accepted_by_id.values()), late


events = [
    Event("evt-1", event_time_seconds=42, arrival_time_seconds=48, amount=30),
    Event("evt-2", event_time_seconds=51, arrival_time_seconds=72, amount=45),
    Event("evt-2", event_time_seconds=51, arrival_time_seconds=73, amount=45),
    Event("evt-3", event_time_seconds=55, arrival_time_seconds=105, amount=25),
]

total, late_events = close_window(events, window_end=60, allowed_lateness=25)
assert total == 75
assert [event.event_id for event in late_events] == ["evt-3"]
print({"window_total": total, "late_event_ids": [event.event_id for event in late_events]})
