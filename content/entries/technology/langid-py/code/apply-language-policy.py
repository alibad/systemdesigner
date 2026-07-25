"""Apply an explicit production gate to language-identification output."""

from dataclasses import dataclass


@dataclass(frozen=True)
class DetectionRecord:
    record_id: str
    characters: int
    predicted_language: str
    normalized_score: float
    mixed_language: bool
    in_product_scope: bool


@dataclass(frozen=True)
class Decision:
    record_id: str
    action: str
    reason: str


def route_detection(
    record: DetectionRecord,
    *,
    score_floor: float,
    minimum_characters: int,
) -> Decision:
    """Return an automatic route only when every policy gate passes."""
    if not record.in_product_scope:
        return Decision(record.record_id, "defer", "outside product language scope")
    if record.mixed_language:
        return Decision(record.record_id, "defer", "mixed-language contract")
    if record.characters < minimum_characters:
        return Decision(record.record_id, "defer", "insufficient text evidence")
    if record.normalized_score < score_floor:
        return Decision(record.record_id, "defer", "score below calibrated floor")

    return Decision(record.record_id, "auto-route", record.predicted_language)


if __name__ == "__main__":
    fixture = [
        DetectionRecord("clear-fr", 68, "fr", 0.97, False, True),
        DetectionRecord("short-en", 4, "en", 0.91, False, True),
        DetectionRecord("mixed", 52, "es", 0.88, True, True),
        DetectionRecord("unsupported", 47, "en", 0.95, False, False),
    ]

    decisions = [
        route_detection(record, score_floor=0.82, minimum_characters=20)
        for record in fixture
    ]

    assert [decision.action for decision in decisions] == [
        "auto-route",
        "defer",
        "defer",
        "defer",
    ]
    for decision in decisions:
        print(f"{decision.record_id}: {decision.action} ({decision.reason})")
