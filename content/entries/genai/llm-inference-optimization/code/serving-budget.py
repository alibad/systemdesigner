"""Transparent planning model for one LLM serving workload.

Replace every throughput and memory coefficient with measurements from the target
model, engine, and hardware before using the result for capacity planning.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Workload:
    prompt_tokens: int
    output_tokens: int
    reusable_prefix_tokens: int
    ttft_slo_ms: float
    tpot_slo_ms: float
    prefill_tokens_per_second: float
    baseline_tpot_ms: float
    kv_mib_per_1k_tokens: float
    kv_budget_gib: float


@dataclass(frozen=True)
class ServingPlan:
    batch_window_ms: float
    active_sequences: int
    prefix_hit_rate: float


def evaluate(workload: Workload, plan: ServingPlan) -> dict[str, float | bool]:
    """Estimate latency and memory while preserving simple accounting invariants."""
    reusable = workload.reusable_prefix_tokens * plan.prefix_hit_rate
    effective_prompt = max(0.0, workload.prompt_tokens - reusable)

    batch_gain = 1.0 + min(plan.active_sequences / 96.0, 1.5) * 0.32
    prefill_ms = effective_prompt / (workload.prefill_tokens_per_second * batch_gain) * 1000

    kv_gib = (
        plan.active_sequences
        * (workload.prompt_tokens + workload.output_tokens)
        * workload.kv_mib_per_1k_tokens
        / 1000
        / 1024
    )
    kv_utilization = kv_gib / workload.kv_budget_gib
    pressure = max(0.0, kv_utilization - 0.75)
    overload_queue_ms = max(0, plan.active_sequences - 128) * 2.5

    ttft_ms = 45 + plan.batch_window_ms + overload_queue_ms + prefill_ms
    tpot_ms = workload.baseline_tpot_ms * (1 + pressure * 1.3)
    goodput_ratio = min(1.0, workload.ttft_slo_ms / ttft_ms) * min(
        1.0, workload.tpot_slo_ms / tpot_ms
    )

    return {
        "effective_prompt_tokens": round(effective_prompt),
        "ttft_ms": round(ttft_ms, 1),
        "tpot_ms": round(tpot_ms, 1),
        "kv_gib": round(kv_gib, 2),
        "kv_utilization": round(kv_utilization, 3),
        "goodput_ratio": round(goodput_ratio, 3),
        "meets_slo": ttft_ms <= workload.ttft_slo_ms
        and tpot_ms <= workload.tpot_slo_ms
        and kv_utilization <= 1,
    }


if __name__ == "__main__":
    support_chat = Workload(
        prompt_tokens=1_800,
        output_tokens=240,
        reusable_prefix_tokens=900,
        ttft_slo_ms=180,
        tpot_slo_ms=40,
        prefill_tokens_per_second=12_000,
        baseline_tpot_ms=26,
        kv_mib_per_1k_tokens=52,
        kv_budget_gib=28,
    )
    candidate = ServingPlan(
        batch_window_ms=6,
        active_sequences=64,
        prefix_hit_rate=0.60,
    )
    result = evaluate(support_chat, candidate)
    assert result["effective_prompt_tokens"] == 1_260
    assert 0 <= result["goodput_ratio"] <= 1
    assert result["kv_gib"] > 0
    print(result)
