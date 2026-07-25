"""Estimate a Glue-style job envelope from explicit benchmark assumptions."""

from dataclasses import dataclass


@dataclass(frozen=True)
class JobPlan:
    input_gib: float
    file_count: int
    workers: int
    dpu_per_worker: float
    throughput_gib_per_worker_hour: float
    complexity_factor: float = 1.0
    file_open_seconds: float = 0.02
    dpu_hour_usd: float = 0.44

    def estimate(self) -> dict[str, float]:
        scan_hours = (
            self.input_gib * self.complexity_factor
            / (self.workers * self.throughput_gib_per_worker_hour)
        )
        file_hours = self.file_count * self.file_open_seconds / self.workers / 3600
        runtime_hours = scan_hours + file_hours
        dpu_hours = self.workers * self.dpu_per_worker * runtime_hours
        return {
            "runtime_minutes": runtime_hours * 60,
            "dpu_hours": dpu_hours,
            "compute_usd": dpu_hours * self.dpu_hour_usd,
            "average_file_mib": self.input_gib * 1024 / self.file_count,
        }


if __name__ == "__main__":
    result = JobPlan(800, 4000, 12, 1, 55, 1.2).estimate()
    assert result["runtime_minutes"] > 0
    assert result["dpu_hours"] > 0
    print(f"runtime: {result['runtime_minutes']:.1f} minutes")
    print(f"DPU-hours: {result['dpu_hours']:.2f}")
    print(f"compute assumption: ${result['compute_usd']:.2f}")
    print(f"average input object: {result['average_file_mib']:.1f} MiB")
