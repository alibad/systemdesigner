"""A dependency-free control-plane example for document parsing.

The example does not implement OCR. It shows the production decisions around an OCR
or native-text engine: page routing, provenance, schema checks, and review routing.
Run with: python3 parsing_pipeline.py
"""

from dataclasses import asdict, dataclass
from hashlib import sha256
from typing import Dict, List, Optional, Sequence, Tuple


@dataclass(frozen=True)
class SourceBlock:
    block_id: str
    page: int
    text: str
    x: float
    y: float
    confidence: float
    method: str


@dataclass(frozen=True)
class FieldCandidate:
    field_id: str
    raw_text: str
    normalized_value: Optional[str]
    source_block_ids: Tuple[str, ...]
    confidence: float
    parser_version: str


@dataclass(frozen=True)
class Decision:
    state: str
    reasons: Tuple[str, ...]


def choose_page_route(native_coverage: float, native_text_valid: bool) -> str:
    """Prefer native objects only when their coverage and encoding are usable."""
    if native_text_valid and native_coverage >= 0.85:
        return "native"
    return "ocr"


def reading_order(blocks: Sequence[SourceBlock]) -> List[SourceBlock]:
    """Order a simple two-column page while retaining the original coordinates."""

    def position(block: SourceBlock) -> Tuple[int, int, float]:
        column = 0 if block.x < 0.5 else 1
        return (block.page, column, block.y)

    return sorted(blocks, key=position)


def validate_fields(fields: Dict[str, FieldCandidate]) -> List[str]:
    errors: List[str] = []
    required = ("invoice_id", "currency", "subtotal", "tax", "total")
    for field_id in required:
        candidate = fields.get(field_id)
        if not candidate or candidate.normalized_value is None:
            errors.append("missing:" + field_id)
        elif not candidate.source_block_ids:
            errors.append("unanchored:" + field_id)

    try:
        subtotal = float(fields["subtotal"].normalized_value or "nan")
        tax = float(fields["tax"].normalized_value or "nan")
        total = float(fields["total"].normalized_value or "nan")
        if abs(subtotal + tax - total) > 0.01:
            errors.append("reconciliation:subtotal+tax!=total")
    except (KeyError, TypeError, ValueError):
        errors.append("reconciliation:values-not-numeric")
    return errors


def decide(fields: Dict[str, FieldCandidate], confidence_floor: float) -> Decision:
    errors = validate_fields(fields)
    low_confidence = sorted(
        field_id
        for field_id, candidate in fields.items()
        if candidate.confidence < confidence_floor
    )
    reasons = tuple(errors + ["low-confidence:" + item for item in low_confidence])
    if any(reason.startswith("missing:") or reason.startswith("unanchored:") for reason in reasons):
        return Decision("blocked", reasons)
    if reasons:
        return Decision("review", reasons)
    return Decision("accepted", ())


def source_identity(content: bytes) -> str:
    return "sha256:" + sha256(content).hexdigest()


def demo() -> None:
    blocks = [
        SourceBlock("b-total", 1, "Total 109.00", 0.62, 0.72, 0.97, "native"),
        SourceBlock("b-id", 1, "Invoice INV-42", 0.08, 0.10, 0.99, "native"),
        SourceBlock("b-subtotal", 1, "Subtotal 100.00", 0.62, 0.60, 0.96, "native"),
        SourceBlock("b-tax", 1, "Tax 9.00", 0.62, 0.66, 0.93, "native"),
        SourceBlock("b-currency", 1, "Currency USD", 0.08, 0.18, 0.98, "native"),
    ]
    fields = {
        "invoice_id": FieldCandidate("invoice_id", "INV-42", "INV-42", ("b-id",), 0.99, "parser-3"),
        "currency": FieldCandidate("currency", "USD", "USD", ("b-currency",), 0.98, "parser-3"),
        "subtotal": FieldCandidate("subtotal", "100.00", "100.00", ("b-subtotal",), 0.96, "parser-3"),
        "tax": FieldCandidate("tax", "9.00", "9.00", ("b-tax",), 0.93, "parser-3"),
        "total": FieldCandidate("total", "109.00", "109.00", ("b-total",), 0.97, "parser-3"),
    }

    assert choose_page_route(0.96, True) == "native"
    assert choose_page_route(0.40, True) == "ocr"
    assert [block.block_id for block in reading_order(blocks)][0] == "b-id"
    decision = decide(fields, confidence_floor=0.90)
    assert decision.state == "accepted"

    print("source", source_identity(b"immutable-demo-document"))
    print("route", choose_page_route(native_coverage=0.96, native_text_valid=True))
    print("reading_order", [block.block_id for block in reading_order(blocks)])
    print("decision", asdict(decision))


if __name__ == "__main__":
    demo()
