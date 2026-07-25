from dataclasses import dataclass


MEBIBYTE = 1024 * 1024


@dataclass(frozen=True)
class DeploymentInputs:
    resolution: int
    batch_size: int
    bytes_per_value: int
    staging_copies: int
    device_budget_mib: float
    profiled_non_input_reserve_mib: float
    observed_batch_latency_ms: float
    maximum_batch_wait_ms: float
    non_model_latency_ms: float
    arrival_frames_per_second: float
    deadline_ms: float


def evaluate_envelope(inputs: DeploymentInputs) -> dict[str, float | bool]:
    values_per_image = inputs.resolution * inputs.resolution * 3
    input_mib_per_image = values_per_image * inputs.bytes_per_value / MEBIBYTE
    staged_input_mib = (
        input_mib_per_image * inputs.batch_size * inputs.staging_copies
    )
    accounted_memory_mib = (
        inputs.profiled_non_input_reserve_mib + staged_input_mib
    )
    memory_headroom_mib = inputs.device_budget_mib - accounted_memory_mib

    capacity_fps = (
        inputs.batch_size * 1000 / inputs.observed_batch_latency_ms
    )
    utilization = inputs.arrival_frames_per_second / capacity_fps
    latency_envelope_ms = (
        inputs.non_model_latency_ms
        + inputs.maximum_batch_wait_ms
        + inputs.observed_batch_latency_ms
    )

    return {
        "staged_input_mib": staged_input_mib,
        "memory_headroom_mib": memory_headroom_mib,
        "capacity_fps": capacity_fps,
        "utilization": utilization,
        "latency_envelope_ms": latency_envelope_ms,
        "deadline_margin_ms": inputs.deadline_ms - latency_envelope_ms,
        "passes": (
            memory_headroom_mib >= 0
            and utilization < 1
            and latency_envelope_ms <= inputs.deadline_ms
        ),
    }


if __name__ == "__main__":
    profile = DeploymentInputs(
        resolution=640,
        batch_size=4,
        bytes_per_value=2,
        staging_copies=2,
        device_budget_mib=4096,
        profiled_non_input_reserve_mib=2900,
        observed_batch_latency_ms=32,
        maximum_batch_wait_ms=8,
        non_model_latency_ms=10,
        arrival_frames_per_second=100,
        deadline_ms=60,
    )
    result = evaluate_envelope(profile)

    assert round(result["staged_input_mib"], 2) == 18.75
    assert round(result["capacity_fps"], 2) == 125.00
    assert round(result["latency_envelope_ms"], 2) == 50.00
    assert result["passes"] is True

    for metric, value in result.items():
        print(f"{metric}: {value}")
