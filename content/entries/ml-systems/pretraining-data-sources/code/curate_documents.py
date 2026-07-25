"""A small, auditable curation pipeline.

Real systems use distributed indexes and learned classifiers. The control flow
is the important part: emit a reason for every rejection and decontaminate
before assigning documents to the training split.
"""

from collections import Counter
from dataclasses import dataclass
from hashlib import sha256
import re
from typing import Iterable


WHITESPACE = re.compile(r"\s+")


@dataclass(frozen=True)
class Document:
    document_id: str
    source_id: str
    language: str
    text: str
    quality_score: float


@dataclass(frozen=True)
class Decision:
    document: Document
    accepted: bool
    reason: str


def normalize(text: str) -> str:
    return WHITESPACE.sub(" ", text).strip()


def content_fingerprint(text: str) -> str:
    canonical = normalize(text).casefold()
    return sha256(canonical.encode("utf-8")).hexdigest()


def curate(
    documents: Iterable[Document],
    *,
    minimum_quality: float,
    allowed_languages: set[str],
    evaluation_fingerprints: set[str],
) -> tuple[list[Document], Counter[str]]:
    accepted: list[Document] = []
    decisions: list[Decision] = []
    observed_fingerprints: set[str] = set()

    for document in documents:
        cleaned = normalize(document.text)
        fingerprint = content_fingerprint(cleaned)

        if document.language not in allowed_languages:
            decisions.append(Decision(document, False, "language_not_selected"))
        elif document.quality_score < minimum_quality:
            decisions.append(Decision(document, False, "below_quality_threshold"))
        elif fingerprint in evaluation_fingerprints:
            decisions.append(Decision(document, False, "evaluation_overlap"))
        elif fingerprint in observed_fingerprints:
            decisions.append(Decision(document, False, "exact_duplicate"))
        else:
            observed_fingerprints.add(fingerprint)
            accepted.append(
                Document(
                    document_id=document.document_id,
                    source_id=document.source_id,
                    language=document.language,
                    text=cleaned,
                    quality_score=document.quality_score,
                )
            )
            decisions.append(Decision(document, True, "accepted"))

    counts = Counter(decision.reason for decision in decisions)
    if sum(counts.values()) != len(decisions):
        raise AssertionError("every input document must have exactly one decision")
    return accepted, counts


def report(counts: Counter[str]) -> None:
    total = sum(counts.values())
    for reason, count in sorted(counts.items()):
        share = 100 * count / total if total else 0
        print(f"{reason:28} {count:8,d}  {share:6.2f}%")


if __name__ == "__main__":
    candidates = [
        Document("a", "reference-1", "en", "A useful systems article.", 0.91),
        Document("b", "reference-1", "en", " A useful systems article. ", 0.89),
        Document("c", "crawl-9", "es", "Contenido educativo.", 0.84),
        Document("d", "crawl-9", "en", "Benchmark answer.", 0.96),
    ]
    held_out = {content_fingerprint("Benchmark answer.")}
    corpus, reason_counts = curate(
        candidates,
        minimum_quality=0.80,
        allowed_languages={"en", "es"},
        evaluation_fingerprints=held_out,
    )
    report(reason_counts)
    print(f"accepted documents: {len(corpus)}")
