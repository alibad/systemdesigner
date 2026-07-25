from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from hmac import compare_digest
from typing import Mapping


@dataclass(frozen=True)
class EvidenceContract:
    requested_shots: int
    maximum_calibration_age_minutes: int
    circuit_hash: str
    backend_id: str


@dataclass(frozen=True)
class ExecutionManifest:
    provider_job_id: str
    circuit_hash: str
    backend_id: str
    compiler_version: str
    calibration_id: str
    calibration_recorded_at: datetime
    requested_shots: int
    completed_shots: int
    result_digest: str


class EvidenceRejected(ValueError):
    pass


def canonical_counts(counts: Mapping[str, int]) -> bytes:
    rows = [f"{state}:{counts[state]}" for state in sorted(counts)]
    return "\n".join(rows).encode("utf-8")


def verify_execution_evidence(
    contract: EvidenceContract,
    manifest: ExecutionManifest,
    counts: Mapping[str, int],
    *,
    now: datetime | None = None,
) -> None:
    observed_at = now or datetime.now(UTC)
    calibration_age = observed_at - manifest.calibration_recorded_at
    completed_from_counts = sum(counts.values())
    observed_digest = sha256(canonical_counts(counts)).hexdigest()

    checks = {
        "circuit hash changed": manifest.circuit_hash != contract.circuit_hash,
        "wrong backend returned the result": manifest.backend_id != contract.backend_id,
        "requested shot count changed": (
            manifest.requested_shots != contract.requested_shots
        ),
        "provider reported a partial result": (
            manifest.completed_shots != contract.requested_shots
        ),
        "histogram does not match completed shots": (
            completed_from_counts != manifest.completed_shots
        ),
        "calibration evidence is too old": (
            calibration_age.total_seconds()
            > contract.maximum_calibration_age_minutes * 60
        ),
        "result digest does not match": not compare_digest(
            observed_digest,
            manifest.result_digest,
        ),
    }

    failures = [message for message, failed in checks.items() if failed]
    if failures:
        raise EvidenceRejected("; ".join(failures))

    if not manifest.provider_job_id or not manifest.compiler_version:
        raise EvidenceRejected("provider job and compiler identity are required")
