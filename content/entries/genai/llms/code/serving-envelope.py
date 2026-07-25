from dataclasses import dataclass


@dataclass(frozen=True)
class RequestShape:
    prompt_tokens: int
    reusable_prefix_tokens: int
    output_tokens: int
    ttft_target_ms: float
    tpot_target_ms: float
    memory_budget_gib: float


@dataclass(frozen=True)
class ModelProfile:
    weights_gib: float
    prefill_tokens_per_second: float
    base_tpot_ms: float
    reference_concurrency: int
    kv_mib_per_1k_tokens: float


def estimate_serving_envelope(
    request: RequestShape,
    model: ModelProfile,
    concurrency: int,
    prefix_hit_rate: float,
    batch_window_ms: float,
) -> dict[str, float | bool]:
    reused_tokens = request.reusable_prefix_tokens * prefix_hit_rate
    effective_prompt_tokens = request.prompt_tokens - reused_tokens
    ttft_ms = batch_window_ms + 90 + (
        effective_prompt_tokens / model.prefill_tokens_per_second * 1000
    )

    concurrency_pressure = max(
        0.0,
        (concurrency - model.reference_concurrency) / model.reference_concurrency,
    )
    tpot_ms = model.base_tpot_ms * (1 + 0.65 * concurrency_pressure)
    kv_gib = (
        concurrency
        * (request.prompt_tokens + request.output_tokens)
        / 1000
        * model.kv_mib_per_1k_tokens
        / 1024
    )
    memory_gib = model.weights_gib + kv_gib

    return {
        "ttft_ms": round(ttft_ms, 1),
        "tpot_ms": round(tpot_ms, 1),
        "memory_gib": round(memory_gib, 2),
        "ttft_pass": ttft_ms <= request.ttft_target_ms,
        "tpot_pass": tpot_ms <= request.tpot_target_ms,
        "memory_pass": memory_gib <= request.memory_budget_gib,
    }


if __name__ == "__main__":
    chat = RequestShape(3200, 900, 240, 650, 45, 48)
    balanced = ModelProfile(18, 9000, 24, 16, 72)
    print(estimate_serving_envelope(chat, balanced, 24, 0.6, 20))
