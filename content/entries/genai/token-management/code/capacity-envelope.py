"""Estimate token pressure and apply an explicit overload boundary."""

from dataclasses import asdict, dataclass
from math import ceil
from typing import Literal


Boundary = Literal["bounded-queue", "fail-fast", "retry-all"]


@dataclass(frozen=True)
class Workload:
    requests_per_minute: float
    input_tokens: int
    output_tokens: int
    tokens_per_minute_limit: int
    concurrency_limit: int
    time_to_first_token_ms: int
    output_tokens_per_second: float
    deadline_ms: int
    base_failure_rate: float
    input_price_per_million: float
    output_price_per_million: float


@dataclass(frozen=True)
class CapacityPlan:
    boundary: Boundary
    service_time_ms: int
    attempt_multiplier: float
    token_demand_per_minute: int
    required_concurrency: int
    admission_rate: float
    admitted_requests_per_minute: int
    deferred_or_shed_per_minute: int
    estimated_cost_per_hour: float
    outcome: str


def plan_capacity(workload: Workload, boundary: Boundary) -> CapacityPlan:
    service_time_ms = round(
        workload.time_to_first_token_ms
        + (workload.output_tokens / workload.output_tokens_per_second) * 1_000
    )
    likely_timeout = service_time_ms > workload.deadline_ms

    if boundary == "retry-all":
        retry_rate = min(0.8, workload.base_failure_rate + (0.35 if likely_timeout else 0.0))
        attempt_multiplier = 1.0 + retry_rate
    elif boundary == "bounded-queue":
        attempt_multiplier = 1.0 + workload.base_failure_rate * 0.25
    else:
        attempt_multiplier = 1.0

    attempts_per_minute = workload.requests_per_minute * attempt_multiplier
    tokens_per_attempt = workload.input_tokens + workload.output_tokens
    token_demand = attempts_per_minute * tokens_per_attempt
    service_seconds = service_time_ms / 1_000
    required_concurrency = attempts_per_minute / 60 * service_seconds

    token_admission = workload.tokens_per_minute_limit / max(token_demand, 1)
    concurrency_admission = workload.concurrency_limit / max(required_concurrency, 1)
    admission_rate = min(1.0, token_admission, concurrency_admission)
    admitted = workload.requests_per_minute * admission_rate
    overflow = max(0.0, workload.requests_per_minute - admitted)

    processed_attempts_per_hour = attempts_per_minute * admission_rate * 60
    cost_per_attempt = (
        workload.input_tokens * workload.input_price_per_million
        + workload.output_tokens * workload.output_price_per_million
    ) / 1_000_000

    if admission_rate >= 0.98 and not likely_timeout:
        outcome = "healthy: the envelope admits the workload within deadline"
    elif boundary == "retry-all":
        outcome = "unsafe: retries amplify pressure and leave overflow unbounded"
    elif boundary == "bounded-queue":
        outcome = "degraded: bounded waiting and shedding protect the dependency"
    else:
        outcome = "degraded: excess work fails quickly instead of building a queue"

    return CapacityPlan(
        boundary=boundary,
        service_time_ms=service_time_ms,
        attempt_multiplier=round(attempt_multiplier, 3),
        token_demand_per_minute=round(token_demand),
        required_concurrency=ceil(required_concurrency),
        admission_rate=round(admission_rate, 3),
        admitted_requests_per_minute=round(admitted),
        deferred_or_shed_per_minute=round(overflow),
        estimated_cost_per_hour=round(processed_attempts_per_hour * cost_per_attempt, 2),
        outcome=outcome,
    )


if __name__ == "__main__":
    example = Workload(
        requests_per_minute=420,
        input_tokens=2_400,
        output_tokens=900,
        tokens_per_minute_limit=1_500_000,
        concurrency_limit=48,
        time_to_first_token_ms=450,
        output_tokens_per_second=55,
        deadline_ms=12_000,
        base_failure_rate=0.04,
        input_price_per_million=2.0,
        output_price_per_million=8.0,
    )
    for overload_boundary in ("bounded-queue", "fail-fast", "retry-all"):
        print(asdict(plan_capacity(example, overload_boundary)))
