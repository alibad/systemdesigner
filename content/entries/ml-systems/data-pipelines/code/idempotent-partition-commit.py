"""Small, dependency-free example of an idempotent partition commit."""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Iterable, Mapping


def canonical_json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def checksum(records: Iterable[Mapping[str, object]]) -> str:
    payload = "\n".join(canonical_json(record) for record in records)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def transform(records: Iterable[Mapping[str, object]]) -> list[dict[str, object]]:
    """Deduplicate by event_id and return a deterministic order."""
    by_id: dict[str, dict[str, object]] = {}
    for record in records:
        event_id = str(record["event_id"])
        by_id[event_id] = {
            "event_id": event_id,
            "account_id": str(record["account_id"]),
            "amount_cents": int(record["amount_cents"]),
        }
    return [by_id[event_id] for event_id in sorted(by_id)]


def commit_partition(
    raw_records: list[Mapping[str, object]],
    output_root: Path,
    logical_date: str,
    transform_version: str,
    schema_version: str,
) -> str:
    output_root.mkdir(parents=True, exist_ok=True)
    final_path = output_root / f"date={logical_date}.json"
    manifest_path = output_root / f"date={logical_date}.manifest.json"

    transformed = transform(raw_records)
    run_identity = {
        "logical_date": logical_date,
        "input_checksum": checksum(raw_records),
        "transform_version": transform_version,
        "schema_version": schema_version,
    }
    run_id = hashlib.sha256(canonical_json(run_identity).encode("utf-8")).hexdigest()[:16]

    if manifest_path.exists():
        previous = json.loads(manifest_path.read_text(encoding="utf-8"))
        if previous["run_id"] == run_id:
            return "no-op: identical logical run already committed"

    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=output_root,
        delete=False,
        prefix="candidate-",
    ) as candidate:
        candidate.write(canonical_json(transformed))
        candidate_path = Path(candidate.name)

    if len({record["event_id"] for record in transformed}) != len(transformed):
        candidate_path.unlink(missing_ok=True)
        raise ValueError("duplicate event_id survived transformation")

    os.replace(candidate_path, final_path)
    manifest = {
        **run_identity,
        "run_id": run_id,
        "output": final_path.name,
        "record_count": len(transformed),
        "output_checksum": checksum(transformed),
    }

    manifest_candidate = manifest_path.with_suffix(".candidate")
    manifest_candidate.write_text(canonical_json(manifest), encoding="utf-8")
    os.replace(manifest_candidate, manifest_path)
    return f"committed {len(transformed)} records as run {run_id}"


if __name__ == "__main__":
    events = [
        {"event_id": "e-2", "account_id": "a-7", "amount_cents": 900},
        {"event_id": "e-1", "account_id": "a-3", "amount_cents": 450},
        {"event_id": "e-2", "account_id": "a-7", "amount_cents": 900},
    ]
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        first = commit_partition(events, root, "2026-07-19", "normalize-v3", "purchase-v2")
        retry = commit_partition(events, root, "2026-07-19", "normalize-v3", "purchase-v2")
        print(first)
        print(retry)
