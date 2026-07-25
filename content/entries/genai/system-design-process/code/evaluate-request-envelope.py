"""Transparent token, cost, latency, and concurrency planning arithmetic."""

from dataclasses import dataclass
from math import ceil


@dataclass(frozen=True)
class PlanningTier:
    input_usd_per_million: float
    output_usd_per_million: float
    first_token_ms: int
    output_tokens_per_second: int


def evaluate_envelope(
    *,
    tier: PlanningTier,
    input_tokens: int,
    output_tokens: int,
    requests_per_minute: int,
    fixed_stage_ms: int,
    days_per_month: int = 30,
) -> dict[str, float | int]:
    per_request_usd = (
        input_tokens * tier.input_usd_per_million
        + output_tokens * tier.output_usd_per_million
    ) / 1_000_000

    requests_per_month = requests_per_minute * 60 * 24 * days_per_month
    generation_ms = (output_tokens / tier.output_tokens_per_second) * 1000
    planning_latency_ms = fixed_stage_ms + tier.first_token_ms + generation_ms
    estimated_concurrency = ceil(
        requests_per_minute * (planning_latency_ms / 1000) / 60
    )

    return {
        "per_request_usd": round(per_request_usd, 6),
        "monthly_usd": round(per_request_usd * requests_per_month, 2),
        "planning_latency_ms": round(planning_latency_ms),
        "estimated_concurrency": estimated_concurrency,
    }


if __name__ == "__main__":
    synthetic_balanced_tier = PlanningTier(
        input_usd_per_million=1.0,
        output_usd_per_million=6.0,
        first_token_ms=520,
        output_tokens_per_second=120,
    )
    result = evaluate_envelope(
        tier=synthetic_balanced_tier,
        input_tokens=2_000,
        output_tokens=240,
        requests_per_minute=10,
        fixed_stage_ms=120 + 190 + 85,
    )
    print(result)
