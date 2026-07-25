"""Evaluate whether a runtime monitor and fallback fit a hazard window."""

from dataclasses import dataclass


@dataclass(frozen=True)
class FaultScenario:
    hazard_window_ms: int
    severity: int
    base_escape_probability: float
    required_evidence_coverage: float


@dataclass(frozen=True)
class RuntimeMonitor:
    latency_multiplier: float
    fault_coverage: float
    common_cause_penalty: float


@dataclass(frozen=True)
class Fallback:
    settle_time_ms: int
    risk_reduction: float


def evaluate_gate(
    scenario: FaultScenario,
    monitor: RuntimeMonitor,
    fallback: Fallback,
    detection_latency_ms: int,
    evidence_coverage: float,
) -> dict[str, float | bool]:
    """Check timing, residual risk, and evaluation evidence independently."""
    monitor_time = detection_latency_ms * monitor.latency_multiplier
    response_time = monitor_time + fallback.settle_time_ms
    time_margin = scenario.hazard_window_ms - response_time
    uncovered_fault_share = min(
        1.0,
        max(0.0, 1.0 - monitor.fault_coverage + monitor.common_cause_penalty),
    )
    escape_probability = (
        scenario.base_escape_probability
        * uncovered_fault_share
        * (1.0 - fallback.risk_reduction)
    )
    residual_risk_index = escape_probability * scenario.severity * 100

    timing_pass = time_margin >= 0
    risk_pass = residual_risk_index <= 5.0
    coverage_pass = evidence_coverage >= scenario.required_evidence_coverage
    return {
        "response_time_ms": round(response_time, 1),
        "time_margin_ms": round(time_margin, 1),
        "residual_risk_index": round(residual_risk_index, 2),
        "timing_pass": timing_pass,
        "risk_pass": risk_pass,
        "coverage_pass": coverage_pass,
        "release_ready": timing_pass and risk_pass and coverage_pass,
    }


if __name__ == "__main__":
    camera_occlusion = FaultScenario(650, 4, 0.18, 82)
    independent_monitor = RuntimeMonitor(0.78, 0.97, 0.02)
    limited_motion = Fallback(260, 0.72)
    result = evaluate_gate(
        camera_occlusion,
        independent_monitor,
        limited_motion,
        detection_latency_ms=90,
        evidence_coverage=86,
    )
    print(result)
