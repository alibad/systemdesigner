from dataclasses import dataclass


@dataclass(frozen=True)
class Requirement:
    capability: str
    maximum_staleness_hours: float


@dataclass(frozen=True)
class Adaptation:
    name: str
    capabilities: frozenset[str]
    update_hours: float
    operating_weight: int
    changes_weights: bool


ADAPTATIONS = (
    Adaptation(
        name="request prompt",
        capabilities=frozenset({"temporary-behavior", "output-format"}),
        update_hours=0.0,
        operating_weight=1,
        changes_weights=False,
    ),
    Adaptation(
        name="retrieval",
        capabilities=frozenset({"fresh-knowledge", "source-attribution"}),
        update_hours=0.25,
        operating_weight=2,
        changes_weights=False,
    ),
    Adaptation(
        name="supervised adapter",
        capabilities=frozenset({"stable-behavior", "domain-pattern"}),
        update_hours=72.0,
        operating_weight=3,
        changes_weights=True,
    ),
    Adaptation(
        name="preference-tuned checkpoint",
        capabilities=frozenset({"ranked-preference", "broad-behavior"}),
        update_hours=168.0,
        operating_weight=4,
        changes_weights=True,
    ),
)


def choose_smallest_fit(requirement: Requirement) -> Adaptation:
    candidates = [
        method
        for method in ADAPTATIONS
        if requirement.capability in method.capabilities
        and method.update_hours <= requirement.maximum_staleness_hours
    ]
    if not candidates:
        raise ValueError("No adaptation satisfies capability and freshness constraints")
    return min(candidates, key=lambda method: method.operating_weight)


if __name__ == "__main__":
    policy_assistant = Requirement(
        capability="fresh-knowledge",
        maximum_staleness_hours=1.0,
    )
    selection = choose_smallest_fit(policy_assistant)
    print(
        f"Use {selection.name}; changes_weights={selection.changes_weights}, "
        f"update_hours={selection.update_hours}"
    )
