"""Small, deterministic capacity model for a video-generation queue."""

from dataclasses import asdict, dataclass
from math import ceil


@dataclass(frozen=True)
class GenerationProfile:
    duration_seconds: int
    generated_fps: int
    width: int
    height: int
    sampling_steps: int
    measured_baseline_seconds: float


@dataclass(frozen=True)
class ServingEnvelope:
    frame_count: int
    service_seconds: float
    required_gpus: int
    jobs_per_gpu_hour: float
    compute_cost_per_job: float


def estimate_envelope(
    profile: GenerationProfile,
    arrivals_per_hour: int,
    target_utilization: float,
    gpu_hourly_price: float,
) -> ServingEnvelope:
    """Scale a measured 6 s, 720p, 12 fps, 30-step baseline."""
    if not 0 < target_utilization < 1:
        raise ValueError("target_utilization must be between zero and one")
    if arrivals_per_hour < 0 or gpu_hourly_price < 0:
        raise ValueError("arrival rate and price cannot be negative")

    frame_count = profile.duration_seconds * profile.generated_fps
    pixel_ratio = (profile.width * profile.height) / (1280 * 720)
    frame_ratio = frame_count / (6 * 12)
    step_ratio = profile.sampling_steps / 30
    service_seconds = (
        profile.measured_baseline_seconds
        * pixel_ratio
        * frame_ratio
        * step_ratio
    )
    offered_gpu_seconds = arrivals_per_hour * service_seconds
    required_gpus = ceil(offered_gpu_seconds / (3600 * target_utilization))

    return ServingEnvelope(
        frame_count=frame_count,
        service_seconds=round(service_seconds, 2),
        required_gpus=required_gpus,
        jobs_per_gpu_hour=round(3600 / service_seconds, 2),
        compute_cost_per_job=round(
            service_seconds / 3600 * gpu_hourly_price,
            4,
        ),
    )


if __name__ == "__main__":
    candidate = GenerationProfile(
        duration_seconds=10,
        generated_fps=12,
        width=1280,
        height=720,
        sampling_steps=30,
        measured_baseline_seconds=48,
    )
    result = estimate_envelope(
        candidate,
        arrivals_per_hour=600,
        target_utilization=0.70,
        gpu_hourly_price=2.50,
    )
    assert result.frame_count == 120
    assert result.required_gpus == 20
    print(asdict(result))
