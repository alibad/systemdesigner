"""Build a langid.py classifier for one stable candidate-language policy.

Install the upstream package before running this integration example:
    python -m pip install langid==1.1.6
"""

from dataclasses import dataclass

from langid.langid import LanguageIdentifier, model


@dataclass(frozen=True)
class Detection:
    language: str
    normalized_score: float
    candidate_policy: str


def build_identifier(languages: list[str]) -> LanguageIdentifier:
    """Create an isolated classifier instead of mutating langid's global state."""
    identifier = LanguageIdentifier.from_modelstring(model, norm_probs=True)
    identifier.set_languages(languages)
    return identifier


def classify(
    identifier: LanguageIdentifier,
    text: str,
    *,
    candidate_policy: str,
) -> Detection:
    cleaned = " ".join(text.split())
    if not cleaned:
        raise ValueError("text must contain at least one non-whitespace character")

    language, score = identifier.classify(cleaned)
    return Detection(
        language=language,
        normalized_score=float(score),
        candidate_policy=candidate_policy,
    )


if __name__ == "__main__":
    western_europe = build_identifier(["de", "en", "es", "fr", "it", "pt"])
    result = classify(
        western_europe,
        "Bonjour, comment allez-vous aujourd'hui ?",
        candidate_policy="western-europe-v1",
    )

    assert result.language in {"de", "en", "es", "fr", "it", "pt"}
    assert 0.0 <= result.normalized_score <= 1.0
    print(result)
