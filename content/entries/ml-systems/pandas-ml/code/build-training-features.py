from __future__ import annotations

import pandas as pd


def build_training_features(
    events: pd.DataFrame,
    cutoff: pd.Timestamp,
) -> pd.DataFrame:
    required = {"customer_id", "event_time", "amount"}
    missing = required.difference(events.columns)
    if missing:
        raise ValueError(f"missing columns: {sorted(missing)}")

    frame = events.loc[:, sorted(required)].copy()
    frame["event_time"] = pd.to_datetime(
        frame["event_time"],
        utc=True,
        errors="raise",
    )
    frame = frame.loc[frame["event_time"] < cutoff]
    frame = frame.sort_values(["customer_id", "event_time"])

    frame["previous_amount"] = frame.groupby(
        "customer_id",
        sort=False,
    )["amount"].shift(1)
    frame["past_7d_average"] = (
        frame.set_index("event_time")
        .groupby("customer_id")["amount"]
        .rolling("7D", closed="left", min_periods=1)
        .mean()
        .reset_index(level=0, drop=True)
        .reindex(frame["event_time"])
        .to_numpy()
    )

    return frame.loc[
        :,
        ["customer_id", "event_time", "previous_amount", "past_7d_average"],
    ]
