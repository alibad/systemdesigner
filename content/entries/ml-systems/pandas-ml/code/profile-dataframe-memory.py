from __future__ import annotations

import pandas as pd


def profile_frame(frame: pd.DataFrame) -> pd.DataFrame:
    memory = frame.memory_usage(index=True, deep=True)
    return (
        memory.rename("bytes")
        .to_frame()
        .assign(
            mebibytes=lambda table: table["bytes"] / 1024**2,
            dtype=lambda table: [
                str(frame[column].dtype) if column in frame else "index"
                for column in table.index
            ],
        )
        .sort_values("bytes", ascending=False)
    )


events = pd.read_parquet(
    "events.parquet",
    columns=["customer_id", "event_time", "amount", "country"],
)
events["country"] = events["country"].astype("category")

print(profile_frame(events))
