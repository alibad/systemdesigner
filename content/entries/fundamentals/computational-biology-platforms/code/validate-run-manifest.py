import hashlib
import json
from pathlib import Path
from typing import Any


REPLAY_FIELDS = (
    "workflow_revision",
    "container_digest",
    "reference_digest",
    "parameters",
    "inputs",
    "outputs",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def require_digest(value: Any, field: str) -> None:
    if not isinstance(value, str) or not value.startswith("sha256:"):
        raise ValueError(f"{field} must be a sha256 content digest")


def validate_manifest(manifest: dict[str, Any], root: Path) -> None:
    missing = [field for field in REPLAY_FIELDS if field not in manifest]
    if missing:
        raise ValueError(f"manifest is missing replay fields: {', '.join(missing)}")
    require_digest(manifest["container_digest"], "container_digest")
    require_digest(manifest["reference_digest"], "reference_digest")

    for collection in ("inputs", "outputs"):
        records = manifest[collection]
        if not isinstance(records, list) or not records:
            raise ValueError(f"{collection} must be a non-empty list")
        for record in records:
            relative_path = Path(record["path"])
            if relative_path.is_absolute() or ".." in relative_path.parts:
                raise ValueError(f"unsafe manifest path: {relative_path}")
            expected = record["sha256"]
            require_digest(expected, f"{collection}.{relative_path}.sha256")
            actual = sha256(root / relative_path)
            if actual != expected:
                raise ValueError(
                    f"content drift for {relative_path}: expected {expected}, got {actual}"
                )


manifest_path = Path("run-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
validate_manifest(manifest, manifest_path.parent)
print("manifest fields and local object digests are valid")
