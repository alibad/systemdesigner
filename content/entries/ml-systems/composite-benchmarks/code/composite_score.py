"""Direction-aware composite scoring with preserved component evidence."""

from __future__ import annotations

from dataclasses import dataclass
from math import exp, log
from typing import Literal, Mapping

Aggregation = Literal["arithmetic", "geometric", "worst_case"]
MissingPolicy = Literal["block", "baseline", "renormalize"]


@dataclass(frozen=True)
class Component:
    name: str
    baseline: float
    reference: float
    higher_is_better: bool


@dataclass(frozen=True)
class CompositeResult:
    score: float
    normalized_components: Mapping[str, float]
    effective_weights: Mapping[str, float]
    missing_components: tuple[str, ...]


def normalize(value: float, component: Component) -> float:
    """Map a raw value to [0, 100] between a declared baseline and reference."""
    if component.baseline == component.reference:
        raise ValueError(f"{component.name}: baseline and reference must differ")

    if component.higher_is_better:
        ratio = (value - component.baseline) / (
            component.reference - component.baseline
        )
    else:
        ratio = (component.baseline - value) / (
            component.baseline - component.reference
        )
    return min(100.0, max(0.0, ratio * 100.0))


def composite_score(
    *,
    components: Mapping[str, Component],
    raw_scores: Mapping[str, float | None],
    weights: Mapping[str, float],
    aggregation: Aggregation,
    missing_policy: MissingPolicy = "block",
) -> CompositeResult:
    unknown = set(weights) - set(components)
    if unknown:
        raise ValueError(f"weights reference unknown components: {sorted(unknown)}")
    if any(weight < 0 for weight in weights.values()):
        raise ValueError("weights must be non-negative")

    normalized: dict[str, float] = {}
    missing: list[str] = []
    for component_id, component in components.items():
        raw_value = raw_scores.get(component_id)
        if raw_value is None:
            missing.append(component_id)
            if missing_policy == "baseline":
                normalized[component_id] = 0.0
            continue
        normalized[component_id] = normalize(raw_value, component)

    if missing and missing_policy == "block":
        raise ValueError(f"missing required components: {missing}")

    active_weights = {
        component_id: weights.get(component_id, 0.0)
        for component_id in normalized
    }
    total_weight = sum(active_weights.values())
    if total_weight <= 0:
        raise ValueError("at least one scored component needs positive weight")
    effective_weights = {
        component_id: weight / total_weight
        for component_id, weight in active_weights.items()
    }

    if aggregation == "arithmetic":
        score = sum(
            normalized[component_id] * weight
            for component_id, weight in effective_weights.items()
        )
    elif aggregation == "geometric":
        score = exp(
            sum(
                weight * log(max(normalized[component_id], 1e-9))
                for component_id, weight in effective_weights.items()
            )
        )
    elif aggregation == "worst_case":
        score = min(normalized.values())
    else:
        raise ValueError(f"unsupported aggregation: {aggregation}")

    return CompositeResult(
        score=score,
        normalized_components=normalized,
        effective_weights=effective_weights,
        missing_components=tuple(missing),
    )


if __name__ == "__main__":
    COMPONENTS = {
        "quality": Component("Task success", 25, 100, True),
        "latency": Component("Latency in milliseconds", 1_000, 100, False),
    }
    result = composite_score(
        components=COMPONENTS,
        raw_scores={"quality": 85, "latency": 280},
        weights={"quality": 3, "latency": 1},
        aggregation="arithmetic",
    )
    print(result)
