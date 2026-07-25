"""Evaluate optimistic append and compaction retries using file-set invariants."""

from __future__ import annotations

import json
import sys
from pathlib import Path


MODEL_PATH = Path(__file__).parents[1] / "data" / "optimistic-commit-model.json"


def load_model() -> dict:
    return json.loads(MODEL_PATH.read_text(encoding="utf-8"))


def evaluate(operation_id: str, conflict_id: str) -> dict:
    model = load_model()
    operation = next(item for item in model["operations"] if item["id"] == operation_id)
    conflict = next(item for item in model["conflicts"] if item["id"] == conflict_id)

    current_files = set(model["baseSnapshot"]["files"])
    current_files.difference_update(conflict["removesFiles"])
    current_files.update(conflict["addsFiles"])

    missing_sources = sorted(set(operation["requiredFiles"]) - current_files)
    if missing_sources:
        return {
            "status": "replan-required",
            "missingRequiredFiles": missing_sources,
            "currentFiles": sorted(current_files),
            "uncommittedArtifacts": operation["producedFiles"],
        }

    final_files = current_files - set(operation["removesFiles"])
    final_files.update(operation["producedFiles"])
    return {
        "status": "retry-committed",
        "missingRequiredFiles": [],
        "currentFiles": sorted(current_files),
        "finalFiles": sorted(final_files),
        "reusedArtifacts": operation["producedFiles"],
    }


if __name__ == "__main__":
    chosen_operation = sys.argv[1] if len(sys.argv) > 1 else "compact-a-b"
    chosen_conflict = sys.argv[2] if len(sys.argv) > 2 else "overlapping-rewrite"
    print(json.dumps(evaluate(chosen_operation, chosen_conflict), indent=2))
