from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from transformers import PreTrainedTokenizerBase


@dataclass(frozen=True)
class GoldenFixture:
    name: str
    text: str
    expected_ids: tuple[int, ...]
    expected_special_mask: tuple[int, ...]


@dataclass(frozen=True)
class SliceResult:
    name: str
    baseline_tokens: int
    candidate_tokens: int
    baseline_task_score: float
    candidate_task_score: float


class ReleaseBlocked(RuntimeError):
    pass


def verify_exact_contract(
    tokenizer: PreTrainedTokenizerBase,
    fixtures: Iterable[GoldenFixture],
) -> None:
    failures: list[str] = []
    for fixture in fixtures:
        encoded = tokenizer(
            fixture.text,
            add_special_tokens=True,
            return_special_tokens_mask=True,
        )
        observed_ids = tuple(encoded["input_ids"])
        observed_mask = tuple(encoded["special_tokens_mask"])
        if observed_ids != fixture.expected_ids:
            failures.append(f"{fixture.name}: token IDs changed")
        if observed_mask != fixture.expected_special_mask:
            failures.append(f"{fixture.name}: special-token boundaries changed")

    if failures:
        raise ReleaseBlocked("; ".join(failures))


def verify_protected_slices(
    results: Iterable[SliceResult],
    *,
    max_expansion_pct: float = 8.0,
    max_task_regression: float = 0.5,
) -> None:
    failures: list[str] = []
    for result in results:
        expansion_pct = (
            (result.candidate_tokens - result.baseline_tokens)
            / max(result.baseline_tokens, 1)
            * 100
        )
        task_delta = result.candidate_task_score - result.baseline_task_score

        if expansion_pct > max_expansion_pct:
            failures.append(
                f"{result.name}: token expansion {expansion_pct:.1f}% "
                f"> {max_expansion_pct:.1f}%"
            )
        if task_delta < -max_task_regression:
            failures.append(
                f"{result.name}: task regression {task_delta:.2f} "
                f"< -{max_task_regression:.2f}"
            )

    if failures:
        raise ReleaseBlocked("; ".join(failures))


def gate_release(
    tokenizer: PreTrainedTokenizerBase,
    fixtures: Iterable[GoldenFixture],
    slice_results: Iterable[SliceResult],
) -> None:
    # Exact invariants run first and cannot be averaged away.
    verify_exact_contract(tokenizer, fixtures)
    verify_protected_slices(slice_results)
