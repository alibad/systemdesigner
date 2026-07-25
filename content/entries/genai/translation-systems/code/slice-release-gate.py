"""Require every governed translation slice to pass before release."""

from dataclasses import dataclass


@dataclass(frozen=True)
class SliceEvidence:
    name: str
    semantic_score: float
    terminology_percent: float
    placeholder_percent: float
    critical_errors: int
    p95_ms: int


@dataclass(frozen=True)
class ReleasePolicy:
    semantic_floor: float
    terminology_floor: float
    placeholder_floor: float
    max_critical_errors: int
    p95_budget_ms: int


def failures(evidence: SliceEvidence, policy: ReleasePolicy) -> list[str]:
    checks = {
        "semantic score": evidence.semantic_score >= policy.semantic_floor,
        "terminology preservation": evidence.terminology_percent >= policy.terminology_floor,
        "placeholder preservation": evidence.placeholder_percent >= policy.placeholder_floor,
        "critical error count": evidence.critical_errors <= policy.max_critical_errors,
        "p95 latency": evidence.p95_ms <= policy.p95_budget_ms,
    }
    return [name for name, passed in checks.items() if not passed]


def release_decision(slices: list[SliceEvidence], policy: ReleasePolicy) -> dict[str, list[str]]:
    return {item.name: failures(item, policy) for item in slices if failures(item, policy)}


if __name__ == "__main__":
    policy = ReleasePolicy(82.0, 95.0, 100.0, 0, 500)
    evidence = [
        SliceEvidence("es-support", 89.0, 99.0, 100.0, 0, 240),
        SliceEvidence("ar-emergency", 84.0, 92.0, 100.0, 2, 620),
    ]
    blocked_slices = release_decision(evidence, policy)
    assert blocked_slices == {
        "ar-emergency": ["terminology preservation", "critical error count", "p95 latency"]
    }
    print({"release": not blocked_slices, "blocked_slices": blocked_slices})
