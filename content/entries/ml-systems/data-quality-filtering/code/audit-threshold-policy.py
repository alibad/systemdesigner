"""Audit a score threshold by slice using human-reviewed labels."""

from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class ReviewedRecord:
    record_id: str
    slice_id: str
    quality_score: float
    human_eligible: bool


@dataclass(frozen=True)
class SliceAudit:
    slice_id: str
    reviewed_records: int
    false_rejection_rate: float
    leakage_rate: float
    release_ready: bool


def safe_ratio(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0


def audit_threshold(
    records: Iterable[ReviewedRecord],
    threshold: float,
    *,
    minimum_reviewed_records: int = 100,
    maximum_false_rejection_rate: float = 0.15,
    maximum_leakage_rate: float = 0.10,
) -> list[SliceAudit]:
    """Evaluate coverage loss and policy leakage separately for every slice."""
    by_slice: dict[str, list[ReviewedRecord]] = defaultdict(list)
    for record in records:
        by_slice[record.slice_id].append(record)

    audits: list[SliceAudit] = []
    for slice_id, reviewed in sorted(by_slice.items()):
        accepted = [record for record in reviewed if record.quality_score >= threshold]
        rejected = [record for record in reviewed if record.quality_score < threshold]

        eligible = sum(record.human_eligible for record in reviewed)
        false_rejections = sum(record.human_eligible for record in rejected)
        leaked = sum(not record.human_eligible for record in accepted)

        false_rejection_rate = safe_ratio(false_rejections, eligible)
        leakage_rate = safe_ratio(leaked, len(accepted))
        release_ready = (
            len(reviewed) >= minimum_reviewed_records
            and false_rejection_rate <= maximum_false_rejection_rate
            and leakage_rate <= maximum_leakage_rate
        )
        audits.append(
            SliceAudit(
                slice_id=slice_id,
                reviewed_records=len(reviewed),
                false_rejection_rate=false_rejection_rate,
                leakage_rate=leakage_rate,
                release_ready=release_ready,
            )
        )

    return audits
