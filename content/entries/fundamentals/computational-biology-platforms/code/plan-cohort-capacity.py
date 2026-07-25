from dataclasses import dataclass


GIB_BYTES = 1024**3
GBIT_BYTES = 1_000_000_000 / 8


@dataclass(frozen=True)
class CohortPlan:
    samples: int
    raw_gib_per_sample: float
    derived_to_raw_ratio: float
    retained_copies: int
    sustained_network_gbps: float
    worker_slot_hours_per_sample: float
    worker_slots: int
    worker_utilization: float = 0.75

    def validate(self) -> None:
        if self.samples <= 0 or self.worker_slots <= 0:
            raise ValueError("samples and worker_slots must be positive")
        if self.raw_gib_per_sample <= 0 or self.sustained_network_gbps <= 0:
            raise ValueError("data size and sustained network rate must be positive")
        if self.derived_to_raw_ratio < 0 or self.retained_copies <= 0:
            raise ValueError("derived ratio cannot be negative; copies must be positive")
        if not 0 < self.worker_utilization <= 1:
            raise ValueError("worker_utilization must be in (0, 1]")


def calculate(plan: CohortPlan) -> dict[str, float]:
    """Return transparent planning bounds, not a runtime or cost guarantee."""
    plan.validate()
    raw_gib = plan.samples * plan.raw_gib_per_sample
    derived_gib = raw_gib * plan.derived_to_raw_ratio
    retained_gib = (raw_gib + derived_gib) * plan.retained_copies
    transfer_seconds = raw_gib * GIB_BYTES / (
        plan.sustained_network_gbps * GBIT_BYTES
    )
    effective_slots = plan.worker_slots * plan.worker_utilization
    compute_days = (
        plan.samples * plan.worker_slot_hours_per_sample / effective_slots / 24
    )
    return {
        "raw_gib": raw_gib,
        "derived_gib": derived_gib,
        "retained_gib": retained_gib,
        "minimum_transfer_hours": transfer_seconds / 3600,
        "compute_slot_days": compute_days,
        "samples_per_day": effective_slots * 24 / plan.worker_slot_hours_per_sample,
    }


example = CohortPlan(
    samples=500,
    raw_gib_per_sample=120,
    derived_to_raw_ratio=1.5,
    retained_copies=2,
    sustained_network_gbps=5,
    worker_slot_hours_per_sample=16,
    worker_slots=128,
)

for name, value in calculate(example).items():
    print(f"{name}: {value:,.2f}")
