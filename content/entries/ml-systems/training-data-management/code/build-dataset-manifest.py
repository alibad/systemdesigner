#!/usr/bin/env python3
"""Build a deterministic manifest for the co-located sample training records."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = SCRIPT_DIR.parent / "data" / "sample-training-records.json"
REQUIRED_FIELDS = {"example_id", "event_time", "feature_value", "label", "split"}


def canonical_json(value: Any) -> bytes:
    """Serialize JSON consistently so the same evidence produces the same digest."""
    return json.dumps(
        value,
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def load_records(path: Path) -> list[dict[str, Any]]:
    records = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(records, list) or not records:
        raise ValueError("The training record file must contain a non-empty JSON array.")

    identifiers: set[str] = set()
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            raise ValueError(f"Record {index} is not an object.")
        missing = REQUIRED_FIELDS.difference(record)
        if missing:
            raise ValueError(f"Record {index} is missing: {sorted(missing)}")
        identifier = str(record["example_id"])
        if identifier in identifiers:
            raise ValueError(f"Duplicate example_id: {identifier}")
        identifiers.add(identifier)

    return sorted(records, key=lambda record: str(record["example_id"]))


def build_manifest(records: list[dict[str, Any]]) -> dict[str, Any]:
    source_digest = hashlib.sha256(canonical_json(records)).hexdigest()
    labels = Counter(str(record["label"]) for record in records)
    splits = Counter(str(record["split"]) for record in records)
    event_times = sorted(str(record["event_time"]) for record in records)

    evidence = {
        "source": {
            "uri": "sample-training-records.json",
            "sha256": source_digest,
        },
        "transformation": {
            "gitCommit": "8b31f2a",
            "entrypoint": "build_examples.py",
            "containerDigest": "sha256:training-example-image",
        },
        "labels": {
            "batch": "label-batch-2026-07-15",
            "rubricVersion": "support-intent-v3",
        },
        "splitPolicy": {
            "strategy": "stable-hash-by-account",
            "seed": 41,
        },
        "statistics": {
            "rowCount": len(records),
            "labelCounts": dict(sorted(labels.items())),
            "splitCounts": dict(sorted(splits.items())),
            "eventTimeRange": [event_times[0], event_times[-1]],
        },
    }
    manifest_digest = hashlib.sha256(canonical_json(evidence)).hexdigest()

    return {
        "schemaVersion": 1,
        "datasetId": f"support-intent-{manifest_digest[:12]}",
        "manifestSha256": manifest_digest,
        **evidence,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data_file", nargs="?", type=Path, default=DEFAULT_INPUT)
    args = parser.parse_args()

    manifest = build_manifest(load_records(args.data_file))
    print(json.dumps(manifest, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
