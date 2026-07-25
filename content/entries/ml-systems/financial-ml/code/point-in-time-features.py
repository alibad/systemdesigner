"""Build a point-in-time feature row and separated temporal folds."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass(frozen=True)
class FeatureValue:
    name: str
    value: float
    event_time: datetime
    available_time: datetime


def point_in_time_row(
    values: list[FeatureValue], decision_time: datetime
) -> dict[str, float]:
    """Keep only the newest value per feature available by the decision."""
    eligible = [value for value in values if value.available_time <= decision_time]
    eligible.sort(key=lambda value: (value.name, value.event_time, value.available_time))

    row: dict[str, float] = {}
    for value in eligible:
        row[value.name] = value.value
    return row


def separated_folds(
    start: datetime,
    train_days: int,
    test_days: int,
    gap_days: int,
    count: int,
) -> list[tuple[datetime, datetime, datetime, datetime]]:
    """Create expanding walk-forward folds with an explicit train-test gap."""
    folds = []
    for index in range(count):
        train_start = start
        train_end = start + timedelta(days=train_days + index * test_days)
        test_start = train_end + timedelta(days=gap_days)
        test_end = test_start + timedelta(days=test_days)
        folds.append((train_start, train_end, test_start, test_end))
    return folds


if __name__ == "__main__":
    utc = timezone.utc
    decision = datetime(2026, 6, 1, 12, tzinfo=utc)
    values = [
        FeatureValue("velocity_1h", 4.0, decision, decision),
        FeatureValue(
            "merchant_risk",
            0.31,
            decision - timedelta(hours=2),
            decision - timedelta(hours=1),
        ),
        FeatureValue(
            "merchant_risk",
            0.88,
            decision - timedelta(hours=2),
            decision + timedelta(hours=3),
        ),
        FeatureValue(
            "chargeback",
            1.0,
            decision + timedelta(days=18),
            decision + timedelta(days=18),
        ),
    ]

    row = point_in_time_row(values, decision)
    assert row == {"merchant_risk": 0.31, "velocity_1h": 4.0}

    folds = separated_folds(
        start=datetime(2025, 1, 1, tzinfo=utc),
        train_days=180,
        test_days=30,
        gap_days=30,
        count=3,
    )
    assert all(test_start - train_end == timedelta(days=30) for _, train_end, test_start, _ in folds)
    print({"feature_row": row, "fold_count": len(folds), "gap_days": 30})
