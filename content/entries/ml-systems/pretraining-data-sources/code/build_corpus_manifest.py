"""Build an immutable manifest for one curated corpus release.

The example keeps the contract small: every accepted document points back to a
registered source snapshot and records the curation decisions that produced it.
"""

from dataclasses import asdict, dataclass
from hashlib import sha256
import json
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class SourceSnapshot:
    source_id: str
    retrieved_at: str
    permission_basis: str
    retention_policy: str
    object_uri: str
    object_sha256: str


@dataclass(frozen=True)
class CuratedDocument:
    document_id: str
    source_id: str
    language: str
    token_count: int
    content_sha256: str
    filter_version: str
    dedup_cluster_id: str
    decision_reasons: tuple[str, ...]


def digest_file(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_manifest(
    release_id: str,
    sources: Iterable[SourceSnapshot],
    documents: Iterable[CuratedDocument],
    output_path: Path,
) -> None:
    source_rows = sorted((asdict(item) for item in sources), key=lambda row: row["source_id"])
    document_rows = sorted(
        (asdict(item) for item in documents),
        key=lambda row: row["document_id"],
    )
    known_sources = {row["source_id"] for row in source_rows}

    missing = {
        row["source_id"]
        for row in document_rows
        if row["source_id"] not in known_sources
    }
    if missing:
        raise ValueError(f"documents reference unknown sources: {sorted(missing)}")

    manifest = {
        "schema_version": 1,
        "release_id": release_id,
        "sources": source_rows,
        "documents": document_rows,
        "statistics": {
            "document_count": len(document_rows),
            "token_count": sum(row["token_count"] for row in document_rows),
            "languages": sorted({row["language"] for row in document_rows}),
        },
    }
    canonical = json.dumps(manifest, sort_keys=True, separators=(",", ":"))
    envelope = {
        "manifest_sha256": sha256(canonical.encode("utf-8")).hexdigest(),
        "manifest": manifest,
    }
    output_path.write_text(json.dumps(envelope, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    snapshot_path = Path("snapshot.wet.gz")
    source = SourceSnapshot(
        source_id="common-crawl-2026-25-segment-001",
        retrieved_at="2026-07-20T09:00:00Z",
        permission_basis="review-required",
        retention_policy="quarantine-90-days",
        object_uri=f"s3://corpus-landing/{snapshot_path.name}",
        object_sha256=digest_file(snapshot_path),
    )
    document = CuratedDocument(
        document_id="doc-8b39",
        source_id=source.source_id,
        language="en",
        token_count=742,
        content_sha256=sha256(b"normalized document").hexdigest(),
        filter_version="quality-v12",
        dedup_cluster_id="cluster-91",
        decision_reasons=("language:en", "quality:accepted", "pii:none"),
    )
    write_manifest("corpus-2026-07-24", [source], [document], Path("manifest.json"))
