"""Replay an extraction candidate without overwriting accepted history."""

from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class FieldEvidence:
    raw_value: str
    normalized_value: str
    page: int
    span: tuple[int, int]
    polygon: tuple[float, ...]
    confidence: float


@dataclass(frozen=True)
class ExtractionVersion:
    version_id: str
    source_hash: str
    processor_version: str
    schema_version: str
    policy_version: str
    fields: Mapping[str, FieldEvidence]


@dataclass(frozen=True)
class FieldDiff:
    field: str
    accepted_value: str | None
    candidate_value: str | None
    source_anchor_changed: bool


def diff_versions(
    accepted: ExtractionVersion,
    candidate: ExtractionVersion,
) -> tuple[FieldDiff, ...]:
    if accepted.source_hash != candidate.source_hash:
        raise ValueError("Cannot compare extraction versions from different source bytes")

    names = sorted(set(accepted.fields) | set(candidate.fields))
    changes: list[FieldDiff] = []
    for name in names:
        old = accepted.fields.get(name)
        new = candidate.fields.get(name)
        old_anchor = None if old is None else (old.page, old.span, old.polygon)
        new_anchor = None if new is None else (new.page, new.span, new.polygon)
        old_value = None if old is None else old.normalized_value
        new_value = None if new is None else new.normalized_value
        if old_value != new_value or old_anchor != new_anchor:
            changes.append(
                FieldDiff(
                    field=name,
                    accepted_value=old_value,
                    candidate_value=new_value,
                    source_anchor_changed=old_anchor != new_anchor,
                )
            )
    return tuple(changes)


SOURCE_HASH = "sha256:7be1...4a90"

accepted_v12 = ExtractionVersion(
    version_id="accepted-v12",
    source_hash=SOURCE_HASH,
    processor_version="invoice-parser-2026-02",
    schema_version="invoice-schema-5",
    policy_version="payment-policy-9",
    fields={
        "invoice.total": FieldEvidence(
            raw_value="$1,250.00",
            normalized_value="1250.00 USD",
            page=2,
            span=(1840, 1849),
            polygon=(0.72, 0.84, 0.91, 0.84, 0.91, 0.88, 0.72, 0.88),
            confidence=0.97,
        )
    },
)

candidate_v13 = ExtractionVersion(
    version_id="candidate-v13",
    source_hash=SOURCE_HASH,
    processor_version="invoice-parser-2026-06",
    schema_version="invoice-schema-5",
    policy_version="payment-policy-9",
    fields={
        "invoice.total": FieldEvidence(
            raw_value="$1,280.00",
            normalized_value="1280.00 USD",
            page=2,
            span=(1840, 1849),
            polygon=(0.72, 0.84, 0.91, 0.84, 0.91, 0.88, 0.72, 0.88),
            confidence=0.96,
        )
    },
)


if __name__ == "__main__":
    changes = diff_versions(accepted_v12, candidate_v13)

    assert accepted_v12.fields["invoice.total"].normalized_value == "1250.00 USD"
    assert len(changes) == 1
    assert changes[0].candidate_value == "1280.00 USD"
    assert changes[0].source_anchor_changed is False

    print(f"accepted remains {accepted_v12.version_id}")
    for change in changes:
        print(
            f"{change.field}: {change.accepted_value} -> {change.candidate_value}; "
            f"anchor_changed={change.source_anchor_changed}"
        )
