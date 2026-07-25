from datetime import timedelta

import pandas as pd


def purchases_last_30_days(events: pd.DataFrame, prediction_time: pd.Timestamp, user_id: str) -> int:
    """Use event_time, not ingestion_time, to avoid future leakage."""
    start = prediction_time - timedelta(days=30)
    eligible = events.loc[
        (events["user_id"] == user_id)
        & (events["event_time"] >= start)
        & (events["event_time"] < prediction_time)
        & events["event_id"].notna()
    ]

    # Idempotent event IDs make a replay produce the same aggregate.
    return eligible.drop_duplicates(subset="event_id")["purchase_id"].nunique()


FEATURE_VERSION = "purchases_last_30_days:v3"
