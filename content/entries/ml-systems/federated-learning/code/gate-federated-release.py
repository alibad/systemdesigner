"""Gate a federated model release using facts from trusted evaluators."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ReleaseEvidence:
    round_id: str
    survivors: int
    required_survivors: int
    epsilon_spent: float
    epsilon_budget: float
    clipped_update_fraction: float
    worst_slice_regression_pp: float
    backdoor_success_rate: float


def release_failures(evidence: ReleaseEvidence) -> list[str]:
    """Return explicit failed gates; an empty result permits canary rollout."""
    failures: list[str] = []

    if evidence.survivors < evidence.required_survivors:
        failures.append("secure-aggregation survivor quorum")
    if evidence.epsilon_spent > evidence.epsilon_budget:
        failures.append("cumulative privacy budget")
    if evidence.clipped_update_fraction > 0.30:
        failures.append("unexpected contribution clipping")
    if evidence.worst_slice_regression_pp > 1.5:
        failures.append("worst client-slice quality")
    if evidence.backdoor_success_rate > 0.02:
        failures.append("poisoning canary")

    return failures


if __name__ == "__main__":
    healthy = ReleaseEvidence(
        round_id="round-0084",
        survivors=184,
        required_survivors=160,
        epsilon_spent=2.4,
        epsilon_budget=4.0,
        clipped_update_fraction=0.08,
        worst_slice_regression_pp=0.4,
        backdoor_success_rate=0.006,
    )
    suspicious = ReleaseEvidence(
        round_id="round-0085",
        survivors=177,
        required_survivors=160,
        epsilon_spent=2.6,
        epsilon_budget=4.0,
        clipped_update_fraction=0.41,
        worst_slice_regression_pp=2.2,
        backdoor_success_rate=0.09,
    )

    assert release_failures(healthy) == []
    assert release_failures(suspicious) == [
        "unexpected contribution clipping",
        "worst client-slice quality",
        "poisoning canary",
    ]

    print(f"{healthy.round_id}: eligible for canary rollout")
    print(f"{suspicious.round_id}: blocked by {', '.join(release_failures(suspicious))}")
