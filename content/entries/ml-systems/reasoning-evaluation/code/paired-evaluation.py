"""Score controlled reasoning pairs with only the Python standard library."""

from collections import defaultdict
from dataclasses import asdict, dataclass
from math import sqrt
import json
import re
from typing import Iterable, Literal


ExpectedRelation = Literal["same", "different"]


@dataclass(frozen=True)
class PairRecord:
    pair_id: str
    slice_id: str
    perturbation: str
    expected_relation: ExpectedRelation
    original_output: str
    variant_output: str
    original_correct: bool
    variant_correct: bool


@dataclass(frozen=True)
class PairScore:
    pair_id: str
    slice_id: str
    perturbation: str
    observed_relation: ExpectedRelation
    relation_correct: bool
    pair_correct: bool


def normalize_answer(value: str) -> str:
    """Apply only transformations that the answer contract permits."""
    return re.sub(r"\s+", " ", value.strip().casefold())


def score_pair(record: PairRecord) -> PairScore:
    observed_relation: ExpectedRelation = (
        "same"
        if normalize_answer(record.original_output)
        == normalize_answer(record.variant_output)
        else "different"
    )
    relation_correct = observed_relation == record.expected_relation

    # Relation-only scoring is insufficient: two identical wrong answers are not a pass.
    pair_correct = (
        record.original_correct
        and record.variant_correct
        and relation_correct
    )
    return PairScore(
        pair_id=record.pair_id,
        slice_id=record.slice_id,
        perturbation=record.perturbation,
        observed_relation=observed_relation,
        relation_correct=relation_correct,
        pair_correct=pair_correct,
    )


def wilson_interval(successes: int, total: int, z: float = 1.96) -> tuple[float, float]:
    """Return an approximate 95% Wilson interval for a binary rate."""
    if total <= 0:
        raise ValueError("total must be positive")
    proportion = successes / total
    denominator = 1 + z**2 / total
    center = (proportion + z**2 / (2 * total)) / denominator
    spread = (
        z
        * sqrt(
            proportion * (1 - proportion) / total
            + z**2 / (4 * total**2)
        )
        / denominator
    )
    return max(0.0, center - spread), min(1.0, center + spread)


def summarize(records: Iterable[PairRecord]) -> dict[str, object]:
    scored = [score_pair(record) for record in records]
    by_perturbation: dict[str, list[PairScore]] = defaultdict(list)
    for result in scored:
        by_perturbation[result.perturbation].append(result)

    slices = {}
    for name, results in sorted(by_perturbation.items()):
        passes = sum(result.pair_correct for result in results)
        low, high = wilson_interval(passes, len(results))
        slices[name] = {
            "passes": passes,
            "total": len(results),
            "pair_pass_rate": passes / len(results),
            "wilson_95": [low, high],
        }

    return {
        "pairs": [asdict(result) for result in scored],
        "by_perturbation": slices,
    }


if __name__ == "__main__":
    demo = [
        PairRecord(
            pair_id="logic-017",
            slice_id="deduction",
            perturbation="entity_rename",
            expected_relation="same",
            original_output="Yes",
            variant_output="yes",
            original_correct=True,
            variant_correct=True,
        ),
        PairRecord(
            pair_id="logic-028",
            slice_id="deduction",
            perturbation="premise_reversal",
            expected_relation="different",
            original_output="Yes",
            variant_output="Yes",
            original_correct=True,
            variant_correct=False,
        ),
    ]
    print(json.dumps(summarize(demo), indent=2))
