"""A small, executable translation request and output contract."""

from dataclasses import dataclass
import re


PROTECTED_SPAN = re.compile(
    r"\{\{[a-zA-Z0-9_]+\}\}"
    r"|https?://\S+"
    r"|\b\d{1,2}:\d{2}(?:\s?[A-Z]{2,4})?\b"
    r"|\b\d+(?:[.,]\d+)?(?:\s?(?:mg|g|kg|ml|cm|mm|%))?\b"
)


@dataclass(frozen=True)
class TranslationRequest:
    request_id: str
    source_locale: str
    target_locale: str
    domain: str
    risk_tier: str
    text: str
    glossary_version: str
    deadline_ms: int

    def validate(self) -> None:
        if self.source_locale == self.target_locale:
            raise ValueError("source and target locales must differ")
        if self.risk_tier not in {"general", "sensitive", "high-impact"}:
            raise ValueError("unknown risk tier")
        if not self.text.strip():
            raise ValueError("source text is empty")
        if self.deadline_ms <= 0:
            raise ValueError("deadline must be positive")

    @property
    def protected_spans(self) -> tuple[str, ...]:
        return tuple(PROTECTED_SPAN.findall(self.text))


def validate_candidate(request: TranslationRequest, candidate: str) -> list[str]:
    """Return deterministic integrity failures before learned quality scoring."""
    failures = []
    for span in request.protected_spans:
        if span not in candidate:
            failures.append(f"missing protected span: {span}")
    if not candidate.strip():
        failures.append("empty candidate")
    return failures


if __name__ == "__main__":
    request = TranslationRequest(
        request_id="tr_1042",
        source_locale="en-US",
        target_locale="es-ES",
        domain="account-support",
        risk_tier="sensitive",
        text="Reset {{account_id}} before 17:00 using https://example.test/help",
        glossary_version="support-es-v7",
        deadline_ms=300,
    )
    request.validate()

    valid = "Restablezca {{account_id}} antes de las 17:00 en https://example.test/help"
    invalid = "Restablezca la cuenta antes de las 17:00"

    assert validate_candidate(request, valid) == []
    assert validate_candidate(request, invalid) == [
        "missing protected span: {{account_id}}",
        "missing protected span: https://example.test/help",
    ]
    print({"request": request.request_id, "protected": request.protected_spans})
