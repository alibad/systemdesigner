from dataclasses import dataclass


@dataclass(frozen=True)
class Workload:
    requests_per_second: int
    duration_ms: int
    cold_start_ms: int
    concurrency_quota: int
    deadline_ms: int


def evaluate(workload: Workload) -> dict[str, float | int | bool]:
    required_concurrency = -(
        -workload.requests_per_second * workload.duration_ms // 1_000
    )
    pressure = required_concurrency / workload.concurrency_quota
    cold_deadline_ok = workload.duration_ms + workload.cold_start_ms <= workload.deadline_ms
    return {
        "required_concurrency": required_concurrency,
        "quota_pressure": round(pressure, 2),
        "warm_deadline_ok": workload.duration_ms <= workload.deadline_ms,
        "cold_deadline_ok": cold_deadline_ok,
        "fits": pressure <= 0.8 and cold_deadline_ok,
    }


if __name__ == "__main__":
    candidate = Workload(120, 180, 1_400, 80, 500)
    print(evaluate(candidate))
