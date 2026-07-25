"""Fail-closed validation for extracted invoice fields."""

from dataclasses import dataclass
from decimal import Decimal
from enum import Enum


class Decision(str, Enum):
    ACCEPT = "accept"
    REVIEW = "review"
    BLOCK = "block"


@dataclass(frozen=True)
class Candidate:
    name: str
    value: str
    confidence: float
    format_valid: bool
    reconciliation_valid: bool
    source_region_id: str


def gate(candidate: Candidate, confidence_floor: float = 0.90) -> Decision:
    if not candidate.source_region_id:
        return Decision.BLOCK
    if not candidate.format_valid or not candidate.reconciliation_valid:
        return Decision.BLOCK
    if candidate.confidence < confidence_floor:
        return Decision.REVIEW
    return Decision.ACCEPT


line_items = [Decimal("2400.00"), Decimal("4030.00")]
extracted_total = Decimal("8430.00")
candidate = Candidate(
    name="invoice_total",
    value=str(extracted_total),
    confidence=0.94,
    format_valid=True,
    reconciliation_valid=extracted_total == sum(line_items),
    source_region_id="page-1:total-box",
)

assert gate(candidate) is Decision.BLOCK
print(f"{candidate.name}: {gate(candidate).value}")
