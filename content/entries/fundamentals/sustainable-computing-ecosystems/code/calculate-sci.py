from dataclasses import dataclass


@dataclass(frozen=True)
class Measurement:
    energy_kwh: float
    grid_intensity_g_per_kwh: float
    allocated_embodied_g: float
    functional_units: float

    def validate(self) -> None:
        if self.energy_kwh < 0 or self.grid_intensity_g_per_kwh < 0:
            raise ValueError("energy and grid intensity cannot be negative")
        if self.allocated_embodied_g < 0:
            raise ValueError("allocated embodied emissions cannot be negative")
        if self.functional_units <= 0:
            raise ValueError("functional units must be positive")


def software_carbon_intensity(measurement: Measurement) -> float:
    measurement.validate()
    operational_g = measurement.energy_kwh * measurement.grid_intensity_g_per_kwh
    return (operational_g + measurement.allocated_embodied_g) / measurement.functional_units


baseline = Measurement(energy_kwh=180, grid_intensity_g_per_kwh=420,
                       allocated_embodied_g=22_000, functional_units=100_000)
candidate = Measurement(energy_kwh=160, grid_intensity_g_per_kwh=260,
                        allocated_embodied_g=22_000, functional_units=100_000)

print(f"baseline: {software_carbon_intensity(baseline):.3f} gCO2e/unit")
print(f"candidate: {software_carbon_intensity(candidate):.3f} gCO2e/unit")
