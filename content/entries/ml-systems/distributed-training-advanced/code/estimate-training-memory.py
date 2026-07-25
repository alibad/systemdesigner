#!/usr/bin/env python3
"""Estimate persistent model-state memory from the lesson's data contract."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "parallelism-capacity-model.json"


def load_model() -> dict[str, Any]:
    with DATA_FILE.open(encoding="utf-8") as handle:
        return json.load(handle)


def estimate_memory(
    parameters_billions: float,
    gpu_count: int,
    activation_reserve_gb: float,
    strategy: dict[str, Any],
) -> dict[str, float]:
    if parameters_billions <= 0 or gpu_count <= 0 or activation_reserve_gb < 0:
        raise ValueError("parameters and GPU count must be positive; reserve cannot be negative")

    replicated_gb = parameters_billions * strategy["replicatedBytesPerParameter"]
    sharded_gb = (
        parameters_billions * strategy["shardedBytesPerParameter"] / gpu_count
    )
    model_state_gb = replicated_gb + sharded_gb
    return {
        "replicated_gb": replicated_gb,
        "sharded_gb": sharded_gb,
        "model_state_gb": model_state_gb,
        "required_gb": model_state_gb + activation_reserve_gb,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parameters-b", type=float, default=70)
    parser.add_argument("--gpus", type=int, default=32)
    parser.add_argument("--activation-reserve-gb", type=float, default=18)
    args = parser.parse_args()

    model = load_model()
    print(
        f"{args.parameters_b:g}B parameters, {args.gpus} GPUs, "
        f"{args.activation_reserve_gb:g} GB activation/buffer reserve"
    )
    for strategy in model["strategies"]:
        result = estimate_memory(
            args.parameters_b,
            args.gpus,
            args.activation_reserve_gb,
            strategy,
        )
        print(
            f"{strategy['label']:<22} "
            f"state={result['model_state_gb']:8.1f} GB/GPU  "
            f"required={result['required_gb']:8.1f} GB/GPU"
        )

    full_shard = next(item for item in model["strategies"] if item["id"] == "fsdp-full-shard")
    check = estimate_memory(70, 32, 18, full_shard)
    assert round(check["model_state_gb"], 1) == 35.0
    assert round(check["required_gb"], 1) == 53.0


if __name__ == "__main__":
    main()
