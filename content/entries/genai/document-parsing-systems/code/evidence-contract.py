"""Minimal evidence contract for a parsed field.

The example uses only the Python standard library so the invariant is visible without
binding the lesson to one parser SDK. Adapter code should map parser output into this
contract before business validation.
"""

from dataclasses import dataclass
from hashlib import sha256
from typing import Tuple


@dataclass(frozen=True)
class Box:
    x0: float
    y0: float
    x1: float
    y1: float

    def is_inside_page(self, width: float, height: float) -> bool:
        return (
            0 <= self.x0 < self.x1 <= width
            and 0 <= self.y0 < self.y1 <= height
        )


@dataclass(frozen=True)
class FieldEvidence:
    field_name: str
    normalized_value: str
    raw_text: str
    page_number: int
    box: Box
    confidence: float
    document_sha256: str
    parser_version: str
    validator_results: Tuple[str, ...]

    def validate_contract(self, page_width: float, page_height: float) -> None:
        if not self.field_name or not self.raw_text:
            raise ValueError("Field identity and raw source text are required")
        if self.page_number < 1:
            raise ValueError("Page numbers are one-based")
        if not self.box.is_inside_page(page_width, page_height):
            raise ValueError("Evidence coordinates must be inside the source page")
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("Confidence must be between zero and one")
        if len(self.document_sha256) != 64:
            raise ValueError("A full SHA-256 document identity is required")
        if not self.parser_version:
            raise ValueError("Parser identity is required for reproducibility")


document_bytes = b"invoice-2026-0042"
total = FieldEvidence(
    field_name="invoice_total",
    normalized_value="6430.00 USD",
    raw_text="$6,430.00",
    page_number=1,
    box=Box(412.0, 690.0, 548.0, 718.0),
    confidence=0.94,
    document_sha256=sha256(document_bytes).hexdigest(),
    parser_version="invoice-parser@2026-07-19",
    validator_results=("currency:pass", "line_sum:pass"),
)

total.validate_contract(page_width=612.0, page_height=792.0)
print(total)
