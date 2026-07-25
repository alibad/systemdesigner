"""Estimate a worker-pool envelope from one measured deployment calibration."""

from dataclasses import dataclass
from math import ceil


@dataclass(frozen=True)
class Calibration:
    width: int = 1024
    height: int = 1024
    steps: int = 24
    seconds_per_image: float = 8.4
    batch_increment: float = 0.68
    hourly_gpu_cost_usd: float = 2.50


@dataclass(frozen=True)
class Workload:
    width: int
    height: int
    steps: int
    batch_size: int
    arrival_images_per_minute: float
    gpu_count: int
    target_utilization: float = 0.70


def estimate(calibration: Calibration, workload: Workload) -> dict[str, float | int]:
    pixel_scale = (
        workload.width * workload.height
        / (calibration.width * calibration.height)
    )
    step_scale = workload.steps / calibration.steps
    batch_scale = 1 + calibration.batch_increment * (workload.batch_size - 1)
    batch_seconds = calibration.seconds_per_image * pixel_scale * step_scale * batch_scale

    images_per_minute_per_gpu = 60 * workload.batch_size / batch_seconds
    pool_capacity = workload.gpu_count * images_per_minute_per_gpu
    utilization = workload.arrival_images_per_minute / pool_capacity
    required_gpus = ceil(
        workload.arrival_images_per_minute
        / (images_per_minute_per_gpu * workload.target_utilization)
    )
    cost_per_image = (
        batch_seconds / 3_600
        * calibration.hourly_gpu_cost_usd
        / workload.batch_size
    )

    return {
        "batch_seconds": round(batch_seconds, 2),
        "pool_images_per_minute": round(pool_capacity, 2),
        "utilization_percent": round(utilization * 100, 1),
        "required_gpus_at_target": required_gpus,
        "modeled_gpu_cost_per_image_usd": round(cost_per_image, 4),
    }


if __name__ == "__main__":
    result = estimate(
        Calibration(),
        Workload(
            width=768,
            height=768,
            steps=16,
            batch_size=2,
            arrival_images_per_minute=24,
            gpu_count=4,
        ),
    )
    for metric, value in result.items():
        print(f"{metric}: {value}")
