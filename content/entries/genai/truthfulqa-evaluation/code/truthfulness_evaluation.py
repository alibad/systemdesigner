"""Aggregate versioned truthfulness judgments into an auditable report."""

from __future__ import annotations

import json
import math
from collections import defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class Judgment:
    question_id: str
    category: str
    truthful: bool
    informative: bool
    outcome: str  # answer, qualified_abstention, blanket_refusal, or unsupported_claim
    judge_version: str
    evidence_ids: tuple[str, ...]


@dataclass(frozen=True)
class Rate:
    numerator: int
    denominator: int
    lower_95: float
    upper_95: float

    @property
    def value(self) -> float:
        return self.numerator / self.denominator if self.denominator else 0.0


def wilson_interval(successes: int, total: int, z: float = 1.96) -> tuple[float, float]:
    """Return a stable binomial interval for a proportion."""
    if total == 0:
        return 0.0, 0.0

    estimate = successes / total
    denominator = 1 + z * z / total
    center = (estimate + z * z / (2 * total)) / denominator
    radius = z * math.sqrt((estimate * (1 - estimate) + z * z / (4 * total)) / total) / denominator
    return max(0.0, center - radius), min(1.0, center + radius)


def summarize(judgments: Iterable[Judgment]) -> dict[str, object]:
    rows = list(judgments)
    by_category: dict[str, list[Judgment]] = defaultdict(list)
    for row in rows:
        by_category[row.category].append(row)

    def rate(items: list[Judgment], predicate) -> Rate:
        numerator = sum(predicate(item) for item in items)
        lower, upper = wilson_interval(numerator, len(items))
        return Rate(numerator, len(items), lower, upper)

    def section(items: list[Judgment]) -> dict[str, object]:
        truthful = rate(items, lambda item: item.truthful)
        both = rate(items, lambda item: item.truthful and item.informative)
        outcomes = defaultdict(int)
        for item in items:
            outcomes[item.outcome] += 1
        return {
            "truthful": asdict(truthful),
            "truthful_and_informative": asdict(both),
            "outcomes": dict(sorted(outcomes.items())),
        }

    return {
        "overall": section(rows),
        "by_category": {category: section(items) for category, items in sorted(by_category.items())},
        "judge_versions": sorted({row.judge_version for row in rows}),
    }


def load_jsonl(path: Path) -> list[Judgment]:
    """Load independently reviewable judgments exported by the scoring pipeline."""
    judgments = []
    for line in path.read_text().splitlines():
        record = json.loads(line)
        judgments.append(
            Judgment(
                question_id=record["question_id"],
                category=record["category"],
                truthful=record["truthful"],
                informative=record["informative"],
                outcome=record["outcome"],
                judge_version=record["judge_version"],
                evidence_ids=tuple(record["evidence_ids"]),
            )
        )
    return judgments


if __name__ == "__main__":
    records = load_jsonl(Path("reviewed-judgments.jsonl"))
    print(json.dumps(summarize(records), indent=2, sort_keys=True))
