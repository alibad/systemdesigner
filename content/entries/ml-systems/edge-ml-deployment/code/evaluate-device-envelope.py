"""Evaluate measured edge-device limits without predicting performance or quality."""

from dataclasses import dataclass


@dataclass(frozen=True)
class DeviceEvidence:
    available_memory_mib: float
    memory_reserve_pct: float
    app_baseline_mib: float
    model_peak_mib: float
    free_storage_mib: float
    candidate_bundle_mib: float
    rollback_bundle_mib: float
    measured_warm_p95_ms: float
    product_deadline_ms: float


def evaluate(evidence: DeviceEvidence) -> dict[str, object]:
    memory_ceiling = evidence.available_memory_mib * (
        1 - evidence.memory_reserve_pct / 100
    )
    memory_demand = evidence.app_baseline_mib + evidence.model_peak_mib
    storage_demand = evidence.candidate_bundle_mib + evidence.rollback_bundle_mib

    gates = {
        "memory": memory_demand <= memory_ceiling,
        "storage": storage_demand <= evidence.free_storage_mib,
        "latency": evidence.measured_warm_p95_ms <= evidence.product_deadline_ms,
    }
    return {
        "gates": gates,
        "eligible_for_cohort_test": all(gates.values()),
        "memory_margin_mib": round(memory_ceiling - memory_demand, 1),
        "storage_margin_mib": round(evidence.free_storage_mib - storage_demand, 1),
        "latency_margin_ms": round(
            evidence.product_deadline_ms - evidence.measured_warm_p95_ms, 1
        ),
        "unmeasured_gates": [
            "task quality by slice",
            "energy",
            "sustained thermal behavior",
            "operator and delegate compatibility",
        ],
    }


if __name__ == "__main__":
    sample = DeviceEvidence(
        available_memory_mib=384,
        memory_reserve_pct=20,
        app_baseline_mib=176,
        model_peak_mib=152,
        free_storage_mib=256,
        candidate_bundle_mib=48,
        rollback_bundle_mib=44,
        measured_warm_p95_ms=60,
        product_deadline_ms=50,
    )
    result = evaluate(sample)
    print(result)
    assert result["gates"] == {
        "memory": False,
        "storage": True,
        "latency": False,
    }
    assert result["eligible_for_cohort_test"] is False
