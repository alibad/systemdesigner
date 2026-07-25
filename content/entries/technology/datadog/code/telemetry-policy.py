"""Transparent retention arithmetic used by the lesson's telemetry lab."""

from dataclasses import dataclass

SECONDS_PER_DAY = 86_400


@dataclass(frozen=True)
class Workload:
    requests_per_second: int
    error_percent: float
    logs_per_request: int
    spans_per_trace: int


def retained_events(
    workload: Workload,
    healthy_log_percent: float,
    healthy_trace_percent: float,
    keep_all_failures: bool,
) -> dict[str, int]:
    """Return daily retained counts without assuming vendor prices or compression."""
    requests = workload.requests_per_second * SECONDS_PER_DAY
    failures = requests * workload.error_percent / 100
    healthy = requests - failures
    failure_rate = 1.0 if keep_all_failures else healthy_log_percent / 100
    trace_failure_rate = 1.0 if keep_all_failures else healthy_trace_percent / 100

    logs = (
        healthy * workload.logs_per_request * healthy_log_percent / 100
        + failures * workload.logs_per_request * failure_rate
    )
    spans = (
        healthy * workload.spans_per_trace * healthy_trace_percent / 100
        + failures * workload.spans_per_trace * trace_failure_rate
    )
    return {"logs": round(logs), "spans": round(spans)}


if __name__ == "__main__":
    checkout = Workload(2500, 1.2, 3, 8)
    protected = retained_events(checkout, 20, 10, keep_all_failures=True)
    uniform = retained_events(checkout, 20, 10, keep_all_failures=False)

    assert protected["logs"] > uniform["logs"]
    assert protected["spans"] > uniform["spans"]
    print({"protected_failures": protected, "uniform_sampling": uniform})
