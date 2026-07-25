"""Estimate evaluation runner, reviewer, and cost capacity without vendor SDKs."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Workload:
    cases_per_release: int
    releases_per_day: int
    seconds_per_case: float
    tokens_per_case: int
    cost_per_million_tokens: float
    review_sample: float
    review_minutes_per_case: float


@dataclass(frozen=True)
class Capacity:
    runner_concurrency: int
    reviewers: int
    review_hours_per_person: float


def plan(workload: Workload, capacity: Capacity) -> dict[str, float]:
    daily_cases = workload.cases_per_release * workload.releases_per_day
    runner_hours = (
        daily_cases * workload.seconds_per_case
        / capacity.runner_concurrency
        / 3600
    )
    review_cases = daily_cases * workload.review_sample
    review_capacity = (
        capacity.reviewers
        * capacity.review_hours_per_person
        * 60
        / workload.review_minutes_per_case
    )
    daily_cost = (
        daily_cases
        * workload.tokens_per_case
        / 1_000_000
        * workload.cost_per_million_tokens
    )

    return {
        "daily_cases": daily_cases,
        "runner_hours": round(runner_hours, 2),
        "review_cases": round(review_cases),
        "review_capacity": round(review_capacity),
        "review_load_pct": round(review_cases / review_capacity * 100, 1),
        "daily_cost": round(daily_cost, 2),
    }


if __name__ == "__main__":
    rag_suite = Workload(
        cases_per_release=1200,
        releases_per_day=4,
        seconds_per_case=5.5,
        tokens_per_case=4800,
        cost_per_million_tokens=4.0,
        review_sample=0.08,
        review_minutes_per_case=4,
    )
    team = Capacity(
        runner_concurrency=40,
        reviewers=3,
        review_hours_per_person=6,
    )

    result = plan(rag_suite, team)
    for metric, value in result.items():
        print(f"{metric}: {value}")
