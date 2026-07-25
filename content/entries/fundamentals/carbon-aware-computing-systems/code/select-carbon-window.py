from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class Workload:
    energy_kwh: float
    data_to_copy_gb: float
    latest_start_hour: int
    allowed_regions: frozenset[str]


@dataclass(frozen=True)
class Candidate:
    region: str
    start_hour: int
    grid_intensity_g_per_kwh: float


@dataclass(frozen=True)
class Estimate:
    candidate: Candidate
    compute_kg_co2e: float
    transfer_kg_co2e: float

    @property
    def total_kg_co2e(self) -> float:
        return self.compute_kg_co2e + self.transfer_kg_co2e


def estimate_candidate(
    workload: Workload,
    candidate: Candidate,
    *,
    home_region: str,
    transfer_energy_kwh_per_gb: float,
    transfer_intensity_g_per_kwh: float,
) -> Estimate:
    compute_kg = (
        workload.energy_kwh
        * candidate.grid_intensity_g_per_kwh
        / 1_000
    )

    crosses_region = candidate.region != home_region
    transfer_energy_kwh = (
        workload.data_to_copy_gb * transfer_energy_kwh_per_gb
        if crosses_region
        else 0
    )
    transfer_kg = (
        transfer_energy_kwh
        * transfer_intensity_g_per_kwh
        / 1_000
    )

    return Estimate(candidate, compute_kg, transfer_kg)


def select_lowest_feasible(
    workload: Workload,
    candidates: Iterable[Candidate],
    *,
    home_region: str,
    transfer_energy_kwh_per_gb: float,
    transfer_intensity_g_per_kwh: float,
) -> Estimate | None:
    feasible = (
        candidate
        for candidate in candidates
        if candidate.start_hour <= workload.latest_start_hour
        and candidate.region in workload.allowed_regions
    )
    estimates = (
        estimate_candidate(
            workload,
            candidate,
            home_region=home_region,
            transfer_energy_kwh_per_gb=transfer_energy_kwh_per_gb,
            transfer_intensity_g_per_kwh=transfer_intensity_g_per_kwh,
        )
        for candidate in feasible
    )

    return min(estimates, key=lambda estimate: estimate.total_kg_co2e, default=None)


# Supply time-stamped grid forecasts and measured workload energy in production.
# The scheduler should also check capacity, residency, cost, and reliability policy
# before it treats a candidate as feasible.
