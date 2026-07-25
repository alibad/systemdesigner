#!/usr/bin/env python3
"""Reproduce the lesson's ORC stripe and row-group pruning arithmetic."""

from __future__ import annotations

import json
from pathlib import Path


MODEL_PATH = Path(__file__).parents[1] / "data" / "scan-pruning-model.json"


def overlaps(minimum: int, maximum: int, query_range: list[int] | None) -> bool:
    if query_range is None:
        return True
    return maximum >= query_range[0] and minimum <= query_range[1]


def main() -> None:
    model = json.loads(MODEL_PATH.read_text(encoding="utf-8"))
    layout = next(
        item for item in model["layouts"] if item["id"] == "event-day-clustered"
    )
    query = next(
        item for item in model["queries"] if item["id"] == "regional-revenue"
    )
    projected = {
        item["id"]: item["compressedMiBPerRowGroup"]
        for item in model["columns"]
        if item["id"] in query["selectedColumnIds"]
    }

    candidate_stripes = []
    candidate_groups = []
    for stripe in layout["stripes"]:
        stripe_min = min(group["minEventDay"] for group in stripe["rowGroups"])
        stripe_max = max(group["maxEventDay"] for group in stripe["rowGroups"])
        if not overlaps(stripe_min, stripe_max, query["eventDayRange"]):
            continue
        candidate_stripes.append(stripe["id"])
        candidate_groups.extend(
            group["id"]
            for group in stripe["rowGroups"]
            if overlaps(
                group["minEventDay"],
                group["maxEventDay"],
                query["eventDayRange"],
            )
        )

    projected_mib_per_group = sum(projected.values())
    data_mib = len(candidate_groups) * projected_mib_per_group

    print(f"projected_columns={','.join(projected)}")
    print(f"candidate_stripes={candidate_stripes}")
    print(f"candidate_row_groups={candidate_groups}")
    print(f"modeled_projected_data_mib={data_mib:.2f}")
    print("note=min/max overlap keeps a group as a candidate; rows still need filtering")


if __name__ == "__main__":
    main()
