from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from typing import Iterable


@dataclass(frozen=True)
class Evidence:
    evidence_type: str
    model_digest: str
    content: bytes
    recorded_digest: str
    approved_by: str

    def is_intact(self) -> bool:
        return sha256(self.content).hexdigest() == self.recorded_digest


REQUIRED_BY_TIER = {
    "tier-1": {"quality", "security", "lineage"},
    "tier-2": {"quality", "security", "lineage", "impact", "subgroup"},
    "tier-3": {
        "quality",
        "security",
        "lineage",
        "impact",
        "subgroup",
        "human-oversight",
        "rollback-drill",
    },
}


def authorize_release(
    *, model_bytes: bytes, tier: str, evidence: Iterable[Evidence]
) -> tuple[bool, list[str]]:
    """Return an explainable release decision for one immutable model artifact."""
    if tier not in REQUIRED_BY_TIER:
        return False, [f"unknown governance tier: {tier}"]

    model_digest = sha256(model_bytes).hexdigest()
    accepted_types: set[str] = set()
    failures: list[str] = []

    for item in evidence:
        if item.model_digest != model_digest:
            failures.append(f"{item.evidence_type}: evaluated a different model digest")
        elif not item.is_intact():
            failures.append(f"{item.evidence_type}: evidence digest does not match")
        elif not item.approved_by.strip():
            failures.append(f"{item.evidence_type}: accountable reviewer is missing")
        else:
            accepted_types.add(item.evidence_type)

    missing = REQUIRED_BY_TIER[tier] - accepted_types
    failures.extend(f"missing required evidence: {item}" for item in sorted(missing))
    return len(failures) == 0, failures


# In production, resolve model and evidence digests from trusted artifact stores,
# build attestations, and review systems rather than accepting caller-supplied bytes.
