#!/usr/bin/env python3
"""Estimate a conservative memory envelope for one vLLM replica.

This is a planning model, not a hardware benchmark. Replace every default with
the checkpoint architecture, precision, startup profile, and workload you will
actually deploy.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import asdict, dataclass


GIB = 1024**3


@dataclass(frozen=True)
class Envelope:
    model_weight_gib: float
    executor_budget_gib: float
    kv_budget_gib: float
    kv_kib_per_token: float
    rounded_tokens_per_sequence: int
    kv_mib_per_sequence: float
    sequence_capacity_from_kv: int
    admitted_sequences: int
    block_tail_waste_mib: float
    headroom_gib: float


def round_to_block(tokens: int, block_size: int) -> int:
    """Round a positive token count to complete KV blocks."""
    if tokens <= 0 or block_size <= 0:
        raise ValueError("tokens and block_size must be positive")
    return math.ceil(tokens / block_size) * block_size


def kv_bytes_per_token(
    layers: int,
    kv_heads: int,
    head_dimension: int,
    bytes_per_element: int,
) -> int:
    """Return key plus value bytes for one token across all layers."""
    values = (layers, kv_heads, head_dimension, bytes_per_element)
    if any(value <= 0 for value in values):
        raise ValueError("KV dimensions must be positive")
    return 2 * layers * kv_heads * head_dimension * bytes_per_element


def estimate(args: argparse.Namespace) -> Envelope:
    total_gpu_bytes = args.gpus * args.gpu_memory_gib * GIB
    executor_budget = total_gpu_bytes * args.gpu_memory_utilization
    model_weight_bytes = args.parameters_billions * 1_000_000_000 * args.weight_bits / 8
    runtime_reserve_bytes = args.gpus * args.runtime_reserve_gib_per_gpu * GIB
    kv_budget = max(0.0, executor_budget - model_weight_bytes - runtime_reserve_bytes)

    live_tokens = args.average_prompt_tokens + args.average_output_tokens
    rounded_tokens = round_to_block(live_tokens, args.block_size)
    per_token_bytes = kv_bytes_per_token(
        args.layers,
        args.kv_heads,
        args.head_dimension,
        args.kv_bytes_per_element,
    )
    kv_bytes_per_sequence = rounded_tokens * per_token_bytes
    sequence_capacity = math.floor(kv_budget / kv_bytes_per_sequence)
    admitted_sequences = min(args.max_num_seqs, sequence_capacity)
    used_kv_bytes = admitted_sequences * kv_bytes_per_sequence
    tail_waste_bytes = admitted_sequences * (rounded_tokens - live_tokens) * per_token_bytes

    return Envelope(
        model_weight_gib=model_weight_bytes / GIB,
        executor_budget_gib=executor_budget / GIB,
        kv_budget_gib=kv_budget / GIB,
        kv_kib_per_token=per_token_bytes / 1024,
        rounded_tokens_per_sequence=rounded_tokens,
        kv_mib_per_sequence=kv_bytes_per_sequence / 1024**2,
        sequence_capacity_from_kv=sequence_capacity,
        admitted_sequences=admitted_sequences,
        block_tail_waste_mib=tail_waste_bytes / 1024**2,
        headroom_gib=max(0.0, kv_budget - used_kv_bytes) / GIB,
    )


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be positive")
    return parsed


def positive_float(value: str) -> float:
    parsed = float(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be positive")
    return parsed


def utilization(value: str) -> float:
    parsed = float(value)
    if not 0 < parsed <= 1:
        raise argparse.ArgumentTypeError("must be in (0, 1]")
    return parsed


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--parameters-billions", type=positive_float, default=8.0)
    result.add_argument("--weight-bits", type=positive_int, default=16)
    result.add_argument("--layers", type=positive_int, default=32)
    result.add_argument("--kv-heads", type=positive_int, default=8)
    result.add_argument("--head-dimension", type=positive_int, default=128)
    result.add_argument("--kv-bytes-per-element", type=positive_int, default=2)
    result.add_argument("--gpus", type=positive_int, default=1)
    result.add_argument("--gpu-memory-gib", type=positive_float, default=80.0)
    result.add_argument("--gpu-memory-utilization", type=utilization, default=0.9)
    result.add_argument("--runtime-reserve-gib-per-gpu", type=positive_float, default=3.0)
    result.add_argument("--average-prompt-tokens", type=positive_int, default=700)
    result.add_argument("--average-output-tokens", type=positive_int, default=180)
    result.add_argument("--block-size", type=positive_int, default=16)
    result.add_argument("--max-num-seqs", type=positive_int, default=128)
    result.add_argument("--self-test", action="store_true")
    return result


def run_self_test() -> None:
    assert kv_bytes_per_token(32, 8, 128, 2) == 131_072
    assert round_to_block(16, 16) == 16
    assert round_to_block(17, 16) == 32

    sample = parser().parse_args([])
    result = estimate(sample)
    assert result.sequence_capacity_from_kv >= result.admitted_sequences > 0
    assert result.rounded_tokens_per_sequence % sample.block_size == 0
    assert result.headroom_gib >= 0
    print("self-test: ok")


def main() -> None:
    args = parser().parse_args()
    if args.self_test:
        run_self_test()
        return

    print(json.dumps(asdict(estimate(args)), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
