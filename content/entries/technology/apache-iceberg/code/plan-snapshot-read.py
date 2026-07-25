"""Trace the exact manifest and data-file plan in the lesson fixture."""

from __future__ import annotations

import json
import sys
from pathlib import Path


MODEL_PATH = Path(__file__).parents[1] / "data" / "snapshot-scan-model.json"


def load_model() -> dict:
    return json.loads(MODEL_PATH.read_text(encoding="utf-8"))


def plan(snapshot_id: str, query_id: str) -> dict:
    model = load_model()
    snapshots = {item["id"]: item for item in model["snapshots"]}
    queries = {item["id"]: item for item in model["queries"]}
    manifests = {item["id"]: item for item in model["manifests"]}

    snapshot = snapshots[snapshot_id]
    query = queries[query_id]
    selected = query["plans"][snapshot_id]
    selected_manifest_ids = set(selected["selectedManifestIds"])
    selected_file_ids = set(selected["selectedFileIds"])

    manifest_plan = []
    for manifest_id in snapshot["manifestIds"]:
        manifest = manifests[manifest_id]
        manifest_plan.append(
            {
                "manifest": manifest_id,
                "specId": manifest["specId"],
                "selected": manifest_id in selected_manifest_ids,
                "selectedFiles": [
                    file_id
                    for file_id in manifest["fileIds"]
                    if file_id in selected_file_ids
                ],
            }
        )

    return {
        "snapshot": snapshot_id,
        "predicate": query["predicate"],
        "manifestPlan": manifest_plan,
        "reasoning": selected["reasoning"],
    }


if __name__ == "__main__":
    chosen_snapshot = sys.argv[1] if len(sys.argv) > 1 else "after-evolution"
    chosen_query = sys.argv[2] if len(sys.argv) > 2 else "eu-history"
    print(json.dumps(plan(chosen_snapshot, chosen_query), indent=2))
