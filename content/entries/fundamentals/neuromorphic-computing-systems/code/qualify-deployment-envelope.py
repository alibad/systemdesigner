from dataclasses import dataclass


@dataclass(frozen=True)
class Envelope:
    latency_budget_ms: float
    quality_floor: float
    capacity_units_per_second: float


def qualify(
    *,
    routed_work_per_second: float,
    observed_latency_ms: float,
    observed_quality: float,
    envelope: Envelope,
) -> dict[str, object]:
    checks = {
        "capacity": routed_work_per_second
        <= envelope.capacity_units_per_second,
        "latency": observed_latency_ms <= envelope.latency_budget_ms,
        "quality": observed_quality >= envelope.quality_floor,
    }

    return {
        "qualified": all(checks.values()),
        "checks": checks,
        "failed_boundaries": [
            name for name, passed in checks.items() if not passed
        ],
    }


result = qualify(
    routed_work_per_second=510_000,
    observed_latency_ms=19.4,
    observed_quality=93.1,
    envelope=Envelope(
        latency_budget_ms=24,
        quality_floor=92,
        capacity_units_per_second=760_000,
    ),
)

print(result)
