"""Score already-segmented page blocks with an inspectable heuristic.

The values are teaching weights, not a universal production model. A real extractor
should fit and validate its policy against labeled fixtures from its own page mix.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Block:
    name: str
    role: str
    text_characters: int
    link_characters: int
    sentence_count: int
    repeated_across_pages: bool

    @property
    def link_density(self) -> float:
        return self.link_characters / max(1, self.text_characters)


def content_score(block: Block) -> int:
    """Return a transparent 0-100 content score for one page block."""
    score = 0
    score += 35 if block.text_characters >= 300 else 20 if block.text_characters >= 120 else 0
    score += min(20, block.sentence_count * 4)
    score += 25 if block.role in {"main", "article"} else 0
    score -= 25 if block.repeated_across_pages else 0
    score -= round(block.link_density * 40)
    return max(0, min(100, score))


def classify(block: Block, threshold: int = 45) -> bool:
    """Keep a block when its score reaches the selected policy threshold."""
    return content_score(block) >= threshold


if __name__ == "__main__":
    fixtures = [
        Block("article body", "article", 1840, 72, 15, False),
        Block("related stories", "aside", 470, 338, 3, True),
        Block("reader comments", "generic", 910, 36, 11, False),
    ]

    for fixture in fixtures:
        verdict = "keep" if classify(fixture) else "discard"
        print(f"{fixture.name:18} score={content_score(fixture):3} {verdict}")

    assert classify(fixtures[0])
    assert not classify(fixtures[1])
