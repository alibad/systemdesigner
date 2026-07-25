from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from hashlib import sha256
from typing import Any


class Modality(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"


@dataclass(frozen=True)
class MediaInput:
    source_id: str
    modality: Modality
    content_type: str
    byte_length: int
    checksum: str
    retention_class: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class EvidenceClaim:
    field: str
    value: Any
    source_ids: tuple[str, ...]
    transformations: tuple[str, ...]
    confidence: float | None
    status: str  # observed, inferred, conflicting, or missing


@dataclass(frozen=True)
class MultimodalRequest:
    request_id: str
    task: str
    inputs: tuple[MediaInput, ...]
    latency_budget_ms: int
    allow_partial: bool = False


TASK_REQUIRED_MODALITIES = {
    "invoice_validation": {Modality.TEXT, Modality.IMAGE},
    "meeting_summary": {Modality.TEXT, Modality.AUDIO},
    "safety_video_review": {Modality.VIDEO},
}

MAX_BYTES = {
    Modality.TEXT: 1_000_000,
    Modality.IMAGE: 20_000_000,
    Modality.AUDIO: 200_000_000,
    Modality.VIDEO: 1_000_000_000,
}


def validate_request(request: MultimodalRequest) -> list[str]:
    errors: list[str] = []
    present = {item.modality for item in request.inputs}
    required = TASK_REQUIRED_MODALITIES.get(request.task, set())

    missing = required - present
    if missing and not request.allow_partial:
        errors.append(f"missing required modalities: {sorted(item.value for item in missing)}")

    if request.latency_budget_ms < 100:
        errors.append("latency budget is below the supported minimum")

    seen_ids: set[str] = set()
    for item in request.inputs:
        if item.source_id in seen_ids:
            errors.append(f"duplicate source_id: {item.source_id}")
        seen_ids.add(item.source_id)

        if item.byte_length > MAX_BYTES[item.modality]:
            errors.append(f"{item.source_id} exceeds the {item.modality.value} byte limit")
        if item.retention_class not in {"ephemeral", "audited", "regulated"}:
            errors.append(f"{item.source_id} has an unknown retention class")

    return errors


def source_from_bytes(
    source_id: str,
    modality: Modality,
    content_type: str,
    payload: bytes,
    retention_class: str = "ephemeral",
) -> MediaInput:
    return MediaInput(
        source_id=source_id,
        modality=modality,
        content_type=content_type,
        byte_length=len(payload),
        checksum=sha256(payload).hexdigest(),
        retention_class=retention_class,
    )


def release_gate(claim: EvidenceClaim, high_impact: bool) -> str:
    if claim.status in {"conflicting", "missing"}:
        return "needs_review"
    if high_impact and len(claim.source_ids) < 2:
        return "needs_review"
    if claim.confidence is not None and claim.confidence < 0.90:
        return "needs_review"
    return "completed"


# Model adapters should return EvidenceClaim objects. Authorization and state
# changes remain outside the adapter so a generated value is never an action.
