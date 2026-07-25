"""Fail a tokenizer release when a protected traffic slice regresses."""

from dataclasses import dataclass


@dataclass(frozen=True)
class SliceResult:
    name: str
    baseline_p95_tokens: int
    candidate_p95_tokens: int
    offset_failures: int
    task_score_delta: float


def release_failures(results: list[SliceResult]) -> list[str]:
    failures: list[str] = []
    for result in results:
        expansion = result.candidate_p95_tokens / result.baseline_p95_tokens - 1
        if expansion > 0.10:
            failures.append(f"{result.name}: p95 token count grew {expansion:.1%}")
        if result.offset_failures:
            failures.append(f"{result.name}: {result.offset_failures} offset failures")
        if result.task_score_delta < -0.01:
            failures.append(
                f"{result.name}: downstream score fell {result.task_score_delta:.3f}"
            )
    return failures


candidate = [
    SliceResult("English prose", 820, 845, 0, 0.002),
    SliceResult("Arabic support", 1180, 1420, 0, -0.004),
    SliceResult("TypeScript", 960, 970, 2, -0.018),
]

issues = release_failures(candidate)
if issues:
    raise SystemExit("Tokenizer release blocked:\n- " + "\n- ".join(issues))
