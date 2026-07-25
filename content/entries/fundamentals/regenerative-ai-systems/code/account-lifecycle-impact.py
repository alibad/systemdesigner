"""Estimate an AI service footprint without hiding its accounting boundary."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ImpactInputs:
    monthly_outcomes: int
    watt_hours_per_thousand_outcomes: float
    grid_intensity_gco2e_per_kwh: float
    annual_allocated_hardware_kgco2e: float
    monthly_data_and_network_kgco2e: float


@dataclass(frozen=True)
class ImpactLedger:
    operational_kgco2e: float
    hardware_kgco2e: float
    data_and_network_kgco2e: float
    total_kgco2e: float
    grams_per_thousand_outcomes: float


def account_impact(inputs: ImpactInputs) -> ImpactLedger:
    if inputs.monthly_outcomes <= 0:
        raise ValueError("monthly_outcomes must be positive")

    monthly_energy_kwh = (
        inputs.monthly_outcomes
        / 1_000
        * inputs.watt_hours_per_thousand_outcomes
        / 1_000
    )
    operational = monthly_energy_kwh * inputs.grid_intensity_gco2e_per_kwh / 1_000
    hardware = inputs.annual_allocated_hardware_kgco2e / 12
    total = operational + hardware + inputs.monthly_data_and_network_kgco2e
    intensity = total * 1_000 / (inputs.monthly_outcomes / 1_000)

    return ImpactLedger(
        operational_kgco2e=operational,
        hardware_kgco2e=hardware,
        data_and_network_kgco2e=inputs.monthly_data_and_network_kgco2e,
        total_kgco2e=total,
        grams_per_thousand_outcomes=intensity,
    )


if __name__ == "__main__":
    baseline = account_impact(
        ImpactInputs(
            monthly_outcomes=8_000_000,
            watt_hours_per_thousand_outcomes=180,
            grid_intensity_gco2e_per_kwh=320,
            annual_allocated_hardware_kgco2e=2_400,
            monthly_data_and_network_kgco2e=90,
        )
    )

    assert round(baseline.operational_kgco2e, 1) == 460.8
    assert round(baseline.total_kgco2e, 1) == 750.8
    assert round(baseline.grams_per_thousand_outcomes, 2) == 93.85
    print(f"monthly footprint: {baseline.total_kgco2e:.1f} kgCO2e")
    print(f"intensity: {baseline.grams_per_thousand_outcomes:.2f} gCO2e / 1k outcomes")
