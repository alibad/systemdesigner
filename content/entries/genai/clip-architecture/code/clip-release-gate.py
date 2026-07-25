"""Gate a CLIP release with exact artifact checks and use-specific evidence."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


UseCase = Literal["retrieval", "zero-shot"]


@dataclass(frozen=True)
class ArtifactEvidence:
    checkpoint_sha256: str
    processor_fixture_match: bool
    tokenizer_fixture_match: bool
    normalized_embeddings: bool
    embedding_dimension: int
    expected_dimension: int
    index_manifest_matches: bool
    prompt_bank_validated: bool
    rollback_loaded: bool


@dataclass(frozen=True)
class QualityEvidence:
    retrieval_recall_at_10: float
    zero_shot_accuracy: float
    expected_calibration_error: float
    worst_slice_delta_points: float
    p95_latency_ms: float


@dataclass(frozen=True)
class ReleasePolicy:
    minimum_recall_at_10: float
    minimum_zero_shot_accuracy: float
    maximum_calibration_error: float
    minimum_worst_slice_delta: float
    maximum_p95_latency_ms: float


@dataclass(frozen=True)
class GateResult:
    approved_for_canary: bool
    failed_checks: tuple[str, ...]


def assess_release(
    use_case: UseCase,
    artifacts: ArtifactEvidence,
    quality: QualityEvidence,
    policy: ReleasePolicy,
) -> GateResult:
    failures: list[str] = []

    if len(artifacts.checkpoint_sha256) != 64:
        failures.append("checkpoint fingerprint is not a SHA-256 digest")
    if not artifacts.processor_fixture_match:
        failures.append("image preprocessing fixtures changed")
    if not artifacts.tokenizer_fixture_match:
        failures.append("text tokenization fixtures changed")
    if not artifacts.normalized_embeddings:
        failures.append("output vectors are not L2-normalized")
    if artifacts.embedding_dimension != artifacts.expected_dimension:
        failures.append("embedding dimension differs from the manifest")
    if not artifacts.rollback_loaded:
        failures.append("previous complete manifest is not loaded")
    if quality.worst_slice_delta_points < policy.minimum_worst_slice_delta:
        failures.append("a protected slice exceeds the regression budget")
    if quality.p95_latency_ms > policy.maximum_p95_latency_ms:
        failures.append("p95 latency exceeds the serving budget")

    if use_case == "retrieval":
        if not artifacts.index_manifest_matches:
            failures.append("catalog index was built with another image manifest")
        if quality.retrieval_recall_at_10 < policy.minimum_recall_at_10:
            failures.append("retrieval Recall@10 is below the release threshold")
    else:
        if not artifacts.prompt_bank_validated:
            failures.append("zero-shot prompt bank is not validated")
        if quality.zero_shot_accuracy < policy.minimum_zero_shot_accuracy:
            failures.append("zero-shot accuracy is below the release threshold")
        if quality.expected_calibration_error > policy.maximum_calibration_error:
            failures.append("calibration error exceeds the release threshold")

    return GateResult(
        approved_for_canary=not failures,
        failed_checks=tuple(failures),
    )
