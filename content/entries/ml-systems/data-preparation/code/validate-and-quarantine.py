"""Validate records without silently discarding the evidence needed for repair."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class QuarantinedRecord:
    record_id: str
    reason_codes: tuple[str, ...]
    source: str


def validate(record: dict[str, Any]) -> tuple[str, ...]:
    reasons: list[str] = []

    if not record.get("record_id"):
        reasons.append("MISSING_RECORD_ID")
    if not record.get("customer_id"):
        reasons.append("MISSING_CUSTOMER_ID")

    amount = record.get("amount")
    if not isinstance(amount, (int, float)):
        reasons.append("INVALID_AMOUNT_TYPE")
    elif amount < 0:
        reasons.append("NEGATIVE_AMOUNT")

    event_time = record.get("event_time")
    try:
        datetime.fromisoformat(str(event_time).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        reasons.append("INVALID_EVENT_TIME")

    return tuple(reasons)


def prepare_batch(
    records: list[dict[str, Any]], source: str
) -> tuple[list[dict[str, Any]], list[QuarantinedRecord]]:
    prepared: list[dict[str, Any]] = []
    quarantined: list[QuarantinedRecord] = []

    for record in records:
        reasons = validate(record)
        if reasons:
            quarantined.append(
                QuarantinedRecord(
                    record_id=str(record.get("record_id", "unknown")),
                    reason_codes=reasons,
                    source=source,
                )
            )
            continue

        prepared.append(
            {
                "record_id": record["record_id"],
                "customer_id": record["customer_id"],
                "amount": float(record["amount"]),
                "event_time": record["event_time"],
            }
        )

    return prepared, quarantined


if __name__ == "__main__":
    sample = [
        {
            "record_id": "order-100",
            "customer_id": "customer-7",
            "amount": 42.5,
            "event_time": "2026-07-01T10:15:00Z",
        },
        {
            "record_id": "order-101",
            "customer_id": "customer-8",
            "amount": -3,
            "event_time": "2026-07-01T10:17:00Z",
        },
        {
            "record_id": "order-102",
            "customer_id": "",
            "amount": "unknown",
            "event_time": "not-a-time",
        },
    ]

    clean, rejected = prepare_batch(sample, source="orders-2026-07-01")
    assert len(clean) == 1
    assert len(rejected) == 2
    print({"prepared": len(clean), "quarantined": [asdict(item) for item in rejected]})
