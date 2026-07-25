"""Join the newest feature row that was available at prediction time.

Run with: python point-in-time-join.py
"""

from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass(frozen=True)
class FeatureRow:
    entity_id: str
    event_time: datetime
    available_time: datetime
    value: int


def point_in_time_value(
    rows: list[FeatureRow],
    entity_id: str,
    prediction_time: datetime,
    ttl: timedelta,
) -> FeatureRow | None:
    eligible = [
        row
        for row in rows
        if row.entity_id == entity_id
        and row.event_time <= prediction_time
        and row.available_time <= prediction_time
        and prediction_time - row.event_time <= ttl
    ]
    return max(eligible, key=lambda row: row.event_time, default=None)


prediction_time = datetime.fromisoformat("2026-07-19T10:00:00")
rows = [
    FeatureRow(
        "acct-7",
        datetime.fromisoformat("2026-07-19T08:30:00"),
        datetime.fromisoformat("2026-07-19T08:32:00"),
        2,
    ),
    FeatureRow(
        "acct-7",
        datetime.fromisoformat("2026-07-19T09:20:00"),
        datetime.fromisoformat("2026-07-19T10:20:00"),
        5,
    ),
    FeatureRow(
        "acct-7",
        datetime.fromisoformat("2026-07-19T10:15:00"),
        datetime.fromisoformat("2026-07-19T10:16:00"),
        9,
    ),
]

joined = point_in_time_value(rows, "acct-7", prediction_time, timedelta(hours=3))
assert joined is not None and joined.value == 2
print(f"joined value={joined.value} from event={joined.event_time:%H:%M}")
